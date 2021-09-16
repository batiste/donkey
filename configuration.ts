import got from "got/dist/source";
import { createBasicAuthMiddleware } from "./middlewares/basicAuth";
import { createCorsMiddleware } from "./middlewares/cors";
import { createRateLimitationMiddleware } from "./middlewares/rateLimit";
import { createRemoveHeadersMiddleware } from "./middlewares/removeHeaders";
import { createMetadataMiddleware } from "./middlewares/metadata";
import { Config, IMatcher } from "./schema";
import { createAuthMiddleware } from "./middlewares/auth";

interface IMetaData {
  uuid: string;
  orgUuid: string;
  scopes: string;
  rateLimitationBy: { second: number; minute: number; hour: number };
  orgRateLimitationBy: { second: number; minute: number; hour: number };
}

export function getConfig(): Config {
  const headersToRemove = ["x-authenticated-scope", "x-consumer-username"];
  const env = process.env.ENV;
  const backendDomain = env === "docker" ? "backend" : "localhost";

  const userMetaData = createMetadataMiddleware({
    // A function that return a key to use for the redis cache mechanism. If
    // none is provided there will be no cache used.
    key: async (clientRequest) => {
      return "10";
    },
    fetchMetadata: (clientRequest) => {
      // here maybe some kind of authentication mechanism is necessary
      // JWT, Access token, API token, etc. It is up to you and your
      // system
      return got.get(`http://${backendDomain}:8000/users/me/meta`).json();
    },
  });

  const limitByMinute = createRateLimitationMiddleware({
    timeWindow: 60,
    setHeaders: true,
    keysLimits: (clientRequest) => {
      const metadata = clientRequest.metadata as IMetaData;
      const userLimit = metadata.rateLimitationBy.minute || 10;
      const orgLimit = metadata.orgRateLimitationBy.minute || 10;
      return [
        { key: `user-${metadata.uuid}`, limit: userLimit, name: "User" },
        { key: `org-${metadata.orgUuid}`, limit: orgLimit, name: "Org" },
      ];
    },
  });

  const authMiddleware = createAuthMiddleware(async (clientRequest) => {
    const metadata = clientRequest.metadata as IMetaData;
    if (!metadata || !metadata.uuid) {
      return false;
    }
    clientRequest.headers["X-Authenticated-Scope"] = metadata.scopes;
    return true;
  });

  const matchers: IMatcher[] = [
    // load test config
    {
      hosts: ["loadtest"],
      upstream: backendDomain,
      port: 8000,
      timeout: 3,
      requestMiddlewares: [createRemoveHeadersMiddleware(headersToRemove)],
    },
    // basic auth
    {
      hosts: ["localhost:3000"],
      upstream: "example.com",
      uris: ["/admin/"],
      requestMiddlewares: [createBasicAuthMiddleware("admin", "1234")],
      stripUri: true,
    },
    // testing limits and user meta data
    {
      hosts: ["localhost:3000"],
      upstream: "example.com",
      protocol: "https:",
      port: 443,
      requestMiddlewares: [userMetaData, authMiddleware, limitByMinute],
    },
    // used to test host with curl
    {
      hosts: ["example.com"],
      upstream: "example.com",
      timeout: 2,
    },
    {
      hosts: ["thing.google"],
      upstream: "about.google",
      uris: ["/products/", "/commitments/"],
      timeout: 3,
    },
  ];

  return {
    matchers,
    global: {
      responseMiddlewares: [createCorsMiddleware("http://example.com")],
    },
  };
}
