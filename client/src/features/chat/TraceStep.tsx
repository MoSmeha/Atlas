import { Code, Text, VisuallyHidden } from '@mantine/core';
import type { ToolStep } from '@atlas/shared';
import { TraceStepIcon, stepStateWords } from './TraceStepIcon';
import { formatDuration } from './formatDuration';
import { describeStepInput } from './stepInput';
import { stepLabel } from './stepLabel';
import classes from './Trace.module.css';

/**
 * One tool call in "How I found this": what Atlas did, what it asked for (SQL and formulas in
 * monospace), what came back and how long it took. A failed or skipped call shows why instead.
 */
export function TraceStep({ step }: { step: ToolStep }) {
  const input = describeStepInput(step.name, step.inputSummary);
  const failed = step.status === 'error' || step.status === 'refused';
  const duration =
    step.durationMs !== null && (step.status === 'ok' || step.durationMs > 0) ? formatDuration(step.durationMs) : null;

  return (
    <li className={classes.step} data-status={step.status}>
      <span className={classes.marker}>
        <TraceStepIcon status={step.status} />
      </span>
      <div className={classes.body}>
        <div className={classes.head}>
          <Text component="span" fz="sm" fw={600} c="gray.9">
            {stepLabel(step.name)}
          </Text>
          <VisuallyHidden>{`, ${stepStateWords[step.status]}`}</VisuallyHidden>
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
            {step.error ?? stepStateWords[step.status]}
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
