import * as http from 'http';

export const headersToRemove = ['x-authenticated-scope', 'x-consumer-custom-id', 
  'x-authenticated-userid', 'x-anonymous-consumer',
  'x-consumer-id', 'x-consumer-username']

export function removeHeaders(clientRequest: http.IncomingMessage, clientResponse: http.ServerResponse) {
  const headers = clientRequest.headers
  headersToRemove.forEach(h => delete headers[h])
}