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
      name: "backend1",
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

  return {
    matchers,
    global: { requestMiddlewares: global },
    admin: { metricsPath: "/__donkey/metrics" },
  };
}

function jsonBackend(type: string): http.RequestListener {
  return (req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      if (req.url?.includes("hop-by-hop")) {
        res.setHeader("X-Internal", "1");
        res.setHeader("Proxy-Authenticate", "Basic");
        res.setHeader("Connection", "keep-alive, X-Internal");
      }
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

  it("sets X-Forwarded-* headers and ignores client provided ones", async () => {
    const response = await request
      .get("/echo/")
      .set("Host", "public.example.com")
      .set("X-Forwarded-For", "6.6.6.6")
      .set("X-Forwarded-Proto", "https")
      .set("X-Forwarded-Host", "spoofed.com");
    const headers = JSON.parse(response.text).headers;
    expect(headers["x-forwarded-for"]).toMatch(/127\.0\.0\.1$/);
    expect(headers["x-forwarded-for"]).not.toContain("6.6.6.6");
    expect(headers["x-forwarded-host"]).toEqual("public.example.com");
    expect(headers["x-forwarded-proto"]).toEqual("http");
    expect(headers["host"]).toEqual("localhost");
  });

  it("does not forward hop-by-hop request headers", async () => {
    const response = await request
      .get("/echo/")
      .set("Connection", "keep-alive, X-Secret")
      .set("X-Secret", "1")
      .set("TE", "trailers")
      .set("Proxy-Authorization", "Basic abc")
      .set("Keep-Alive", "timeout=99");
    const headers = JSON.parse(response.text).headers;
    expect(headers["x-secret"]).toBeUndefined();
    expect(headers["te"]).toBeUndefined();
    expect(headers["proxy-authorization"]).toBeUndefined();
    expect(headers["keep-alive"]).toBeUndefined();
  });

  it("does not forward hop-by-hop response headers", async () => {
    const res = await new Promise<http.IncomingMessage>((resolve) =>
      http.get(
        {
          port: (gateway.address() as AddressInfo).port,
          path: "/echo/hop-by-hop",
        },
        resolve
      )
    );
    res.resume();
    expect(res.statusCode).toEqual(200);
    expect(res.headers["x-internal"]).toBeUndefined();
    expect(res.headers["proxy-authenticate"]).toBeUndefined();
  });

  it("reuses upstream connections", async () => {
    let connections = 0;
    const counter = () => connections++;
    backend1.on("connection", counter);
    for (let i = 0; i < 5; i++) {
      const response = await request.get("/admin/keep-alive");
      expect(response.status).toEqual(200);
    }
    backend1.off("connection", counter);
    expect(connections).toBeLessThanOrEqual(1);
  });

  it("answers the health check without proxying", async () => {
    const response = await request.get("/__donkey/health");
    expect(response.status).toEqual(200);
    expect(response.body).toEqual({ status: "ok" });

    // other methods are proxied as usual (and nothing matches here)
    const post = await request.post("/__donkey/health");
    expect(post.status).toEqual(404);
  });

  it("exposes Prometheus metrics", async () => {
    await request.get("/admin/metrics-test");
    await request.get("/does-not-exist");
    const response = await request.get("/__donkey/metrics");
    expect(response.status).toEqual(200);
    expect(response.headers["content-type"]).toContain("text/plain");
    expect(response.text).toMatch(
      /donkey_requests_total\{matcher="backend1",method="GET",status="200"\} \d+/
    );
    expect(response.text).toMatch(
      /donkey_requests_total\{matcher="none",method="GET",status="404"\} \d+/
    );
    expect(response.text).toContain(
      'donkey_request_duration_seconds_bucket{matcher="backend1",le="+Inf"}'
    );
    expect(response.text).toContain("donkey_in_flight_requests 1");
    // admin endpoints get their own label, not "none"
    expect(response.text).toMatch(
      /donkey_requests_total\{matcher="admin",method="GET",status="200"\} \d+/
    );
    expect(response.text).not.toMatch(
      /donkey_requests_total\{matcher="none",method="GET",status="200"\}/
    );
  });

  it("writes one JSON access log line per request", async () => {
    const lines: string[] = [];
    const spy = jest
      .spyOn(process.stdout, "write")
      .mockImplementation((chunk: any) => {
        lines.push(String(chunk));
        return true;
      });
    process.env.LOG_LEVEL = "info";
    try {
      await request.get("/__donkey/health");
      await request
        .get("/admin/logged?token=secret")
        .set("x-request-id", "req-42")
        .set("Authorization", "Bearer secret");
      // the access log is written on "close", after the response is sent
      await new Promise((resolve) => setImmediate(resolve));
    } finally {
      process.env.LOG_LEVEL = "silent";
      spy.mockRestore();
    }
    const entries = lines
      .map((line) => JSON.parse(line))
      .filter((entry) => entry.msg === "access");
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      level: "info",
      method: "GET",
      path: "/admin/logged",
      status: "200",
      matcher: "backend1",
      requestId: "req-42",
    });
    expect(typeof entries[0].durationMs).toBe("number");
    expect(lines.join("")).not.toContain("secret");
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
