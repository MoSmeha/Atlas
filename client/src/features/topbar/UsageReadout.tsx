import { Stack, Text, Tooltip } from '@mantine/core';
import type { UsageResponse } from '@atlas/shared';
import { useModels } from '../../api/useModels';
import { useUsage } from '../../api/useUsage';
import { useSession } from '../../state/useSession';
import { formatCost, formatCount, formatDuration, questionCount } from './usageText';

/**
 * The last answer's cost and time as a quiet text pair, "$0.042 · 14.2 s". Hovering or focusing
 * it shows the tokens behind the cost and what this chat has cost so far. Hidden until a question
 * is answered, and on narrow screens.
 */
export function UsageReadout() {
  const { sessionId } = useSession();
  const usage = useUsage(sessionId);
  const models = useModels();
  const last = usage.data?.last;
  if (!usage.data || !last) return null;

  const cost = formatCost(last.costUsd);
  const time = formatDuration(last.durationMs);
  const modelLabel = models.data?.models.find((option) => option.id === last.model)?.label ?? last.model;

  return (
    <Tooltip
      label={<UsageDetails usage={usage.data} modelLabel={modelLabel} />}
      events={{ hover: true, focus: true, touch: true }}
      position="bottom"
    >
      <Text
        component="span"
        visibleFrom="sm"
        fz="sm"
        c="dimmed"
        className="tabular-nums"
        tabIndex={0}
        aria-label={`Last answer cost ${cost} and took ${time}`}
        style={{ whiteSpace: 'nowrap', cursor: 'default' }}
      >
        {cost} · {time}
      </Text>
    </Tooltip>
  );
}

function UsageDetails({ usage, modelLabel }: { usage: UsageResponse; modelLabel: string }) {
  const last = usage.last;
  if (!last) return null;
  return (
    <Stack gap={2} className="tabular-nums">
      <Text fz="xs" fw={600} c="inherit">
        Last answer, {modelLabel}
      </Text>
      <Text fz="xs" c="inherit">
        Input {formatCount(last.inputTokens)} tokens{part(last.cachedInputTokens, 'cached')}
      </Text>
      <Text fz="xs" c="inherit">
        Output {formatCount(last.outputTokens)} tokens{part(last.reasoningTokens, 'reasoning')}
      </Text>
      <Text fz="xs" c="inherit">
        This chat: {formatCost(usage.session.costUsd)} over {questionCount(usage.session.questions)}
      </Text>
    </Stack>
  );
}

/** " (1,200 cached)", or nothing when none of the tokens were of that kind. */
function part(tokens: number, kind: string): string {
  return tokens > 0 ? ` (${formatCount(tokens)} ${kind})` : '';
}
