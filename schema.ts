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
  /**
   * Protocol to use on the upstream. Default http
   */
  protocol?: 'http:' | 'https:'
  /**
   * Timeout when the gateway give up on the upstream
   */
  timeout?: number
  /**
   * All middleware to apply on the client request or response
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
   * Remove the matched uri from the rest of the uri
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
  /** Applied to all request without conditions */
  global?: {
    /**
     * All middleware to apply on the client request or response
     */
    requestMiddlewares?: RequestMiddleware[]
    /**
     * All middleware to apply on the upstream response
     */
    responseMiddlewares?: ResponseMiddleware[]
  }
  defaultTimeout?: number
}

export type RequestMiddleware = (clientRequest: Request, clientResponse: http.ServerResponse) => Promise<boolean>

export type ResponseMiddleware = (upstreamResponse: http.IncomingMessage) => void

export interface Request extends http.IncomingMessage {
  metadata: object
}

