import { Group, Stack, Text } from '@mantine/core';
import { IconCheck } from '@tabler/icons-react';

interface OptionRowProps {
  label: string;
  /** What the option is good for, in a small line under the label; nothing when null. */
  hint: string | null;
  /** A name that stays Latin and left to right in Arabic, such as a model's. */
  latin?: boolean;
  checked: boolean;
}

/** One choice in a top-bar picker's list: its name, a small hint under it, and a check on the chosen one. */
export function OptionRow({ label, hint, latin = false, checked }: OptionRowProps) {
  return (
    <Group justify="space-between" gap="sm" wrap="nowrap" w="100%">
      <Stack gap={2} miw={0}>
        <Text fz="sm" fw={600} lh="xs" ta="start" {...(latin ? { lang: 'en', dir: 'ltr' } : {})}>
          {label}
        </Text>
        {hint && (
          <Text fz="xs" c="dimmed" lh="xs">
            {hint}
          </Text>
        )}
      </Stack>
      {checked && <IconCheck size={16} stroke={2} color="var(--atlas-focus)" aria-hidden />}
    </Group>
  );
}
