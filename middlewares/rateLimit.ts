import * as http from "http";
import { RequestMiddleware } from "../schema";
import RedisStore = require("rate-limit-redis");
import * as redis from "redis";
import { logger, onShutdown } from "../logs";
import { Request } from "../schema";

/** A list of rate limitation to apply on a single time window */
export interface RateLimitsOptions {
  /** Function returning a list of rate limit to apply */
  keysLimits: (clientRequest: Request) => KeyLimit[];
  /* Redis URL to connect to. Default to provess.env.REDIS_URL or redis://localhost:6379*/
  redisURL?: string;
  /** Time window duration in seconds for this rate limitation. Default is 1 minute. */
  timeWindow?: number;
  /** Set the rate limits response headers if true. E.g. RateLimit-Limit-{key.name} */
  setHeaders?: boolean;
}

/** Key used to store the request counter in Redis with the limit */
export interface KeyLimit {
  /** Key used to store the request counter. E.g. "global", "user-${user.id}" */
  key: string;
  /** Maximum limit of requests that are allowed on this key */
  limit: number;
  /** Name used in the response header for this limit. e.g.
   * RateLimit-Limit-Global
   * RateLimit-Limit-User
   */
  name?: string;
}

export function createRateLimitationMiddleware(
  options: RateLimitsOptions
): RequestMiddleware {
  const timeWindow = options.timeWindow || 60;

  const url =
    options.redisURL || process.env.REDIS_URL || "redis://localhost:6379";
  const client = redis.createClient(url);

  const shutdown = () => {
    logger.log("Limit middleware: Closing redis connection");
    client.quit(() => logger.log("Limit middleware: Redis connection closed"));
  };
  onShutdown(shutdown);

  const store = new RedisStore({
    expiry: timeWindow,
    client,
  });

  logger.log(`Rate limitation middleware connected on ${url}`);

  return async function rateLimitMiddleware(
    clientRequest: Request,
    clientResponse: http.ServerResponse
  ) {
    const keysLimits = options.keysLimits(clientRequest);

    let anyLimitReached = false;
    for (let i = 0; i < keysLimits.length; i++) {
      const limitReached = await new Promise((resolve) => {
        const limit = keysLimits[i];
        store.incr(limit.key, (err: any, v: number, ttl: number) => {
          if (options.setHeaders) {
            clientResponse.setHeader(`RateLimit-Limit-${limit.name || i}`, v);
            clientResponse.setHeader(
              `RateLimit-Remaining-${limit.name || i}`,
              limit.limit - v
            );
          }
          if (v > limit.limit) {
            resolve(true);
          } else {
            resolve(false);
          }
        });
      });
      if (limitReached) {
        anyLimitReached = true;
      }
    }

    if (anyLimitReached) {
      clientResponse.writeHead(429);
      clientResponse.end(`Rate limit reached`);
      return true;
    }

    return false;
  };
}
