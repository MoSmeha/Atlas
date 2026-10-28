import type { IncomingMessage, ServerResponse } from 'node:http';

export interface RouteContext {
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
  /** Path parameters in order, already decoded. */
  params: string[];
}

export interface Route {
  method: 'GET' | 'POST' | 'DELETE';
  pattern: RegExp;
  handle(context: RouteContext): void | Promise<void>;
}

/** Stand-in for a path parameter when building a pattern from a `routes` function. */
export const PARAM = '__param__';

/** Turns a path from `routes` into a pattern; each PARAM becomes one path segment. */
export function pathPattern(path: string): RegExp {
  const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped.replaceAll(PARAM, '([^/]+)')}$`);
}

export function route(method: Route['method'], path: string, handle: Route['handle']): Route {
  return { method, pattern: pathPattern(path), handle };
}

/** Finds the route for a request, or null. */
export function match(routes: Route[], method: string, pathname: string): { route: Route; params: string[] } | null {
  for (const candidate of routes) {
    if (candidate.method !== method) continue;
    const found = candidate.pattern.exec(pathname);
    if (found) return { route: candidate, params: found.slice(1).map((p) => decodeURIComponent(p)) };
  }
  return null;
}
