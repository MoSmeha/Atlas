/** What each tool did, as the trace names it for a reader who is not an engineer. */
const labels: Record<string, string> = {
  list_documents: 'Listed documents',
  search_documents: 'Searched the text',
  read_pages: 'Read pages',
  query_tables: 'Queried the tables',
  look_at_page: 'Looked at a page image',
  check_boq_arithmetic: 'Checked BOQ arithmetic',
  extract_schedule: 'Extracted dates',
  compare_revisions: 'Compared revisions',
  calculate: 'Calculated',
  export_table: 'Exported a table',
};

/** "Searched the text" for search_documents; a tool added later reads as "Used find tables". */
export function stepLabel(name: string): string {
  return labels[name] ?? `Used ${name.replaceAll('_', ' ')}`;
}
