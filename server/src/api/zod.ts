import type {
  FastifyPluginAsync,
  FastifySchemaCompiler,
  FastifyTypeProvider,
  RawServerDefault,
} from 'fastify';
import type { z } from 'zod';

/** Lets route handlers infer request and reply types from the Zod schemas they declare. */
export interface ZodTypeProvider extends FastifyTypeProvider {
  validator: this['schema'] extends z.ZodType ? z.output<this['schema']> : unknown;
  serializer: this['schema'] extends z.ZodType ? z.input<this['schema']> : unknown;
}

export type RoutePlugin<Options extends object = Record<never, never>> = FastifyPluginAsync<
  Options,
  RawServerDefault,
  ZodTypeProvider
>;

export const validatorCompiler: FastifySchemaCompiler<z.ZodType> =
  ({ schema }) =>
  (data) => {
    const result = schema.safeParse(data);
    return result.success ? { value: result.data } : { error: result.error };
  };

export const serializerCompiler =
  ({ schema }: { schema: unknown }) =>
  (data: unknown) =>
    JSON.stringify((schema as z.ZodType).parse(data));
