import * as http from "http";
import jwt from 'jsonwebtoken';
import { RequestMiddleware, Request } from "../schema";
import { logger } from "../logs";

export type TGetToken = (clientRequest: Request) => string | undefined;

export function extractToken(auth: string) {
  const [type, token] = auth.split(' ')
  if (type == 'Bearer') {
    return token
  }
}

export const getTokenFromAuthorization: TGetToken = (clientRequest: Request) => {
  const auth_headers = clientRequest.headers['authorization']
  console.log('getTokenFromAuthorization', auth_headers, clientRequest.headers)
  if(!auth_headers) {
    return
  }
  return extractToken(auth_headers)
}


export function verify(token: string, secrets: string[]) : jwt.JwtPayload | false {
  for (const secret of secrets) {
    try {
      const payload = jwt.verify(token, secret)
      if (payload) {
        return payload as jwt.JwtPayload;
      }
    } catch(e: any) {
      logger.warn("JWT verification error", e);
      return false
    }
  }
  return false
}

export interface IJWTOptions {
  getToken: TGetToken
  removeHeader?: boolean 
  forwardClaims?: boolean
}

export const DEFAULT_OPTIONS: IJWTOptions = {
  getToken: getTokenFromAuthorization,
  forwardClaims: true,
  removeHeader: true,
}

export function createJWTVerificationMiddleware(
  secrets: string[],
  options: IJWTOptions = DEFAULT_OPTIONS
): RequestMiddleware {
  return async function authMiddleware(
    clientRequest: Request,
    clientResponse: http.ServerResponse
  ) {
    
    const token = options.getToken(clientRequest);

    if(!token) {
      clientResponse.writeHead(401);
      clientResponse.end("JWT Token not found");
      return true
    }

    const payload = verify(token, secrets)

    if(!payload) {
      clientResponse.writeHead(401);
      clientResponse.end("JWT Authorization failed");
      return true
    }

    if (options.removeHeader === true) {
      delete clientRequest.headers['authorization']
    }

    if (options.forwardClaims === true) {
      clientRequest.headers['claims'] = JSON.stringify(payload)
    }

    return false;
  };
}


