import { useEffect, useId, useRef } from 'react';
import { useReducedMotion } from '@mantine/hooks';
import type { AudioLevels } from '../../api/audioMeter';
import classes from './AtlasFace.module.css';
import {
  BACK_HAIR,
  BEARD,
  BROWS,
  CURLS,
  FACE,
  FOLD,
  FRINGE,
  LEFT_EYE,
  LIPS,
  MOUSTACHE,
  NECK,
  RIGHT_EYE,
  SHOULDERS,
  SOFT_FOLD,
  beardTransform,
  eyeTransform,
  lipsHeight,
  mouthPath,
} from './faceDrawing';
import {
  BLINK_MS,
  type FaceMood,
  type FacePose,
  blinkOpenness,
  breath,
  easePose,
  nextBlinkDelay,
  restingPose,
  targetPose,
} from './faceMotion';

interface AtlasFaceProps {
  mood: FaceMood;
  /** Read every frame: Atlas's voice opens the mouth. */
  levels: () => AudioLevels;
  /** 72px in the call card (56px on a phone), or 156px (120px on a phone) in the empty conversation's opening. */
  size?: 'call' | 'opening';
}

interface Parts {
  figure: SVGGElement | null;
  head: SVGGElement | null;
  leftEye: SVGGElement | null;
  rightEye: SVGGElement | null;
  brows: SVGGElement | null;
  beard: SVGPathElement | null;
  lips: SVGEllipseElement | null;
  mouth: SVGPathElement | null;
  ring: SVGCircleElement | null;
}

/** Writes one frame straight onto the drawing, so the face moves without React rendering every frame. */
function draw(parts: Parts, pose: FacePose, breathing: number, blink: number): void {
  const open = pose.eyeOpen * blink;
  parts.figure?.setAttribute('transform', `translate(0 ${(breathing * 0.7).toFixed(2)})`);
  parts.head?.setAttribute('transform', `rotate(${pose.tilt.toFixed(2)} ${NECK[0]} ${NECK[1]})`);
  parts.leftEye?.setAttribute('transform', eyeTransform(LEFT_EYE, pose.lookX, pose.lookY, open));
  parts.rightEye?.setAttribute('transform', eyeTransform(RIGHT_EYE, pose.lookX, pose.lookY, open));
  parts.brows?.setAttribute('transform', `translate(0 ${(-pose.brow * 2.4).toFixed(2)})`);
  parts.beard?.setAttribute('transform', beardTransform(pose.mouth));
  parts.lips?.setAttribute('ry', lipsHeight(pose.mouth).toFixed(2));
  parts.mouth?.setAttribute('d', mouthPath(pose.mouth, pose.smile));
}

/**
 * Atlas during a call: a philosopher's bust in the app's graphite line work, with curls and a full beard. It blinks
 * and breathes while it listens, raises its brows while the user speaks, looks up while it checks the documents, and
 * moves its mouth with the loudness of its own voice. The ring around it is dashed and turning while the call connects
 * and while it works, and turns ink while it speaks. With reduced motion the face holds one still pose per state. The
 * empty conversation uses the same face, larger, to say Atlas's line.
 */
