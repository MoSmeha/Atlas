import { Group, Select, Text } from '@mantine/core';
import type { VoiceOption } from '@atlas/shared';
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

/** "Gulf · female": the dialect without the word Arabic, which the group heading already says. */
function optionLabel(voice: VoiceOption): string {
  const dialect = voice.language === 'ar' ? voice.label.replace(/ Arabic$/, '') : voice.label;
  return `${dialect} · ${voice.gender}`;
}

/**
 * The call's voice, grouped by language, with each Arabic dialect's own name beside it. A call's voice is fixed when
 * it starts, so choosing another one mid-call reconnects in the new voice. While the server makes new voices, a
 * group's heading says how many of its voices are not ready yet.
 */
export function VoicePicker({ voices, preparing, voiceId, onChange, disabled, className, size = 'sm' }: VoicePickerProps) {
  const byId = new Map(voices.map((voice) => [voice.id, voice]));
  const group = (language: VoiceOption['language'], name: string) => {
    const members = voices.filter((voice) => voice.language === language);
    const waiting = preparing ? members.filter((voice) => !voice.ready).length : 0;
    return {
      group: waiting === 0 ? name : `${name} · ${waiting} still preparing`,
      items: members.map((voice) => ({ value: voice.id, label: optionLabel(voice) })),
    };
  };
  const current = voiceId === null ? undefined : byId.get(voiceId);

  return (
    <Select
      size={size}
      className={className}
      aria-label={current === undefined ? 'Voice' : `Voice: ${voiceName(current)}`}
      data={[group('en', 'English'), group('ar', 'Arabic')].filter((entry) => entry.items.length > 0)}
      value={voiceId}
      onChange={(value) => value !== null && onChange(value)}
      allowDeselect={false}
      disabled={disabled}
      checkIconPosition="right"
      comboboxProps={{ position: 'top-start', width: 240 }}
      maxDropdownHeight={320}
      renderOption={({ option }) => {
        const voice = byId.get(option.value);
        return (
          <Group gap="xs" justify="space-between" wrap="nowrap" w="100%">
            <Text fz="sm">{option.label}</Text>
            {voice?.nativeLabel && (
              <Text fz="sm" c="dimmed" dir="rtl" lang="ar">
                {voice.nativeLabel}
              </Text>
            )}
          </Group>
        );
      }}
    />
  );
}
