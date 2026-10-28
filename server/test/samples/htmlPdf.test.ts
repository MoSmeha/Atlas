import { describe, expect, it } from 'vitest';
import { day } from '../../scripts/samples/lib/dates';
import { setPdfDates } from '../../scripts/samples/lib/htmlPdf';

const encode = (text: string) => new Uint8Array(Buffer.from(text, 'latin1'));
const decode = (bytes: Uint8Array) => Buffer.from(bytes).toString('latin1');

describe('setPdfDates', () => {
  it('replaces the creation and modification dates in place, keeping every byte offset', () => {
    const pdf = "1 0 obj\n<</Producer (Skia/PDF m156) /CreationDate (D:20261028190345+00'00') /ModDate (D:20261028190345+00'00')>>\nendobj\nstartxref\n123\n%%EOF";
    const fixed = setPdfDates(encode(pdf), day('2026-10-12'));
    expect(fixed.length).toBe(pdf.length);
    expect(decode(fixed)).toContain("/CreationDate (D:20261012000000+00'00') /ModDate (D:20261012000000+00'00')");
    expect(decode(fixed).endsWith('startxref\n123\n%%EOF')).toBe(true);
  });

  it('leaves bytes outside the date entries untouched, binary ones included', () => {
    const binary = Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0xe2, 0xe3, 0xcf, 0xd3, 0x00, 0xff]);
    expect(setPdfDates(binary, day('2026-10-12'))).toEqual(binary);
  });

  it('refuses a date it cannot rewrite at the same length', () => {
    expect(() => setPdfDates(encode('/CreationDate (D:2026)'), day('2026-10-12'))).toThrow(/in place/);
  });
});
