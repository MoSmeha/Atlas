export interface PageRenderer {
  /** Renders one PDF page (1-based) to PNG bytes. */
  renderPage(filePath: string, page: number, options?: { dpi?: number }): Promise<Uint8Array>;
}
