import * as http from "http";
import { RequestMiddleware } from "../schema";
import { Request } from "../schema";

const uid = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

export function createXRequestIdMiddleware(): RequestMiddleware {
  return async function rateLimitMiddleware(
    clientRequest: Request,
    clientResponse: http.ServerResponse
  ) {
    const xRequestId = clientRequest.headers["x-request-id"] || uid();
    clientRequest.headers["x-request-id"] = xRequestId;
    clientResponse.setHeader("x-request-id", xRequestId);
    return false;
  };
}
