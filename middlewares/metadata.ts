import * as http from 'http';
import { RequestMiddleware } from '../schema';
import * as redis from 'redis';
import { Request } from '../schema'

export type FetchMetadataSignature = (clientRequest: Request) => Promise<object>
export type MetaDataKey = (clientRequest: Request) => Promise<string>

interface MetadataOptions {
  key: MetaDataKey
  fetchMetadata: FetchMetadataSignature
  redisURL?: string
  expiry?: number
}

export function createMetadataMiddleware(options: MetadataOptions): RequestMiddleware {
  const url = options.redisURL || process.env.REDIS_URL || 'redis://localhost:6379'
  const client = redis.createClient(url);

  return async function metadataMiddleware(clientRequest: Request, clientResponse: http.ServerResponse) {
    const key = await options.key(clientRequest)
    const metadataKey = `dk-metadata-${key}`
    const expiry = options.expiry || 60 * 5
    const pmetadata = new Promise<object | null>(resolve => {
      client.get(metadataKey, (err, reply) => {
        if(!reply) {
          resolve(null)
        } else {
          resolve(JSON.parse(reply))
        }
      })
    })
    let metadata = await pmetadata
    if(!metadata) {
      metadata = await options.fetchMetadata(clientRequest);
      if (metadata) {
        client.set(metadataKey, JSON.stringify(metadata), 'EX', expiry)
      } else {
        metadata = {}
      }
    }
    const m = clientRequest.metadata || {}
    clientRequest.metadata = { ...m, ...metadata }
    return false
  }
}

