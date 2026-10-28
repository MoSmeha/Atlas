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
        <Heading>Load a folder to begin</Heading>
        <Line>
          Type the path of a folder of PDF and Excel files in the documents panel, or drop files there. Atlas reads every
          file, then answers your questions with the page or rows each fact came from.
        </Line>
      </Frame>
    );
  }

  const name = folderName(status.folder);
  if (status.phase === 'error') {
    return (
      <Frame>
        <Heading>Atlas could not read {name}</Heading>
        {status.error && <ErrorNotice error={status.error} />}
      </Frame>
    );
  }

  if (status.phase !== 'ready') {
    return (
      <Frame>
        <Heading>Reading {name}</Heading>
        <Line>{status.progress?.message ?? 'Looking for PDF and Excel files.'} Suggested questions appear when it is done.</Line>
        <SuggestedQuestionsSkeleton />
      </Frame>
    );
  }

  return (
    <Frame>
      <Stack gap={6}>
        <Heading>Ask about {name}</Heading>
        <Line>{folderSummary(status.documents)}</Line>
      </Stack>
      {status.suggestions.length > 0 ? (
        <SuggestedQuestions questions={status.suggestions.slice(0, 5)} disabled={!canAsk} onAsk={onAsk} />
      ) : (
        <Line>Type a question below to start.</Line>
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

function Heading({ children }: { children: ReactNode }) {
  return (
    <Title order={1} c="bright" style={{ overflowWrap: 'anywhere' }}>
      {children}
    </Title>
  );
}

function Line({ children }: { children: ReactNode }) {
  return (
    <Text fz="md" c="dimmed" maw="65ch">
      {children}
    </Text>
  );
}
