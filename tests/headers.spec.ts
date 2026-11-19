import * as http from "http";
import { Socket } from "net";
import { removeHopByHopHeaders, setForwardedHeaders } from "../headers";

function fakeRequest(headers: http.IncomingHttpHeaders): http.IncomingMessage {
  const socket = new Socket();
  Object.defineProperty(socket, "remoteAddress", { value: "10.0.0.2" });
  const request = new http.IncomingMessage(socket);
  request.headers = headers;
  return request;
}

describe("removeHopByHopHeaders", () => {
  it("removes standard and Connection-listed headers but never Host", () => {
    const headers = removeHopByHopHeaders({
      host: "example.com",
      connection: "keep-alive, X-Foo, Host",
      "x-foo": "1",
      "keep-alive": "timeout=5",
      "transfer-encoding": "chunked",
      upgrade: "websocket",
      accept: "*/*",
    });
    expect(headers).toEqual({ host: "example.com", accept: "*/*" });
  });
});

describe("setForwardedHeaders", () => {
  it("overwrites client values by default", () => {
    const request = fakeRequest({
      host: "example.com",
      "x-forwarded-for": "1.1.1.1",
      "x-forwarded-host": "evil.com",
      "x-forwarded-proto": "https",
    });
    setForwardedHeaders(request, false);
    expect(request.headers["x-forwarded-for"]).toEqual("10.0.0.2");
    expect(request.headers["x-forwarded-host"]).toEqual("example.com");
    expect(request.headers["x-forwarded-proto"]).toEqual("http");
  });

  it("extends existing values when they are trusted", () => {
    const request = fakeRequest({
      host: "internal",
      "x-forwarded-for": "1.1.1.1",
      "x-forwarded-host": "example.com",
      "x-forwarded-proto": "https",
    });
    setForwardedHeaders(request, true);
    expect(request.headers["x-forwarded-for"]).toEqual("1.1.1.1, 10.0.0.2");
    expect(request.headers["x-forwarded-host"]).toEqual("example.com");
    expect(request.headers["x-forwarded-proto"]).toEqual("https");
  });
});
