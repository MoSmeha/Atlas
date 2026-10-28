import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

/** The repository root, where the server reads `.env`. */
const repoRoot = fileURLToPath(new URL('..', import.meta.url));

export default defineConfig(({ mode }) => {
  // The same PORT the server listens on: from the environment, else from the root .env, else 3001.
  const env = loadEnv(mode, repoRoot, '');
  const serverPort = env.PORT || '3001';
  return {
    plugins: [react()],
    server: {
      port: Number(env.CLIENT_PORT || 5173),
      proxy: {
        '/api': { target: `http://127.0.0.1:${serverPort}` },
      },
    },
  };
});
