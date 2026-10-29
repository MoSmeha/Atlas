import { useEffect, useState } from 'react';
import { Alert, Button, Group, Stack, Text } from '@mantine/core';
import { IconAlertCircle, IconAlertTriangle, IconInfoCircle } from '@tabler/icons-react';
import { figure } from '../../i18n/count';
import type { Bilingual } from '../../i18n/language';
import { useCopy } from '../../i18n/useCopy';
import { useLanguage } from '../../i18n/useLanguage';
import { type ErrorTone, type NoticeError, errorCopy } from './errorCopy';
import { type NoticeColor, noticeStyles } from './noticeStyles';

interface ErrorNoticeProps {
  error: NoticeError;
  /** Shown as a button when asking again can work. */
  onRetry?: () => void;
  retryLabel?: string;
}

const noticeCopy: Bilingual<{ askAgain: string; retryIn: (label: string, seconds: number) => string }> = {
  en: { askAgain: 'Ask again', retryIn: (label, seconds) => `${label} in ${figure(seconds)} s` },
  ar: { askAgain: 'اسأل مرة أخرى', retryIn: (label, seconds) => `${label} بعد ${figure(seconds)} ث` },
};

const toneColor: Record<ErrorTone, NoticeColor> = { error: 'red', warning: 'yellow', neutral: 'gray' };
const toneIcon = { error: IconAlertCircle, warning: IconAlertTriangle, neutral: IconInfoCircle };

/** A plain-language error: what went wrong, what to do next, and a retry button when one helps. */
export function ErrorNotice({ error, onRetry, retryLabel }: ErrorNoticeProps) {
  const { language } = useLanguage();
  const text = useCopy(noticeCopy);
  const { title, detail, tone, retryable } = errorCopy(error, language);
  const color = toneColor[tone];
  const Icon = toneIcon[tone];
  const wait = useCountdown(error.retryAfterSeconds ?? 0);
  const showRetry = onRetry !== undefined && retryable;
  const label = retryLabel ?? text.askAgain;

  return (
    <Alert
      role="alert"
      title={title}
      icon={<Icon size={18} stroke={1.75} />}
      styles={noticeStyles(color)}
    >
      {(detail !== '' || showRetry) && (
        <Stack gap="xs" align="flex-start">
          {detail !== '' && (
            <Text fz="sm" c="gray.8">
              {detail}
            </Text>
          )}
          {showRetry && (
            <Group gap="xs">
              <Button variant="default" size="xs" onClick={onRetry} disabled={wait > 0}>
                {wait > 0 ? text.retryIn(label, wait) : label}
              </Button>
            </Group>
          )}
        </Stack>
      )}
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
