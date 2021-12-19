import * as http from "http";
export interface IMatcher {
  /**
   * Upstream domain, with no protocol and no path.
   */
  upstream: string;
  /**
   * Port to use on the upstream. The default is 80.
   */
  port?: number;
  /**
   * List of hosts to match.
   */
  hosts?: (string | RegExp)[];
  /**
   * List of uris to match. String.startsWith is used for the match.
   * A RegExp can also be provided. If stripeUri is true, the first capturing
   * parenthesis will be used. If none present the whole match will be used.
   */
  uris?: (string | RegExp)[];
  /**
   * Protocol to use on the upstream. The default is http.
   */
  protocol?: "http:" | "https:";
  /**
   * Timeout when the gateway give up on the upstream. There is a default
   * of 30 seconds.
   */
  timeout?: number;
  /**
   * All middleware to apply on the client request or response.
   */
  requestMiddlewares?: RequestMiddleware[];
  /**
   * All middleware to apply on the upstream response.
   */
  responseMiddlewares?: ResponseMiddleware[];
  /**
   * Preserve the original host from the client. The default is false.
   */
  preserveHost?: boolean;
  /**
   * Remove the matched path from the rest of the URI. E.g.
   * If the matcher path is /admin/ and the incoming request is /admin/user/123
   * the uri used on the upstream will become /user/123. As leading slash is enforced.
   * The default is false.
   */
  stripeUri?: boolean;
}

export interface IMatcherCriteria {
  host?: string;
  uri?: string;
}

export interface IMatch {
  matcher: IMatcher;
  criteria: IMatcherCriteria;
}

export interface Config {
  matchers: IMatcher[];
  /** Applied to all request without conditions. */
  global?: {
    /**
     * All middleware to apply on the client request or response.
     */
    requestMiddlewares?: RequestMiddleware[];
    /**
     * All middleware to apply on the upstream response.
     */
    responseMiddlewares?: ResponseMiddleware[];
  };
  defaultTimeout?: number;
}

/**
 * Use this if you want to create a middlware that cares
 * about request and response. Return true if you handled
 * the response completly and you want not other middleware to be applied.
 */
export type RequestMiddleware = (
  clientRequest: Request,
  clientResponse: http.ServerResponse
) => Promise<boolean>;

export type ResponseMiddleware = (
  upstreamResponse: http.IncomingMessage
) => void;

export interface Request extends http.IncomingMessage {
  metadata: object;
  match: IMatch;
}
