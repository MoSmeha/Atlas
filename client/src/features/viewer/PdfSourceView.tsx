import 'react-pdf/dist/Page/TextLayer.css';
import './pdfWorker';

import { useCallback, useRef, useState } from 'react';
import { Box, Stack } from '@mantine/core';
import { useElementSize, useHotkeys } from '@mantine/hooks';
import { Document, Page } from 'react-pdf';
import type { DocumentSummary, PdfSource } from '@atlas/shared';
import { api } from '../../api/endpoints';
import { ErrorNotice } from '../errors/ErrorNotice';
import type { NoticeError } from '../errors/errorCopy';
import { PdfToolbar } from './PdfToolbar';
import { QuoteNote } from './QuoteNote';
import { ViewerLoading } from './ViewerLoading';
import { pdfLoadError } from './pdfLoadError';
import { scrollToMiddle } from './stageScroll';
import { useQuoteHighlight } from './useQuoteHighlight';
import classes from './SourceViewer.module.css';

/** Wide enough to read a page without zooming, narrow enough to keep the whole line in view. */
const MAX_PAGE_WIDTH = 860;

/** A4 height over width, for the space a page holds while it draws. */
const PAGE_RATIO = 1.414;

interface PdfSourceViewProps {
  document: DocumentSummary;
  source: PdfSource;
}

/**
 * The cited PDF page drawn by pdf.js with the quoted words highlighted and scrolled into view,
 * plus previous and next page controls (also the arrow keys).
 */
export function PdfSourceView({ document, source }: PdfSourceViewProps) {
  const [page, setPage] = useState(source.page);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [failure, setFailure] = useState<NoticeError | null>(null);
  const [attempt, setAttempt] = useState(0);
  const stage = useRef<HTMLDivElement>(null);
  const scrolledToQuote = useRef(false);
  const { ref: sizer, width } = useElementSize();

  const quote = source.quote?.trim() || null;
  const onCitedPage = page === source.page;
  const highlight = useQuoteHighlight(onCitedPage ? quote : null, page, classes.mark);
  const pageWidth = Math.floor(Math.min(MAX_PAGE_WIDTH, width));
  const lastPage = pageCount ?? document.pageCount ?? source.page;

  const goTo = (next: number) => {
    const target = Math.min(Math.max(1, next), lastPage);
    if (target === page) return;
    setPage(target);
    scrolledToQuote.current = false;
    if (stage.current) stage.current.scrollTop = 0;
  };
  useHotkeys([
    ['ArrowLeft', () => goTo(page - 1)],
    ['ArrowRight', () => goTo(page + 1)],
  ]);

  // Runs after every text layer draw; the first one that carries marks brings them into view.
  const { customTextRenderer } = highlight;
  const onTextLayerDrawn = useCallback(() => {
    if (scrolledToQuote.current || !customTextRenderer || !stage.current) return;
    const mark = stage.current.querySelector('mark');
    if (!(mark instanceof HTMLElement)) return;
    scrollToMiddle(stage.current, mark);
    scrolledToQuote.current = true;
  }, [customTextRenderer]);

  const retry = () => {
    setFailure(null);
    setAttempt((count) => count + 1);
  };

  return (
    <>
      {(!failure || quote) && (
        <Stack gap="xs" className={classes.bar}>
          {!failure && <PdfToolbar page={page} pageCount={pageCount} citedPage={source.page} onGoTo={goTo} />}
          {quote && <QuoteNote quote={quote} state={onCitedPage ? highlight.state : null} citedPage={source.page} />}
        </Stack>
      )}

      <div ref={stage} className={classes.stage}>
        <div ref={sizer} className={classes.sizer}>
          {failure ? (
            <Box w="100%" maw={560}>
              <ErrorNotice error={failure} onRetry={retry} retryLabel="Try again" />
            </Box>
          ) : (
            <Document
              key={attempt}
              file={api.documentFileUrl(document.id)}
              suspense={false}
              loading={<ViewerLoading label="Opening the PDF" />}
              error={null}
              onLoadSuccess={(pdf) => {
                setPageCount(pdf.numPages);
                setPage((current) => Math.min(current, pdf.numPages));
              }}
              onLoadError={(error) => setFailure(pdfLoadError(error))}
            >
              {pageWidth > 0 && (
                <Page
                  key={page}
                  pageNumber={page}
                  width={pageWidth}
                  className={classes.page}
                  renderAnnotationLayer={false}
                  suspense={false}
                  loading={<Box w={pageWidth} h={Math.round(pageWidth * PAGE_RATIO)} />}
                  error={
                    <Box w="100%" maw={560}>
                      <ErrorNotice error={{ code: 'internal', message: '' }} />
                    </Box>
                  }
                  onGetTextSuccess={highlight.onGetTextSuccess}
                  customTextRenderer={customTextRenderer}
                  onRenderTextLayerSuccess={onTextLayerDrawn}
                />
              )}
            </Document>
          )}
        </div>
      </div>
    </>
  );
}
