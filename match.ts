import * as http from "http";
import * as path from "path";
import { Config, IMatch, IMatcher, IMatcherCriteria, Request } from "./schema";

/**
 * Normalise the path of a request URL so that matching is done on the path
 * the upstream will actually resolve:
 * - dot segments are resolved ("/public/../admin" becomes "/admin")
 * - duplicate slashes are collapsed ("//admin" becomes "/admin")
 *
 * Returns null for URLs that must be rejected: anything that is not an
 * origin-form path, backslashes, and percent-encoded dot segments or
 * slashes that could be decoded into a traversal by the upstream
 * (e.g. "/public/%2e%2e/admin" or "/public/..%2fadmin").
 */
export function normalizeUrl(url: string): string | null {
  if (!url.startsWith("/")) {
    return null;
  }
  const queryIndex = url.indexOf("?");
  const rawPath = queryIndex === -1 ? url : url.slice(0, queryIndex);
  const query = queryIndex === -1 ? "" : url.slice(queryIndex);

  if (rawPath.includes("\\")) {
    return null;
  }

  const normalized = path.posix.normalize(rawPath);

  let decoded: string;
  try {
    decoded = decodeURIComponent(normalized);
  } catch {
    return null;
  }
  const segments = decoded.split(/[/\\]/);
  if (segments.some((segment) => segment === "." || segment === "..")) {
    return null;
  }

  return normalized + query;
}

export function matchUris(
  uris: (string | RegExp)[],
  requestUrl: string
): string | false {
  for (const uri of uris) {
    if (uri instanceof RegExp) {
      const result = uri.exec(requestUrl);
      if (result) {
        // we return the first capturing parenthesis if present,
        // it can be used for striping the URL
        return result[1] || result[0];
      }
    } else if (requestUrl.startsWith(uri)) {
      return uri;
    }
  }
  return false;
}

export function matchHosts(
  hosts: (string | RegExp)[],
  requestHost: string
): string | false {
  for (const host of hosts) {
    if (host instanceof RegExp) {
      const result = host.exec(requestHost);
      if (result) {
        return requestHost;
      }
    } else if (host === requestHost) {
      return host;
    }
  }
  return false;
}

export function matchRequest(
  matchers: IMatcher[],
  clientRequest: Request
): IMatch | undefined {
  for (const matcher of matchers) {
    const criteria: IMatcherCriteria = {};
    if (matcher.hosts) {
      if (matchHosts(matcher.hosts, clientRequest.headers.host as string)) {
        criteria.host = clientRequest.headers.host;
      } else {
        continue;
      }
    }
    if (matcher.uris) {
      const uri = matchUris(matcher.uris, clientRequest.url as string);
      if (uri) {
        criteria.uri = uri;
      } else {
        continue;
      }
    }
    return { matcher, criteria };
  }
  return;
}

export function matcherToOptions(
  clientRequest: http.IncomingMessage,
  match: IMatch,
  config: Config
): http.RequestOptions {
  const matcher = match.matcher;
  let url = clientRequest.url as string;
  if (matcher.stripeUri && match.criteria.uri) {
    url = url.substr(match.criteria.uri.length);
    if (!url.startsWith("/")) {
      url = "/" + url;
    }
  }
  return {
    host: matcher.upstream,
    port: matcher.port || 80,
    path: url,
    protocol: matcher.protocol || "http:",
    method: clientRequest.method,
    headers: clientRequest.headers,
    timeout: (matcher.timeout || config.defaultTimeout || 30) * 1000,
  };
}
