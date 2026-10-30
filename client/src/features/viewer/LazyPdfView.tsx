import { Suspense, lazy } from 'react';
import { useCopy } from '../../i18n/useCopy';
import type { PdfViewProps } from './PdfView';
import { ViewerLoading } from './ViewerLoading';
import { viewerCopy } from './viewerCopy';

// pdf.js is large, so it loads the first time a PDF opens rather than with the app.
const PdfView = lazy(() => import('./PdfView').then((module) => ({ default: module.PdfView })));

/** The PDF view, with a loading line while pdf.js arrives. */
export function LazyPdfView(props: PdfViewProps) {
  const copy = useCopy(viewerCopy);
  return (
    <Suspense fallback={<ViewerLoading label={copy.openingPdf} />}>
      <PdfView {...props} />
    </Suspense>
  );
}
