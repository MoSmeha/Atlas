import { Group, Loader, Text } from '@mantine/core';

/** A quiet loading line in the middle of the viewer stage. */
export function ViewerLoading({ label, minHeight }: { label: string; minHeight?: number | string }) {
  return (
    <Group justify="center" gap="xs" mih={minHeight ?? 240} role="status">
      <Loader size="sm" type="dots" />
      <Text fz="sm" c="dimmed">
        {label}
      </Text>
    </Group>
  );
}
