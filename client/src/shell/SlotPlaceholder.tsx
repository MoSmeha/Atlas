import { Center, Text } from '@mantine/core';

interface SlotPlaceholderProps {
  /** What goes here, in plain words. */
  label: string;
  /** Branch that builds this region and removes the placeholder. */
  owner: string;
  /** Fill the remaining height of a flex column parent. */
  grow?: boolean;
}

/** Scaffolding that marks a region a later unit fills. It renders no data. */
export function SlotPlaceholder({ label, owner, grow = false }: SlotPlaceholderProps) {
  return (
    <Center
      data-slot={owner}
      title={owner}
      flex={grow ? 1 : undefined}
      mih={36}
      px="sm"
      bd="1px dashed var(--mantine-color-gray-4)"
      bdrs="md"
    >
      <Text fz="xs" c="dimmed" ta="center">
        {label}
      </Text>
    </Center>
  );
}
