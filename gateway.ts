import * as http from "http";
import * as https from "https";
import { logger } from "./logs";
import { matchRequest, matcherToOptions } from "./match";
import { Config, Request } from "./schema";

export function createGateway(config: Config, port: number): http.Server {
  async function onRequest(
    clientRequest: Request,
    clientResponse: http.ServerResponse
  ) {
    const match = matchRequest(config.matchers, clientRequest);

    if (!match) {
      logger.warn(
        `No match found for ${clientRequest.headers.host}, ${clientRequest.url}`
      );
      clientResponse.writeHead(503);
      clientResponse.end("No match on gateway, 🐴 will not move");
      return;
    }

    const matcher = match.matcher;

    const middlewaresToApply = [
      ...(config.global?.requestMiddlewares || []),
      ...(matcher.requestMiddlewares || []),
    ];

    for (const middleware of middlewaresToApply) {
      if (await middleware(clientRequest, clientResponse)) {
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
      clientRequest.headers.host = matcher?.upstream;
    }

    const requestFct =
      options.protocol === "https:" ? https.request : http.request;

    const upstreamRequest = requestFct(options, (upstreamResponse) => {
      const responseMiddlewaresToApply = [
        ...(config.global?.responseMiddlewares || []),
        ...(matcher.responseMiddlewares || []),
      ];

      for (const middleware of responseMiddlewaresToApply) {
        middleware(upstreamResponse);
      }
      clientResponse.writeHead(
        upstreamResponse.statusCode || 200,
        upstreamResponse.headers
      );
      upstreamResponse.pipe(clientResponse, {
        end: true,
      });
    });

    clientRequest.pipe(upstreamRequest, {
      end: true,
    });

    upstreamRequest.on("error", (error) => {
      logger.error("Error on request", { error, match });
      try {
        clientResponse.writeHead(503);
        clientResponse.end("Gateway error");
      } catch (e) {
        logger.warn("Headers already sent in error handler", e);
      }
    });

    upstreamRequest.on("timeout", () => {
      logger.warn(`Timeout on upstream ${matcher?.upstream}`, { match });
      try {
        clientResponse.writeHead(503);
        clientResponse.end("Gateway timeout");
      } catch (e) {
        logger.warn("Headers already sent in timeout handler", e);
      }
    });
  }

  logger.log(`Starting Donkey Gateway 🐴 on http://localhost:${port}`);

  process.on("uncaughtException", (err: any, origin: any) => {
    logger.error("Uncaught Exception", { err, origin });
  });

  return http.createServer(onRequest as any).listen(port);
}
