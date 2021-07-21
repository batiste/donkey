import * as http from 'http';
import { RequestMiddleware } from '../schema';
import RedisStore = require("rate-limit-redis")
import { logger } from '../logs';
import { Request } from '../schema'

interface RateLimitsOptions {
  keysLimits: (clientRequest: Request) => KeyLimit[]
  redisURL?: string
  /** Time window duration in seconds for this rate limitation */
  timeWindow?: number
  /** Set the rate limits response headers if true */
  setHeaders?: boolean
}

interface KeyLimit {
  key: string
  limit: number
  name?: string
}

export function createRateLimitationMiddleware(options: RateLimitsOptions): RequestMiddleware {
  const url = options.redisURL || process.env.REDIS_URL || 'redis://localhost:6379'
  const timeWindow = options.timeWindow || 60
  const store = new RedisStore({
    expiry: timeWindow,
    redisURL: url
  });
  logger.log(`Rate limitation middleware connected on ${url}`)

  return async function rateLimitMiddleware(clientRequest: Request, clientResponse: http.ServerResponse) {

    const keysLimits = options.keysLimits(clientRequest)

    let resolved = false;
    const checkLimits = new Promise((resolve) => {
      for(let i=0; i < keysLimits.length; i++) {
        const limit = keysLimits[i]
        store.incr(limit.key, (err: any, v: number, ttl: number) => {
          if (resolved) { return }
          resolved = true
          if (options.setHeaders) {
            clientResponse.setHeader(`RateLimit-Limit-${limit.name || i}`, v)
            clientResponse.setHeader(`RateLimit-Remaining-${limit.name || i}`, limit.limit - v)
          }
          if(v <= limit.limit) {
            resolve(false)
          } else {
            resolve(v)
          }
        })
      }
    })

    const limitReached = await checkLimits
    if(limitReached !== false) {
      clientResponse.writeHead(429)
      clientResponse.end(`Rate limit reached`)
      return true
    }

    return false
  }
}
