import { Code, Text, VisuallyHidden } from '@mantine/core';
import type { ToolStep } from '@atlas/shared';
import { useCopy } from '../../i18n/useCopy';
import { useLanguage } from '../../i18n/useLanguage';
import { TraceStepIcon, type TraceStepState } from './TraceStepIcon';
import { formatDuration } from './formatDuration';
import { describeStepInput, stepInputDir } from './stepInput';
import { stepLabel } from './stepLabel';
import { traceCopy } from './traceCopy';
import classes from './Trace.module.css';

interface TraceStepProps {
  step: ToolStep;
  /** The answer stopped streaming, so a step still marked running will never finish. */
  ended: boolean;
}

/**
 * One tool call in "How I found this": what Atlas did, what it asked for (SQL and formulas in
 * monospace), what came back and how long it took. A failed or skipped call shows why instead.
 * What came back is the server's own line, shown in its own direction.
 */
export function TraceStep({ step, ended }: TraceStepProps) {
  const { language } = useLanguage();
  const copy = useCopy(traceCopy);
  const state: TraceStepState = ended && step.status === 'running' ? 'unfinished' : step.status;
  const input = describeStepInput(step.name, step.inputSummary, language);
  const duration =
    step.durationMs !== null && (state === 'ok' || step.durationMs > 0) ? formatDuration(step.durationMs, language) : null;

  return (
    <li className={classes.step} data-status={state}>
      <span className={classes.marker}>
        <TraceStepIcon status={state} />
      </span>
      <div className={classes.body}>
        <div className={classes.head}>
          <Text component="span" fz="sm" fw={600} c="gray.9">
            {stepLabel(step.name, language)}
          </Text>
          <VisuallyHidden>{`${copy.pause}${copy.states[state]}`}</VisuallyHidden>
          {duration && (
            <Text component="span" fz="xs" c="dimmed" className={`${classes.duration} tabular-nums`}>
              {duration}
            </Text>
          )}
        </div>
        {input &&
          (input.kind === 'code' ? (
            <Code block dir="ltr" className={classes.code}>
              {input.text}
            </Code>
          ) : (
            <Text fz="sm" c="gray.8" dir={stepInputDir(input)} className={classes.wrap}>
              {input.text}
            </Text>
          ))}
        {state === 'error' || state === 'refused' ? (
          <Text fz="sm" c="var(--mantine-color-error)" dir="auto" className={classes.wrap}>
            {copy.failed(state, step.error)}
          </Text>
        ) : state === 'unfinished' ? (
          <Text fz="sm" c="dimmed">
            {copy.unfinished}
          </Text>
        ) : (
          step.resultSummary && (
            <Text fz="sm" c="dimmed" dir="auto" className={classes.wrap}>
              {step.resultSummary}
            </Text>
          )
        )}
      </div>
    </li>
  );
}
