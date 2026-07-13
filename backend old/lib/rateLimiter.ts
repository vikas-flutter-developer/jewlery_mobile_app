interface RateLimitState {
  timestamps: number[];
}

const rateMap = new Map<string, RateLimitState>();

export const recordRateLimit = (
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number; retryAfterMs: number } => {
  const now = Date.now();
  const state = rateMap.get(key) || { timestamps: [] };
  state.timestamps = state.timestamps.filter((timestamp) => timestamp > now - windowMs);

  if (state.timestamps.length >= maxRequests) {
    const retryAfterMs = Math.max(windowMs - (now - state.timestamps[0]), 0);
    rateMap.set(key, state);
    return { allowed: false, remaining: 0, retryAfterMs };
  }

  state.timestamps.push(now);
  rateMap.set(key, state);

  return {
    allowed: true,
    remaining: Math.max(maxRequests - state.timestamps.length, 0),
    retryAfterMs: 0,
  };
};

export const resetRateLimiter = () => {
  rateMap.clear();
};
