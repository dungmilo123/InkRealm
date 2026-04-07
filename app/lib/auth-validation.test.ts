import {
  normalizeEmail,
  validateEmail,
  validatePassword,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
} from "@/app/lib/auth-validation";

describe("normalizeEmail", () => {
  it("lowercases and trims whitespace", () => {
    expect(normalizeEmail("  User@Example.COM  ")).toBe("user@example.com");
  });

  it("handles already-normalized emails", () => {
    expect(normalizeEmail("user@example.com")).toBe("user@example.com");
  });
});

describe("validateEmail", () => {
  it("rejects null/undefined/empty", () => {
    expect(validateEmail(null)).not.toBe(null);
    expect(validateEmail(undefined)).not.toBe(null);
    expect(validateEmail("")).not.toBe(null);
    expect(validateEmail("   ")).not.toBe(null);
  });

  it("rejects invalid formats", () => {
    expect(validateEmail("not-an-email")).not.toBe(null);
    expect(validateEmail("@missing-local.com")).not.toBe(null);
    expect(validateEmail("missing-domain@")).not.toBe(null);
  });

  it("accepts valid emails", () => {
    expect(validateEmail("user@example.com")).toBe(null);
    expect(validateEmail("a+tag@sub.domain.org")).toBe(null);
  });
});

describe("validatePassword", () => {
  it("rejects null/undefined/empty", () => {
    expect(validatePassword(null)).not.toBe(null);
    expect(validatePassword(undefined)).not.toBe(null);
    expect(validatePassword("")).not.toBe(null);
  });

  it("rejects too-short passwords", () => {
    const result = validatePassword("a".repeat(PASSWORD_MIN_LENGTH - 1));
    expect(result).not.toBe(null);
    expect(result!.error).toContain("at least");
  });

  it("rejects too-long passwords (bcrypt 72-byte limit)", () => {
    const result = validatePassword("a".repeat(PASSWORD_MAX_LENGTH + 1));
    expect(result).not.toBe(null);
    expect(result!.error).toContain("exceeds the maximum length");
  });

  it("accepts passwords within valid range", () => {
    expect(validatePassword("a".repeat(PASSWORD_MIN_LENGTH))).toBe(null);
    expect(validatePassword("a".repeat(PASSWORD_MAX_LENGTH))).toBe(null);
    expect(validatePassword("SecureP@ssw0rd!")).toBe(null);
  });

  it("uses custom label in error messages", () => {
    const result = validatePassword("short", "New password");
    expect(result).not.toBe(null);
    expect(result!.error.startsWith("New password")).toBeTruthy();
  });
});
