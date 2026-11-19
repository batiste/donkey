import * as http from "http";
import jwt from "jsonwebtoken";
import { RequestMiddleware, Request } from "../schema";
import { logger } from "../logs";

export type TGetToken = (clientRequest: Request) => string | undefined;

export function extractBearerToken(auth: string) {
  const [type, token] = auth.split(" ");
  if (type === "Bearer") {
    return token;
  }
}

export const getTokenFromAuthorization: TGetToken = (
  clientRequest: Request
) => {
  const authHeaders = clientRequest.headers.authorization;
  if (!authHeaders) {
    return;
  }
  return extractBearerToken(authHeaders);
};

/** Secrets are shared keys, so only HMAC algorithms make sense. */
export const DEFAULT_ALGORITHMS: jwt.Algorithm[] = ["HS256", "HS384", "HS512"];

export function verify(
  token: string,
  secrets: string[],
  algorithms: jwt.Algorithm[] = DEFAULT_ALGORITHMS
): jwt.JwtPayload | false {
  for (const secret of secrets) {
    try {
      const payload = jwt.verify(token, secret, { algorithms });
      if (payload) {
        return payload as jwt.JwtPayload;
      }
    } catch (e: any) {
      if (e.message === "invalid signature") {
        continue;
      }
      logger.warn("JWT verification error", e);
      return false;
    }
  }
  return false;
}

export interface IJWTOptions {
  /** Extract the token from the request, default Authorization: Bearer <JTW> */
  getToken?: TGetToken;
  /** Forward the JWT payload, default: true */
  forwardClaims?: boolean;
  /** Allow a different claim header name, default: X-Claims */
  claimsHeader?: string;
  /** Accepted signing algorithms, default: HS256, HS384, HS512 */
  algorithms?: jwt.Algorithm[];
}

export const DEFAULT_OPTIONS = {
  getToken: getTokenFromAuthorization,
  forwardClaims: true,
  claimsHeader: "X-Claims",
  algorithms: DEFAULT_ALGORITHMS,
};

export function createJWTVerificationMiddleware(
  /** List of secret key that can be used to decode the JWT */
  secrets: string[],
  userOptions: IJWTOptions = {}
): RequestMiddleware {
  // partial options are merged with the defaults
  const options = { ...DEFAULT_OPTIONS, ...userOptions };
  return async function authMiddleware(
    clientRequest: Request,
    clientResponse: http.ServerResponse
  ) {
    const token = options.getToken(clientRequest);

    if (!token) {
      clientResponse.writeHead(401);
      clientResponse.end("JWT Token not found");
      return true;
    }

    const payload = verify(token, secrets, options.algorithms);

    if (!payload) {
      clientResponse.writeHead(401);
      clientResponse.end("JWT Authorization failed");
      return true;
    }

    if (options.forwardClaims === true) {
      clientRequest.headers[options.claimsHeader.toLowerCase()] =
        JSON.stringify(payload);
    }

    return false;
  };
}
