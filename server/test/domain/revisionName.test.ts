import { describe, expect, it } from 'vitest';
import { revisionName } from '../../src/domain/revisionName';

describe('revisionName', () => {
  it('reads the stem and number of common revision markers', () => {
    expect(revisionName('BOQ_Phase1_Rev0.xlsx')).toEqual({ stem: 'boq_phase1', rank: 0 });
    expect(revisionName('BOQ_Phase1_Rev1.xlsx')).toEqual({ stem: 'boq_phase1', rank: 1 });
    expect(revisionName('Tower BOQ Revision 12.pdf')).toEqual({ stem: 'tower boq', rank: 12 });
    expect(revisionName('Bill-2 (Rev 3).xlsx')).toEqual({ stem: 'bill-2', rank: 3 });
    expect(revisionName('Facade_BOQ_R2.pdf')).toEqual({ stem: 'facade_boq', rank: 2 });
    expect(revisionName('Facade_BOQ_v4.xlsx')).toEqual({ stem: 'facade_boq', rank: 4 });
    expect(revisionName('BOQ_Rev.5.xlsx')).toEqual({ stem: 'boq', rank: 5 });
  });

  it('ranks letter revisions before numbered ones', () => {
    const a = revisionName('BOQ_RevA.xlsx');
    const b = revisionName('BOQ Rev B.xlsx');
    const zero = revisionName('BOQ_Rev0.xlsx');
    expect(a?.stem).toBe('boq');
    expect(b?.stem).toBe('boq');
    expect(a!.rank).toBeLessThan(b!.rank);
    expect(b!.rank).toBeLessThan(zero!.rank);
  });

  it('ignores names without a marker', () => {
    expect(revisionName('Contract_Main_Works.pdf')).toBeNull();
    expect(revisionName('Cost_Report.xlsx')).toBeNull();
    expect(revisionName('Tower.pdf')).toBeNull();
    expect(revisionName('Rev1.xlsx')).toBeNull();
    expect(revisionName('Plan_RA.pdf')).toBeNull();
    expect(revisionName('BOQ_Phase1_Rev0_final.xlsx')).toBeNull();
  });
});
