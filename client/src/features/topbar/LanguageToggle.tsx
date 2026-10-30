import { Button, Tooltip } from '@mantine/core';
import { IconLanguage } from '@tabler/icons-react';
import { useCopy } from '../../i18n/useCopy';
import { useLanguage } from '../../i18n/useLanguage';
import { topbarCopy } from './topbarCopy';

/**
 * Switches the interface between English and Arabic. It names the other language in its own script,
 * the way a reader of that language looks for it. Answers keep following the question's language.
 */
export function LanguageToggle() {
  const { setLanguage } = useLanguage();
  const { otherLanguage } = useCopy(topbarCopy);

  return (
    <Tooltip label={otherLanguage.hint}>
      <Button
        variant="subtle"
        color="gray"
        px={8}
        leftSection={<IconLanguage size={16} stroke={1.75} aria-hidden />}
        onClick={() => setLanguage(otherLanguage.code)}
      >
        <span lang={otherLanguage.code}>{otherLanguage.name}</span>
      </Button>
    </Tooltip>
  );
}
