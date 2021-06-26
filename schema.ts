import * as http from 'http';
export interface IMatcher {
  upstream: string
  port?: number
  host?: string
  uris?: string[]
  protocol?: string
  timeout?: number
  requestMiddlewares?: RequestMiddleware[]
}

export interface Config {
  matchers: IMatcher[]
  defaultTimeout?: number
}

export type RequestMiddleware = (clientRequest: http.IncomingMessage, clientResponse: http.ServerResponse) => boolean
