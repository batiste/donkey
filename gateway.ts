import * as http from 'http';
import { logger } from './logs';
import { match, matcherToOptions } from './match';
import { removeHeaders } from './middlewares/removeHeaders';
import { Config } from './schema';

function modifyResponseHeaders(headers: http.IncomingHttpHeaders) {
  headers['access-control-allow-credentials'] = 'true'
  headers['access-control-allow-origin'] = 'https://example.com'
}

export function createGateway(config: Config, port: number): http.Server {

  function onRequest(clientRequest: http.IncomingMessage, clientResponse: http.ServerResponse) {

    var matcher = match(config.matchers, clientRequest)

    if (!matcher) {
      logger.log('no matches')
      clientResponse.writeHead(503)
      clientResponse.end('No match on gateway, 🐴 kicked you out')
      return
    }

    if (matcher.middleware && matcher.middleware(clientRequest, clientResponse)) {
      return
    }

    const options = matcherToOptions(clientRequest, matcher)

    removeHeaders(clientRequest, clientResponse)
    logger.log(`Match found for host:${clientRequest.headers.host}`, options)

    var req = http.request(options, function (res) {
      modifyResponseHeaders(res.headers)
      clientResponse.writeHead(res.statusCode || 200, res.headers)
      res.pipe(clientResponse, {
        end: true
      });
    });

    clientRequest.pipe(req, {
      end: true
    });

    req.on('error', (error) => {
      logger.error(error)
      try {
        clientResponse.writeHead(503)
      } catch(e) {
        logger.warn('Header already sent! -e')
      }
      clientResponse.end('Gateway error')
    });

    req.on('timeout', () => {
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

