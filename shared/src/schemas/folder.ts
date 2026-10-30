import { z } from 'zod';
import { DocumentSummary } from './documents';
import { ErrorDetail } from './errors';

export const LoadFolderRequest = z.object({ path: z.string().trim().min(1) });
export type LoadFolderRequest = z.infer<typeof LoadFolderRequest>;

/** Opens the folder window on the computer running Atlas; the title is in the interface language. */
export const PickFolderRequest = z.object({ title: z.string().trim().min(1).max(200) });
export type PickFolderRequest = z.infer<typeof PickFolderRequest>;

/** The folder chosen in that window, as an absolute path, or null when it was closed without one. */
export const PickFolderResponse = z.object({ path: z.string().nullable() });
export type PickFolderResponse = z.infer<typeof PickFolderResponse>;

/** A file or subfolder of the loaded folder, relative to it with forward slashes, as the documents list gives it. */
export const FolderItemRequest = z.object({ path: z.string().trim().min(1).max(1000) });
export type FolderItemRequest = z.infer<typeof FolderItemRequest>;

export const IndexPhase = z.enum(['idle', 'scanning', 'reading', 'embedding', 'classifying', 'ready', 'error']);
export type IndexPhase = z.infer<typeof IndexPhase>;

/** "Reading BOQ_Phase2.xlsx, 3 of 12". */
export const IndexProgress = z.object({
  current: z.number().int(),
  total: z.number().int(),
  file: z.string().nullable(),
  message: z.string(),
});
export type IndexProgress = z.infer<typeof IndexProgress>;

/**
 * A suggested question in both interface languages. The CLI prints the English ones when it starts; the web
 * client's empty chat no longer shows them.
 */
export const SuggestedQuestion = z.object({ en: z.string(), ar: z.string() });
export type SuggestedQuestion = z.infer<typeof SuggestedQuestion>;

export const IndexStatus = z.object({
  folder: z.string().nullable(),
  phase: IndexPhase,
  progress: IndexProgress.nullable(),
  documents: z.array(DocumentSummary),
  suggestions: z.array(SuggestedQuestion),
  error: ErrorDetail.nullable(),
  /** The folder is Atlas's own uploads folder, so removing a file from it deletes the uploaded copy. */
  uploads: z.boolean(),
  /**
   * Files and subfolders removed from Atlas in a folder loaded by its path. Their files stay on disk, Atlas leaves
   * them out of every scan, and each can be put back.
   */
  removed: z.array(z.string()),
});
export type IndexStatus = z.infer<typeof IndexStatus>;

/** Server-sent events on GET /api/folder/events; the client refreshes its queries on each one. */
export const IndexEvent = z.discriminatedUnion('type', [
  z.object({ type: z.literal('progress'), phase: IndexPhase, progress: IndexProgress }),
  z.object({ type: z.literal('document'), document: DocumentSummary }),
  z.object({ type: z.literal('removed'), path: z.string() }),
  z.object({ type: z.literal('ready'), folder: z.string() }),
  z.object({ type: z.literal('error'), error: ErrorDetail }),
  /** The folder was removed from Atlas: nothing is loaded now. */
  z.object({ type: z.literal('unloaded'), folder: z.string() }),
]);
export type IndexEvent = z.infer<typeof IndexEvent>;
