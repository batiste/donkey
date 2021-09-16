import * as http from "http";
import { RequestMiddleware } from "../schema";
import { Request } from "../schema";

export function createRemoveHeadersMiddleware(
  headersToRemove: string[]
): RequestMiddleware {
  return async function removeHeadersMiddleware(
    clientRequest: Request,
    clientResponse: http.ServerResponse
  ) {
    const headers = clientRequest.headers;
    headersToRemove.forEach((h) => delete headers[h]);
    return false;
  };
}
