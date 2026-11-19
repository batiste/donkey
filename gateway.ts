import * as http from "http";
import * as https from "https";
import { removeHopByHopHeaders, setForwardedHeaders } from "./headers";
import { logger } from "./logs";
import { matchRequest, matcherToOptions, normalizeUrl } from "./match";
import { Config, Request } from "./schema";

class UpstreamTimeoutError extends Error {
  constructor() {
    super("Upstream timeout");
    this.name = "UpstreamTimeoutError";
  }
}

/**
 * Send an error response to the client if it is still possible, otherwise
 * destroy the connection so the client does not wait forever.
 */
function sendError(
  clientResponse: http.ServerResponse,
  status: number,
  message: string
) {
  if (clientResponse.headersSent) {
    clientResponse.destroy();
    return;
  }
  if (!clientResponse.writableEnded) {
    clientResponse.writeHead(status, { "content-type": "text/plain" });
    clientResponse.end(message);
  }
}

export function createGateway(config: Config, port: number): http.Server {
  // Reuse connections to the upstreams instead of opening a new TCP (and
  // TLS) connection for every request.
  const agentOptions: http.AgentOptions = {
    keepAlive: true,
    ...config.upstreamAgentOptions,
  };
  const httpAgent = new http.Agent(agentOptions);
  const httpsAgent = new https.Agent(agentOptions);

  async function proxy(
    clientRequest: Request,
    clientResponse: http.ServerResponse
  ) {
    const normalizedUrl = normalizeUrl(clientRequest.url || "");
    if (normalizedUrl === null) {
      logger.warn(`Rejected invalid request path ${clientRequest.url}`);
      clientResponse.writeHead(400);
      clientResponse.end("Invalid request path");
      return;
    }
    clientRequest.url = normalizedUrl;

    // Done before the middlewares so they see the headers that will be sent
    // upstream, and so that headers they add cannot be removed by a
    // client-provided Connection header.
    removeHopByHopHeaders(clientRequest.headers);
    setForwardedHeaders(clientRequest, !!config.trustForwardedHeaders);

    const match = matchRequest(config.matchers, clientRequest);

    if (!match) {
      logger.warn(
        `No match found for ${clientRequest.headers.host}, ${clientRequest.url}`
      );
      clientResponse.writeHead(404);
      clientResponse.end("No match on gateway, 🐴 will not move");
      return;
    }

    clientRequest.match = match;
    const matcher = match.matcher;

    const middlewaresToApply = [
      ...(config.global?.requestMiddlewares || []),
      ...(matcher.requestMiddlewares || []),
    ];

    for (const middleware of middlewaresToApply) {
      if (await middleware(clientRequest, clientResponse)) {
        return;
      }
      // the client might have gone away while a middleware was running
      if (clientRequest.destroyed || clientResponse.destroyed) {
        return;
      }
    }

    const options = matcherToOptions(clientRequest, match, config);

    logger.log("Match found", {
      options,
      match,
      host: clientRequest.headers.host,
      url: clientRequest.url,
    });

    if (!matcher.preserveHost) {
      clientRequest.headers.host = matcher.upstream;
    }

    const isHttps = options.protocol === "https:";
    options.agent = isHttps ? httpsAgent : httpAgent;
    const requestFct = isHttps ? https.request : http.request;

    const upstreamRequest = requestFct(options, (upstreamResponse) => {
      const responseMiddlewaresToApply = [
        ...(config.global?.responseMiddlewares || []),
        ...(matcher.responseMiddlewares || []),
      ];

      try {
        for (const middleware of responseMiddlewaresToApply) {
          middleware(upstreamResponse);
        }
      } catch (error: any) {
        logger.error("Error in response middleware", {
          error,
          upstream: matcher.upstream,
        });
        upstreamResponse.destroy();
        sendError(clientResponse, 500, "Gateway error");
        return;
      }

      upstreamResponse.on("error", (error) => {
        logger.error("Error while reading the upstream response", {
          error,
          upstream: matcher.upstream,
        });
        clientResponse.destroy();
      });

      clientResponse.writeHead(
        upstreamResponse.statusCode || 502,
        removeHopByHopHeaders(upstreamResponse.headers)
      );
      upstreamResponse.pipe(clientResponse);
    });

    upstreamRequest.on("timeout", () => {
      logger.warn(`Timeout on upstream ${matcher.upstream}`);
      // destroying with an error triggers the "error" handler below
      upstreamRequest.destroy(new UpstreamTimeoutError());
    });

    upstreamRequest.on("error", (error) => {
      if (clientResponse.destroyed) {
        // the client went away, nothing to answer
        return;
      }
      if (error instanceof UpstreamTimeoutError) {
        sendError(clientResponse, 504, "Gateway timeout");
        return;
      }
      logger.error("Error on upstream request", {
        error,
        upstream: matcher.upstream,
      });
      sendError(clientResponse, 502, "Bad gateway");
    });

    // If the client aborts or the connection breaks before the response was
    // fully sent, stop working on the upstream request as well.
    clientResponse.on("close", () => {
      if (!clientResponse.writableFinished) {
        upstreamRequest.destroy();
      }
    });
    clientRequest.on("error", () => upstreamRequest.destroy());

    clientRequest.pipe(upstreamRequest);
  }

  async function onRequest(
    incomingMessage: http.IncomingMessage,
    clientResponse: http.ServerResponse
  ) {
    const clientRequest = incomingMessage as Request;
    try {
      await proxy(clientRequest, clientResponse);
    } catch (error: any) {
      logger.error("Unhandled error while processing the request", {
        error,
        host: clientRequest.headers.host,
        url: clientRequest.url,
      });
      sendError(clientResponse, 500, "Gateway error");
    }
  }

  logger.log(`Starting Donkey Gateway 🐴 on http://localhost:${port}`);

  const server = http.createServer(onRequest);
  server.on("close", () => {
    httpAgent.destroy();
    httpsAgent.destroy();
  });
  return server.listen(port);
}
