import type { FolderPicker } from '../../src/application/ports/FolderPicker';

/** A folder window that answers with a set path (null: closed without one) and records each title it was shown with. */
export class FakeFolderPicker implements FolderPicker {
  readonly titles: string[] = [];

  constructor(public answer: string | null = null) {}

  async pick(title: string): Promise<string | null> {
    this.titles.push(title);
    return this.answer;
  }
}
