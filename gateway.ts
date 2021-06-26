import * as http from 'http';
import { logger } from './logs';
import { match, matcherToOptions } from './match';
import { Config } from './schema';


export function createGateway(config: Config, port: number): http.Server {

  function onRequest(clientRequest: http.IncomingMessage, clientResponse: http.ServerResponse) {

    const matcher = match(config.matchers, clientRequest)

    if (!matcher) {
      logger.warn(`No matches for ${clientRequest.headers.host}, ${clientRequest.url}`)
      clientResponse.writeHead(503)
      clientResponse.end('No match on gateway, 🐴 will not move')
      return
    }

    if (matcher.requestMiddlewares) {
      for(let i=0; i < matcher.requestMiddlewares.length; i++) {
        if (matcher.requestMiddlewares[i](clientRequest, clientResponse)) { return }
      }
    }

    const options = matcherToOptions(clientRequest, matcher, config)

    logger.log(`Match found for host:${clientRequest.headers.host}`, options)

    const upstreamRequest= http.request(options, function (upstreamResponse) {
      if (matcher.responseMiddlewares) {
        for(let i=0; i < matcher.responseMiddlewares.length; i++) {
          matcher.responseMiddlewares[i](upstreamResponse)
        }
      }
      clientResponse.writeHead(upstreamResponse.statusCode || 200, upstreamResponse.headers)
      upstreamResponse.pipe(clientResponse, {
        end: true
      });
    });

    clientRequest.pipe(upstreamRequest, {
      end: true
    });

    upstreamRequest.on('error', (error) => {
      logger.error(error)
      try {
        clientResponse.writeHead(503)
      } catch(e) {
        logger.warn('Header already sent! -e')
      }
      clientResponse.end('Gateway error')
    });

    upstreamRequest.on('timeout', () => {
      logger.warn(`Timeout on upstream ${matcher?.upstream}`)
      try {
        clientResponse.writeHead(503)
      } catch(e) {
        logger.warn('Header already sent! -t')
      }
      clientResponse.end('Gateway timeout')
    });
  }

  logger.log(`Starting Donkey Gateway 🐴 on http://localhost:${port}`)

  process.on('uncaughtException', (err: any, origin: any) => {
    logger.error(err, origin)
  });

  return http.createServer(onRequest).listen(port);
}

