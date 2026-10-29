import { Badge, Tooltip, VisuallyHidden } from '@mantine/core';
import { IconCurrencyDollarOff } from '@tabler/icons-react';
import { useModels } from '../../api/useModels';
import { useCopy } from '../../i18n/useCopy';
import { freeProvider } from './freeTier';
import { topbarCopy } from './topbarCopy';

/**
 * A neutral badge with a no-cost icon beside the model picker while a free provider answers: "Free tier" for
 * Gemini, "Free, on this computer" for Ollama. It stays neutral because amber and red mean trouble. What it means
 * (the daily limit, where the documents go) shows on hover or focus.
 * Nothing while OpenAI answers. Hidden on the narrowest screens, where the top bar has no room.
 */
export function FreeTierBadge() {
  const copy = useCopy(topbarCopy);
  const provider = freeProvider(useModels().data?.provider);
  if (provider === null) return null;
  const { label, hint } = copy.free[provider];
  return (
    <Tooltip label={hint} multiline w={280} events={{ hover: true, focus: true, touch: true }}>
      <Badge
        tabIndex={0}
        visibleFrom="xs"
        leftSection={<IconCurrencyDollarOff size={12} stroke={2} aria-hidden />}
        style={{ flexShrink: 0 }}
      >
        {label}
        <VisuallyHidden>: {hint}</VisuallyHidden>
      </Badge>
    </Tooltip>
  );
}
