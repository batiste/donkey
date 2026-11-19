import { Config, IMatcher, RequestMiddleware } from "../schema";
import supertest from "supertest";
import { createGateway } from "../gateway";
import * as http from "http";
import { AddressInfo } from "net";
import jwt from "jsonwebtoken";
import { createJWTVerificationMiddleware } from "../middlewares/JWTVerification";
import { createCorsOptionsMiddleware } from "../middlewares/cors";
import { createXRequestIdMiddleware } from "../middlewares/xRequestId";
import { createBasicAuthMiddleware } from "../middlewares/basicAuth";

interface Ports {
  backend1: number;
  backend2: number;
  slow: number;
  down: number;
}

export function getConfig(ports: Ports): Config {
  const matchers: IMatcher[] = [
    {
      uris: ["/admin/"],
      upstream: "localhost",
      port: ports.backend1,
      stripeUri: true,
    },
    {
      uris: ["/admin/blop", "/test"],
      upstream: "localhost",
      port: ports.backend2,
    },
    {
      uris: ["/jwt/"],
      upstream: "localhost",
      port: ports.backend2,
      requestMiddlewares: [
        createJWTVerificationMiddleware(["old-secret", "secret"]),
      ],
    },
    {
      uris: ["/cors/"],
      upstream: "localhost",
      port: ports.backend2,
      requestMiddlewares: [
        createCorsOptionsMiddleware({
          allowOrigins: ["http://test-cors.com", /http:\/\/hello-.*\.com/],
          allowMethods: ["GET", "POST"],
        }),
      ],
    },
    {
      uris: ["/basic-auth/"],
      upstream: "localhost",
      port: ports.backend2,
      requestMiddlewares: [createBasicAuthMiddleware("admin", "1234")],
    },
    {
      uris: ["/throws/"],
      upstream: "localhost",
      port: ports.backend2,
      requestMiddlewares: [
        async () => {
          throw new Error("middleware failure");
        },
      ],
    },
    {
      uris: ["/slow/"],
      upstream: "localhost",
      port: ports.slow,
      timeout: 0.2,
    },
    {
      uris: ["/hang/"],
      upstream: "localhost",
      port: ports.slow,
    },
    {
      uris: ["/down/"],
      upstream: "localhost",
      port: ports.down,
    },
    {
      uris: ["/echo/"],
      upstream: "localhost",
      port: ports.backend2,
    },
  ];

  const global: RequestMiddleware[] = [createXRequestIdMiddleware()];

  return { matchers, global: { requestMiddlewares: global } };
}

function jsonBackend(type: string): http.RequestListener {
  return (req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      res.setHeader("Content-Type", "application/json");
      res.writeHead(200);
      res.end(
        JSON.stringify({
          type,
          url: req.url,
          method: req.method,
          headers: req.headers,
          body,
        })
      );
    });
  };
}

/** Raw request that bypasses any client side URL normalisation */
function rawGet(
  server: http.Server,
  path: string,
  headers: http.OutgoingHttpHeaders = {}
): Promise<{ status: number; body: string }> {
  const port = (server.address() as AddressInfo).port;
  return new Promise((resolve, reject) => {
    http
      .get({ port, path, headers }, (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => resolve({ status: res.statusCode || 0, body }));
      })
      .on("error", reject);
  });
}

function listen(server: http.Server): Promise<number> {
  return new Promise((resolve) =>
    server.listen(0, () => resolve((server.address() as AddressInfo).port))
  );
}

function close(server: http.Server): Promise<void> {
  server.closeAllConnections();
  return new Promise((resolve) => server.close(() => resolve()));
}

