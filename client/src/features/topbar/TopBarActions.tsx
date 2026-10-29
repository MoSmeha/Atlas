import { Divider, Group } from '@mantine/core';
import { ClearChatButton } from './ClearChatButton';
import { ModelPicker } from './ModelPicker';
import { Preferences } from './Preferences';
import { UsageReadout } from './UsageReadout';

/**
 * The top bar's end side: the last answer's cost and time, the model picker and Clear chat, then,
 * past a hairline, the interface language and theme. The readout sits before the picker so the picker
 * never moves when it appears. Below sm the language and theme move to the foot of the sidebar.
 */
export function TopBarActions() {
  return (
    <>
      <UsageReadout />
      <ModelPicker />
      <ClearChatButton />
      <Group gap={4} wrap="nowrap" visibleFrom="sm">
        <Divider orientation="vertical" my={14} mx={4} color="gray.3" />
        <Preferences />
      </Group>
    </>
  );
}
