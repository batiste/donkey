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
  /**
   * List of hosts to check
   */
  hosts?: string[]
  /**
   * List of uris to match. String.startsWith is used
   */
  uris?: string[]
  protocol?: 'http:' | 'https:'
  /**
   * Global timeout when the gateway give up on the upstream
   */
  timeout?: number
  /**
   * All middleware to apply on the outer request/response
   */
  requestMiddlewares?: RequestMiddleware[]
  /**
   * All middleware to apply on the upstream response
   */
  responseMiddlewares?: ResponseMiddleware[]
  /**
   * Preserve the original host from the client
   */
  preserveHost?: boolean
  /**
   * Remove the matched uri before passing the request
   */
  stripUri?: boolean
}

export interface IMatcherCriteria {
  host?: string
  uri?: string
}

export interface IMatch {
  matcher: IMatcher,
  criteria: IMatcherCriteria 
}

export interface Config {
  matchers: IMatcher[]
  defaultTimeout?: number
}

export type RequestMiddleware = (clientRequest: http.IncomingMessage, clientResponse: http.ServerResponse) => boolean

export type ResponseMiddleware = (upstreamResponse: http.IncomingMessage) => void


