import { basename } from 'node:path';
import type { ExportFormat } from '@atlas/shared';
import { fileSlug, fileTimestamp } from '../domain/fileName';
import { errors } from './errors';
import type { Clock } from './ports/Clock';
import type { ResultExporter } from './ports/ResultExporter';
import type { Session } from './session/Session';

export interface ExportResultInput {
  session: Session;
  /** A saved result id such as r3. */
  resultId: string;
  format: ExportFormat;
  exportsDir: string;
}

export interface ExportedFile {
  fileName: string;
  /** Absolute path of the new file. */
  path: string;
}

/** Saves one of a chat's results as an Excel or CSV file named after its title and the time, for example boq-items-20261028-140509.xlsx. */
export class ExportResult {
  private readonly exporter: ResultExporter;
  private readonly clock: Clock;

  constructor(exporter: ResultExporter, clock: Clock) {
    this.exporter = exporter;
    this.clock = clock;
  }

  /** Throws result_not_found when the chat has no result with that id. */
  async execute({ session, resultId, format, exportsDir }: ExportResultInput): Promise<ExportedFile> {
    const result = session.result(resultId);
    if (!result) throw errors.resultNotFound(resultId);

    const baseName = `${fileSlug(result.title ?? '', 'result')}-${fileTimestamp(this.clock.now())}`;
    const table = { title: result.title, columns: result.columns, rows: result.rows, sources: result.sources };
    const path = await this.exporter.export(table, format, exportsDir, baseName);
    return { fileName: basename(path), path };
  }
}
