/** The folder window of the computer running Atlas, so a folder can be chosen instead of typed. */
export interface FolderPicker {
  /** Shows the window with this title and waits; the chosen folder's absolute path, or null when it was closed. */
  pick(title: string): Promise<string | null>;
}
