import { describe, expect, it } from 'vitest';
import { sqlReferences } from '../../src/domain/sqlReferences';

describe('sqlReferences', () => {
  it('lists names in order of first use, lower case, without repeats', () => {
    const { names } = sqlReferences('SELECT Amount, amount FROM T_Boq_1 b JOIN t_boq_2 ON b._row = t_boq_2._row');
    expect(names).toEqual(['select', 'amount', 'from', 't_boq_1', 'b', 'join', 't_boq_2', 'on', '_row']);
  });

  it('includes quoted names without their quotes', () => {
    expect(sqlReferences('SELECT "Unit Rate" FROM [t_boq_1]').names).toEqual(['select', 'unit rate', 'from', 't_boq_1']);
  });

  it('skips strings and comments', () => {
    const { names } = sqlReferences("SELECT 1 FROM t_a -- t_b\nWHERE note = 't_c' /* t_d */");
    expect(names).toEqual(['select', '1', 'from', 't_a', 'where', 'note']);
  });

  it('lists function calls, with or without a space before the bracket', () => {
    const { calls } = sqlReferences('SELECT SUM(amount), count (*), lower(description) FROM t WHERE x IN (1)');
    expect(calls).toEqual(['sum', 'count', 'lower', 'in']);
  });
});
