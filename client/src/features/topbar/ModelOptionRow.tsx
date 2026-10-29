import { Group, Stack, Text } from '@mantine/core';
import { IconCheck } from '@tabler/icons-react';
import type { ModelTier } from '@atlas/shared';
import { useCopy } from '../../i18n/useCopy';
import { topbarCopy } from './topbarCopy';

interface ModelOptionRowProps {
  label: string;
  tier: ModelTier | null;
  checked: boolean;
}

/** One model in the picker's list: its name, a small tier hint under it, and a check on the chosen one. */
export function ModelOptionRow({ label, tier, checked }: ModelOptionRowProps) {
  const copy = useCopy(topbarCopy);
  return (
    <Group justify="space-between" gap="sm" wrap="nowrap" w="100%">
      <Stack gap={2} miw={0}>
        <Text fz="sm" fw={600} lh="xs" lang="en" dir="ltr" ta="start">
          {label}
        </Text>
        {tier && (
          <Text fz="xs" c="dimmed" lh="xs">
            {copy.tiers[tier]}
          </Text>
        )}
      </Stack>
      {checked && <IconCheck size={16} stroke={2} color="var(--atlas-focus)" aria-hidden />}
    </Group>
  );
}
