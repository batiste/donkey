import * as http from 'http';
import { RequestMiddleware, Request } from '../schema';

export function createBasicAuthMiddleware(username:string, password: string): RequestMiddleware {
  return async function basicAuthMiddleware(clientRequest: Request, clientResponse: http.ServerResponse) {
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
    const [_username, _password] = credentials.split(':');
    if (username != _username || password != _password) {
      clientResponse.writeHead(401)
      clientResponse.end('Incorrect credentials')
      return true
    }

    delete clientRequest.headers['authorization']

    return false
  }
}