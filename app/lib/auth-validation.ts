/**
 * Shared validation utilities for authentication routes.
 *
 * Centralises email normalisation and password validation so every
 * auth surface (register, login, change-password, reset-password,
 * set-password) enforces the same rules.
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Min 8 chars (existing rule).
 * Max 72 chars — bcrypt silently truncates at 72 bytes, so accepting
 * longer strings creates a false sense of security.  It also prevents
 * bcrypt DoS where an attacker sends multi-MB passwords to burn CPU.
 */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;

/**
 * Normalise an email address for consistent storage and lookup.
 * - Trims whitespace
 * - Lowercases (RFC 5321 §2.4: local-part *may* be case-sensitive,
 *   but in practice no major provider honours this, and mixed-case
 *   emails cause duplicate-account bugs.)
 */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export type AuthValidationError = {
  error: string;
};

/**
 * Validate an email string. Returns null if valid, or an error object.
 */
export function validateEmail(
  email: string | undefined | null
): AuthValidationError | null {
  if (!email || email.trim().length === 0) {
    return { error: "Email is required" };
  }
  if (!EMAIL_REGEX.test(email.trim())) {
    return { error: "Invalid email format" };
  }
  return null;
}

/**
 * Validate a password string. Returns null if valid, or an error object.
 */
export function validatePassword(
  password: string | undefined | null,
  label = "Password"
): AuthValidationError | null {
  if (!password || password.trim().length === 0) {
    return { error: `${label} is required` };
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    return { error: `${label} must be at least ${PASSWORD_MIN_LENGTH} characters` };
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return {
      error: `${label} must be at most ${PASSWORD_MAX_LENGTH} characters`,
    };
  }
  return null;
}
