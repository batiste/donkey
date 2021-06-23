import * as http from 'http';
import { match, matcherToOptions } from './match';
import { removeHeaders } from './middlewares/removeHeaders';

function modifyResponseHeaders(headers: http.IncomingHttpHeaders) {
  headers['access-control-allow-credentials'] = 'true'
  headers['access-control-allow-origin'] = 'https://example.com'
}

function onRequest(clientRequest: http.IncomingMessage, clientResponse: http.ServerResponse) {

  var matcher = match(clientRequest)

  if (!matcher) {
    clientResponse.writeHead(503)
    clientResponse.end('No match on gateway')
    return
  }

  if (matcher.middleware && matcher.middleware(clientRequest, clientResponse)) {
    return
  }

  const options = matcherToOptions(clientRequest, matcher)

  removeHeaders(clientRequest, clientResponse)
  console.log(options)

  var req = http.request(options, function (res) {
    modifyResponseHeaders(res.headers)
    clientResponse.writeHead(res.statusCode || 200, res.headers)
    res.pipe(clientResponse, {
      end: true
    });
  });

  req.on('error', (error) => {
    console.error(error)
    try {
      clientResponse.writeHead(503)
    } catch(e) {
      console.warn('Header already sent! -e')
    }
    clientResponse.end('Gateway error')
  });

  req.on('timeout', () => {
    try {
      clientResponse.writeHead(503)
    } catch(e) {
      console.warn('Header already sent! -t')
    }
    clientResponse.end('Gateway timeout')
  });

  clientRequest.pipe(req, {
    end: true
  });
}

const PORT = 3000
console.log(`Starting Donkey Gateway on http://localhost:${PORT}`)
const server = http.createServer(onRequest).listen(PORT);

process.on('uncaughtException', (err: any, origin: any) => {
  console.error(err, origin)
});
