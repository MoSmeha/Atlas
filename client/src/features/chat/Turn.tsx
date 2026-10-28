import { Stack, Title } from '@mantine/core';
import { motion } from '../../theme';
import { ErrorNotice } from '../errors/ErrorNotice';
import { AnswerMarkdown } from './AnswerMarkdown';
import { AnswerNotice } from './AnswerNotice';
import { AnswerWarnings } from './AnswerWarnings';
import { PendingLine } from './PendingLine';
import { StoppedNote } from './StoppedNote';
import { Trace } from './Trace';
import { isArabicText } from './arabicText';
import type { Turn as ChatTurn } from './chatReducer';
import classes from './Turn.module.css';

interface TurnProps {
  turn: ChatTurn;
  /** Asks the turn's question again, after an error or a stop. */
  onRetry: (turnId: string) => void;
}

const settleTiming = { animationDuration: `${motion.durationMs}ms`, animationTimingFunction: motion.easing };

/**
 * One question and its answer: the question as a heading-weight line, then the streamed answer,
 * then the parts that arrive with the finished answer, and last "How I found this".
 */
export function Turn({ turn, onRetry }: TurnProps) {
  const { answer, status } = turn;
  const streaming = status === 'streaming';
  const hasText = turn.markdown.trim() !== '';
  const questionId = `${turn.id}-question`;
  const retry = () => onRetry(turn.id);

  const text =
    hasText && status !== 'error' ? (
      <AnswerMarkdown
        markdown={turn.markdown}
        streaming={streaming}
        language={answer?.language ?? null}
        questionArabic={isArabicText(turn.question)}
        muted={status === 'stopped'}
      />
    ) : null;

  return (
    <Stack
      component="article"
      id={turn.id}
      gap="md"
      aria-labelledby={questionId}
      className={classes.turn}
      data-status={status}
    >
      <Title order={2} id={questionId} fz="xl" lh={1.35} className={classes.question} dir="auto">
        {turn.question}
      </Title>

      {streaming && !hasText && <PendingLine steps={turn.steps} />}

      {answer && answer.kind !== 'answer' ? (
        <AnswerNotice kind={answer.kind} unreadableFiles={answer.unreadableFiles}>
          {text}
        </AnswerNotice>
      ) : (
        text
      )}

      {status === 'stopped' && <StoppedNote hadText={hasText} onAskAgain={retry} />}
      {status === 'error' && turn.error && <ErrorNotice error={turn.error} onRetry={retry} />}

      {answer && (
        <Stack gap="md" className={classes.settle} style={settleTiming}>
          <AnswerWarnings warnings={answer.warnings} />
          {/* Slot (feature/client-sources): the result table, answer.table, with its export menu. */}
          {/* Slot (feature/client-sources): numbered source rows from answer.sources. */}
        </Stack>
      )}

      <Trace steps={turn.steps} streaming={streaming} durationMs={turn.usage?.durationMs ?? null} />
    </Stack>
  );
}
