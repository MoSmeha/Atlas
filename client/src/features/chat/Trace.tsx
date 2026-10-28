import { useId, useRef } from 'react';
import { Collapse, UnstyledButton, VisuallyHidden } from '@mantine/core';
import { useDisclosure, useReducedMotion } from '@mantine/hooks';
import { IconChevronRight } from '@tabler/icons-react';
import type { ToolStep } from '@atlas/shared';
import { motion } from '../../theme';
import { TraceStep } from './TraceStep';
import { traceSummary } from './traceSummary';
import classes from './Trace.module.css';

interface TraceProps {
  /** Tool calls in the order they started; running ones update in place. */
  steps: ToolStep[];
  streaming: boolean;
  /** How long the whole answer took, once it is in. */
  durationMs: number | null;
}

const chevronTiming = { transitionDuration: `${motion.durationMs}ms`, transitionTimingFunction: motion.easing };

/**
 * "How I found this", collapsed under an answer: one line with the step count and time that opens
 * onto every tool step in order. While the answer streams, the steps appear and finish live.
 */
export function Trace({ steps, streaming, durationMs }: TraceProps) {
  const [opened, { toggle }] = useDisclosure(false);
  const stepsId = useId();
  const root = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  if (steps.length === 0) return null;

  // Under the newest answer the steps open behind the docked composer, so once open they scroll into view.
  const onToggle = () => {
    toggle();
    if (opened) return;
    window.setTimeout(
      () => root.current?.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' }),
      reduceMotion ? 0 : motion.durationMs,
    );
  };

  return (
    <div ref={root} className={classes.trace}>
      <UnstyledButton className={classes.toggle} onClick={onToggle} aria-expanded={opened} aria-controls={stepsId}>
        <IconChevronRight size={16} stroke={1.75} className={classes.chevron} style={chevronTiming} aria-hidden />
        <span className={classes.label}>How I found this</span>
        <span className={classes.meta} aria-hidden>
          ·
        </span>
        <VisuallyHidden>, </VisuallyHidden>
        <span className={classes.meta}>{traceSummary(steps, streaming, durationMs)}</span>
      </UnstyledButton>
      <Collapse
        id={stepsId}
        expanded={opened}
        transitionDuration={motion.durationMs}
        transitionTimingFunction={motion.easing}
      >
        <ol className={classes.steps} aria-label="Steps Atlas took">
          {steps.map((step) => (
            <TraceStep key={step.id} step={step} />
          ))}
        </ol>
      </Collapse>
    </div>
  );
}
