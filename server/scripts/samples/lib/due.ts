import type { Due } from '../project';
import { addDays, day, isoDate, longDate } from './dates';

/** How the contract writes a due date, for example "within 28 days of the Commencement Date". */
export function dueText(due: Due): string {
  switch (due.kind) {
    case 'date':
      return longDate(day(due.date));
    case 'afterCommencement':
      return `within ${due.days} days of the Commencement Date`;
    case 'recurring':
      return due.text;
  }
}

/** The calendar date a due falls on (YYYY-MM-DD), or null for a recurring one. */
export function dueDate(due: Due, commencement: string): string | null {
  switch (due.kind) {
    case 'date':
      return due.date;
    case 'afterCommencement':
      return isoDate(addDays(day(commencement), due.days));
    case 'recurring':
      return null;
  }
}
