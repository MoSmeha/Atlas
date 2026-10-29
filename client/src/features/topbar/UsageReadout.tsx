import { Stack, Text, Tooltip } from '@mantine/core';
import type { UsageResponse } from '@atlas/shared';
import { useModels } from '../../api/useModels';
import { useUsage } from '../../api/useUsage';
import { useCopy } from '../../i18n/useCopy';
import { useSession } from '../../state/useSession';
import { topbarCopy } from './topbarCopy';
import { formatCost, formatCount, formatDuration } from './usageText';

interface UsageReadoutProps {
  /**
   * "topbar" shows it beside the model picker from the sm breakpoint up; "composer" shows it, a
   * size smaller, on the hint line under the question box below sm, where the top bar has no room.
   */
  placement?: 'topbar' | 'composer';
}

/**
 * The last answer's cost and time as a quiet text pair, "$0.042 · 14.2 s". Hovering, focusing or
 * tapping it shows the tokens behind the cost and what this chat has cost so far. Hidden until a
 * question is answered.
 */
export function UsageReadout({ placement = 'topbar' }: UsageReadoutProps) {
  const { sessionId } = useSession();
  const copy = useCopy(topbarCopy);
  const usage = useUsage(sessionId);
  const models = useModels();
  const last = usage.data?.last;
  if (!usage.data || !last) return null;

  const cost = formatCost(last.costUsd);
  const time = formatDuration(last.durationMs, copy);
  const modelLabel = models.data?.models.find((option) => option.id === last.model)?.label ?? last.model;
  const inTopBar = placement === 'topbar';

  return (
    <Tooltip
      label={<UsageDetails usage={usage.data} modelLabel={modelLabel} />}
      events={{ hover: true, focus: true, touch: true }}
      position={inTopBar ? 'bottom' : 'top-end'}
    >
      <Text
        component="span"
        visibleFrom={inTopBar ? 'sm' : undefined}
        hiddenFrom={inTopBar ? undefined : 'sm'}
        fz={inTopBar ? 'sm' : 'xs'}
        c="dimmed"
        className="tabular-nums"
        tabIndex={0}
        aria-label={copy.usageLabel(cost, time)}
        style={{ whiteSpace: 'nowrap', cursor: 'default' }}
      >
        {cost} · {time}
      </Text>
    </Tooltip>
  );
}

function UsageDetails({ usage, modelLabel }: { usage: UsageResponse; modelLabel: string }) {
  const copy = useCopy(topbarCopy);
  const last = usage.last;
  if (!last) return null;
  return (
    <Stack gap={2} className="tabular-nums">
      <Text fz="xs" fw={600} c="inherit">
        {copy.lastAnswer(modelLabel)}
      </Text>
      <Text fz="xs" c="inherit">
        {copy.inputTokens(formatCount(last.inputTokens))}
        {last.cachedInputTokens > 0 && copy.cached(formatCount(last.cachedInputTokens))}
      </Text>
      <Text fz="xs" c="inherit">
        {copy.outputTokens(formatCount(last.outputTokens))}
        {last.reasoningTokens > 0 && copy.reasoning(formatCount(last.reasoningTokens))}
      </Text>
      <Text fz="xs" c="inherit">
        {copy.thisChat(formatCost(usage.session.costUsd), usage.session.questions)}
      </Text>
    </Stack>
  );
}
