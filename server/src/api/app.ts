import Fastify from 'fastify';
import { registerErrorHandler } from './errorHandler';
import { healthRoutes, type HealthDeps } from './routes/health';
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from './zod';

export interface ApiDeps {
  health: HealthDeps;
}

/** Builds the Fastify app with every feature's routes. Tests call this and use `inject`. */
export function buildApp(deps: ApiDeps) {
  const app = Fastify({ logger: { level: 'warn' } }).withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerErrorHandler(app);

  app.register(healthRoutes, { deps: deps.health });

  return app;
}

export type AtlasApp = ReturnType<typeof buildApp>;
