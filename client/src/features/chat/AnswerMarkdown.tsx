import { useMemo } from 'react';
import Markdown, { type Components, type Options } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Typography } from '@mantine/core';
import { isArabicText } from './arabicText';
import { rehypeCaret } from './rehypeCaret';
import { tidyStreamingMarkdown } from './streamingMarkdown';
import classes from './AnswerMarkdown.module.css';

interface AnswerMarkdownProps {
  markdown: string;
  /** Shows the brand caret after the last word while text is still arriving. */
  streaming: boolean;
  /** The finished answer's language; null while streaming. */
  language: 'en' | 'ar' | null;
  /** The question was Arabic, so the first streamed words should be too. */
  questionArabic: boolean;
  /** Greyed out, for text that was stopped before Atlas checked it. */
  muted?: boolean;
}

/** Streaming text needs at least this many letters before its own direction overrides the question's. */
const STREAM_MIN_LETTERS = 24;

const components: Components = {
  a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
  table: ({ node: _node, ...props }) => (
    <div className={classes.tableScroll}>
      <table {...props} />
    </div>
  ),
};

const remarkPlugins: Options['remarkPlugins'] = [remarkGfm];
const caretPlugins: Options['rehypePlugins'] = [[rehypeCaret, { className: classes.caret ?? '' }]];

/**
 * An answer's markdown in the theme's type, right to left when it is Arabic. Pictures and raw
 * HTML in the text are dropped: whatever a document said reaches the screen as plain text.
 */
export function AnswerMarkdown({ markdown, streaming, language, questionArabic, muted = false }: AnswerMarkdownProps) {
  const text = useMemo(() => (streaming ? tidyStreamingMarkdown(markdown) : markdown), [markdown, streaming]);
  const arabic =
    language === null
      ? isArabicText(text, { minLetters: STREAM_MIN_LETTERS, fallback: questionArabic })
      : language === 'ar' || isArabicText(text);

  return (
    <Typography
      className={[classes.root, muted && classes.muted].filter(Boolean).join(' ')}
      dir={arabic ? 'rtl' : 'ltr'}
      lang={arabic ? 'ar' : 'en'}
      aria-busy={streaming}
    >
      <Markdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={streaming ? caretPlugins : undefined}
        components={components}
        disallowedElements={['img']}
        unwrapDisallowed
      >
        {text}
      </Markdown>
    </Typography>
  );
}
