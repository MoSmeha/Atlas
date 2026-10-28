import type { ToolContext } from '../../src/application/tools/Tool';
import { Session } from '../../src/application/session/Session';
import { FakeClock } from './FakeClock';
import { FakeEmbeddingClient } from './FakeEmbeddingClient';
import { FakeIndex } from './FakeIndex';
import { FakeModelClient } from './FakeModelClient';
import { FakeExporter, FakePageRenderer } from './FakeOutputs';

/** A ToolContext made of fakes; pass overrides for the parts a test cares about. */
export function makeToolContext(overrides: Partial<ToolContext> = {}): ToolContext {
  return {
    folder: '/folder',
    index: new FakeIndex(),
    embeddings: new FakeEmbeddingClient(),
    model: new FakeModelClient(),
    renderer: new FakePageRenderer(),
    exporter: new FakeExporter(),
    session: new Session('test-session'),
    clock: new FakeClock(),
    models: { answer: 'frontier-model', small: 'small-model' },
    exportsDir: '/exports',
    signal: new AbortController().signal,
    ...overrides,
  };
}
