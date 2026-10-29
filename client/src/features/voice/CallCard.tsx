import { ActionIcon, Button, Group, Stack, Text, Tooltip } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconMicrophone, IconMicrophoneOff, IconPhoneOff, IconPlayerStopFilled } from '@tabler/icons-react';
import type { VoiceOption } from '@atlas/shared';
import type { Language } from '../../i18n/language';
import { useLanguage } from '../../i18n/useLanguage';
import { motion } from '../../theme';
import { pendingActivity } from '../chat/stepActivity';
import { useChat } from '../chat/useChat';
import { formatCost } from '../topbar/usageText';
import { AtlasFace } from './AtlasFace';
import classes from './CallCard.module.css';
import type { CallView } from './CallSession';
import { type CallCopy, callCopy, clockText, micTroubleMessage } from './callCopy';
import { faceMood } from './faceMotion';
import { useVoiceCall } from './useVoiceCall';
import { VoicePicker } from './VoicePicker';

const settleTiming = { animationDuration: `${motion.durationMs}ms`, animationTimingFunction: motion.easing };

/** Below Mantine's xs breakpoint the call's controls grow to 40px and End call becomes an icon. */
const PHONE = '(max-width: 36em)';

/**
 * The line beside Atlas's face: what the call is doing right now. `working` names the step, as the thread does;
 * `preparing` means the call waits for its voice to be made.
 */
function statusText(call: CallView, voice: VoiceOption | undefined, working: string, preparing: boolean, copy: CallCopy): string {
  const status = copy.status;
  switch (call.status) {
    case 'connecting':
      return preparing ? status.preparing(voice) : status.calling(voice);
    case 'ending':
      return call.endReason === 'switching' ? status.switching : status.ending;
    case 'ended':
      return status.ended;
    case 'live':
      if (call.activity === 'speaking') return status.speaking;
      if (call.activity === 'thinking') return working;
      return call.muted ? status.muted : status.listening;
  }
}

/**
 * A hint that needs reading now, as an alert when Atlas may not be hearing the user; null for the standing one, which
 * a phone leaves out to save room.
 */
function urgentHint(call: CallView, preparing: boolean, copy: CallCopy, language: Language): { text: string; alert: boolean } | null {
  if (call.status === 'connecting') return { text: preparing ? copy.hints.preparingVoice : copy.hints.allowMicrophone, alert: false };
  if (call.muted) return { text: copy.hints.muted, alert: false };
  if (call.status === 'live' && call.micTrouble !== null) return { text: micTroubleMessage(call.micTrouble, language), alert: true };
  return null;
}

/**
 * The voice call, docked where the question box was: Atlas's face, what it is doing, the call's length and cost, the
 * latest words from each side, and the controls. Every question it answers lands in the thread above as a normal turn.
 */
export function CallCard() {
  const voice = useVoiceCall();
  const { turns } = useChat();
  const { language } = useLanguage();
  const phone = useMediaQuery(PHONE) ?? false;
  const call = voice.call;
  if (call === null) return null;

  const copy = callCopy[language];
  const current = voice.voices.find((option) => option.id === voice.voiceId);
  const live = call.status === 'live';
  const cost = (call.seconds / 60) * voice.pricePerMinute;
  // Before anyone speaks, the user's line, with its prompt, counts as the latest.
  const userLatest = call.lastSpeaker !== 'atlas';
  const preparing = call.status === 'connecting' && current?.ready === false;
  const hint = urgentHint(call, preparing, copy, language);
  // While a spoken question runs, the card names its step in the thread's own words; before that, it reads the question.
  const newest = turns.at(-1);
  const working = pendingActivity(newest?.spoken && newest.status === 'streaming' ? newest.steps : [], language).label;
  const controlSize = phone ? 40 : 34;
  const muteLabel = call.muted ? copy.unmute : copy.mute;

  return (
    <Stack gap={6}>
      <section className={classes.card} style={settleTiming} aria-label={copy.card}>
        <div className={classes.top}>
          <AtlasFace mood={faceMood({ status: call.status, activity: call.activity })} levels={voice.levels} />
          <div className={classes.body}>
            <div className={classes.status}>
              <Text fz="sm" fw={600} aria-live="polite" truncate>
                {statusText(call, current, working, preparing, copy)}
              </Text>
              <Tooltip label={copy.price(`$${voice.pricePerMinute.toFixed(2)}`)}>
                <Text fz="xs" c="dimmed" className="tabular-nums" tabIndex={0} style={{ whiteSpace: 'nowrap', cursor: 'default' }}>
                  {clockText(call.seconds)} · {formatCost(cost)}
                </Text>
              </Tooltip>
            </div>
            <div className={classes.captions}>
              <div className={classes.caption} data-latest={userLatest || undefined}>
                <span className={classes.speaker}>{copy.you}</span>
                <span className={`${classes.words} ${call.userCaption === '' ? classes.waiting : ''}`} dir="auto">
                  {call.userCaption === '' ? copy.askPrompt : call.userCaption}
                </span>
              </div>
              {call.atlasCaption !== '' && (
                <div className={classes.caption} data-latest={!userLatest || undefined}>
                  <span className={classes.speaker}>{copy.atlas}</span>
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
            preparing={voice.preparingVoices}
            voiceId={voice.voiceId}
            onChange={voice.chooseVoice}
            disabled={!live}
          />
          <div className={classes.actions}>
            {call.busy &&
              live &&
              (phone ? (
                <ActionIcon variant="default" size={controlSize} onClick={voice.stopQuestion} aria-label={copy.stopTheAnswer}>
                  <IconPlayerStopFilled size={14} />
                </ActionIcon>
              ) : (
                <Button variant="default" leftSection={<IconPlayerStopFilled size={12} />} onClick={voice.stopQuestion}>
                  {copy.stopAnswer}
                </Button>
              ))}
            <Tooltip label={muteLabel}>
              <ActionIcon
                variant="default"
                size={controlSize}
                onClick={() => voice.setMuted(!call.muted)}
                disabled={!live}
                aria-pressed={call.muted}
                aria-label={muteLabel}
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
                aria-label={copy.endCall}
              >
                <IconPhoneOff size={18} stroke={2} />
              </ActionIcon>
            ) : (
              <Button leftSection={<IconPhoneOff size={16} stroke={2} />} onClick={voice.hangUp} loading={call.status === 'ending'}>
                {copy.endCall}
              </Button>
            )}
          </div>
        </div>
      </section>
      <Group gap="xs" wrap="nowrap" px="xs">
        <Text
          fz="xs"
          c={hint?.alert ? 'var(--mantine-color-error)' : 'dimmed'}
          role={hint?.alert ? 'alert' : undefined}
          visibleFrom={hint === null ? 'xs' : undefined}
        >
          {hint?.text ?? copy.hints.standing}
        </Text>
      </Group>
    </Stack>
  );
}
