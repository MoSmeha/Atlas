import { Box, Select, Tooltip } from '@mantine/core';
import { useModels } from '../../api/useModels';
import { useCopy } from '../../i18n/useCopy';
import { useLanguage } from '../../i18n/useLanguage';
import { useSession } from '../../state/useSession';
import { errorMessage } from '../errors/errorCopy';
import { isFreeModel } from './freeTier';
import { OptionRow } from './OptionRow';
import { topbarCopy } from './topbarCopy';

/**
 * Picks the model the next question goes to, from the server's lineup. It shows the server's
 * default until the user picks; the choice lasts until the page reloads, Clear chat included.
 */
export function ModelPicker() {
  const { model, setModel } = useSession();
  const { language } = useLanguage();
  const copy = useCopy(topbarCopy);
  const models = useModels();
  const lineup = models.data?.models ?? [];
  const value = model ?? models.data?.defaultModel ?? null;
  const optionOf = (id: string) => lineup.find((option) => option.id === id);
  /** What the model's tier is good for; a free model's hint says free instead of naming a cost. */
  const hintOf = (id: string) => {
    const option = optionOf(id);
    if (option === undefined) return null;
    return (isFreeModel(option) ? copy.freeTiers : copy.tiers)[option.tier];
  };

  const select = (
    <Select
      aria-label={copy.model}
      w={156}
      data={lineup.map((option) => ({ value: option.id, label: option.label }))}
      value={value}
      onChange={(id) => {
        if (id !== null) setModel(id);
      }}
      allowDeselect={false}
      withCheckIcon={false}
      disabled={models.data === undefined}
      placeholder={models.isError ? copy.defaultModel : copy.loadingModels}
      renderOption={({ option, checked }) => (
        <OptionRow label={option.label} hint={hintOf(option.value)} latin checked={checked === true} />
      )}
      comboboxProps={{ width: 252, position: 'bottom-end' }}
    />
  );

  if (!models.isError) return select;
  return (
    <Tooltip label={copy.modelsFailed(errorMessage(models.error, language))}>
      <Box>{select}</Box>
    </Tooltip>
  );
}
