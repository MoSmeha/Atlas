import { useEffect, useState } from 'react';
import { Alert, Button, Group, Stack, Text } from '@mantine/core';
import { IconAlertCircle, IconAlertTriangle, IconInfoCircle } from '@tabler/icons-react';
import type { ApiErrorCode } from '../../api/ApiError';
import { type ErrorTone, errorCopy } from './errorCopy';

/** Anything with an error code and a message: an ApiError, an ErrorDetail or a chat turn's error. */
export interface NoticeError {
  code: ApiErrorCode;
  message: string;
  retryAfterSeconds?: number | null;
}

interface ErrorNoticeProps {
  error: NoticeError;
  /** Shown as a button when asking again can work. */
  onRetry?: () => void;
  retryLabel?: string;
}

const toneColor: Record<ErrorTone, 'red' | 'yellow' | 'gray'> = { error: 'red', warning: 'yellow', neutral: 'gray' };
const toneIcon = { error: IconAlertCircle, warning: IconAlertTriangle, neutral: IconInfoCircle };

/** A plain-language error: what went wrong, what to do next, and a retry button when one helps. */
export function ErrorNotice({ error, onRetry, retryLabel = 'Ask again' }: ErrorNoticeProps) {
  const { title, advice, tone, retryable } = errorCopy(error.code);
  const color = toneColor[tone];
  const Icon = toneIcon[tone];
  const wait = useCountdown(error.retryAfterSeconds ?? 0);
  const message = error.message.trim() === '' ? advice : error.message;

  return (
    <Alert
      role="alert"
      title={title}
      icon={<Icon size={18} stroke={1.75} />}
      styles={{
        root: {
          backgroundColor: `var(--mantine-color-${color}-0)`,
          border: `1px solid var(--mantine-color-${color}-2)`,
        },
        title: { color: `var(--mantine-color-${color}-9)`, fontWeight: 600, fontSize: 'var(--mantine-font-size-sm)' },
        icon: { color: `var(--mantine-color-${color}-7)` },
      }}
    >
      <Stack gap="xs" align="flex-start">
        <Text fz="sm" c="gray.8">
          {message}
        </Text>
        {onRetry && retryable && (
          <Group gap="xs">
            <Button variant="default" size="xs" onClick={onRetry} disabled={wait > 0}>
              {wait > 0 ? `${retryLabel} in ${wait} s` : retryLabel}
            </Button>
          </Group>
        )}
      </Stack>
    </Alert>
  );
}

/** Whole seconds left of `seconds`, counting down once a second from when the notice appears. */
function useCountdown(seconds: number): number {
  const [left, setLeft] = useState(Math.ceil(seconds));
  useEffect(() => {
    setLeft(Math.ceil(seconds));
    if (seconds <= 0) return;
    const endsAt = Date.now() + seconds * 1000;
    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setLeft(remaining);
      if (remaining === 0) clearInterval(timer);
    }, 250);
    return () => clearInterval(timer);
  }, [seconds]);
  return left;
}
