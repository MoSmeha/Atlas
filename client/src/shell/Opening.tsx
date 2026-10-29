import { type CSSProperties, Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { AudioLevels } from '../api/audioMeter';
import { AtlasFace } from '../features/voice/AtlasFace';
import type { FaceMood } from '../features/voice/faceMotion';
import { useCopy } from '../i18n/useCopy';
import classes from './Opening.module.css';
import { type OpeningPhase, openingBeats, openingTimeline, spokenVoice } from './openingScript';
import { shellCopy } from './shellCopy';

const moods: Record<OpeningPhase, FaceMood> = {
  arriving: 'resting',
  awake: 'listening',
  speaking: 'speaking',
  said: 'listening',
};

interface OpeningProps {
  /** A question is being written or a call is open, so the face and its line step back until the box is empty again. */
  away: boolean;
  /** The line is said, or was skipped: the question box can rise into place. */
  onSaid: () => void;
}

/**
 * The empty conversation, and how it opens: the bust comes into focus with its eyes lowered, looks up, and says its
 * line while the words appear one by one; then it stays, blinking now and then, until a question is written. Any click
 * or key finishes the line at once. With reduced motion the face and the line are simply there. It waits for the tab
 * to be seen first.
 */
export function Opening({ away, onSaid }: OpeningProps) {
  const copy = useCopy(shellCopy).opening;
  const words = copy.quote.split(/\s+/);
  // Both stay as they were when the opening started: read before the first paint, so a reduced-motion visitor never
  // sees the moving version start, and a language switch later changes the words without timing them again.
  const [reduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [wordCount] = useState(words.length);
  const [phase, setPhase] = useState<OpeningPhase>(reduced ? 'said' : 'arriving');
  // False until the tab is seen, so even the face's focus pull waits for a viewer.
  const [started, setStarted] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const timers = useRef<number[]>([]);
  const speakingSince = useRef(0);

  const clearTimers = useCallback(() => {
    for (const timer of timers.current) window.clearTimeout(timer);
    timers.current = [];
  }, []);

  useEffect(() => {
    const start = () => {
      setStarted(true);
      timers.current = openingTimeline(wordCount, reduced).map(({ phase: next, at }) =>
        window.setTimeout(() => setPhase(next), at),
      );
    };
    // Opened in a background tab, it plays when the tab is first looked at, not unseen.
    const onVisible = () => {
      if (document.hidden) return;
      document.removeEventListener('visibilitychange', onVisible);
      start();
    };
    if (document.hidden) document.addEventListener('visibilitychange', onVisible);
    else start();
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      clearTimers();
    };
  }, [wordCount, reduced, clearTimers]);

  useEffect(() => {
    if (phase === 'speaking') speakingSince.current = performance.now();
  }, [phase]);

  // Before the paint, so with reduced motion the question box is there from the first frame.
  const said = phase === 'said';
  useLayoutEffect(() => {
    if (said) onSaid();
  }, [said, onSaid]);

  const skip = useCallback(() => {
    clearTimers();
    setSkipped(true);
    setPhase('said');
  }, [clearTimers]);

  useEffect(() => {
    if (said) return;
    window.addEventListener('keydown', skip);
    window.addEventListener('pointerdown', skip);
    return () => {
      window.removeEventListener('keydown', skip);
      window.removeEventListener('pointerdown', skip);
    };
  }, [said, skip]);

  const levels = useCallback(
    (): AudioLevels => ({
      mic: 0,
      voice: phase === 'speaking' ? spokenVoice(performance.now() - speakingSince.current, wordCount) : 0,
    }),
    [phase, wordCount],
  );

  return (
    <div
      className={classes.opening}
      data-phase={phase}
      data-started={started || undefined}
      data-still={reduced || undefined}
      data-skipped={skipped || undefined}
      data-away={away || undefined}
      aria-hidden={away || undefined}
    >
      <figure className={classes.stage}>
        <div className={classes.face}>
          <AtlasFace mood={moods[phase]} levels={levels} size="opening" />
        </div>
        <blockquote className={classes.quote}>
          {words.map((word, index) => (
            <Fragment key={index}>
              {index > 0 && ' '}
              <span className={classes.word} style={{ '--word-at': `${index * openingBeats.wordMs}ms` } as CSSProperties}>
                {index === 0 && copy.open}
                {word}
                {index === words.length - 1 && copy.close}
              </span>
            </Fragment>
          ))}
        </blockquote>
        <figcaption className={classes.by}>
          {'— '}
          <span lang="en" dir="ltr">
            {copy.by}
          </span>
        </figcaption>
      </figure>
    </div>
  );
}
