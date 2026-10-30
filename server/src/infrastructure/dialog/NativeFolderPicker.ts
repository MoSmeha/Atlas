import { execFile } from 'node:child_process';
import { errors } from '../../application/errors';
import type { FolderPicker } from '../../application/ports/FolderPicker';

/** What a dialog command printed and how it ended. */
export interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/** Runs a command to its end; rejects only when it cannot start (for example, it is not installed). */
export type RunCommand = (command: string, args: string[], env: Record<string, string>) => Promise<CommandResult>;

interface DialogCommand {
  command: string;
  args: string[];
  env: Record<string, string>;
  /** The window was closed without a folder. */
  cancelled: (result: CommandResult) => boolean;
}

/**
 * The Explorer-style folder window (IFileOpenDialog with FOS_PICKFOLDERS), which Windows PowerShell's own
 * FolderBrowserDialog is not. Its owner is an invisible topmost window centred on the screen under the mouse, so
 * the dialog opens in front of the browser that asked for it. The path is written as UTF-8 so Arabic names survive.
 */
const WINDOWS_SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
Add-Type -AssemblyName System.Windows.Forms, System.Drawing
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

public static class AtlasFolderDialog
{
    [ComImport, Guid("DC1C5A9C-E88A-4dde-A5A1-60F82A20AEF7")]
    private class FileOpenDialog { }

