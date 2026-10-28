import { describe, expect, it } from 'vitest';
import { csvField, toCsv } from '../../src/infrastructure/export/csv';

describe('toCsv', () => {
  it('writes a header and one CRLF-terminated line per row', () => {
    expect(toCsv(['item_code', 'amount'], [['A1', 1500000], ['A2', null]])).toBe(
      'item_code,amount\r\nA1,1500000\r\nA2,\r\n',
    );
  });

  it('quotes fields with commas, quotes or line breaks and doubles the quotes', () => {
    expect(csvField('Piles, bored')).toBe('"Piles, bored"');
    expect(csvField('12" pipe')).toBe('"12"" pipe"');
    expect(csvField('line one\nline two')).toBe('"line one\nline two"');
    expect(csvField('carriage\rreturn')).toBe('"carriage\rreturn"');
  });

  it('leaves plain text, Arabic and numbers unquoted', () => {
    expect(csvField('Concrete works')).toBe('Concrete works');
    expect(csvField('أعمال الخرسانة')).toBe('أعمال الخرسانة');
    expect(csvField(0.125)).toBe('0.125');
    expect(csvField(-42)).toBe('-42');
  });

  it('stops spreadsheet formulas in document text from running', () => {
    expect(csvField('=HYPERLINK("http://x")')).toBe(`"'=HYPERLINK(""http://x"")"`);
    expect(csvField('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(csvField('- Excavation')).toBe("'- Excavation");
    expect(csvField('-12.5')).toBe('-12.5');
  });

  it('writes nothing for numbers that are not finite', () => {
    expect(csvField(Number.NaN)).toBe('');
  });
});
