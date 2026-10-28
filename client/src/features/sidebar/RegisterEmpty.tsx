import { Stack, Text } from '@mantine/core';

const copy = {
  'no-folder': {
    title: 'No folder loaded yet',
    body: 'Type the path of a project folder above and press Load, or drop files into the box. Atlas lists every PDF and Excel file here and marks any it cannot read.',
  },
  'no-files': {
    title: 'No PDF or Excel files here',
    body: 'Drop files into the box above to add them, or load another folder.',
  },
} as const;

/** What the register says when it has nothing to list, and what to do next. */
export function RegisterEmpty({ reason }: { reason: keyof typeof copy }) {
  const { title, body } = copy[reason];
  return (
    <Stack gap={4} py="xs">
      <Text fz="sm" fw={600}>
        {title}
      </Text>
      <Text fz="sm" c="dimmed">
        {body}
      </Text>
    </Stack>
  );
}