describe("gateway", () => {
  let backend1: http.Server;
  let backend2: http.Server;
  let slow: http.Server;
  let onSlowRequestClosed: () => void = () => undefined;
  let gateway: http.Server;
  let request: ReturnType<typeof supertest>;

  beforeAll(async () => {
    backend1 = http.createServer(jsonBackend("backend1"));
    backend2 = http.createServer(jsonBackend("backend2"));
    slow = http.createServer((req, res) => {
      res.on("close", () => onSlowRequestClosed());
      setTimeout(() => res.end("too late"), 2000).unref();
    });
    const down = http.createServer();
    const ports: Ports = {
      backend1: await listen(backend1),
      backend2: await listen(backend2),
      slow: await listen(slow),
      down: await listen(down),
    };
    // nothing listens on this port anymore
    await close(down);
    gateway = createGateway(getConfig(ports), 0);
    request = supertest(gateway);
  });

  afterAll(async () => {
    await Promise.all([close(backend1), close(backend2), close(slow)]);
    await close(gateway);
  });

  it("404", async () => {
    const response = await request.get("/does-not-exist/");

    expect(response.status).toEqual(404);
  });

  it("matchUris", async () => {
    let response = await request.get("/admin/");

    expect(response.status).toEqual(200);
    expect(JSON.parse(response.text).type).toEqual("backend1");
    expect(JSON.parse(response.text).url).toEqual("/");

    response = await request.get("/admin/extra/url");
    expect(JSON.parse(response.text).url).toEqual("/extra/url");

    response = await request.get("/test/");
    expect(response.status).toEqual(200);
    expect(JSON.parse(response.text).type).toEqual("backend2");
  });

  it("JWT", async () => {
    let response = await request.get("/jwt/");

    expect(response.status).toEqual(401);

    response = await request
      .get("/jwt/")
      .set(
        "Authorization",
        "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0ZXN0IjoiMSJ9.JDfCu69YMtGgGfImZq9j0xapAIkEM9Hf6VM_wvd4Z9M"
      );
    expect(response.status).toEqual(200);
    expect(JSON.parse(response.text).headers["x-claims"]).toEqual(
      '{"test":"1"}'
    );
  });

  it("Cors", async () => {
    let response = await request
      .options("/cors/")
      .set({ origin: "http://test-cors.com" });
    expect(response.status).toEqual(204);
    expect(response.headers["access-control-allow-origin"]).toEqual(
      "http://test-cors.com"
    );

    response = await request
      .options("/cors/")
      .set({ origin: "http://hello-world.com" });
    expect(response.status).toEqual(204);
    expect(response.headers["access-control-allow-origin"]).toEqual(
      "http://hello-world.com"
    );
    expect(response.headers["access-control-allow-methods"]).toEqual(
      "GET, POST, OPTIONS"
    );

    response = await request
      .options("/cors/")
      .set({ origin: "http://wrong.com" });
    expect(response.status).toEqual(204);
    expect(response.headers["access-control-allow-origin"]).toEqual(undefined);

    response = await request
      .post("/cors/")
      .set({ origin: "http://test-cors.com" });
    expect(response.status).toEqual(200);
    expect(response.headers["access-control-allow-origin"]).toEqual(
      "http://test-cors.com"
    );
    expect(response.headers["access-control-allow-methods"]).toEqual(
      "GET, POST, OPTIONS"
    );

    response = await request
      .delete("/cors/")
      .set({ origin: "http://test-cors.com" });
    expect(response.status).toEqual(200);
    expect(response.headers["access-control-allow-origin"]).toEqual(undefined);
    expect(response.headers["access-control-allow-methods"]).toEqual(undefined);
  });

  it("X Request ID", async () => {
    let response = await request.get("/cors/");
    expect(response.status).toEqual(200);
    expect(response.headers["x-request-id"].length).toBeGreaterThan(3);

    response = await request.get("/cors/").set({ "x-request-id": "id-blop" });

    expect(response.status).toEqual(200);
    expect(response.headers["x-request-id"]).toBe("id-blop");

    response = await request.get("/cors/").set({ "X-Request-ID": "id-blop" });

    expect(response.status).toEqual(200);
    expect(response.headers["x-request-id"]).toBe("id-blop");
  });

  it("Basic Auth", async () => {
    const toBase64 = (data: string) => {
      return Buffer.from(data).toString("base64");
    };

    let response = await request.get("/basic-auth/");
    expect(response.status).toEqual(401);

    response = await request
      .get("/basic-auth/")
      .set({ authorization: `Basic ${toBase64("admin:wrong")}` });
    expect(response.status).toEqual(401);

    response = await request
      .get("/basic-auth/")
      .set({ authorization: `Basic ${toBase64("admin:1234")}` });
    expect(response.status).toEqual(200);
  });
  it("matches on the normalised path to prevent auth bypass", async () => {
    // "/test" is public, "/basic-auth/" is protected
    let response = await rawGet(gateway, "/test/../basic-auth/");
    expect(response.status).toEqual(401);

    response = await rawGet(gateway, "/test//../admin/hello");
    expect(JSON.parse(response.body).type).toEqual("backend1");
    expect(JSON.parse(response.body).url).toEqual("/hello");

    response = await rawGet(gateway, "/test/%2e%2e/basic-auth/");
    expect(response.status).toEqual(400);

    response = await rawGet(gateway, "/test/..%2fbasic-auth/");
    expect(response.status).toEqual(400);
  });

  it("JWT: rejects unsigned tokens and accepts HMAC algorithms", async () => {
    const unsigned = jwt.sign({ admin: true }, "", { algorithm: "none" });
    let response = await request
      .get("/jwt/")
      .set("Authorization", `Bearer ${unsigned}`);
    expect(response.status).toEqual(401);

    const hs512 = jwt.sign({ test: "2" }, "old-secret", {
      algorithm: "HS512",
    });
    response = await request
      .get("/jwt/")
      .set("Authorization", `Bearer ${hs512}`);
    expect(response.status).toEqual(200);
    expect(JSON.parse(response.text).headers["x-claims"]).toContain(
      '"test":"2"'
    );
  });

  it("JWT: the forwarded claims cannot be spoofed by the client", async () => {
    const token = jwt.sign({ user: "real" }, "secret");
    const response = await request
      .get("/jwt/")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Claims", '{"user":"admin"}');
    const claims = JSON.parse(JSON.parse(response.text).headers["x-claims"]);
    expect(claims.user).toEqual("real");
  });

  it("returns 500 when a middleware throws", async () => {
    const response = await request.get("/throws/");
    expect(response.status).toEqual(500);
  });

  it("returns 504 and gives up when the upstream is too slow", async () => {
    const start = Date.now();
    const response = await request.get("/slow/");
    expect(response.status).toEqual(504);
    expect(Date.now() - start).toBeLessThan(1500);
  });

  it("cancels the upstream request when the client aborts", async () => {
    const upstreamClosed = new Promise<void>(
      (resolve) => (onSlowRequestClosed = resolve)
    );
    const port = (gateway.address() as AddressInfo).port;
    const clientRequest = http.get({ port, path: "/hang/" });
    clientRequest.on("error", () => undefined);
    setTimeout(() => clientRequest.destroy(), 100);
    // the slow backend would answer after 2s on its own, so require the
    // upstream request to be closed well before that
    const tooLate = new Promise<string>((resolve) =>
      setTimeout(() => resolve("still open"), 1000).unref()
    );
    await expect(
      Promise.race([upstreamClosed.then(() => "closed"), tooLate])
    ).resolves.toEqual("closed");
  });

  it("returns 502 when the upstream is unreachable", async () => {
    const response = await request.get("/down/");
    expect(response.status).toEqual(502);
  });

  it("streams the request body to the upstream", async () => {
    const response = await request
      .post("/echo/")
      .set("content-type", "text/plain")
      .send("hello donkey");
    expect(response.status).toEqual(200);
    expect(response.body.method).toEqual("POST");
    expect(response.body.body).toEqual("hello donkey");
  });
});
