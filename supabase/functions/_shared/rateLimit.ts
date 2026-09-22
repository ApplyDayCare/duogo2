// Simple in-memory rate limiter with namespaced keys
const attempts = new Map<string, { count: number; resetAt: number }>();

export function isRateLimited(
  key: string,
  maxAttempts: number = 5,
  windowMs: number = 60 * 60 * 1000 // 1 hour default
): boolean {
  const now = Date.now();
  const record = attempts.get(key);
  if (!record || now > record.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  record.count++;
  return record.count > maxAttempts;
}
