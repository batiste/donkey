import * as donkey from "../index";

describe("library entry point", () => {
  it("exports the gateway and middlewares without side effects", () => {
    expect(typeof donkey.createGateway).toBe("function");
    expect(typeof donkey.createBasicAuthMiddleware).toBe("function");
    expect(typeof donkey.createJWTVerificationMiddleware).toBe("function");
    expect(typeof donkey.createRateLimitationMiddleware).toBe("function");
    expect(typeof donkey.matchRequest).toBe("function");
  });
});
