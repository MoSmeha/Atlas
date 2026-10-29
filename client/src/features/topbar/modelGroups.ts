import type { ModelOption, ModelProvider } from '@atlas/shared';

export interface PickerItem {
  value: string;
  label: string;
}

/**
 * The picker's list: one group per provider, in the server's order, headed by its name. A list from one provider
 * stays flat, with no heading, as it was before there were several.
 */
export function modelGroups(
  models: ModelOption[],
  headings: Record<ModelProvider, string>,
): PickerItem[] | { group: string; items: PickerItem[] }[] {
  const item = (option: ModelOption): PickerItem => ({ value: option.id, label: option.label });
  const providers = [...new Set(models.map((option) => option.provider))];
  if (providers.length <= 1) return models.map(item);
  return providers.map((provider) => ({
    group: headings[provider],
    items: models.filter((option) => option.provider === provider).map(item),
  }));
}
