import * as http from "http";
import jwt from 'jsonwebtoken';
import { RequestMiddleware, Request } from "../schema";
import { logger } from "../logs";

export type TGetToken = (clientRequest: Request) => string | undefined;

export function extractBearerToken(auth: string) {
  const [type, token] = auth.split(' ')
  if (type == 'Bearer') {
    return token
  }
}

export const getTokenFromAuthorization: TGetToken = (clientRequest: Request) => {
  const auth_headers = clientRequest.headers['authorization']
  if(!auth_headers) {
    return
  }
  return extractBearerToken(auth_headers)
}


export function verify(token: string, secrets: string[]) : jwt.JwtPayload | false {
  for (const secret of secrets) {
    try {
      const payload = jwt.verify(token, secret)
      if (payload) {
        return payload as jwt.JwtPayload;
      }
    } catch(e: any) {
      if (e.message === 'invalid signature') {
        continue
      }
      logger.warn("JWT verification error", e);
      return false
    }
  }
  return false
}

export interface IJWTOptions {
  /** Extract the token from the request, default Authorization: Bearer <JTW> */
  getToken: TGetToken
  /** Forward the JWT payload, default: true */
  forwardClaims?: boolean
  /** Allow a different claim header name, default: X-Claims */
  claimsHeader?: string
}

export const DEFAULT_OPTIONS: IJWTOptions = {
  getToken: getTokenFromAuthorization,
  forwardClaims: true,
}

export function createJWTVerificationMiddleware(
  /** List of secret key that can be used to decode the JWT */
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

    if (options.forwardClaims === true) {
      const header = options.claimsHeader || 'X-Claims'
      clientRequest.headers[header] = JSON.stringify(payload)
    }

    return false;
  }
}


