import { execFile } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import { totalmem } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);
const COMMAND_TIMEOUT_MS = 3_000;
/** Where Windows keeps one key per display adapter; qwMemorySize holds its dedicated memory as 64 bits. */
const DISPLAY_ADAPTERS = 'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}';

/** The memory a local model can use. */
export interface Machine {
  ramBytes: number;
  /** Dedicated memory of the largest graphics card; null when there is none or it could not be read. */
  gpuBytes: number | null;
  /** Apple silicon, where the graphics share the main memory. */
  unifiedMemory: boolean;
}

/** Reads RAM and graphics memory. Each probe that fails or is missing counts as no reading; it never throws. */
export async function scanMachine(): Promise<Machine> {
  const unifiedMemory = process.platform === 'darwin' && process.arch === 'arm64';
  return { ramBytes: totalmem(), gpuBytes: unifiedMemory ? null : await gpuMemory(), unifiedMemory };
}

async function gpuMemory(): Promise<number | null> {
  const readings = await Promise.all([
    output('nvidia-smi', ['--query-gpu=memory.total', '--format=csv,noheader,nounits']).then(parseNvidiaSmi),
    process.platform === 'win32'
      ? output('reg', ['query', DISPLAY_ADAPTERS, '/s', '/v', 'HardwareInformation.qwMemorySize']).then(parseRegistryMemory)
      : null,
    process.platform === 'linux' ? linuxVram() : null,
  ]);
  const known = readings.filter((bytes) => bytes !== null && bytes > 0) as number[];
  return known.length > 0 ? Math.max(...known) : null;
}

/** nvidia-smi prints one line per card, in MiB. */
export function parseNvidiaSmi(text: string | null): number | null {
  const sizes = (text ?? '').split(/\r?\n/).map((line) => Number(line.trim())).filter((mib) => Number.isFinite(mib) && mib > 0);
  return sizes.length > 0 ? Math.max(...sizes) * 1024 * 1024 : null;
}

/** `reg query` prints `HardwareInformation.qwMemorySize    REG_QWORD    0x3fb000000` for each adapter. */
export function parseRegistryMemory(text: string | null): number | null {
  const sizes = [...(text ?? '').matchAll(/qwMemorySize\s+REG_QWORD\s+0x([0-9a-f]+)/gi)].map((match) => Number.parseInt(match[1] ?? '', 16));
  const known = sizes.filter((bytes) => Number.isFinite(bytes) && bytes > 0);
  return known.length > 0 ? Math.max(...known) : null;
}

/** AMD cards on Linux report their memory in sysfs. */
async function linuxVram(): Promise<number | null> {
  try {
    const cards = (await readdir('/sys/class/drm')).filter((name) => /^card\d+$/.test(name));
    const sizes = await Promise.all(
      cards.map((card) =>
        readFile(join('/sys/class/drm', card, 'device', 'mem_info_vram_total'), 'utf8').then(Number, () => 0),
      ),
    );
    const known = sizes.filter((bytes) => Number.isFinite(bytes) && bytes > 0);
    return known.length > 0 ? Math.max(...known) : null;
  } catch {
    return null;
  }
}

async function output(command: string, args: string[]): Promise<string | null> {
  try {
    const { stdout } = await run(command, args, { timeout: COMMAND_TIMEOUT_MS, windowsHide: true });
    return stdout;
  } catch {
    return null;
  }
}
