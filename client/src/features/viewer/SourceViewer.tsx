import type { Source } from '@atlas/shared';
import { useFolderStatus } from '../../api/useFolderStatus';
import { ErrorNotice } from '../errors/ErrorNotice';
import { LazyPdfView } from './LazyPdfView';
import { SheetView } from './SheetView';
import { ViewerLoading } from './ViewerLoading';
import { ViewerNotice } from './ViewerNotice';
import { findSourceDocument } from './findSourceDocument';

/** Finds the source's document in the loaded folder, then shows its page or its rows. */
export function SourceViewer({ source }: { source: Source }) {
  const folder = useFolderStatus();

  if (folder.isPending) return <ViewerLoading label="Finding the file" />;
  if (folder.isError) {
    return (
      <ViewerNotice>
        <ErrorNotice error={folder.error} onRetry={() => void folder.refetch()} retryLabel="Try again" />
      </ViewerNotice>
    );
  }

  const document = findSourceDocument(folder.data.documents, source);
  if (!document) {
    return (
      <ViewerNotice>
        <ErrorNotice error={{ code: 'document_not_found', message: `${source.document} is not in the loaded folder.` }} />
      </ViewerNotice>
    );
  }
  return source.kind === 'pdf' ? (
    <LazyPdfView document={document} source={source} />
  ) : (
    <SheetView document={document} sheet={source.sheet} cited={{ from: source.rowFrom, to: source.rowTo }} />
  );
}
