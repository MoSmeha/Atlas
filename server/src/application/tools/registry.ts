import { listDocuments } from './listDocuments';
import type { Tool } from './Tool';

/** Every tool the model can call, in the order it sees them. The agent loop adds submit_answer itself. */
export const tools: Tool[] = [listDocuments];
