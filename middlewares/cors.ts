import * as http from "http";
import { ResponseMiddleware } from "../schema";

export function createCorsMiddleware(domain: string): ResponseMiddleware {
  return function corsMiddleware(upstreamResponse: http.IncomingMessage) {
    const headers = upstreamResponse.headers;
    headers["access-control-allow-credentials"] = "true";
    headers["access-control-allow-origin"] = domain;
  };
}
