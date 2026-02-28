import { describe, it, expect, vi } from "vitest";
import { bearerAuth } from "../../src/mcp/auth-middleware.js";

function mockReqResNext(authHeader?: string) {
  const req = { headers: { authorization: authHeader } } as any;
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
  const next = vi.fn();
  return { req, res, next };
}

describe("bearerAuth", () => {
  const middleware = bearerAuth("test-secret");

  it("calls next() for valid token", () => {
    const { req, res, next } = mockReqResNext("Bearer test-secret");
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("returns 401 for missing header", () => {
    const { req, res, next } = mockReqResNext(undefined);
    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 for wrong token", () => {
    const { req, res, next } = mockReqResNext("Bearer wrong-token");
    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 for non-Bearer scheme", () => {
    const { req, res, next } = mockReqResNext("Basic dXNlcjpwYXNz");
    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
