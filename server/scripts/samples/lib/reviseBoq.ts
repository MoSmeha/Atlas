import type { BoqChanges, BoqItem, BoqRevision } from './boqTypes';

/** Applies a change set to a BOQ revision. Throws when a change names an item code that does not exist. */
export function reviseBoq(base: BoqRevision, changes: BoqChanges): BoqRevision {
  const known = new Set(base.bills.flatMap((bill) => bill.sections.flatMap((s) => s.items.map((item) => item.code))));
  const named = [
    ...Object.keys(changes.quantities),
    ...Object.keys(changes.rates),
    ...changes.added.map((add) => add.after),
    ...changes.removed,
    ...changes.corrected,
  ];
  for (const code of named) if (!known.has(code)) throw new Error(`Revision ${changes.revision}: no item ${code}`);

  const revise = (item: BoqItem): BoqItem => {
    const next: BoqItem = {
      ...item,
      quantity: changes.quantities[item.code] ?? item.quantity,
      rate: changes.rates[item.code] ?? item.rate,
    };
    if (changes.corrected.includes(item.code)) delete next.typedAmount;
    return next;
  };

  const bills = base.bills.map((bill) => ({
    ...bill,
    sections: bill.sections.map((section) => ({
      ...section,
      items: section.items.flatMap((item) => {
        if (changes.removed.includes(item.code)) return [];
        const additions = changes.added.filter((add) => add.after === item.code).map((add) => add.item);
        return [revise(item), ...additions];
      }),
    })),
  }));

  return { ...base, fileName: changes.fileName, revision: changes.revision, issueDate: changes.issueDate, bills };
}
