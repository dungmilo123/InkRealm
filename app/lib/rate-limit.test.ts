import assert from "node:assert/strict";
import { describe, it, afterEach } from "node:test";
import {
  createRateLimiter,
  getClientIp,
  rateLimitResponse,
} from "@/app/lib/rate-limit";

describe("createRateLimiter", () => {
  const limiters: ReturnType<typeof createRateLimiter>[] = [];

  function makeLimiter(limit: number, windowMs: number) {
    const limiter = createRateLimiter({ limit, windowMs });
    limiters.push(limiter);
    return limiter;
  }

  afterEach(() => {
    for (const l of limiters) {
      l.destroy();
    }
    limiters.length = 0;
  });

  it("allows requests under the limit", () => {
    const limiter = makeLimiter(3, 60_000);
    const r1 = limiter.check("ip-1");
    assert.equal(r1.allowed, true);
    assert.equal(r1.remaining, 2);
  });

  it("counts down remaining correctly", () => {
    const limiter = makeLimiter(3, 60_000);
    assert.equal(limiter.check("ip-1").remaining, 2);
    assert.equal(limiter.check("ip-1").remaining, 1);
    assert.equal(limiter.check("ip-1").remaining, 0);
  });

  it("blocks requests at the limit", () => {
    const limiter = makeLimiter(2, 60_000);
    limiter.check("ip-1");
    limiter.check("ip-1");
    const blocked = limiter.check("ip-1");
    assert.equal(blocked.allowed, false);
    assert.equal(blocked.remaining, 0);
  });

  it("tracks keys independently", () => {
    const limiter = makeLimiter(1, 60_000);
    const r1 = limiter.check("ip-1");
    const r2 = limiter.check("ip-2");
    assert.equal(r1.allowed, true);
    assert.equal(r2.allowed, true);

    // ip-1 is now blocked, ip-2 is also blocked
    assert.equal(limiter.check("ip-1").allowed, false);
    assert.equal(limiter.check("ip-2").allowed, false);
  });

  it("provides a resetAt timestamp in the future", () => {
    const limiter = makeLimiter(1, 60_000);
    const result = limiter.check("ip-1");
    assert.equal(result.allowed, true);
    assert.ok(result.resetAt > Date.now());
    assert.ok(result.resetAt <= Date.now() + 60_000);
  });

  it("does not count blocked requests towards the limit", () => {
    const limiter = makeLimiter(2, 60_000);
    limiter.check("ip-1"); // 1
    limiter.check("ip-1"); // 2 — at limit
    limiter.check("ip-1"); // blocked — should NOT push count to 3
    limiter.check("ip-1"); // blocked
    // After window expires, only 2 timestamps should exist, not 4
    assert.equal(limiter.size, 1); // still tracking ip-1
  });

  it("exposes size for monitoring", () => {
    const limiter = makeLimiter(5, 60_000);
    assert.equal(limiter.size, 0);
    limiter.check("ip-1");
    limiter.check("ip-2");
    assert.equal(limiter.size, 2);
  });

  it("reset() clears all entries", () => {
    const limiter = makeLimiter(5, 60_000);
    limiter.check("ip-1");
    limiter.check("ip-2");
    limiter.reset();
    assert.equal(limiter.size, 0);
    // Can make requests again
    assert.equal(limiter.check("ip-1").allowed, true);
  });
});

describe("getClientIp", () => {
  function makeRequest(headers: Record<string, string>): Request {
    return new Request("http://localhost/test", {
      headers: new Headers(headers),
    });
  }

  it("extracts first IP from x-forwarded-for", () => {
    const req = makeRequest({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" });
    assert.equal(getClientIp(req), "1.2.3.4");
  });

  it("handles single IP in x-forwarded-for", () => {
    const req = makeRequest({ "x-forwarded-for": "1.2.3.4" });
    assert.equal(getClientIp(req), "1.2.3.4");
  });

  it("trims whitespace from x-forwarded-for", () => {
    const req = makeRequest({ "x-forwarded-for": "  1.2.3.4  , 5.6.7.8" });
    assert.equal(getClientIp(req), "1.2.3.4");
  });

  it("falls back to x-real-ip", () => {
    const req = makeRequest({ "x-real-ip": "10.0.0.1" });
    assert.equal(getClientIp(req), "10.0.0.1");
  });

  it("prefers x-forwarded-for over x-real-ip", () => {
    const req = makeRequest({
      "x-forwarded-for": "1.2.3.4",
      "x-real-ip": "10.0.0.1",
    });
    assert.equal(getClientIp(req), "1.2.3.4");
  });

  it("returns 'unknown' when no IP headers present", () => {
    const req = makeRequest({});
    assert.equal(getClientIp(req), "unknown");
  });
});

describe("rateLimitResponse", () => {
  it("returns a 429 status", async () => {
    const resp = rateLimitResponse({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 60_000,
    });
    assert.equal(resp.status, 429);
  });

  it("includes Retry-After header", async () => {
    const resp = rateLimitResponse({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 30_000,
    });
    const retryAfter = Number(resp.headers.get("Retry-After"));
    assert.ok(retryAfter > 0);
    assert.ok(retryAfter <= 30);
  });

  it("includes rate limit headers", async () => {
    const resetAt = Date.now() + 60_000;
    const resp = rateLimitResponse({
      allowed: false,
      remaining: 0,
      resetAt,
    });
    assert.equal(resp.headers.get("X-RateLimit-Remaining"), "0");
    assert.equal(resp.headers.get("X-RateLimit-Reset"), String(resetAt));
  });

  it("returns JSON error body", async () => {
    const resp = rateLimitResponse({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 60_000,
    });
    const body = await resp.json();
    assert.ok(body.error);
    assert.ok(body.error.includes("Too many requests"));
  });

  it("ensures Retry-After is at least 1 second", async () => {
    const resp = rateLimitResponse({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() - 1000, // already past
    });
    const retryAfter = Number(resp.headers.get("Retry-After"));
    assert.ok(retryAfter >= 1);
  });
});
