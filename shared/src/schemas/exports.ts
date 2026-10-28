import { z } from 'zod';

export const ExportFormat = z.enum(['xlsx', 'csv']);
export type ExportFormat = z.infer<typeof ExportFormat>;

export const ExportRequest = z.object({
  sessionId: z.string().min(1),
  resultId: z.string().min(1),
  format: ExportFormat,
});
export type ExportRequest = z.infer<typeof ExportRequest>;

export const ExportResponse = z.object({
  fileName: z.string(),
  /** Absolute path on the machine running Atlas. */
  path: z.string(),
  /** Download link served by the API. */
  url: z.string(),
});
export type ExportResponse = z.infer<typeof ExportResponse>;
