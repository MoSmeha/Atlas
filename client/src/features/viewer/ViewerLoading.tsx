import { Group, Loader, Text } from '@mantine/core';
import { useLanguage } from '../../i18n/useLanguage';

/**
 * A quiet loading line in the middle of the viewer stage. It reads in the interface's direction even
 * inside a sheet's stage, which always runs left to right.
 */
export function ViewerLoading({ label, minHeight }: { label: string; minHeight?: number | string }) {
  const { dir } = useLanguage();
  return (
    <Group justify="center" gap="xs" mih={minHeight ?? 240} role="status" dir={dir}>
      <Loader size="sm" type="dots" />
      <Text fz="sm" c="dimmed">
        {label}
      </Text>
    </Group>
  );
}