    [ComImport, Guid("42f85136-db7e-439c-85f1-e4075d135fc8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IFileDialog
    {
        [PreserveSig] int Show(IntPtr parent);
        void SetFileTypes(uint count, IntPtr filters);
        void SetFileTypeIndex(uint index);
        void GetFileTypeIndex(out uint index);
        void Advise(IntPtr events, out uint cookie);
        void Unadvise(uint cookie);
        void SetOptions(uint options);
        void GetOptions(out uint options);
        void SetDefaultFolder(IShellItem item);
        void SetFolder(IShellItem item);
        void GetFolder(out IShellItem item);
        void GetCurrentSelection(out IShellItem item);
        void SetFileName([MarshalAs(UnmanagedType.LPWStr)] string name);
        void GetFileName([MarshalAs(UnmanagedType.LPWStr)] out string name);
        void SetTitle([MarshalAs(UnmanagedType.LPWStr)] string title);
        void SetOkButtonLabel([MarshalAs(UnmanagedType.LPWStr)] string label);
        void SetFileNameLabel([MarshalAs(UnmanagedType.LPWStr)] string label);
        void GetResult(out IShellItem item);
    }

    [ComImport, Guid("43826D1E-E718-42EE-BC55-A1E261C37BFE"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IShellItem
    {
        void BindToHandler(IntPtr bindContext, ref Guid handler, ref Guid iid, out IntPtr result);
        void GetParent(out IShellItem parent);
        void GetDisplayName(uint form, [MarshalAs(UnmanagedType.LPWStr)] out string name);
    }

    [DllImport("user32.dll")]
    public static extern bool SetProcessDPIAware();

    private const uint PickFolders = 0x20;
    private const uint ForceFileSystem = 0x40;
    private const uint FileSystemPath = 0x80058000;
    private const int Cancelled = unchecked((int)0x800704C7);

    public static string Pick(IntPtr owner, string title)
    {
        IFileDialog dialog = (IFileDialog)new FileOpenDialog();
        try
        {
            uint options;
            dialog.GetOptions(out options);
            dialog.SetOptions(options | PickFolders | ForceFileSystem);
            dialog.SetTitle(title);
            int result = dialog.Show(owner);
            if (result == Cancelled) return null;
            Marshal.ThrowExceptionForHR(result);
            IShellItem item;
            dialog.GetResult(out item);
            string path;
            item.GetDisplayName(FileSystemPath, out path);
            return path;
        }
        finally
        {
            Marshal.ReleaseComObject(dialog);
        }
    }
}
'@
[void][AtlasFolderDialog]::SetProcessDPIAware()
$screen = [Windows.Forms.Screen]::FromPoint([Windows.Forms.Cursor]::Position).WorkingArea
$owner = New-Object Windows.Forms.Form
$owner.TopMost = $true
$owner.ShowInTaskbar = $false
$owner.FormBorderStyle = 'None'
$owner.Opacity = 0
$owner.StartPosition = 'Manual'
$owner.Bounds = New-Object Drawing.Rectangle(($screen.X + [int]($screen.Width / 4)), ($screen.Y + [int]($screen.Height / 6)), 1, 1)
$owner.Show()
$owner.Activate()
$path = [AtlasFolderDialog]::Pick($owner.Handle, $env:ATLAS_PICKER_TITLE)
$owner.Close()
if ($path) { [Console]::Out.Write($path) }
`;

/** The title travels as the script's first argument, so no text from the browser becomes AppleScript. */
const MAC_SCRIPT = ['on run argv', 'activate', 'return POSIX path of (choose folder with prompt (item 1 of argv))', 'end run'];

/** AppleScript's "User canceled." */
const MAC_CANCELLED = /\(-128\)/;

/**
 * Opens the folder window of the computer Atlas runs on: Explorer's on Windows, Finder's on macOS and zenity's on
 * Linux. Atlas's server and browser share one computer, so the window opens in front of the person who asked.
 * One window at a time: a second request while it is open waits for the same answer.
 */
export class NativeFolderPicker implements FolderPicker {
  private open: Promise<string | null> | null = null;

  constructor(
    private readonly platform: NodeJS.Platform = process.platform,
    private readonly run: RunCommand = runCommand,
  ) {}

  pick(title: string): Promise<string | null> {
    this.open ??= this.show(title).finally(() => {
      this.open = null;
    });
    return this.open;
  }

  private async show(title: string): Promise<string | null> {
    const dialog = dialogCommand(this.platform, title);
    if (dialog === null) throw errors.folderPickerUnavailable();
    let result: CommandResult;
    try {
      result = await this.run(dialog.command, dialog.args, dialog.env);
    } catch {
      throw errors.folderPickerUnavailable();
    }
    if (dialog.cancelled(result)) return null;
    if (result.exitCode !== 0) throw errors.folderPickerUnavailable();
    const path = result.stdout.trim();
    return path === '' ? null : withoutTrailingSlash(path);
  }
}

function dialogCommand(platform: NodeJS.Platform, title: string): DialogCommand | null {
  switch (platform) {
    case 'win32':
      return {
        command: 'powershell.exe',
        args: ['-NoProfile', '-NonInteractive', '-STA', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encodePowerShell(WINDOWS_SCRIPT)],
        env: { ATLAS_PICKER_TITLE: title },
        cancelled: () => false,
      };
    case 'darwin':
      return {
        command: 'osascript',
        args: [...MAC_SCRIPT.flatMap((line) => ['-e', line]), title],
        env: {},
        cancelled: (result) => result.exitCode === 1 && MAC_CANCELLED.test(result.stderr),
      };
    case 'linux':
      return {
        command: 'zenity',
        args: ['--file-selection', '--directory', `--title=${title}`],
        env: {},
        cancelled: (result) => result.exitCode === 1,
      };
    default:
      return null;
  }
}

/** -EncodedCommand takes the script as base64 of its UTF-16LE text, which needs no quoting. */
function encodePowerShell(script: string): string {
  return Buffer.from(script, 'utf16le').toString('base64');
}

/** Finder answers "/Users/me/Riyadh Tower/"; a root ("/" or "C:\") keeps its slash. */
function withoutTrailingSlash(path: string): string {
  return /^(?:[A-Za-z]:)?[\\/]$/.test(path) ? path : path.replace(/[\\/]+$/, '');
}

/** No timeout: the window stays open until the person closes it. `windowsHide` keeps PowerShell's console away. */
function runCommand(command: string, args: string[], env: Record<string, string>): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { env: { ...process.env, ...env }, windowsHide: true, encoding: 'utf8' }, (error, stdout, stderr) => {
      if (error !== null && typeof error.code !== 'number') reject(error);
      else resolve({ exitCode: error === null ? 0 : Number(error.code), stdout, stderr });
    });
  });
}
