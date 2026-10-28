import Fastify from 'fastify';
import { registerErrorHandler } from './errorHandler';
import { exportsRoutes, type ExportsDeps } from './routes/exports';
import { healthRoutes, type HealthDeps } from './routes/health';
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from './zod';

export interface ApiDeps {
  health: HealthDeps;
  exports: ExportsDeps;
}

/** Builds the Fastify app with every feature's routes. Tests call this and use `inject`. */
export function buildApp(deps: ApiDeps) {
  const app = Fastify({ logger: { level: 'warn' } }).withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerErrorHandler(app);

  app.register(healthRoutes, { deps: deps.health });
  app.register(exportsRoutes, { deps: deps.exports });

  return app;
}

export type AtlasApp = ReturnType<typeof buildApp>;
