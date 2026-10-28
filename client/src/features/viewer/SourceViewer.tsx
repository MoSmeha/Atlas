import { type ReactNode, Suspense, lazy } from 'react';
import { Box } from '@mantine/core';
import type { Source } from '@atlas/shared';
import { useFolderStatus } from '../../api/useFolderStatus';
import { ErrorNotice } from '../errors/ErrorNotice';
import { SheetSourceView } from './SheetSourceView';
import { ViewerLoading } from './ViewerLoading';
import { findSourceDocument } from './findSourceDocument';

// pdf.js is large, so it loads the first time a PDF source opens rather than with the app.
const PdfSourceView = lazy(() => import('./PdfSourceView').then((module) => ({ default: module.PdfSourceView })));

/** Finds the source's document in the loaded folder, then shows its page or its rows. */
export function SourceViewer({ source }: { source: Source }) {
  const folder = useFolderStatus();

  if (folder.isPending) return <ViewerLoading label="Finding the file" />;
  if (folder.isError) {
    return (
      <Notice>
        <ErrorNotice error={folder.error} onRetry={() => void folder.refetch()} retryLabel="Try again" />
      </Notice>
    );
  }

  const document = findSourceDocument(folder.data.documents, source);
  if (!document) {
    return (
      <Notice>
        <ErrorNotice error={{ code: 'document_not_found', message: `${source.document} is not in the loaded folder.` }} />
      </Notice>
    );
  }
  return source.kind === 'pdf' ? (
    <Suspense fallback={<ViewerLoading label="Opening the PDF" />}>
      <PdfSourceView document={document} source={source} />
    </Suspense>
  ) : (
    <SheetSourceView document={document} source={source} />
  );
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <Box p="lg" maw={600}>
      {children}
    </Box>
  );
}
