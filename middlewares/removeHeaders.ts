import * as http from 'http';
import { RequestMiddleware } from '../schema';

export function createRemoveHeadersMiddleware(headersToRemove: string[]): RequestMiddleware {
  return function removeHeadersMiddleware(clientRequest: http.IncomingMessage, clientResponse: http.ServerResponse) {
    const headers = clientRequest.headers
    headersToRemove.forEach(h => delete headers[h])
    return false
  }
}

