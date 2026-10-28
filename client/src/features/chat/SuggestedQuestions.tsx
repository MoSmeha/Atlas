import { UnstyledButton } from '@mantine/core';
import { IconArrowRight } from '@tabler/icons-react';
import classes from './SuggestedQuestions.module.css';

interface SuggestedQuestionsProps {
  questions: string[];
  /** Asking is not possible yet, for example while a key is missing. */
  disabled: boolean;
  onAsk: (question: string) => void;
}

/** Questions suggested for the loaded folder, as full-width quiet rows. A click asks the question. */
export function SuggestedQuestions({ questions, disabled, onAsk }: SuggestedQuestionsProps) {
  return (
    <ul className={classes.list} aria-label="Suggested questions">
      {questions.map((question) => (
        <li key={question}>
          <UnstyledButton className={classes.row} onClick={() => onAsk(question)} disabled={disabled} dir="auto">
            <span>{question}</span>
            <IconArrowRight size={16} stroke={1.75} className={classes.arrow} aria-hidden />
          </UnstyledButton>
        </li>
      ))}
    </ul>
  );
}
