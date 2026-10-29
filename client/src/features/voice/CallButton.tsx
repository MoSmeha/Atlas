import { useRef } from 'react';
import { ActionIcon, Combobox, Group, Text, Tooltip, useCombobox } from '@mantine/core';
import { IconCheck, IconChevronDown, IconPhone } from '@tabler/icons-react';
import type { VoiceOption } from '@atlas/shared';
import { useLanguage } from '../../i18n/useLanguage';
import { callCopy } from './callCopy';
import { useVoiceCall } from './useVoiceCall';
import { voiceName } from './voiceChoice';

const LANGUAGES: readonly VoiceOption['language'][] = ['en', 'ar'];

/**
 * Starts a voice call, with its voice chosen beforehand: the phone calls in the voice its tooltip names, and the arrow
 * beside it lists the voices by language. In English each Arabic dialect's own name sits beside it. While the server
 * makes new voices, a group's heading says how many of its voices are not ready yet. A call's voice is fixed once it
 * starts.
 */
export function CallButton({ disabled }: { disabled: boolean }) {
  const voice = useVoiceCall();
  const { language } = useLanguage();
  const copy = callCopy[language].picker;
  const combobox = useCombobox({
    onDropdownOpen: () => combobox.updateSelectedOptionIndex('active'),
    onDropdownClose: () => combobox.resetSelectedOption(),
  });
  const arrow = useRef<HTMLButtonElement>(null);
  const current = voice.voices.find((option) => option.id === voice.voiceId);
  const callLabel = current === undefined ? copy.callAnyVoice : copy.call(voiceName(current, language));
  const groups = LANGUAGES.map((voiceLanguage) => {
    const members = voice.voices.filter((option) => option.language === voiceLanguage);
    const waiting = voice.preparingVoices ? members.filter((option) => !option.ready).length : 0;
    const heading = copy.languages[voiceLanguage];
    return { voiceLanguage, members, heading: waiting === 0 ? heading : copy.stillPreparing(heading, waiting) };
  }).filter((group) => group.members.length > 0);

  return (
    <Combobox
      store={combobox}
      position="top-end"
      width={250}
      withinPortal
      onOptionSubmit={(id) => {
        voice.chooseVoice(id);
        combobox.closeDropdown();
      }}
    >
      <ActionIcon.Group>
        <Tooltip label={callLabel}>
          <ActionIcon
            variant="filled"
            color="ink"
            size={34}
            radius="md"
            onClick={voice.start}
            disabled={disabled || voice.voiceId === null}
            aria-label={callLabel}
          >
            <IconPhone size={17} stroke={2} />
          </ActionIcon>
        </Tooltip>
        <Combobox.Target targetType="button">
          <ActionIcon
            ref={arrow}
            variant="filled"
            color="ink"
            size={34}
            w={22}
            miw={22}
            radius="md"
            onClick={() => combobox.toggleDropdown()}
            disabled={voice.voices.length === 0}
            aria-label={current === undefined ? copy.choose : copy.current(voiceName(current, language))}
          >
            <IconChevronDown size={14} stroke={2} />
          </ActionIcon>
        </Combobox.Target>
      </ActionIcon.Group>
      {/* Attached by ref: wrapped round the arrow, a tooltip keeps the list's keys and labels from reaching it. */}
      <Tooltip label={copy.choose} target={arrow} disabled={combobox.dropdownOpened} />
      <Combobox.Dropdown>
        <Combobox.Options mah={320} style={{ overflowY: 'auto' }} aria-label={copy.label}>
          {groups.map((group) => (
            <Combobox.Group key={group.voiceLanguage} label={group.heading}>
              {group.members.map((option) => {
                const chosen = option.id === voice.voiceId;
                return (
                  <Combobox.Option key={option.id} value={option.id} active={chosen} aria-selected={chosen}>
                    <Group gap="xs" justify="space-between" wrap="nowrap">
                      <Group gap="xs" wrap="nowrap">
                        <Text fz="sm">{copy.option(option)}</Text>
                        {language === 'en' && option.nativeLabel && (
                          <Text fz="sm" c="dimmed" dir="rtl" lang="ar">
                            {option.nativeLabel}
                          </Text>
                        )}
                      </Group>
                      {chosen && <IconCheck size={14} stroke={2} aria-hidden />}
                    </Group>
                  </Combobox.Option>
                );
              })}
            </Combobox.Group>
          ))}
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  );
}
