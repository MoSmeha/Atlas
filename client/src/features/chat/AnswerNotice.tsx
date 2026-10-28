import type { ReactNode } from 'react';
import { Box, Group, List, Stack, Text } from '@mantine/core';
import { IconFileOff, IconFileSearch, IconInfoCircle } from '@tabler/icons-react';
import type { AnswerKind } from '@atlas/shared';

interface AnswerNoticeProps {
  kind: Exclude<AnswerKind, 'answer'>;
  /** Files Atlas could not read, so the answer may be in one of them. */
  unreadableFiles: string[];
  /** The answer's own words. */
  children: ReactNode;
}

/**
 * A calm frame for "not found" and "outside the documents" answers. It names the files Atlas
 * could not read, so the reader knows where the answer might still be.
 */
export function AnswerNotice({ kind, unreadableFiles, children }: AnswerNoticeProps) {
  const Icon = kind === 'not_found' ? IconFileSearch : IconInfoCircle;
  return (
    <Box bg="gray.0" bd="1px solid var(--mantine-color-gray-3)" bdrs="md" px="md" py="sm">
      <Group align="flex-start" gap="sm" wrap="nowrap">
        <Box c="gray.6" pt={3} lh={0}>
          <Icon size={18} stroke={1.75} aria-hidden />
        </Box>
        <Stack gap="sm" miw={0} flex={1}>
          {children}
          {unreadableFiles.length > 0 && (
            <Stack gap={6}>
              <Text fz="xs" fw={600} c="dimmed">
                {unreadableFiles.length === 1 ? 'File Atlas could not read' : 'Files Atlas could not read'}
              </Text>
              <List spacing={4} fz="sm" c="gray.8" listStyleType="none" p={0} m={0}>
                {unreadableFiles.map((file) => (
                  <List.Item
                    key={file}
                    icon={<IconFileOff size={16} stroke={1.75} color="var(--mantine-color-gray-6)" aria-hidden />}
                  >
                    <Text component="span" fz="sm" dir="auto" style={{ overflowWrap: 'anywhere' }}>
                      {file}
                    </Text>
                  </List.Item>
                ))}
              </List>
            </Stack>
          )}
        </Stack>
      </Group>
    </Box>
  );
}
