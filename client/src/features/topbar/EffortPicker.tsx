import { Select } from '@mantine/core';
import { AnswerEffort } from '@atlas/shared';
import { useCopy } from '../../i18n/useCopy';
import { useSession } from '../../state/useSession';
import { OptionRow } from './OptionRow';
import { topbarCopy } from './topbarCopy';
import { useChosenModel } from './useChosenModel';

/**
 * Picks how long the answer model thinks before the next question is answered: low, medium or high effort, each with
 * how fast its answers come. It shows the chosen model's default (its provider's) until the user picks; the pick then
 * holds for every model until the page reloads, Clear chat included. Hidden while the lineup loads or failed, when
 * the chosen model's provider leaves thinking to the model (Ollama), and below sm, where the top bar has no room.
 */
export function EffortPicker() {
  const { effort, setEffort } = useSession();
  const copy = useCopy(topbarCopy);
  const defaultEffort = useChosenModel().option?.defaultEffort ?? null;
  if (defaultEffort === null) return null;

  return (
    <Select
      aria-label={copy.effort}
      visibleFrom="sm"
      w={140}
      data={AnswerEffort.options.map((option) => ({ value: option, label: copy.efforts[option].label }))}
      value={effort ?? defaultEffort}
      onChange={(value) => {
        const picked = AnswerEffort.safeParse(value);
        if (picked.success) setEffort(picked.data);
      }}
      allowDeselect={false}
      withCheckIcon={false}
      renderOption={({ option, checked }) => {
        const picked = AnswerEffort.safeParse(option.value);
        return <OptionRow label={option.label} hint={picked.success ? copy.efforts[picked.data].speed : null} checked={checked === true} />;
      }}
      comboboxProps={{ width: 200, position: 'bottom-end' }}
    />
  );
}
