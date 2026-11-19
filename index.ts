export { createGateway } from "./gateway";
export { matchRequest, matchUris, matchHosts, matcherToOptions } from "./match";
export { logger, onShutdown } from "./logs";
export * from "./schema";

export { createAuthMiddleware } from "./middlewares/auth";
export type { TAuthCheck } from "./middlewares/auth";
export { createBasicAuthMiddleware } from "./middlewares/basicAuth";
export {
  createCorsMiddleware,
  createCorsOptionsMiddleware,
} from "./middlewares/cors";
export {
  createJWTVerificationMiddleware,
  extractBearerToken,
  getTokenFromAuthorization,
} from "./middlewares/JWTVerification";
export type { IJWTOptions, TGetToken } from "./middlewares/JWTVerification";
export { createMetadataMiddleware } from "./middlewares/metadata";
export type { MetadataOptions } from "./middlewares/metadata";
export { createRateLimitationMiddleware } from "./middlewares/rateLimit";
export type { RateLimitsOptions, KeyLimit } from "./middlewares/rateLimit";
export { createRemoveHeadersMiddleware } from "./middlewares/removeHeaders";
export { createXRequestIdMiddleware } from "./middlewares/xRequestId";
