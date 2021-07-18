import * as http from 'http';
import { RequestMiddleware } from '../schema';
import RedisStore = require("rate-limit-redis")
import { logger } from '../logs';


interface RateLimitsOptions {
  keysLimits: (clientRequest: http.IncomingMessage) => KeyLimit[]
  redisURL?: string
  expiry?: number
}

interface KeyLimit {
  key: string
  limit: number
}

export function createRateLimitationMiddleware(options: RateLimitsOptions): RequestMiddleware {
  const url = options.redisURL || process.env.REDIS_URL || 'redis://localhost:6379'
  const store = new RedisStore({
    expiry: options.expiry || 60,
    redisURL: url
  });
  logger.log(`Rate limitation middleware connected on ${url}`)

  return async function rateLimitMiddleware(clientRequest: http.IncomingMessage, clientResponse: http.ServerResponse) {

    const keysLimits = options.keysLimits(clientRequest)
    if (keysLimits) {
      const checkLimits = new Promise((resolve) => {
        for(let i=0; i < keysLimits.length; i++) {
          const limit = keysLimits[i]
          store.incr(limit.key, (err: any, v: number, ttl: number) => {
            clientResponse.setHeader(`RateLimit-Limit-${i}`, v)
            clientResponse.setHeader(`RateLimit-Remaining-${i}`, limit.limit - v)
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
        clientResponse.end('Rate limit reached')
        return true
      }
    }

    return false
  }
}

