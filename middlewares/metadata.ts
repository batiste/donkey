import * as http from "http";
import { RequestMiddleware } from "../schema";
import * as redis from "redis";
import { Request } from "../schema";
import { logger, onShutdown } from "../logs";

export type FetchMetadataSignature = (
  clientRequest: Request
) => Promise<object>;
export type MetaDataKey = (clientRequest: Request) => Promise<string | number>;

export interface MetadataOptions {
  /** A function that return a key to use for the redis cache mechanism. If
   *  none is provided there will be no cache used.
   */
  key?: MetaDataKey;
  /** A function that return the object to be stored in the clientRequest.metadata. */
  fetchMetadata: FetchMetadataSignature;
  redisURL?: string;
  /** Expiry time for the redis cache, default is 5 minutes */
  expiry?: number;
}

export function createMetadataMiddleware(
  options: MetadataOptions
): RequestMiddleware {
  const url =
    options.redisURL || process.env.REDIS_URL || "redis://localhost:6379";
  const client = redis.createClient(url);
  logger.log(`Metadata limitation middleware connected on ${url}`);

  const shutdown = () => {
    logger.log("Metadata middleware: Closing redis connection");
    client.quit(() =>
      logger.log("Metadata middleware: Redis connection closed")
    );
  };
  onShutdown(shutdown);

  async function cachedKey(clientRequest: Request) {
    if (!options.key) {
      return options.fetchMetadata(clientRequest);
    }
    const key = await options.key(clientRequest);
    const metadataKey = `dk-metadata-${key}`;
    const expiry = options.expiry || 60 * 5;
    const pmetadata = new Promise<object | null>((resolve) => {
      client.get(metadataKey, (err, reply) => {
        if (!reply) {
          resolve(null);
        } else {
          resolve(JSON.parse(reply));
        }
      });
    });
    let metadata = await pmetadata;
    if (!metadata) {
      metadata = await options.fetchMetadata(clientRequest);
      if (metadata) {
        client.set(metadataKey, JSON.stringify(metadata), "EX", expiry);
      } else {
        metadata = {};
      }
    }
    return metadata;
  }

  return async function metadataMiddleware(
    clientRequest: Request,
    clientResponse: http.ServerResponse
  ) {
    const metadata = await cachedKey(clientRequest);
    const m = clientRequest.metadata || {};
    clientRequest.metadata = { ...m, ...metadata };
    return false;
  };
}
