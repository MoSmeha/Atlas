import { Group, Stack, Text } from '@mantine/core';
import { IconCheck } from '@tabler/icons-react';
import type { ModelTier } from '@atlas/shared';

/** What each tier is good for, in plain words. */
export const tierHint: Record<ModelTier, string> = {
  frontier: 'Most thorough, highest cost',
  balanced: 'Good balance of depth and cost',
  small: 'Fastest, lowest cost',
};

interface ModelOptionRowProps {
  label: string;
  tier: ModelTier | null;
  checked: boolean;
}

/** One model in the picker's list: its name, a small tier hint under it, and a check on the chosen one. */
export function ModelOptionRow({ label, tier, checked }: ModelOptionRowProps) {
  return (
    <Group justify="space-between" gap="sm" wrap="nowrap" w="100%">
      <Stack gap={2} miw={0}>
        <Text fz="sm" fw={600} lh="xs">
          {label}
        </Text>
        {tier && (
          <Text fz="xs" c="dimmed" lh="xs">
            {tierHint[tier]}
          </Text>
        )}
      </Stack>
      {checked && <IconCheck size={16} stroke={2} color="var(--mantine-primary-color-filled)" aria-hidden />}
    </Group>
  );
}
