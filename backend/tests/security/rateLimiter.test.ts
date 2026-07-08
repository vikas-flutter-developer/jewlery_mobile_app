import { recordRateLimit, resetRateLimiter } from "../../lib/rateLimiter.js";

describe("rateLimiter", () => {
  beforeEach(() => {
    resetRateLimiter();
  });

  it("allows requests until limit is reached", () => {
    const key = "test-key";
    const windowMs = 1000;
    const maxRequests = 3;

    expect(recordRateLimit(key, maxRequests, windowMs).allowed).toBe(true);
    expect(recordRateLimit(key, maxRequests, windowMs).allowed).toBe(true);
    expect(recordRateLimit(key, maxRequests, windowMs).allowed).toBe(true);
    const result = recordRateLimit(key, maxRequests, windowMs);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it("resets after window expires", async () => {
    const key = "expire-key";
    const windowMs = 50;
    const maxRequests = 2;

    expect(recordRateLimit(key, maxRequests, windowMs).allowed).toBe(true);
    expect(recordRateLimit(key, maxRequests, windowMs).allowed).toBe(true);
    expect(recordRateLimit(key, maxRequests, windowMs).allowed).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, windowMs + 20));

    expect(recordRateLimit(key, maxRequests, windowMs).allowed).toBe(true);
  });
});
