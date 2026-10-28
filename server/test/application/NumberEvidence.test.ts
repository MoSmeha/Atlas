import { describe, expect, it } from 'vitest';
import { NumberEvidence } from '../../src/application/session/NumberEvidence';
import { Session } from '../../src/application/session/Session';

describe('NumberEvidence', () => {
  it('remembers numbers from text, whatever their format', () => {
    const evidence = new NumberEvidence();
    evidence.noteText('The contract value is SAR 12,500,000.00 with 10% retention.');
    expect(evidence.has(12500000)).toBe(true);
    expect(evidence.has(10)).toBe(true);
    expect(evidence.has(0.1)).toBe(true);
    expect(evidence.has(12500001)).toBe(false);
  });

  it('ignores the sign', () => {
    const evidence = new NumberEvidence();
    evidence.noteNumber(-250.5);
    expect(evidence.has(250.5)).toBe(true);
    expect(evidence.has(-250.5)).toBe(true);
  });

  it('notes number cells and numbers inside text cells', () => {
    const evidence = new NumberEvidence();
    evidence.noteRows([
      ['A1', 48000000, null],
      ['Concrete C40, 450 m3', 0.1 + 0.2, 'x'],
    ]);
    expect(evidence.has(48000000)).toBe(true);
    expect(evidence.has(450)).toBe(true);
    expect(evidence.has(40)).toBe(true);
    expect(evidence.has(0.3)).toBe(true);
    expect(evidence.has(0.30000000000000004)).toBe(true);
  });

  it('notes the numbers anywhere in a tool output, but not its keys', () => {
    const evidence = new NumberEvidence();
    evidence.noteValue({ pages: [{ number: 4, text: 'Retention is 5% of SAR 2,400,000.' }], total: 1250000.5, '777': null });
    expect(evidence.has(1250000.5)).toBe(true);
    expect(evidence.has(2400000)).toBe(true);
    expect(evidence.has(0.05)).toBe(true);
    expect(evidence.has(777)).toBe(false);
  });

  it('skips values that are not finite', () => {
    const evidence = new NumberEvidence();
    evidence.noteNumber(Number.POSITIVE_INFINITY);
    evidence.noteNumber(Number.NaN);
    expect(evidence.has(Number.POSITIVE_INFINITY)).toBe(false);
  });
});

describe('Session evidence', () => {
  it('learns the numbers of every saved result', () => {
    const session = new Session('s1');
    session.saveResult({
      title: null,
      columns: ['item_code', 'amount'],
      rows: [['B-7', 1750000]],
      sources: [],
      tool: 'query_tables',
      detail: 'SELECT item_code, amount FROM boq WHERE amount > 999999',
    });
    expect(session.evidence.has(1750000)).toBe(true);
    expect(session.evidence.has(7)).toBe(true);
    expect(session.evidence.has(999999)).toBe(false);
  });
});
