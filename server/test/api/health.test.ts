import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/api/app';
import { makeApiDeps } from '../fakes/apiDeps';

describe('health route', () => {
  const app = buildApp(makeApiDeps({ health: { version: 'test', apiKeyPresent: false } }));

  it('reports the server is up and whether the API key is set', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true, version: 'test', apiKeyPresent: false });
  });

  it('returns the error body for an unknown route', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/nope' });
    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('invalid_request');
  });
});
