import * as http from "http";

/**
 * Hop-by-hop headers are meaningful only for a single transport-level
 * connection and must not be forwarded by proxies (RFC 9110, section 7.6.1).
 */
export const HOP_BY_HOP_HEADERS = [
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "proxy-connection",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
];

/**
 * Remove hop-by-hop headers, including any header listed in the
 * Connection header, from a headers object (mutated in place).
 */
export function removeHopByHopHeaders(
  headers: http.IncomingHttpHeaders
): http.IncomingHttpHeaders {
  const connection = headers.connection;
  if (connection) {
    for (const token of connection.split(",")) {
      const name = token.trim().toLowerCase();
      // never let a client remove the Host header this way
      if (name !== "host") {
        delete headers[name];
      }
    }
  }
  for (const name of HOP_BY_HOP_HEADERS) {
    delete headers[name];
  }
  return headers;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Set the X-Forwarded-For, X-Forwarded-Host and X-Forwarded-Proto headers.
 *
 * When `trustForwardedHeaders` is false (the default), Donkey considers it is
 * the edge proxy: values sent by the client are discarded and replaced, so
 * they cannot be spoofed. When true (Donkey runs behind another trusted proxy
 * or load balancer), the client IP is appended to the existing
 * X-Forwarded-For chain and existing X-Forwarded-Host/Proto are kept.
 */
export function setForwardedHeaders(
  clientRequest: http.IncomingMessage,
  trustForwardedHeaders: boolean
) {
  const headers = clientRequest.headers;
  const remoteAddress = clientRequest.socket.remoteAddress;
  const proto = (clientRequest.socket as { encrypted?: boolean }).encrypted
    ? "https"
    : "http";

  const existingFor = trustForwardedHeaders
    ? firstValue(headers["x-forwarded-for"])
    : undefined;
  if (remoteAddress) {
    headers["x-forwarded-for"] = existingFor
      ? `${existingFor}, ${remoteAddress}`
      : remoteAddress;
  } else if (!trustForwardedHeaders) {
    delete headers["x-forwarded-for"];
  }

  const existingHost = trustForwardedHeaders
    ? firstValue(headers["x-forwarded-host"])
    : undefined;
  const host = existingHost || headers.host;
  if (host) {
    headers["x-forwarded-host"] = host;
  } else {
    delete headers["x-forwarded-host"];
  }

  const existingProto = trustForwardedHeaders
    ? firstValue(headers["x-forwarded-proto"])
    : undefined;
  headers["x-forwarded-proto"] = existingProto || proto;
}
