/**
 * In-memory sliding-window rate limiter for API routes.
 *
 * Each limiter instance tracks request timestamps per key (typically IP
 * address) in a Map.  A background sweep runs every 60 s to evict stale
 * entries and prevent unbounded memory growth.
 *
 * Designed for single-process deployments.  If the app scales
 * horizontally, swap the Map store for Redis.
 */

export interface RateLimitConfig {
  /** Maximum number of requests allowed within the window. */
  limit: number;
  /** Window duration in milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  /** Whether the request is allowed. */
  allowed: boolean;
  /** Remaining requests in the current window (≥ 0). */
  remaining: number;
  /** Unix-ms timestamp when the window resets (earliest entry expires). */
  resetAt: number;
}

/**
 * Create a rate limiter with the given configuration.
 *
 * Usage:
 * ```ts
 * const limiter = createRateLimiter({ limit: 5, windowMs: 15 * 60 * 1000 });
 *
 * export async function POST(request: Request) {
 *   const ip = getClientIp(request);
 *   const rl = limiter.check(ip);
 *   if (!rl.allowed) {
 *     return rateLimitResponse(rl);
 *   }
 *   // handle request...
 * }
 * ```
 */
export function createRateLimiter(config: RateLimitConfig) {
  const { limit, windowMs } = config;

  // Map<key, timestamps[]>
  const store = new Map<string, number[]>();

  // Periodic cleanup — evict keys whose newest timestamp is older than
  // the window.  Runs every 60 s so abandoned entries don't accumulate.
  const cleanupInterval = setInterval(() => {
    const cutoff = Date.now() - windowMs;
    for (const [key, timestamps] of store) {
      const recent = timestamps.filter((t) => t > cutoff);
      if (recent.length === 0) {
        store.delete(key);
      } else {
        store.set(key, recent);
      }
    }
  }, 60_000);

  // Allow Node to exit without waiting for the interval
  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }

  return {
    /**
     * Record a request from `key` and return whether it's allowed.
     *
     * The sliding window keeps only timestamps within the last
     * `windowMs` milliseconds.  If the count is already at `limit`,
     * the request is rejected.
     */
    check(key: string): RateLimitResult {
      const now = Date.now();
      const cutoff = now - windowMs;

      // Get existing timestamps and filter to current window
      const existing = store.get(key) ?? [];
      const recent = existing.filter((t) => t > cutoff);

      if (recent.length >= limit) {
        // Over limit — don't record this request
        const oldestInWindow = recent[0];
        return {
          allowed: false,
          remaining: 0,
          resetAt: oldestInWindow + windowMs,
        };
      }

      // Under limit — record and allow
      recent.push(now);
      store.set(key, recent);

      return {
        allowed: true,
        remaining: limit - recent.length,
        resetAt: recent[0] + windowMs,
      };
    },

    /** Current number of tracked keys (for testing / monitoring). */
    get size(): number {
      return store.size;
    },

    /** Remove all entries (for testing). */
    reset(): void {
      store.clear();
    },

    /** Stop the background cleanup interval (for testing). */
    destroy(): void {
      clearInterval(cleanupInterval);
    },
  };
}

// ─── Pre-configured limiters for auth routes ───────────────────────

/**
 * Strict limiter for public auth routes that are prime brute-force targets.
 * 5 requests per 15 minutes per IP.
 *
 * Protects: register, forgot-password, reset-password
 */
export const authLimiter = createRateLimiter({
  limit: 5,
  windowMs: 15 * 60 * 1000, // 15 minutes
});

/**
 * Moderate limiter for authenticated routes that accept passwords.
 * 10 requests per 15 minutes per IP.
 *
 * Protects: change-password, set-password
 */
export const authActionLimiter = createRateLimiter({
  limit: 10,
  windowMs: 15 * 60 * 1000, // 15 minutes
});

/**
 * Limiter for file uploads.
 * 20 uploads per hour per IP.
 */
export const uploadLimiter = createRateLimiter({
  limit: 20,
  windowMs: 60 * 60 * 1000, // 1 hour
});

// ─── Helpers ───────────────────────────────────────────────────────

/**
 * Extract client IP from request headers.
 *
 * Checks `x-forwarded-for` first (common when behind a reverse proxy
 * or CDN), then `x-real-ip`, then falls back to "unknown".
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    // x-forwarded-for may contain multiple IPs: client, proxy1, proxy2
    // The first one is the original client IP
    return forwarded.split(",")[0].trim();
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }

  return "unknown";
}

/**
 * Build a standard 429 Too Many Requests response with Retry-After header.
 */
export function rateLimitResponse(result: RateLimitResult): Response {
  const retryAfterSeconds = Math.ceil((result.resetAt - Date.now()) / 1000);

  return new Response(
    JSON.stringify({
      error: "Too many requests. Please try again later.",
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(Math.max(retryAfterSeconds, 1)),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(result.resetAt),
      },
    }
  );
}
