import * as http from 'http';
import * as https from 'https';
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

    clientRequest.headers['origin'] = matcher?.upstream
    clientRequest.headers['host'] = matcher?.upstream

    const requestFct = options.protocol === 'https:' ? https.request : http.request

    const upstreamRequest= requestFct(options, function (upstreamResponse) {
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
        clientResponse.end('Gateway error')
      } catch(e) {
        logger.warn('Headers already sent in error handler', e)
      }
    });

    upstreamRequest.on('timeout', () => {
      logger.warn(`Timeout on upstream ${matcher?.upstream}`)
      try {
        clientResponse.writeHead(503)
        clientResponse.end('Gateway timeout')
      } catch(e) {
        logger.warn('Headers already sent in timeout handler', e)
      }
    });
  }

  logger.log(`Starting Donkey Gateway 🐴 on http://localhost:${port}`)

  process.on('uncaughtException', (err: any, origin: any) => {
    logger.error(err, origin)
  });

  return http.createServer(onRequest).listen(port);
}

