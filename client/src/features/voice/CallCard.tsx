import { ActionIcon, Button, Group, Stack, Text, Tooltip } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconMicrophone, IconMicrophoneOff, IconPhoneOff, IconPlayerStopFilled } from '@tabler/icons-react';
import { motion } from '../../theme';
import { pendingActivity } from '../chat/stepActivity';
import { useChat } from '../chat/useChat';
import { formatCost } from '../topbar/usageText';
import { AtlasFace } from './AtlasFace';
import classes from './CallCard.module.css';
import type { CallView } from './CallSession';
import { clockText } from './callCopy';
import { faceMood } from './faceMotion';
import { useVoiceCall } from './useVoiceCall';
import { VoicePicker } from './VoicePicker';

const settleTiming = { animationDuration: `${motion.durationMs}ms`, animationTimingFunction: motion.easing };

/** Below Mantine's xs breakpoint the call's controls grow to 40px and End call becomes an icon. */
const PHONE = '(max-width: 36em)';

/** The line beside Atlas's face: what the call is doing right now. `working` names the step, as the thread does. */
function statusText(call: CallView, voiceLabel: string, working: string): string {
  switch (call.status) {
    case 'connecting':
      return `Calling Atlas in ${voiceLabel}…`;
    case 'ending':
      return call.endReason === 'switching' ? 'Changing the voice…' : 'Ending the call…';
    case 'ended':
      return 'Call ended';
    case 'live':
      if (call.activity === 'speaking') return 'Atlas is speaking';
      if (call.activity === 'thinking') return working;
      return call.muted ? 'Muted' : 'Listening';
  }
}

/** A hint that needs reading now; null for the standing one, which a phone leaves out to save room. */
function urgentHint(call: CallView): string | null {
  if (call.status === 'connecting') return 'Allow the microphone if the browser asks.';
  if (call.muted) return 'Atlas cannot hear you while the microphone is muted.';
  return null;
}

const STANDING_HINT = 'Speak naturally and interrupt any time. Every answer is also written above, with its sources.';

/**
 * The voice call, docked where the question box was: Atlas's face, what it is doing, the call's length and cost, the
 * latest words from each side, and the controls. Every question it answers lands in the thread above as a normal turn.
 */
export function CallCard() {
  const voice = useVoiceCall();
  const { turns } = useChat();
  const phone = useMediaQuery(PHONE) ?? false;
  const call = voice.call;
  if (call === null) return null;

  const current = voice.voices.find((option) => option.id === voice.voiceId);
  const voiceLabel = current?.label ?? 'English';
  const live = call.status === 'live';
  const cost = (call.seconds / 60) * voice.pricePerMinute;
  // Before anyone speaks, the user's line, with its prompt, counts as the latest.
  const userLatest = call.lastSpeaker !== 'atlas';
  const hint = urgentHint(call);
  // While a spoken question runs, the card names its step in the thread's own words.
  const newest = turns.at(-1);
  const working = newest?.spoken && newest.status === 'streaming' ? pendingActivity(newest.steps).label : 'Reading the question';
  const controlSize = phone ? 40 : 34;

  return (
    <Stack gap={6}>
      <section className={classes.card} style={settleTiming} aria-label="Voice call with Atlas">
        <div className={classes.top}>
          <AtlasFace mood={faceMood({ live, activity: call.activity })} levels={voice.levels} />
          <div className={classes.body}>
            <div className={classes.status}>
              <Text fz="sm" fw={600} aria-live="polite" truncate>
                {statusText(call, voiceLabel, working)}
              </Text>
              <Tooltip label={`Calls cost $${voice.pricePerMinute.toFixed(2)} a minute, billed by the second.`}>
                <Text fz="xs" c="dimmed" className="tabular-nums" tabIndex={0} style={{ whiteSpace: 'nowrap', cursor: 'default' }}>
                  {clockText(call.seconds)} · {formatCost(cost)}
                </Text>
              </Tooltip>
            </div>
            <div className={classes.captions}>
              <div className={classes.caption} data-latest={userLatest || undefined}>
                <span className={classes.speaker}>You</span>
                <span className={`${classes.words} ${call.userCaption === '' ? classes.waiting : ''}`} dir="auto">
                  {call.userCaption === '' ? 'Ask about the documents, in English or Arabic.' : call.userCaption}
                </span>
              </div>
              {call.atlasCaption !== '' && (
                <div className={classes.caption} data-latest={!userLatest || undefined}>
                  <span className={classes.speaker}>Atlas</span>
                  <span className={classes.words} dir="auto">
                    {call.atlasCaption}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className={classes.controls}>
          <VoicePicker
            className={classes.picker}
            size={phone ? 'md' : 'sm'}
            voices={voice.voices}
            voiceId={voice.voiceId}
            onChange={voice.chooseVoice}
            disabled={!live}
          />
          <div className={classes.actions}>
            {call.busy &&
              live &&
              (phone ? (
                <ActionIcon variant="default" size={controlSize} onClick={voice.stopQuestion} aria-label="Stop the answer">
                  <IconPlayerStopFilled size={14} />
                </ActionIcon>
              ) : (
                <Button variant="default" leftSection={<IconPlayerStopFilled size={12} />} onClick={voice.stopQuestion}>
                  Stop answer
                </Button>
              ))}
            <Tooltip label={call.muted ? 'Unmute the microphone' : 'Mute the microphone'}>
              <ActionIcon
                variant="default"
                size={controlSize}
                onClick={() => voice.setMuted(!call.muted)}
                disabled={!live}
                aria-pressed={call.muted}
                aria-label={call.muted ? 'Unmute the microphone' : 'Mute the microphone'}
              >
                {call.muted ? <IconMicrophoneOff size={18} stroke={1.75} /> : <IconMicrophone size={18} stroke={1.75} />}
              </ActionIcon>
            </Tooltip>
            {phone ? (
              <ActionIcon
                variant="filled"
                color="ink"
                size={controlSize}
                onClick={voice.hangUp}
                loading={call.status === 'ending'}
                aria-label="End call"
              >
                <IconPhoneOff size={18} stroke={2} />
              </ActionIcon>
            ) : (
              <Button leftSection={<IconPhoneOff size={16} stroke={2} />} onClick={voice.hangUp} loading={call.status === 'ending'}>
                End call
              </Button>
            )}
          </div>
        </div>
      </section>
      <Group gap="xs" wrap="nowrap" px="xs">
        <Text fz="xs" c="dimmed" visibleFrom={hint === null ? 'xs' : undefined}>
          {hint ?? STANDING_HINT}
        </Text>
      </Group>
    </Stack>
  );
}
