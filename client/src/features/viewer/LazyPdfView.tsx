import { Suspense, lazy } from 'react';
import type { PdfViewProps } from './PdfView';
import { ViewerLoading } from './ViewerLoading';

// pdf.js is large, so it loads the first time a PDF opens rather than with the app.
const PdfView = lazy(() => import('./PdfView').then((module) => ({ default: module.PdfView })));

/** The PDF view, with a loading line while pdf.js arrives. */
export function LazyPdfView(props: PdfViewProps) {
  return (
    <Suspense fallback={<ViewerLoading label="Opening the PDF" />}>
      <PdfView {...props} />
    </Suspense>
  );
}
