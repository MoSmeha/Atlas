import { ClearChatButton } from './ClearChatButton';
import { ModelPicker } from './ModelPicker';
import { UsageReadout } from './UsageReadout';

/**
 * The top bar's right side: the last answer's cost and time, the model picker, then Clear chat.
 * The readout sits left of the picker so the picker never moves when it appears.
 */
export function TopBarActions() {
  return (
    <>
      <UsageReadout />
      <ModelPicker />
      <ClearChatButton />
    </>
  );
}
