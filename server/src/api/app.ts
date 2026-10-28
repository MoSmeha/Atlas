import multipart from '@fastify/multipart';
import Fastify from 'fastify';
import { registerErrorHandler } from './errorHandler';
import { documentsRoutes, type DocumentsDeps } from './routes/documents';
import { exportsRoutes, type ExportsDeps } from './routes/exports';
import { folderRoutes, type FolderDeps } from './routes/folder';
import { healthRoutes, type HealthDeps } from './routes/health';
import { MAX_UPLOAD_FILES, uploadsRoutes, type UploadsDeps } from './routes/uploads';
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from './zod';

export interface ApiDeps {
  health: HealthDeps;
  exports: ExportsDeps;
  folder: FolderDeps;
  documents: DocumentsDeps;
  uploads: UploadsDeps;
}

/** Builds the Fastify app with every feature's routes. Tests call this and use `inject`. */
export function buildApp(deps: ApiDeps) {
  const app = Fastify({ logger: { level: 'warn' } }).withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerErrorHandler(app);
  app.register(multipart, { limits: { fileSize: deps.uploads.maxFileBytes, files: MAX_UPLOAD_FILES } });

  app.register(healthRoutes, { deps: deps.health });
  app.register(exportsRoutes, { deps: deps.exports });
  app.register(folderRoutes, { deps: deps.folder });
  app.register(documentsRoutes, { deps: deps.documents });
  app.register(uploadsRoutes, { deps: deps.uploads });

  return app;
}

export type AtlasApp = ReturnType<typeof buildApp>;
