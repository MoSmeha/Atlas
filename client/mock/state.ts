import { MockSessions } from './MockSessions';
import { MockWorkspace } from './MockWorkspace';

/** Everything the mock remembers, in memory for as long as it runs. */
export const state = {
  workspace: new MockWorkspace(),
  sessions: new MockSessions(),
  /** MOCK_NO_KEY=1 behaves like a server started without OPENAI_API_KEY. */
  apiKeyPresent: process.env.MOCK_NO_KEY !== '1',
};

// MOCK_FOLDER=<path> starts with the project already indexed, skipping the folder step.
const preloaded = process.env.MOCK_FOLDER;
if (preloaded) state.workspace.loadReady(preloaded);
