import { Code, Text, VisuallyHidden } from '@mantine/core';
import type { ToolStep } from '@atlas/shared';
import { TraceStepIcon, type TraceStepState, stepStateWords } from './TraceStepIcon';
import { formatDuration } from './formatDuration';
import { describeStepInput } from './stepInput';
import { stepLabel } from './stepLabel';
import classes from './Trace.module.css';

interface TraceStepProps {
  step: ToolStep;
  /** The answer stopped streaming, so a step still marked running will never finish. */
  ended: boolean;
}

/**
 * One tool call in "How I found this": what Atlas did, what it asked for (SQL and formulas in
 * monospace), what came back and how long it took. A failed or skipped call shows why instead.
 */
export function TraceStep({ step, ended }: TraceStepProps) {
  const state: TraceStepState = ended && step.status === 'running' ? 'unfinished' : step.status;
  const input = describeStepInput(step.name, step.inputSummary);
  const failed = state === 'error' || state === 'refused';
  const duration =
    step.durationMs !== null && (state === 'ok' || step.durationMs > 0) ? formatDuration(step.durationMs) : null;

  return (
    <li className={classes.step} data-status={state}>
      <span className={classes.marker}>
        <TraceStepIcon status={state} />
      </span>
      <div className={classes.body}>
        <div className={classes.head}>
          <Text component="span" fz="sm" fw={600} c="gray.9">
            {stepLabel(step.name)}
          </Text>
          <VisuallyHidden>{`, ${stepStateWords[state]}`}</VisuallyHidden>
          {duration && (
            <Text component="span" fz="xs" c="dimmed" className={`${classes.duration} tabular-nums`}>
              {duration}
            </Text>
          )}
        </div>
        {input &&
          (input.code ? (
            <Code block dir="ltr" className={classes.code}>
              {input.text}
            </Code>
          ) : (
            <Text fz="sm" c="gray.8" dir="ltr" className={classes.wrap}>
              {input.text}
            </Text>
          ))}
        {failed ? (
          <Text fz="sm" c="var(--mantine-color-error)" className={classes.wrap}>
            {step.error ?? stepStateWords[state]}
          </Text>
        ) : state === 'unfinished' ? (
          <Text fz="sm" c="dimmed">
            Did not finish.
          </Text>
        ) : (
          step.resultSummary && (
            <Text fz="sm" c="dimmed" className={classes.wrap}>
              {step.resultSummary}
            </Text>
          )
        )}
      </div>
    </li>
  );
}
