import type { ExportFormat } from '@atlas/shared';
import type { PageRenderer } from '../../src/application/ports/PageRenderer';
import type { ExportableTable, ResultExporter } from '../../src/application/ports/ResultExporter';

/** Returns a tiny fixed "PNG" and records which pages were rendered. */
export class FakePageRenderer implements PageRenderer {
  readonly rendered: { filePath: string; page: number }[] = [];

  async renderPage(filePath: string, page: number): Promise<Uint8Array> {
    this.rendered.push({ filePath, page });
    return new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
  }
}

/** Records exports instead of writing files. */
export class FakeExporter implements ResultExporter {
  readonly exported: { table: ExportableTable; format: ExportFormat; path: string }[] = [];

  async export(table: ExportableTable, format: ExportFormat, directory: string, baseName: string): Promise<string> {
    const path = `${directory}/${baseName}.${format}`;
    this.exported.push({ table, format, path });
    return path;
  }
}
