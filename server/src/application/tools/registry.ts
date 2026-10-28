import { calculate } from './calculate';
import { checkBoqArithmetic } from './checkBoqArithmetic';
import { exportTable } from './exportTable';
import { listDocuments } from './listDocuments';
import { readPages } from './readPages';
import { searchDocuments } from './searchDocuments';
import type { Tool } from './Tool';

/** Every tool the model can call, in the order it sees them. The agent loop adds submit_answer itself. */
export const tools: Tool[] = [listDocuments, exportTable, searchDocuments, readPages, calculate, checkBoqArithmetic];
