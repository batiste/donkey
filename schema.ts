import * as http from 'http';
export interface IMatcher {
  upstream: string
  port?: number
  host?: string
  uris?: string[]
  protocol?: string
  timeout?: number
  requestMiddlewares?: RequestMiddleware[]
  responseMiddlewares?: ResponseMiddleware[]
}

export interface Config {
  matchers: IMatcher[]
  defaultTimeout?: number
}

export type RequestMiddleware = (clientRequest: http.IncomingMessage, clientResponse: http.ServerResponse) => boolean

export type ResponseMiddleware = (upstreamResponse: http.IncomingMessage) => void


