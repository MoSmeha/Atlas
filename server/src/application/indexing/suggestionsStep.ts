import type { Workspace } from '../workspace/Workspace';
import type { IndexStep } from './IndexFolder';
import { suggest } from './SuggestQuestions';

/**
 * The last indexing step: suggested questions from the documents as they now stand, classifications included, so
 * it runs after classification. It makes no model call and shows under the classifying phase.
 */
export function suggestionsStep(workspace: Workspace): IndexStep {
  return {
    phase: 'classifying',
    async run({ index, signal }) {
      if (signal.aborted) return;
      workspace.update({ suggestions: suggest(index.documents()) });
    },
  };
}
