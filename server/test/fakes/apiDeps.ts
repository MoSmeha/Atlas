import type { ApiDeps } from '../../src/api/app';
import { ExportResult } from '../../src/application/ExportResult';
import { SessionStore } from '../../src/application/session/SessionStore';
import { FakeClock } from './FakeClock';
import { FakeExporter } from './FakeOutputs';

/** ApiDeps made of fakes; pass overrides for the features a test cares about. */
export function makeApiDeps(overrides: Partial<ApiDeps> = {}): ApiDeps {
  return {
    health: { version: 'test', apiKeyPresent: false },
    exports: {
      sessions: new SessionStore(),
      exportResult: new ExportResult(new FakeExporter(), new FakeClock()),
      exportsDir: '/exports',
    },
    ...overrides,
  };
}
