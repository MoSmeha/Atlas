import { describe, expect, it } from 'vitest';
import { parseNvidiaSmi, parseRegistryMemory } from '../../../src/infrastructure/local/scanMachine';

describe('parseNvidiaSmi', () => {
  it('takes the largest card, in MiB', () => {
    expect(parseNvidiaSmi('8192\n24576\n')).toBe(24576 * 1024 * 1024);
    expect(parseNvidiaSmi('')).toBeNull();
    expect(parseNvidiaSmi(null)).toBeNull();
  });
});

describe('parseRegistryMemory', () => {
  it('reads the 64-bit memory size of each display adapter and takes the largest', () => {
    const output = [
      'HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}\\0000',
      '    HardwareInformation.qwMemorySize    REG_QWORD    0x20000000',
      '',
      'HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}\\0001',
      '    HardwareInformation.qwMemorySize    REG_QWORD    0x3fb000000',
      '',
      'End of search: 2 match(es) found.',
    ].join('\r\n');
    expect(parseRegistryMemory(output)).toBe(0x3fb000000);
    expect(parseRegistryMemory('ERROR: The system was unable to find the specified registry key or value.')).toBeNull();
  });
});
