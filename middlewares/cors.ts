import * as http from "http";
import { matchHosts } from "../match";
import { RequestMiddleware, Request, ResponseMiddleware } from "../schema";

/** Generic simple middleware that always adds the same headers */
export function createCorsMiddleware(domain: string): ResponseMiddleware {
  return function corsMiddleware(upstreamResponse: http.IncomingMessage) {
    const headers = upstreamResponse.headers;
    headers["access-control-allow-credentials"] = "true";
    headers["access-control-allow-origin"] = domain;
  };
}

interface CorsOptions {
  allowOrigins: (string | RegExp)[]
  allowMethods?: string[]
}

// based on https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/OPTIONS

/** Middleware that accepts many possible origins */
export function createCorsOptionsMiddleware(options: CorsOptions): RequestMiddleware {
  return async function test(
    clientRequest: Request,
    clientResponse: http.ServerResponse
  ) {
    const origin = clientRequest.headers.origin || ''
    const match = matchHosts(options.allowOrigins, origin)
    const method = clientRequest.method || ''
    const methodAllowed = options.allowMethods?.includes(method) || method === 'OPTIONS'

    if (match && methodAllowed) {
      if (options.allowMethods) {
        const methods = [...options.allowMethods, 'OPTIONS'];
        clientResponse.setHeader("access-control-allow-methods", methods.join(', '));
      }
      clientResponse.setHeader("access-control-allow-credentials", "true");
      clientResponse.setHeader("access-control-allow-origin", match);
    }

    if(clientRequest.method === 'OPTIONS') {
      clientResponse.writeHead(204);
      clientResponse.end('');
      return true
    }

    return false;
  };
}