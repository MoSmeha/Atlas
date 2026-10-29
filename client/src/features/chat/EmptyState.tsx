import type { ReactNode } from 'react';
import { Box, Skeleton, Stack, Text, Title } from '@mantine/core';
import type { IndexStatus } from '@atlas/shared';
import type { ApiError } from '../../api/ApiError';
import { useCopy } from '../../i18n/useCopy';
import { useLanguage } from '../../i18n/useLanguage';
import { ErrorNotice } from '../errors/ErrorNotice';
import { folderName } from '../sidebar/folderPath';
import { indexingNow } from '../sidebar/indexingNow';
import { sidebarCopy } from '../sidebar/sidebarCopy';
import { emptyStateCopy } from './emptyStateCopy';
import { folderSummary } from './folderSummary';
import { SuggestedQuestions } from './SuggestedQuestions';
import { SuggestedQuestionsSkeleton } from './SuggestedQuestionsSkeleton';

interface EmptyStateProps {
  status: IndexStatus | undefined;
  /** Why the folder status could not be fetched. */
  statusError: ApiError | null;
  /** Suggested questions can be sent now. */
  canAsk: boolean;
  onAsk: (question: string) => void;
  /** Fetches the folder status again after an error. */
  onReload: () => void;
  /** The question box, or the call card during a call. It sits under the heading until the first question. */
  composer: ReactNode;
}

/**
 * What the conversation column shows before the first question: the loaded folder by name with a
 * one-line summary, the question box under it, and five suggested questions below; or what to do
 * when no folder is loaded.
 */
export function EmptyState({ status, statusError, canAsk, onAsk, onReload, composer }: EmptyStateProps) {
  const { language } = useLanguage();
  const copy = useCopy(emptyStateCopy);
  const steps = useCopy(sidebarCopy);

  if (!status) {
    if (statusError) {
      return (
        <Frame composer={composer}>
          <ErrorNotice error={statusError} onRetry={onReload} retryLabel={copy.tryAgain} />
        </Frame>
      );
    }
    return (
      <Frame composer={composer} after={<SuggestedQuestionsSkeleton />}>
        <Skeleton height={26} width="45%" radius="sm" />
      </Frame>
    );
  }

  if (status.folder === null) {
    return (
      <Frame composer={composer}>
        <Intro heading={copy.noFolder.heading}>{copy.noFolder.body}</Intro>
      </Frame>
    );
  }

  const name = folderName(status.folder);
  if (status.phase === 'error' && status.error?.code === 'folder_empty') {
    return (
      <Frame composer={composer}>
        <Intro heading={copy.folderEmpty.heading(name)}>{copy.folderEmpty.body}</Intro>
      </Frame>
    );
  }

  if (status.phase === 'error') {
    return (
      <Frame composer={composer}>
        <Intro heading={copy.unreadable(name)} />
        {status.error && <ErrorNotice error={status.error} />}
      </Frame>
    );
  }

  if (status.phase !== 'ready') {
    const now = indexingNow(status, null, steps, language === 'en');
    return (
      <Frame composer={composer} after={<SuggestedQuestionsSkeleton />}>
        <Intro heading={copy.gettingReady(name)}>
          {now !== null && `${sentence(now.message)} `}
          {copy.suggestionsLater}
        </Intro>
      </Frame>
    );
  }

  return (
    <Frame
      composer={composer}
      after={
        status.suggestions.length > 0 && (
          <SuggestedQuestions questions={status.suggestions.slice(0, 5)} disabled={!canAsk} onAsk={onAsk} />
        )
      }
    >
      <Intro heading={copy.askAbout(name)}>{folderSummary(status.documents, copy.summary)}</Intro>
    </Frame>
  );
}

/**
 * The empty column: the heading block, the question box, then what can be asked, held a little above
 * the middle of the sheet where the eye lands.
 */
function Frame({ children, composer, after }: { children: ReactNode; composer: ReactNode; after?: ReactNode }) {
  return (
    <Stack flex={1} justify="center" gap="lg" pt="xl" pb="12dvh">
      <Stack gap="lg">{children}</Stack>
      <Box>{composer}</Box>
      {after}
    </Stack>
  );
}

/** The heading that names the state, with one line under it. */
function Intro({ heading, children }: { heading: string; children?: ReactNode }) {
  return (
    <Stack gap="xs">
      <Title order={1} c="bright" style={{ overflowWrap: 'anywhere' }}>
        {heading}
      </Title>
      {children && (
        <Text fz="md" c="dimmed" maw="65ch">
          {children}
        </Text>
      )}
    </Stack>
  );
}

/** Ends a progress message such as "Reading BOQ.xlsx, 3 of 12" with a full stop. */
function sentence(text: string): string {
  const trimmed = text.trim();
  return /[.!?؟]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}
