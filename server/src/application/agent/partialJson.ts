import { isHighSurrogate } from '../../domain/text';

type Frame = { kind: 'object'; expectKey: boolean } | { kind: 'array' };

/** What the string being read is: a key, the wanted field's value, or anything else. */
type StringKind = 'key' | 'field' | 'other';

const ESCAPES: Record<string, string> = { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', '"': '"', '\\': '\\', '/': '/' };
const HEX4 = /^[0-9a-fA-F]{4}$/;

/**
 * Reads one top-level string field out of a JSON object that arrives in pieces, such as the streamed
 * arguments of the submit_answer call. Each `push` returns the text the piece added to that field,
 * decoded (escapes such as \n, \" and \uXXXX work across piece boundaries). Nested fields with the
 * same name are ignored. Half of a surrogate pair is held back until the other half arrives.
 */
export class StringFieldExtractor {
  private readonly field: string;
  private readonly frames: Frame[] = [];
  private reading: StringKind | null = null;
  private escape: 'none' | 'backslash' | 'unicode' = 'none';
  private hex = '';
  private key = '';
  private lastKey: string | null = null;
  private value = '';
  private emitted = 0;
  private found = false;
  private closed = false;

  constructor(field: string) {
    this.field = field;
  }

  /** The field's text decoded so far. */
  get text(): string {
    return this.value;
  }

  /** True once the field's closing quote has been read. */
  get complete(): boolean {
    return this.closed;
  }

  /** Reads the next piece of JSON and returns what it added to the field, or '' when nothing. */
  push(chunk: string): string {
    for (const char of chunk) this.read(char);
    let end = this.value.length;
    if (!this.closed && end > this.emitted && isHighSurrogate(this.value.charCodeAt(end - 1))) end -= 1;
    const delta = this.value.slice(this.emitted, end);
    this.emitted = end;
    return delta;
  }

  private read(char: string): void {
    if (this.reading !== null) {
      this.readString(char);
      return;
    }
    const top = this.frames.at(-1);
    switch (char) {
      case '{':
        this.frames.push({ kind: 'object', expectKey: true });
        break;
      case '[':
        this.frames.push({ kind: 'array' });
        break;
      case '}':
      case ']':
        this.frames.pop();
        break;
      case ':':
        if (top?.kind === 'object') top.expectKey = false;
        break;
      case ',':
        if (top?.kind === 'object') top.expectKey = true;
        break;
      case '"':
        this.reading = this.startString(top);
        break;
    }
  }

  private startString(top: Frame | undefined): StringKind {
    if (top?.kind === 'object' && top.expectKey) {
      this.key = '';
      return 'key';
    }
    const isField = this.frames.length === 1 && top?.kind === 'object' && this.lastKey === this.field && !this.found;
    if (!isField) return 'other';
    this.found = true;
    return 'field';
  }

  private readString(char: string): void {
    if (this.escape === 'backslash') {
      this.escape = char === 'u' ? 'unicode' : 'none';
      this.hex = '';
      if (char !== 'u') this.append(ESCAPES[char] ?? char);
      return;
    }
    if (this.escape === 'unicode') {
      this.hex += char;
      if (this.hex.length < 4) return;
      this.escape = 'none';
      if (HEX4.test(this.hex)) this.append(String.fromCharCode(Number.parseInt(this.hex, 16)));
      return;
    }
    if (char === '\\') this.escape = 'backslash';
    else if (char === '"') this.endString();
    else this.append(char);
  }

  private append(text: string): void {
    if (this.reading === 'key') this.key += text;
    else if (this.reading === 'field') this.value += text;
  }

  private endString(): void {
    if (this.reading === 'key' && this.frames.length === 1) this.lastKey = this.key;
    if (this.reading === 'field') this.closed = true;
    this.reading = null;
  }
}
