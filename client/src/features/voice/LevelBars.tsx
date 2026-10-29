import { useEffect, useRef } from 'react';
import classes from './LevelBars.module.css';

const BARS = 5;
/** Loudness above which the microphone counts as hearing speech, and below which it counts as quiet again. */
const SPEECH_ON = 0.08;
const SPEECH_OFF = 0.04;

/**
 * Five still bars beside a dictation's timer. They darken while the microphone hears speech and fade back when it is
 * quiet, one 150ms colour change each way, so the user can see they are heard without anything moving outside the
 * call avatar.
 */
export function LevelBars({ level }: { level: () => number }) {
  const bars = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let hearing = false;
    let smooth = 0;
    const timer = setInterval(() => {
      smooth += (level() - smooth) * 0.5;
      const next = hearing ? smooth > SPEECH_OFF : smooth > SPEECH_ON;
      if (next === hearing) return;
      hearing = next;
      if (hearing) bars.current?.setAttribute('data-hearing', '');
      else bars.current?.removeAttribute('data-hearing');
    }, 100);
    return () => clearInterval(timer);
  }, [level]);

  return (
    <span ref={bars} className={classes.bars} aria-hidden>
      {Array.from({ length: BARS }, (_, i) => (
        <span key={i} className={classes.bar} />
      ))}
    </span>
  );
}
