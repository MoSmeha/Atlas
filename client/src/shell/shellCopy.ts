import type { Bilingual } from '../i18n/language';

export interface ShellCopy {
  showDocuments: string;
  hideDocuments: string;
  /** The sidebar edge's name for screen readers. */
  resizeDocuments: string;
  /** Atlas's own line on the opening screen, the quotation marks its language uses, and who says it. */
  opening: { quote: string; open: string; close: string; by: string };
}

/** Interface text for the app frame. The name under the opening line stays Latin, like the wordmark. */
export const shellCopy: Bilingual<ShellCopy> = {
  en: {
    showDocuments: 'Show documents',
    hideDocuments: 'Hide documents',
    resizeDocuments: 'Resize documents',
    opening: { quote: 'Every answer, with its page.', open: '“', close: '”', by: 'Atlas' },
  },
  ar: {
    showDocuments: 'إظهار المستندات',
    hideDocuments: 'إخفاء المستندات',
    resizeDocuments: 'تغيير عرض المستندات',
    opening: { quote: 'كل إجابة، ومعها صفحتها.', open: '«', close: '»', by: 'Atlas' },
  },
};
