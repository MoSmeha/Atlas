import { calculate } from './calculate';
import { checkBoqArithmetic } from './checkBoqArithmetic';
import { compareRevisions } from './compareRevisions';
import { exportTable } from './exportTable';
import { extractSchedule } from './extractSchedule';
import { listDocuments } from './listDocuments';
import { queryTables } from './queryTables';
import { lookAtPage } from './lookAtPage';
import { readPages } from './readPages';
import { searchDocuments } from './searchDocuments';
import type { Tool } from './Tool';

/** Every tool the model can call, in the order it sees them. The agent loop adds submit_answer itself. */
export const tools: Tool[] = [listDocuments, exportTable, searchDocuments, readPages, calculate, extractSchedule, queryTables, checkBoqArithmetic, lookAtPage, compareRevisions];
