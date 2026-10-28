import { describe, expect, it } from 'vitest';
import { type ClassificationReply, toClassification } from '../../src/application/indexing/classificationReply';

const source = [
  'File: Contract.pdf',
  'CONTRACT AGREEMENT for the Riyadh Tower project, dated 1 March 2026.',
  'Between Al Noor Development (the Employer) and Gulf Build Contracting (the Contractor).',
  'The Contract Price is SAR 245,750,000.00. Completion: 30 June 2028. Retention 10%.',
].join('\n');

function reply(patch: Partial<ClassificationReply> = {}): ClassificationReply {
  return {
    type: 'Contract',
    type_confidence: 0.95,
    project_name: { value: 'Riyadh Tower', confidence: 0.9 },
    parties: [
      { name: 'Al Noor Development', role: 'Employer', confidence: 0.9 },
      { name: 'Gulf Build Contracting', role: 'Contractor', confidence: 0.85 },
    ],
    contract_value: { amount: 245_750_000, currency: 'SAR', confidence: 0.9 },
    key_dates: [
      { label: 'Agreement date', date: '1 March 2026', confidence: 0.9 },
      { label: 'Completion', date: '30 June 2028', confidence: 0.8 },
    ],
    ...patch,
  };
}

describe('toClassification', () => {
  it('maps a confident reply to the shared shape', () => {
    expect(toClassification(reply(), source)).toEqual({
      type: 'Contract',
      confidence: 0.95,
      metadata: {
        projectName: 'Riyadh Tower',
        parties: ['Al Noor Development (Employer)', 'Gulf Build Contracting (Contractor)'],
        contractValue: { amount: 245_750_000, currency: 'SAR' },
        keyDates: [
          { label: 'Agreement date', date: '1 March 2026' },
          { label: 'Completion', date: '30 June 2028' },
        ],
      },
    });
  });

  it('is null when the type itself is below 0.6', () => {
    expect(toClassification(reply({ type_confidence: 0.55 }), source)).toBeNull();
  });

  it('drops every value below 0.6 and keeps the confident ones', () => {
    const result = toClassification(
      reply({
        project_name: { value: 'Riyadh Tower', confidence: 0.4 },
        parties: [
          { name: 'Al Noor Development', role: 'Employer', confidence: 0.9 },
          { name: 'Gulf Build Contracting', role: 'Contractor', confidence: 0.59 },
        ],
        contract_value: { amount: 245_750_000, currency: 'SAR', confidence: 0.5 },
        key_dates: [
          { label: 'Agreement date', date: '1 March 2026', confidence: 0.3 },
          { label: 'Completion', date: '30 June 2028', confidence: 0.6 },
        ],
      }),
      source,
    );
    expect(result?.metadata).toEqual({
      projectName: null,
      parties: ['Al Noor Development (Employer)'],
      contractValue: null,
      keyDates: [{ label: 'Completion', date: '30 June 2028' }],
    });
  });

  it('keeps a contract value only when the text writes that amount, and uses the amount as written', () => {
    const invented = toClassification(reply({ contract_value: { amount: 250_000_000, currency: 'SAR', confidence: 0.9 } }), source);
    expect(invented?.metadata.contractValue).toBeNull();

    const scaled = toClassification(
      reply({ contract_value: { amount: 12_500_000, currency: 'SR', confidence: 0.9 } }),
      'The Contract Sum is SR 12.5 million.',
    );
    expect(scaled?.metadata.contractValue).toEqual({ amount: 12_500_000, currency: 'SAR' });

    const percent = toClassification(reply({ contract_value: { amount: 10, currency: 'SAR', confidence: 0.9 } }), source);
    expect(percent?.metadata.contractValue).toBeNull();
  });

  it('drops dates the text does not write as given, and blank names', () => {
    const result = toClassification(
      reply({
        parties: [{ name: '  ', role: 'Engineer', confidence: 0.9 }, { name: 'Gulf Build Contracting', role: ' ', confidence: 0.9 }],
        key_dates: [{ label: 'Completion', date: '2028-06-30', confidence: 0.9 }],
      }),
      source,
    );
    expect(result?.metadata.parties).toEqual(['Gulf Build Contracting']);
    expect(result?.metadata.keyDates).toEqual([]);
  });

  it('drops a date code cannot read as a real date, even when the text writes it', () => {
    const result = toClassification(
      reply({
        key_dates: [
          { label: 'Meeting', date: '21 October 6202', confidence: 0.9 },
          { label: 'Handover', date: 'Q3 2026', confidence: 0.9 },
          { label: 'Agreement', date: '29 Rajab 1447 AH', confidence: 0.9 },
        ],
      }),
      'Meeting held 21 October 6202. Handover in Q3 2026. Signed 29 Rajab 1447 AH.',
    );
    expect(result?.metadata.keyDates).toEqual([{ label: 'Agreement', date: '29 Rajab 1447 AH' }]);
  });

  it('keeps the confidence between 0 and 1', () => {
    expect(toClassification(reply({ type_confidence: 1.4 }), source)?.confidence).toBe(1);
  });
});
