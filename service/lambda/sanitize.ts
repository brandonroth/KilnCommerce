/**
 * Returns trimmed string if within length, null if over limit or not a string.
 */
export function sanitizeString(value: unknown, maxLen: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > maxLen) return null;
  return trimmed;
}

/**
 * Returns trimmed, valid email (basic format check, ≤254 chars), or null.
 */
export function sanitizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  if (trimmed.length === 0 || trimmed.length > 254) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed)) return null;
  return trimmed;
}

/**
 * Returns the value if it is in the allowed set, null otherwise.
 */
export function sanitizeEnum<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim() as T;
  return (allowed as readonly string[]).includes(trimmed) ? trimmed : null;
}
