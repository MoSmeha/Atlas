import type { ReactNode } from 'react';
import { Skeleton, Stack, Text, Title } from '@mantine/core';
import type { IndexStatus } from '@atlas/shared';
import type { ApiError } from '../../api/ApiError';
import { ErrorNotice } from '../errors/ErrorNotice';
import { SuggestedQuestions } from './SuggestedQuestions';
import { SuggestedQuestionsSkeleton } from './SuggestedQuestionsSkeleton';
import { folderName, folderSummary } from './folderSummary';

interface EmptyStateProps {
  status: IndexStatus | undefined;
  /** Why the folder status could not be fetched. */
  statusError: ApiError | null;
  /** Suggested questions can be sent now. */
  canAsk: boolean;
  onAsk: (question: string) => void;
  /** Fetches the folder status again after an error. */
  onReload: () => void;
}

/**
 * What the conversation column shows before the first question: the loaded folder by name, a
 * one-line summary of it and five suggested questions, or what to do when no folder is loaded.
 */
export function EmptyState({ status, statusError, canAsk, onAsk, onReload }: EmptyStateProps) {
  if (!status) {
    if (statusError) {
      return (
        <Frame>
          <ErrorNotice error={statusError} onRetry={onReload} retryLabel="Try again" />
        </Frame>
      );
    }
    return (
      <Frame>
        <Skeleton height={26} width="45%" radius="sm" />
        <SuggestedQuestionsSkeleton />
      </Frame>
    );
  }

  if (status.folder === null) {
    return (
      <Frame>
        <Intro heading="Load a folder to begin">
          Type the path of a folder of PDF and Excel files in the documents panel, or drop files there. Atlas reads every
          file, then answers your questions with the page or rows each fact came from.
        </Intro>
      </Frame>
    );
  }

  const name = folderName(status.folder);
  if (status.phase === 'error' && status.error?.code === 'folder_empty') {
    return (
      <Frame>
        <Intro heading={`No PDF or Excel files in ${name}`}>
          Load a folder that holds PDF or Excel files, or drop files into the documents panel.
        </Intro>
      </Frame>
    );
  }

  if (status.phase === 'error') {
    return (
      <Frame>
        <Intro heading={`Atlas could not read ${name}`} />
        {status.error && <ErrorNotice error={status.error} />}
      </Frame>
    );
  }

  if (status.phase !== 'ready') {
    return (
      <Frame>
        <Intro heading={`Getting ${name} ready`}>
          {sentence(status.progress?.message ?? 'Looking for PDF and Excel files')} Suggested questions appear when it is done.
        </Intro>
        <SuggestedQuestionsSkeleton />
      </Frame>
    );
  }

  return (
    <Frame>
      <Intro heading={`Ask about ${name}`}>{folderSummary(status.documents)}</Intro>
      {status.suggestions.length > 0 ? (
        <SuggestedQuestions questions={status.suggestions.slice(0, 5)} disabled={!canAsk} onAsk={onAsk} />
      ) : (
        <Text fz="md" c="dimmed">
          Type a question below to start.
        </Text>
      )}
    </Frame>
  );
}

function Frame({ children }: { children: ReactNode }) {
  return (
    <Stack flex={1} justify="center" gap="lg" py="xl">
      {children}
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
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}
