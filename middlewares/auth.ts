import * as http from 'http';
import { RequestMiddleware, Request } from '../schema';

type TAuthCheck = (clientRequest: Request) => Promise<boolean>

export function createAuthMiddleware(authCheck: TAuthCheck): RequestMiddleware {
  return async function authMiddleware(clientRequest: Request, clientResponse: http.ServerResponse) {
    
    const check = await authCheck(clientRequest)

    if (!check) {
      clientResponse.writeHead(401)
      clientResponse.end('Authentication failed')
      return true
    }

    return false
  }
}