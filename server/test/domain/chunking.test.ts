import { describe, expect, it } from 'vitest';
import { chunkPage } from '../../src/domain/chunking';

const sentence = (n: number) => `Clause ${n} requires the contractor to submit method statement number ${n} before work starts.`;

describe('chunkPage', () => {
  it('returns nothing for blank text', () => {
    expect(chunkPage('')).toEqual([]);
    expect(chunkPage(' \n\n\t ')).toEqual([]);
  });

  it('keeps a short page as one chunk with tidy whitespace', () => {
    expect(chunkPage('  Scope of   works\r\n\r\nPayment terms  ')).toEqual(['Scope of works\n\nPayment terms']);
  });

  it('packs whole paragraphs into chunks under the limit', () => {
    const paragraphs = Array.from({ length: 6 }, (_, i) => `Paragraph ${i + 1}. ${'Concrete works. '.repeat(10).trim()}`);
    const chunks = chunkPage(paragraphs.join('\n\n'), { maxChars: 400, overlapChars: 0 });
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(400);
    for (const paragraph of paragraphs) expect(chunks.some((chunk) => chunk.includes(paragraph))).toBe(true);
  });

  it('cuts a long paragraph at sentence ends', () => {
    const text = Array.from({ length: 30 }, (_, i) => sentence(i + 1)).join(' ');
    const chunks = chunkPage(text, { maxChars: 300, overlapChars: 0 });
    expect(chunks.length).toBeGreaterThan(5);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(300);
      expect(chunk.endsWith('.')).toBe(true);
    }
    for (let i = 1; i <= 30; i++) expect(chunks.some((chunk) => chunk.includes(sentence(i)))).toBe(true);
  });

  it('repeats the end of one chunk at the start of the next', () => {
    const text = Array.from({ length: 20 }, (_, i) => sentence(i + 1)).join(' ');
    const chunks = chunkPage(text, { maxChars: 300, overlapChars: 60 });
    for (let i = 1; i < chunks.length; i++) {
      const previous = chunks[i - 1] ?? '';
      const lead = (chunks[i] ?? '').slice(0, 20);
      expect(previous.slice(-80)).toContain(lead);
      expect((chunks[i] ?? '').length).toBeLessThanOrEqual(300);
    }
  });

  it('falls back to lines, words and finally a hard cut', () => {
    const lines = Array.from({ length: 40 }, (_, i) => `A${i + 1} Excavation m3 ${100 + i}`).join('\n');
    const byLine = chunkPage(lines, { maxChars: 200, overlapChars: 0 });
    for (const chunk of byLine) expect(chunk.split('\n').every((line) => /^A\d+ Excavation m3 \d+$/.test(line))).toBe(true);

    const word = 'x'.repeat(250);
    const cut = chunkPage(word, { maxChars: 100, overlapChars: 20 });
    // The last 50 characters fit with 20 characters of overlap; the full-size cuts do not.
    expect(cut).toEqual(['x'.repeat(100), 'x'.repeat(100), 'x'.repeat(70)]);
  });

  it('splits Arabic text at Arabic question marks and full stops', () => {
    const question = 'ما هي قيمة العقد الإجمالية المتفق عليها بين الطرفين؟';
    const statement = 'يلتزم المقاول بتسليم الأعمال في الموعد المحدد۔';
    const text = Array.from({ length: 8 }, (_, i) => (i % 2 === 0 ? question : statement)).join(' ');
    const chunks = chunkPage(text, { maxChars: 120, overlapChars: 0 });
    expect(chunks.length).toBeGreaterThan(2);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(120);
      expect(chunk.endsWith('؟') || chunk.endsWith('۔')).toBe(true);
    }
  });

  it('never returns empty chunks', () => {
    const messy = ['\n\n\n', 'Title', '\n \n', '.', ' ', 'word '.repeat(400), '\n\n', '؟ ؟'].join('');
    const chunks = chunkPage(messy, { maxChars: 150, overlapChars: 40 });
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.trim()).not.toBe('');
      expect(chunk.length).toBeLessThanOrEqual(150);
    }
  });
});
