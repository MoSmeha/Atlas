import { spawn, type ChildProcess } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { errors } from '../../application/errors';
import type { QueryResult } from '../../application/ports/DocumentIndex';

const SCRIPT = fileURLToPath(new URL('./queryProcess.cjs', import.meta.url));
const BETTER_SQLITE = createRequire(import.meta.url).resolve('better-sqlite3');

type Reply = { ready: true } | ({ id: number } & (({ ok: true } & QueryResult) | { ok: false; message: string }));

interface Worker {
  process: ChildProcess;
  /** Settles once the process has opened the database. */
  ready: Promise<void>;
}

interface Pending {
  id: number;
  timer: NodeJS.Timeout;
  resolve: (result: QueryResult) => void;
  reject: (error: Error) => void;
}

/** Query processes still running; killed if the server exits in the middle of a query. */
const live = new Set<ChildProcess>();
let exitHookAdded = false;

/**
 * Runs SELECTs on a separate read-only connection in a child process, one at a time, with a row cap and a
 * timeout. A query that runs too long is stopped by killing that process, and a fresh one starts for the next.
 * A worker thread cannot do this: terminating it waits until SQLite returns, which an endless query never does.
 */
export class QueryRunner {
  private readonly dbPath: string;
  private worker: Worker | null = null;
  private pending: Pending | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private nextId = 1;
  private closed = false;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  run(sql: string, options: { maxRows: number; timeoutMs: number }): Promise<QueryResult> {
    const result = this.queue.then(() => this.send(sql, options));
    this.queue = result.catch(() => undefined);
    return result;
  }

  close(): void {
    this.closed = true;
    this.fail(new Error('The index was closed before the query finished.'));
    this.stop();
  }

  private async send(sql: string, { maxRows, timeoutMs }: { maxRows: number; timeoutMs: number }): Promise<QueryResult> {
    if (this.closed) throw new Error('The index is closed.');
    const worker = this.worker ?? this.start();
    // The channel is unref'd while idle so an open index never keeps Node running; a query in flight must.
    const channel = worker.process.channel;
    channel?.ref();
    try {
      await worker.ready;
      if (this.worker !== worker) throw new Error('The query process stopped before the query could run.');
      return await this.exchange(worker, sql, maxRows, timeoutMs);
    } finally {
      channel?.unref();
    }
  }

  private exchange(worker: Worker, sql: string, maxRows: number, timeoutMs: number): Promise<QueryResult> {
    const id = this.nextId++;
    return new Promise<QueryResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending = null;
        this.stop();
        if (!this.closed) this.start();
        reject(errors.invalidRequest(`The query took longer than ${seconds(timeoutMs)} and was stopped.`));
      }, timeoutMs);
      this.pending = { id, timer, resolve, reject };
      worker.process.send({ id, sql, maxRows }, (error) => {
        if (error) this.fail(new Error(`Could not send the query to the query process: ${error.message}`));
      });
    });
  }

  private start(): Worker {
    const child = spawn(process.execPath, [SCRIPT], {
      stdio: ['ignore', 'ignore', 'inherit', 'ipc'],
      env: { ...process.env, ATLAS_INDEX_PATH: this.dbPath, ATLAS_BETTER_SQLITE: BETTER_SQLITE },
      windowsHide: true,
    });
    let markReady: () => void = () => {};
    let failStart: (error: Error) => void = () => {};
    const ready = new Promise<void>((resolve, reject) => {
      markReady = resolve;
      failStart = reject;
    });
    ready.catch(() => undefined);

    const stopped = (error: Error) => {
      live.delete(child);
      failStart(error);
      if (this.worker?.process !== child) return;
      this.worker = null;
      this.fail(error);
    };
    child.on('message', (reply: Reply) => ('ready' in reply ? markReady() : this.settle(reply)));
    child.on('exit', (code, signal) => stopped(new Error(`The query process stopped (${signal ?? `exit code ${code}`}).`)));
    child.on('error', (error) => stopped(new Error(`The query process failed: ${error.message}`)));
    child.unref();
    child.channel?.unref();
    killOnExit(child);

    this.worker = { process: child, ready };
    return this.worker;
  }

  private settle(reply: Exclude<Reply, { ready: true }>): void {
    const pending = this.pending;
    if (!pending || pending.id !== reply.id) return;
    this.pending = null;
    clearTimeout(pending.timer);
    if (reply.ok) pending.resolve({ columns: reply.columns, rows: reply.rows, truncated: reply.truncated });
    else pending.reject(errors.invalidRequest(reply.message));
  }

  private fail(error: Error): void {
    const pending = this.pending;
    if (!pending) return;
    this.pending = null;
    clearTimeout(pending.timer);
    pending.reject(error);
  }

  private stop(): void {
    const child = this.worker?.process;
    this.worker = null;
    if (!child) return;
    live.delete(child);
    child.kill();
  }
}

function killOnExit(child: ChildProcess): void {
  live.add(child);
  if (exitHookAdded) return;
  exitHookAdded = true;
  process.on('exit', () => {
    for (const running of live) running.kill();
  });
}

function seconds(ms: number): string {
  const value = Math.max(0.1, Math.round(ms / 100) / 10);
  return `${value} second${value === 1 ? '' : 's'}`;
}
