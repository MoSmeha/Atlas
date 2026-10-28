const CLEAR_LINE = '\r\x1b[2K';

/**
 * Where the CLI prints: whole lines, plus one status line at the bottom that is rewritten in place, such as
 * "Reading BOQ_Phase2.xlsx, 3 of 12". The status line only shows on a terminal; piped output gets the lines alone.
 */
export class Terminal {
  /** True when output goes to a terminal, so the status line can be rewritten. */
  readonly live: boolean;
  private readonly stream: NodeJS.WriteStream;
  private statusShown = false;

  constructor(stream: NodeJS.WriteStream) {
    this.stream = stream;
    this.live = stream.isTTY === true;
  }

  /** Prints lines above the status line. */
  line(text = ''): void {
    this.clearStatus();
    this.stream.write(`${text}\n`);
  }

  /** Replaces the status line, cut to the terminal width. Does nothing when output is not a terminal. */
  status(text: string): void {
    if (!this.live) return;
    const width = Math.max(10, (this.stream.columns ?? 80) - 1);
    const line = text.replace(/\s+/g, ' ').trim();
    this.stream.write(`${CLEAR_LINE}${line.length <= width ? line : `${line.slice(0, width - 1)}…`}`);
    this.statusShown = true;
  }

  clearStatus(): void {
    if (!this.statusShown) return;
    this.stream.write(CLEAR_LINE);
    this.statusShown = false;
  }
}
