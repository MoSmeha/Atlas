import { ActionIcon, Tooltip, useComputedColorScheme, useMantineColorScheme } from '@mantine/core';
import { IconMoon, IconSun } from '@tabler/icons-react';
import { useCopy } from '../../i18n/useCopy';
import { topbarCopy } from './topbarCopy';

/** Switches between the light and dark theme. The choice is kept for the next visit. */
export function ColorSchemeToggle() {
  const copy = useCopy(topbarCopy);
  const { setColorScheme } = useMantineColorScheme();
  const dark = useComputedColorScheme('light') === 'dark';
  const label = dark ? copy.toLight : copy.toDark;
  const Icon = dark ? IconSun : IconMoon;

  return (
    <Tooltip label={label}>
      <ActionIcon variant="subtle" color="gray" aria-label={label} onClick={() => setColorScheme(dark ? 'light' : 'dark')}>
        <Icon size={18} stroke={1.75} aria-hidden />
      </ActionIcon>
    </Tooltip>
  );
}
