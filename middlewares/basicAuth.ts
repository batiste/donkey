import * as http from 'http';

export function basicAuthMiddleware(clientRequest: http.IncomingMessage, clientResponse: http.ServerResponse) {
  // check for basic auth header
  if (!clientRequest.headers.authorization || clientRequest.headers.authorization.indexOf('Basic ') === -1) {
    clientResponse.setHeader('WWW-Authenticate', 'Basic')
    clientResponse.writeHead(401)
    clientResponse.end('Missing Authorization Header')
    return true
  }

  // verify auth credentials
  const base64Credentials =  clientRequest.headers.authorization.split(' ')[1];
  const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
  const [username, password] = credentials.split(':');
  if (username != 'admin') {
    clientResponse.writeHead(401)
    clientResponse.end('Incorrect credentials')
    return true
  }

  delete clientRequest.headers['authorization']

  return false
}