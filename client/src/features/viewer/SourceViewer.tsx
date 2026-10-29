import type { Source } from '@atlas/shared';
import { useFolderStatus } from '../../api/useFolderStatus';
import { useCopy } from '../../i18n/useCopy';
import { ErrorNotice } from '../errors/ErrorNotice';
import { LazyPdfView } from './LazyPdfView';
import { SheetView } from './SheetView';
import { ViewerLoading } from './ViewerLoading';
import { ViewerNotice } from './ViewerNotice';
import { findSourceDocument } from './findSourceDocument';
import { viewerCopy } from './viewerCopy';

/** Finds the source's document in the loaded folder, then shows its page or its rows. */
export function SourceViewer({ source }: { source: Source }) {
  const copy = useCopy(viewerCopy);
  const folder = useFolderStatus();

  if (folder.isPending) return <ViewerLoading label={copy.findingFile} />;
  if (folder.isError) {
    return (
      <ViewerNotice>
        <ErrorNotice error={folder.error} onRetry={() => void folder.refetch()} retryLabel={copy.tryAgain} />
      </ViewerNotice>
    );
  }

  const document = findSourceDocument(folder.data.documents, source);
  if (!document) {
    return (
      <ViewerNotice>
        <ErrorNotice error={{ code: 'document_not_found', message: copy.notInFolder(source.document) }} />
      </ViewerNotice>
    );
  }
  return source.kind === 'pdf' ? (
    <LazyPdfView document={document} source={source} />
  ) : (
    <SheetView document={document} sheet={source.sheet} cited={{ from: source.rowFrom, to: source.rowTo }} />
  );
}
