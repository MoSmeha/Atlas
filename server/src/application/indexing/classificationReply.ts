import { type Classification, DocumentType } from '@atlas/shared';
import { z } from 'zod';
import { currencyCode } from '../../domain/currency';
import { tolerance } from '../../domain/numberMatch';
import { extractNumbers } from '../../domain/numbers';
import { findDateMentions } from '../../domain/scheduleDates';

/** Values the classifier is less sure of than this are dropped; below it for the type, there is no classification. */
export const MIN_CONFIDENCE = 0.6;

/** What the model returns for one document. Confidences run from 0 to 1. */
export const ClassificationReply = z.object({
  type: DocumentType,
  type_confidence: z.number(),
  project_name: z.object({ value: z.string(), confidence: z.number() }).nullable(),
  parties: z.array(z.object({ name: z.string(), role: z.string(), confidence: z.number() })),
  contract_value: z.object({ amount: z.number(), currency: z.string(), confidence: z.number() }).nullable(),
  key_dates: z.array(z.object({ label: z.string(), date: z.string(), confidence: z.number() })),
});
export type ClassificationReply = z.infer<typeof ClassificationReply>;

/**
 * The shared Classification for a reply, keeping only confident values; null when the type itself is not confident.
 * A contract value is kept only when its amount is written in the text the model read, and a date only when it
 * appears there as written and code reads a real date from it, so nothing shown comes from the model alone.
 */
export function toClassification(reply: ClassificationReply, sourceText: string): Classification | null {
  if (!confident(reply.type_confidence)) return null;
  const source = folded(sourceText);
  const projectName = reply.project_name !== null && confident(reply.project_name.confidence) ? clean(reply.project_name.value) : '';
  const parties = reply.parties
    .filter((party) => confident(party.confidence) && clean(party.name) !== '')
    .map((party) => (clean(party.role) === '' ? clean(party.name) : `${clean(party.name)} (${clean(party.role)})`));
  const keyDates = reply.key_dates
    .filter((item) => confident(item.confidence) && clean(item.label) !== '' && clean(item.date) !== '')
    .filter((item) => source.includes(folded(item.date)) && findDateMentions(item.date).length > 0)
    .map((item) => ({ label: clean(item.label), date: clean(item.date) }));
  return {
    type: reply.type,
    confidence: Math.round(Math.min(1, reply.type_confidence) * 100) / 100,
    metadata: {
      projectName: projectName === '' ? null : projectName,
      parties: [...new Set(parties)],
      contractValue: contractValue(reply.contract_value, sourceText),
      keyDates,
    },
  };
}

function contractValue(value: ClassificationReply['contract_value'], sourceText: string): Classification['metadata']['contractValue'] {
  if (value === null || !confident(value.confidence) || !Number.isFinite(value.amount) || value.amount <= 0) return null;
  const currency = clean(value.currency);
  const amount = writtenAmount(sourceText, value.amount);
  if (currency === '' || amount === null) return null;
  return { amount, currency: currencyCode(currency) ?? currency.toUpperCase() };
}

/**
 * The amount as the text writes it, in any format ("12,500,000.00", "SAR 12.5M", "12.5 million"), when the model's
 * amount is that number; null when the text never writes it.
 */
function writtenAmount(text: string, amount: number): number | null {
  let best: number | null = null;
  for (const mention of extractNumbers(text)) {
    if (mention.percent) continue;
    const value = Math.abs(mention.value);
    const distance = Math.abs(value - amount);
    if (distance <= tolerance(mention) && (best === null || distance < Math.abs(best - amount))) best = value;
  }
  return best;
}

function confident(confidence: number): boolean {
  return Number.isFinite(confidence) && confidence >= MIN_CONFIDENCE;
}

function clean(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function folded(text: string): string {
  return clean(text).toLowerCase();
}
