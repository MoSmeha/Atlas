import { Group } from '@mantine/core';
import { ColorSchemeToggle } from './ColorSchemeToggle';
import { LanguageToggle } from './LanguageToggle';

/** The interface language and the light or dark theme, side by side. */
export function Preferences() {
  return (
    <Group gap={2} wrap="nowrap">
      <LanguageToggle />
      <ColorSchemeToggle />
    </Group>
  );
}
