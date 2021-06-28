import * as http from 'http';
export interface IMatcher {
  /**
   * Upstream domain, with no protocol, no path
   */
  upstream: string
  /**
   * Port to use on the upstream, default is 80
   */
  port?: number
  hosts?: string[]
  uris?: string[]
  protocol?: string
  /**
   * Timeout when the gateway give up the upstream
   */
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


