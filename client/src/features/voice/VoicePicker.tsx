import { Group, Select, Text } from '@mantine/core';
import type { VoiceOption } from '@atlas/shared';
import { useLanguage } from '../../i18n/useLanguage';
import { callCopy } from './callCopy';
import { voiceName } from './voiceChoice';

interface VoicePickerProps {
  voices: VoiceOption[];
  /** The server is still making the voices that are not ready; each group heading counts them. */
  preparing: boolean;
  voiceId: string | null;
  onChange: (voiceId: string) => void;
  disabled?: boolean;
  /** Sets its width; the call card's picker fills the row on a phone. */
  className?: string;
  size?: 'sm' | 'md';
}

/**
 * The call's voice, grouped by language. In English each Arabic dialect's own name sits beside it; in Arabic the
 * option already is that name. A call's voice is fixed when it starts, so choosing another one mid-call reconnects in
 * the new voice. While the server makes new voices, a group's heading says how many of its voices are not ready yet.
 */
export function VoicePicker({ voices, preparing, voiceId, onChange, disabled, className, size = 'sm' }: VoicePickerProps) {
  const { language } = useLanguage();
  const copy = callCopy[language].picker;
  const byId = new Map(voices.map((voice) => [voice.id, voice]));
  const group = (voiceLanguage: VoiceOption['language']) => {
    const members = voices.filter((voice) => voice.language === voiceLanguage);
    const waiting = preparing ? members.filter((voice) => !voice.ready).length : 0;
    const heading = copy.languages[voiceLanguage];
    return {
      group: waiting === 0 ? heading : copy.stillPreparing(heading, waiting),
      items: members.map((voice) => ({ value: voice.id, label: copy.option(voice) })),
    };
  };
  const current = voiceId === null ? undefined : byId.get(voiceId);

  return (
    <Select
      size={size}
      className={className}
      aria-label={current === undefined ? copy.label : copy.current(voiceName(current, language))}
      data={[group('en'), group('ar')].filter((entry) => entry.items.length > 0)}
      value={voiceId}
      onChange={(value) => value !== null && onChange(value)}
      allowDeselect={false}
      disabled={disabled}
      checkIconPosition="right"
      comboboxProps={{ position: 'top-start', width: 240 }}
      maxDropdownHeight={320}
      renderOption={({ option }) => {
        const native = language === 'en' ? byId.get(option.value)?.nativeLabel : null;
        return (
          <Group gap="xs" justify="space-between" wrap="nowrap" w="100%">
            <Text fz="sm">{option.label}</Text>
            {native && (
              <Text fz="sm" c="dimmed" dir="rtl" lang="ar">
                {native}
              </Text>
            )}
          </Group>
        );
      }}
    />
  );
}
