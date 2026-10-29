import type { DocumentSummary } from '@atlas/shared';
import { DocumentProblemNotice } from './DocumentProblemNotice';
import { LazyPdfView } from './LazyPdfView';
import { WorkbookView } from './WorkbookView';
import { documentProblem } from './documentProblem';

/** A whole file opened from the register: a PDF from its first page, a workbook at its first sheet. */
export function DocumentViewer({ document }: { document: DocumentSummary }) {
  const problem = documentProblem(document);
  if (problem !== null) return <DocumentProblemNotice document={document} reason={problem} />;
  return document.kind === 'pdf' ? <LazyPdfView document={document} source={null} /> : <WorkbookView document={document} />;
}
