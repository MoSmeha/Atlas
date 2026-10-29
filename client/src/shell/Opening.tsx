import { type CSSProperties, Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { useMediaQuery } from '@mantine/hooks';
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
  leaving: 'listening',
  gone: 'listening',
};

/**
 * The opening screen, each time Atlas opens: the bust comes into focus on the chrome with its eyes lowered,
 * looks up, and says its line while the words appear one by one; then the screen lifts away. The app loads
 * underneath meanwhile, so the opening never delays the first answer. Any click or key skips it. With
 * reduced motion the face and the line show at once and fade. It waits for the tab to be seen first.
 */
export function Opening() {
  const copy = useCopy(shellCopy).opening;
  // Read now, not after the first paint, so a reduced-motion visitor never sees the moving version start.
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)', undefined, { getInitialValueInEffect: false });
  const words = copy.quote.split(/\s+/);
  const [phase, setPhase] = useState<OpeningPhase>(reduced ? 'said' : 'arriving');
  // False until the tab is seen, so even the face's focus pull waits for a viewer.
  const [started, setStarted] = useState(false);
  const timers = useRef<number[]>([]);
  const speakingSince = useRef(0);

  const clearTimers = useCallback(() => {
    for (const timer of timers.current) window.clearTimeout(timer);
    timers.current = [];
  }, []);

  // The line and the motion preference stay as they were when the page opened, so this runs once.
  const wordCount = words.length;
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

  const leaving = phase === 'leaving' || phase === 'gone';
  const skip = useCallback(() => {
    if (leaving) return;
    clearTimers();
    setPhase('leaving');
    timers.current = [window.setTimeout(() => setPhase('gone'), reduced ? openingBeats.stillLeaveMs : openingBeats.leaveMs)];
  }, [leaving, reduced, clearTimers]);

  useEffect(() => {
    if (leaving) return;
    window.addEventListener('keydown', skip);
    return () => window.removeEventListener('keydown', skip);
  }, [leaving, skip]);

  const levels = useCallback(
    (): AudioLevels => ({
      mic: 0,
      voice: phase === 'speaking' ? spokenVoice(performance.now() - speakingSince.current, wordCount) : 0,
    }),
    [phase, wordCount],
  );

  if (phase === 'gone') return null;

  return (
    // Decorative: the app underneath is already there for assistive technology, so the opening stays out of its way.
    <div
      className={classes.opening}
      data-phase={phase}
      data-started={started || undefined}
      data-still={reduced || undefined}
      aria-hidden
      onPointerDown={skip}
      style={{ '--leave': `${reduced ? openingBeats.stillLeaveMs : openingBeats.leaveMs}ms` } as CSSProperties}
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
