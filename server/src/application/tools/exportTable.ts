import { basename } from 'node:path';
import { z } from 'zod';
import { ExportFormat } from '@atlas/shared';
import { AppError } from '../errors';
import { ExportResult } from '../ExportResult';
import { defineTool, ToolError } from './Tool';

/** Saves a result the chat already has as an Excel or CSV file in the exports folder. */
export const exportTable = defineTool({
  name: 'export_table',
  description:
    'Save a result you already have as a file the user can open. Use it only when the user asks to export, ' +
    'download or save a table. result_id is the id a tool returned with its rows, such as r3. ' +
    'xlsx makes an Excel workbook that also lists the sources; csv makes a plain CSV file with the rows only.',
  parameters: z.object({
    result_id: z.string().describe('Id of a saved result, for example r3.'),
    format: ExportFormat.describe('xlsx for Excel, csv for a plain CSV file.'),
  }),
  async run(args, context) {
    try {
      const file = await new ExportResult(context.exporter, context.clock).execute({
        session: context.session,
        resultId: args.result_id,
        format: args.format,
        exportsDir: context.exportsDir,
      });
      return {
        // The file name only: the answer names the file, never its folder on this machine.
        output: { file: file.fileName },
        summary: `Exported the table to ${basename(context.exportsDir)}/${file.fileName}`,
      };
    } catch (error) {
      if (error instanceof AppError && error.code === 'result_not_found') {
        throw new ToolError(`${error.message} Use an id that a tool returned with its rows, such as r1.`);
      }
      throw error;
    }
  },
});
