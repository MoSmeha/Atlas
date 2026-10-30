import { describe, expect, it } from 'vitest';
import { AppError } from '../../src/application/errors';
import { type CommandResult, NativeFolderPicker, type RunCommand } from '../../src/infrastructure/dialog/NativeFolderPicker';

interface Call {
  command: string;
  args: string[];
  env: Record<string, string>;
}

/** A command runner that records each call and answers with the given result, or fails to start when given an error. */
function runner(answer: Partial<CommandResult> | Error): { run: RunCommand; calls: Call[] } {
  const calls: Call[] = [];
  const run: RunCommand = async (command, args, env) => {
    calls.push({ command, args, env });
    if (answer instanceof Error) throw answer;
    return { exitCode: 0, stdout: '', stderr: '', ...answer };
  };
  return { run, calls };
}

describe('NativeFolderPicker', () => {
  it('opens the Explorer folder window through PowerShell on Windows, with the title in the environment', async () => {
    const { run, calls } = runner({ stdout: 'C:\\Projects\\مشروع الرياض\r\n' });
    const path = await new NativeFolderPicker('win32', run).pick('اختر مجلد المشروع');
    expect(path).toBe('C:\\Projects\\مشروع الرياض');
    expect(calls[0]?.command).toBe('powershell.exe');
    expect(calls[0]?.args).toContain('-STA');
    expect(calls[0]?.env).toEqual({ ATLAS_PICKER_TITLE: 'اختر مجلد المشروع' });
    const script = Buffer.from(calls[0]?.args.at(-1) ?? '', 'base64').toString('utf16le');
    expect(script).toContain('PickFolders = 0x20');
    expect(script).not.toContain('اختر');
  });

  it('keeps the slash of a drive root', async () => {
    const { run } = runner({ stdout: 'D:\\' });
    expect(await new NativeFolderPicker('win32', run).pick('Choose')).toBe('D:\\');
  });

  it('answers null when the Windows window is closed without a folder', async () => {
    const { run } = runner({ stdout: '' });
    expect(await new NativeFolderPicker('win32', run).pick('Choose')).toBeNull();
  });

  it('asks Finder on macOS, passing the title as an argument and dropping the trailing slash', async () => {
    const { run, calls } = runner({ stdout: '/Users/me/Riyadh Tower/\n' });
    expect(await new NativeFolderPicker('darwin', run).pick('Choose "the" folder')).toBe('/Users/me/Riyadh Tower');
    expect(calls[0]?.command).toBe('osascript');
    expect(calls[0]?.args.at(-1)).toBe('Choose "the" folder');
    expect(calls[0]?.args.filter((arg) => arg.includes('the" folder'))).toHaveLength(1);
  });

  it('answers null when Finder reports that the person cancelled', async () => {
    const { run } = runner({ exitCode: 1, stderr: 'execution error: User canceled. (-128)' });
    expect(await new NativeFolderPicker('darwin', run).pick('Choose')).toBeNull();
  });

  it('uses zenity on Linux, where closing the window exits with 1', async () => {
    const { run, calls } = runner({ exitCode: 1 });
    expect(await new NativeFolderPicker('linux', run).pick('Choose')).toBeNull();
    expect(calls[0]?.args).toEqual(['--file-selection', '--directory', '--title=Choose']);
  });

  it('explains that the path must be typed when no folder window can be opened', async () => {
    await expect(new NativeFolderPicker('linux', runner(new Error('spawn zenity ENOENT')).run).pick('Choose')).rejects.toThrow(
      AppError,
    );
    await expect(new NativeFolderPicker('aix', runner({}).run).pick('Choose')).rejects.toThrow(/Type the folder's path instead/);
    await expect(new NativeFolderPicker('win32', runner({ exitCode: 1, stderr: 'boom' }).run).pick('Choose')).rejects.toThrow(
      AppError,
    );
  });

  it('opens one window at a time: a second request while it is open gets the same answer', async () => {
    let finish: (result: CommandResult) => void = () => undefined;
    let starts = 0;
    const run: RunCommand = () => {
      starts += 1;
      return new Promise((resolve) => {
        finish = resolve;
      });
    };
    const picker = new NativeFolderPicker('win32', run);
    const first = picker.pick('Choose');
    const second = picker.pick('Choose');
    finish({ exitCode: 0, stdout: 'C:\\Projects', stderr: '' });
    expect(await Promise.all([first, second])).toEqual(['C:\\Projects', 'C:\\Projects']);
    expect(starts).toBe(1);

    const third = picker.pick('Choose');
    finish({ exitCode: 0, stdout: '', stderr: '' });
    expect(await third).toBeNull();
    expect(starts).toBe(2);
  });
});
