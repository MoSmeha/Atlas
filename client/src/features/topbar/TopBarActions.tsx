import { Divider, Group } from '@mantine/core';
import { ClearChatButton } from './ClearChatButton';
import { FreeTierBadge } from './FreeTierBadge';
import { ModelPicker } from './ModelPicker';
import { Preferences } from './Preferences';
import { UsageReadout } from './UsageReadout';

/**
 * The top bar's end side: the last answer's cost and time, the free-tier badge while a free provider answers,
 * the model picker and Clear chat, then, past a hairline, the interface language and theme. The readout sits
 * before the badge and the picker so neither moves when it appears. Below sm the language and theme move to the
 * foot of the sidebar.
 */
export function TopBarActions() {
  return (
    <>
      <UsageReadout />
      <FreeTierBadge />
      <ModelPicker />
      <ClearChatButton />
      <Group gap={4} wrap="nowrap" visibleFrom="sm">
        <Divider orientation="vertical" my={14} mx={4} color="gray.3" />
        <Preferences />
      </Group>
    </>
  );
}
