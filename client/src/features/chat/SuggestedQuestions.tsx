import { UnstyledButton } from '@mantine/core';
import { IconArrowRight } from '@tabler/icons-react';
import type { SuggestedQuestion } from '@atlas/shared';
import { useCopy } from '../../i18n/useCopy';
import { useLanguage } from '../../i18n/useLanguage';
import { emptyStateCopy } from './emptyStateCopy';
import classes from './SuggestedQuestions.module.css';

interface SuggestedQuestionsProps {
  questions: SuggestedQuestion[];
  /** Asking is not possible yet, for example while a key is missing. */
  disabled: boolean;
  onAsk: (question: string) => void;
}

/**
 * Questions suggested for the loaded folder, in the interface language, as full-width quiet rows.
 * A click asks the question, so the answer comes back in that language too.
 */
export function SuggestedQuestions({ questions, disabled, onAsk }: SuggestedQuestionsProps) {
  const { language } = useLanguage();
  const copy = useCopy(emptyStateCopy);
  return (
    <ul className={classes.list} aria-label={copy.suggestedQuestions}>
      {questions.map((suggestion) => {
        const question = suggestion[language];
        return (
          <li key={suggestion.en}>
            <UnstyledButton className={classes.row} onClick={() => onAsk(question)} disabled={disabled}>
              <span dir="auto">{question}</span>
              <IconArrowRight size={16} stroke={1.75} className={classes.arrow} aria-hidden />
            </UnstyledButton>
          </li>
        );
      })}
    </ul>
  );
}
