import { Config, IMatcher } from "../schema";
import supertest from "supertest";
import { createGateway } from "../gateway";
import * as http from "http";
import { createJWTVerificationMiddleware } from "../middlewares/JWTVerification";
import { createCorsOptionsMiddleware } from "../middlewares/cors";

const BACKEND1_PORT = 8001;
const BACKEND2_PORT = 8002;

export function getConfig(): Config {
  const matchers: IMatcher[] = [
    // BACKEND1_PORT
    {
      uris: ["/admin/"],
      upstream: "localhost",
      port: BACKEND1_PORT,
      stripeUri: true,
    },
    // BACKEND2_PORT
    {
      uris: ["/admin/blop", "/test"],
      upstream: "localhost",
      port: BACKEND2_PORT,
    },
    // JWT
    {
      uris: ["/jwt/"],
      upstream: "localhost",
      port: BACKEND2_PORT,
      requestMiddlewares: [
        createJWTVerificationMiddleware(["old-secret", "secret"]),
      ],
    },
    // cors tests
    {
      uris: ["/cors/"],
      upstream: "localhost",
      port: BACKEND2_PORT,
      requestMiddlewares: [
        createCorsOptionsMiddleware({
          allowOrigins: ["http://test-cors.com", /http:\/\/hello-.*\.com/]
        }),
      ],
    },
  ];
  return { matchers };
}

const requestListener1: http.RequestListener = (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.writeHead(200);
  res.end(
    JSON.stringify({ type: "backend1", url: req.url, headers: req.headers })
  );
};

const requestListener2: http.RequestListener = (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.writeHead(200);
  res.end(
    JSON.stringify({ type: "backend2", url: req.url, headers: req.headers })
  );
};

describe("gateway", () => {
  let backend1: http.Server;
  let backend2: http.Server;
  let gateway: http.Server;

  beforeAll(() => {
    gateway = createGateway(getConfig(), 3000);
    backend1 = http.createServer(requestListener1).listen(BACKEND1_PORT);
    backend2 = http.createServer(requestListener2).listen(BACKEND2_PORT);
  });

  afterAll(() => {
    backend1.close();
    backend2.close();
    gateway.close();
  });

  it("404", async () => {
    const request = supertest(gateway);
    const response = await request.get("/does-not-exist/");

    expect(response.status).toEqual(404);
  });

  it("matchUris", async () => {
    const request = supertest(gateway);
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
    const request = supertest(gateway);
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
    const request = supertest(gateway);
    let response = await request.options("/cors/").set({ origin: 'http://test-cors.com' });

    expect(response.status).toEqual(204);
    expect(response.headers['access-control-allow-origin']).toEqual('http://test-cors.com');

    response = await request.options("/cors/").set({ origin: 'http://hello-world.com' });

    expect(response.status).toEqual(204);
    expect(response.headers['access-control-allow-origin']).toEqual('http://hello-world.com');

    response = await request.options("/cors/").set({ origin: 'http://wrong.com' });

    expect(response.status).toEqual(204);
    expect(response.headers['access-control-allow-origin']).toEqual(undefined);
  });
});
