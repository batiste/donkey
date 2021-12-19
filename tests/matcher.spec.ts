import { matchHosts, matchUris, matchRequest } from "../match";
import { IMatcher, Request } from "../schema";
import * as http from "http";

describe("matchUris", () => {
  it("matchUris", async () => {
    expect(matchUris(["/admin/"], "/admin")).toEqual(false);
    expect(matchUris(["/admin"], "/admin")).toEqual("/admin");
    expect(matchUris(["/admin"], "/admin/hello")).toEqual("/admin");
    expect(matchUris([/^(\/admin)\/.*/], "/admin/hello")).toEqual("/admin");
  });
});

describe("matchHosts", () => {
  it("matchHosts", async () => {
    expect(matchHosts(["example.com", "test.com"], "test.com")).toEqual(
      "test.com"
    );
    expect(matchHosts(["example.com", "test.com"], "test1.com")).toEqual(false);
    expect(matchHosts(["example.com", /^(.*)\.com/], "test1.com")).toEqual(
      "test1.com"
    );
  });
});

describe("matchRequest", () => {
  it("matchRequest", async () => {
    const matcher: IMatcher[] = [
      { upstream: "example.com", uris: ["/hello"] },
      { upstream: "example.com", uris: ["/admin"] },
      { upstream: "test.com", hosts: ["example.com"] },
      { upstream: "test.com" },
    ];
    const socket: any = {};
    const request: Request = new http.IncomingMessage(socket) as any;
    request.url = "/admin";
    request.headers.host = "example.com";

    expect(matchRequest(matcher, request)?.criteria).toEqual({ uri: "/admin" });
    request.url = "/";
    expect(matchRequest(matcher, request)?.criteria).toEqual({
      host: "example.com",
    });
    request.url = "/hello/blop";
    expect(matchRequest(matcher, request)?.criteria).toEqual({ uri: "/hello" });
    request.url = "/nop";
    request.headers.host = "nop.com";
    expect(matchRequest(matcher, request)?.criteria).toEqual({});
  });
});
