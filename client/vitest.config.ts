import { defineConfig } from 'vitest/config';

/** Unit tests for the client's pure logic, such as the voice call's transcript and face motion. No browser needed. */
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
});
