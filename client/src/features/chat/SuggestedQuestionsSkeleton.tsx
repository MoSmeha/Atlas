import { Box, Skeleton } from '@mantine/core';
import classes from './SuggestedQuestions.module.css';

const placeholderWidths = ['62%', '78%', '54%', '70%', '46%'];

/** Five loading rows where the suggestions will appear. */
export function SuggestedQuestionsSkeleton() {
  return (
    <Box className={classes.list} aria-hidden>
      {placeholderWidths.map((width) => (
        <div key={width} className={classes.skeletonRow}>
          <Skeleton height={14} width={width} radius="sm" my={5} />
        </div>
      ))}
    </Box>
  );
}
