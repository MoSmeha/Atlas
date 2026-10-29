import { Box, Select, Tooltip } from '@mantine/core';
import { useModels } from '../../api/useModels';
import { useCopy } from '../../i18n/useCopy';
import { useLanguage } from '../../i18n/useLanguage';
import { useSession } from '../../state/useSession';
import { errorMessage } from '../errors/errorCopy';
import { isFreeModel } from './freeTier';
import { modelGroups } from './modelGroups';
import { ModelOptionRow } from './ModelOptionRow';
import { topbarCopy } from './topbarCopy';
import { useChosenModel } from './useChosenModel';

/**
 * Picks the model the next question goes to, from every provider the server has set up, grouped by provider. It
 * shows the server's default until the user picks; the choice lasts until the page reloads, Clear chat included.
 */
export function ModelPicker() {
  const { setModel } = useSession();
  const { language } = useLanguage();
  const copy = useCopy(topbarCopy);
  const models = useModels();
  const lineup = models.data?.models ?? [];
  const { id: value } = useChosenModel();
  const optionOf = (id: string) => lineup.find((option) => option.id === id);

  const select = (
    <Select
      aria-label={copy.model}
      w={176}
      data={modelGroups(lineup, copy.providers)}
      value={value}
      onChange={(id) => {
        if (id !== null) setModel(id);
      }}
      allowDeselect={false}
      withCheckIcon={false}
      disabled={models.data === undefined}
      placeholder={models.isError ? copy.defaultModel : copy.loadingModels}
      renderOption={({ option, checked }) => (
        <ModelOptionRow
          label={option.label}
          tier={optionOf(option.value)?.tier ?? null}
          free={isFreeModel(optionOf(option.value))}
          checked={checked === true}
        />
      )}
      maxDropdownHeight={420}
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