export function AtlasFace({ mood, levels, size = 'call' }: AtlasFaceProps) {
  const reduceMotion = useReducedMotion();
  const clipId = useId();
  const parts = useRef<Parts>({
    figure: null,
    head: null,
    leftEye: null,
    rightEye: null,
    brows: null,
    beard: null,
    lips: null,
    mouth: null,
    ring: null,
  });
  const latest = useRef({ mood, levels });

  useEffect(() => {
    latest.current = { mood, levels };
  });

  // Reduced motion: one still pose per state, which still says listening, checking or speaking.
  useEffect(() => {
    if (reduceMotion) draw(parts.current, targetPose(mood, mood === 'speaking' ? 0.2 : 0), 0, 1);
  }, [reduceMotion, mood]);

  // Otherwise one loop for the whole call, reading the mood and the voice as it goes; it pauses in a hidden tab.
  useEffect(() => {
    if (reduceMotion) return;
    let pose: FacePose = restingPose;
    let last = performance.now();
    let blinkStartedAt = Number.NEGATIVE_INFINITY;
    let nextBlinkAt = last + nextBlinkDelay(Math.random);
    let glance = { x: 0, y: 0 };
    let nextGlanceAt = last + 1_800;
    let hearing = 0;
    let frame = requestAnimationFrame(function step(now: number) {
      frame = requestAnimationFrame(step);
      const dt = Math.min(64, now - last);
      last = now;
      if (document.hidden) return;
      const current = latest.current.mood;
      const levels = latest.current.levels();
      const target = { ...targetPose(current, levels.voice) };
      // While the user speaks, the ring's weight follows their voice; otherwise the stylesheet's ring returns.
      hearing += ((current === 'hearing' ? levels.mic : 0) - hearing) * 0.3;
      if (current === 'hearing') parts.current.ring?.style.setProperty('stroke-width', `${(1.2 + Math.min(1, hearing * 1.8) * 1.6).toFixed(2)}px`);
      else parts.current.ring?.style.removeProperty('stroke-width');
      // While it only listens, the eyes drift now and then, as anyone's do.
      if (current === 'listening' && now >= nextGlanceAt) {
        glance = { x: (Math.random() * 2 - 1) * 0.35, y: (Math.random() * 2 - 1) * 0.2 };
        nextGlanceAt = now + 1_600 + Math.random() * 2_600;
      } else if (current !== 'listening') {
        glance = { x: 0, y: 0 };
      }
      target.lookX += glance.x;
      target.lookY += glance.y;
      pose = easePose(pose, target, dt, 110, 45);
      if (now >= nextBlinkAt && target.eyeOpen >= 0.5) {
        blinkStartedAt = now;
        nextBlinkAt = now + BLINK_MS + nextBlinkDelay(Math.random);
      }
      draw(parts.current, pose, breath(now), blinkOpenness(now - blinkStartedAt));
    });
    return () => cancelAnimationFrame(frame);
  }, [reduceMotion]);

  const set =
    <K extends keyof Parts>(key: K) =>
    (element: Parts[K]) => {
      parts.current[key] = element;
    };

  return (
    <svg className={classes.face} viewBox="0 0 120 120" data-mood={mood} data-size={size} role="img" aria-label="Atlas">
      <defs>
        <clipPath id={clipId}>
          <circle cx="60" cy="60" r="58" />
        </clipPath>
      </defs>
      <circle className={classes.ground} cx="60" cy="60" r="58" />
      <g clipPath={`url(#${clipId})`}>
        <g ref={set('figure')}>
          <path className={classes.cloth} d={SHOULDERS} />
          <path className={classes.curl} d={FOLD} />
          <path className={classes.curl} d={SOFT_FOLD} />
          <g ref={set('head')}>
            <path className={classes.hair} d={BACK_HAIR} />
            <path className={classes.skin} d={FACE} />
            <path className={classes.hair} d={FRINGE} />
            <g ref={set('brows')}>
              {BROWS.map((brow) => (
                <path key={brow} className={classes.line} d={brow} />
              ))}
            </g>
            <g ref={set('leftEye')} transform={eyeTransform(LEFT_EYE, restingPose.lookX, restingPose.lookY, restingPose.eyeOpen)}>
              <ellipse className={classes.eye} rx="2.7" ry="3.3" />
              <circle className={classes.glint} cx="0.9" cy="-1.1" r="0.75" />
            </g>
            <g ref={set('rightEye')} transform={eyeTransform(RIGHT_EYE, restingPose.lookX, restingPose.lookY, restingPose.eyeOpen)}>
              <ellipse className={classes.eye} rx="2.7" ry="3.3" />
              <circle className={classes.glint} cx="0.9" cy="-1.1" r="0.75" />
            </g>
            <path ref={set('beard')} className={classes.hair} d={BEARD} />
            {CURLS.map((curl) => (
              <path key={curl} className={classes.curl} d={curl} />
            ))}
            <ellipse ref={set('lips')} className={classes.lips} cx={LIPS[0]} cy={LIPS[1]} rx="6.6" ry={lipsHeight(0)} />
            <path className={classes.thin} d={MOUSTACHE} />
            <path ref={set('mouth')} className={classes.mouth} d={mouthPath(0, restingPose.smile)} />
          </g>
        </g>
      </g>
      <circle ref={set('ring')} className={classes.ring} cx="60" cy="60" r="58" />
    </svg>
  );
}
