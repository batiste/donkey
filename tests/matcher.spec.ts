import { matchHosts, matchUris, matchRequest, normalizeUrl } from "../match";
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

describe("normalizeUrl", () => {
  it("resolves dot segments and duplicate slashes", () => {
    expect(normalizeUrl("/admin")).toEqual("/admin");
    expect(normalizeUrl("/admin/")).toEqual("/admin/");
    expect(normalizeUrl("/public/../admin/secret")).toEqual("/admin/secret");
    expect(normalizeUrl("/public/./file")).toEqual("/public/file");
    expect(normalizeUrl("//admin//users")).toEqual("/admin/users");
    expect(normalizeUrl("/../../etc/passwd")).toEqual("/etc/passwd");
  });

  it("keeps the query string untouched", () => {
    expect(normalizeUrl("/a/../b?next=/../x&y=%2e%2e")).toEqual(
      "/b?next=/../x&y=%2e%2e"
    );
  });

  it("keeps legitimate percent-encoding", () => {
    expect(normalizeUrl("/files/my%20file.txt")).toEqual(
      "/files/my%20file.txt"
    );
    expect(normalizeUrl("/v1.2/..thing")).toEqual("/v1.2/..thing");
  });

  it("rejects encoded traversal, backslashes and non origin-form URLs", () => {
    expect(normalizeUrl("/public/%2e%2e/admin")).toBeNull();
    expect(normalizeUrl("/public/%2E%2E/admin")).toBeNull();
    expect(normalizeUrl("/public/.%2e/admin")).toBeNull();
    expect(normalizeUrl("/public/..%2fadmin")).toBeNull();
    expect(normalizeUrl("/public/..%5cadmin")).toBeNull();
    expect(normalizeUrl("/public\\..\\admin")).toBeNull();
    expect(normalizeUrl("/bad%zzencoding")).toBeNull();
    expect(normalizeUrl("http://evil.com/admin")).toBeNull();
    expect(normalizeUrl("*")).toBeNull();
    expect(normalizeUrl("")).toBeNull();
  });
});
