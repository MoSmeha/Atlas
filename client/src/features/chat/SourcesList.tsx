import { useId } from 'react';
import { Stack, Text } from '@mantine/core';
import type { Source } from '@atlas/shared';
import { SourceRow } from './SourceRow';
import classes from './SourcesList.module.css';

interface SourcesListProps {
  sources: Source[];
  /** The source open in the viewer, shown as selected; null when none of these is. */
  openedSource: Source | null;
  onOpenSource: (source: Source) => void;
}

/** The answer's numbered sources as compact rows; a click opens one at its page or rows. Nothing when there are none. */
export function SourcesList({ sources, openedSource, onOpenSource }: SourcesListProps) {
  const headingId = useId();
  if (sources.length === 0) return null;

  return (
    <Stack component="section" gap={4} aria-labelledby={headingId}>
      <Text component="h3" id={headingId} fz="xs" fw={600} c="dimmed" m={0}>
        Sources
      </Text>
      <ol className={classes.list}>
        {sources.map((source, index) => (
          <li key={index}>
            <SourceRow
              number={index + 1}
              source={source}
              active={source === openedSource}
              onOpen={() => onOpenSource(source)}
            />
          </li>
        ))}
      </ol>
    </Stack>
  );
}
