import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  normalizeEmail,
  validateEmail,
  validatePassword,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
} from "@/app/lib/auth-validation";

describe("normalizeEmail", () => {
  it("lowercases and trims whitespace", () => {
    assert.equal(normalizeEmail("  User@Example.COM  "), "user@example.com");
  });

  it("handles already-normalized emails", () => {
    assert.equal(normalizeEmail("user@example.com"), "user@example.com");
  });
});

describe("validateEmail", () => {
  it("rejects null/undefined/empty", () => {
    assert.notEqual(validateEmail(null), null);
    assert.notEqual(validateEmail(undefined), null);
    assert.notEqual(validateEmail(""), null);
    assert.notEqual(validateEmail("   "), null);
  });

  it("rejects invalid formats", () => {
    assert.notEqual(validateEmail("not-an-email"), null);
    assert.notEqual(validateEmail("@missing-local.com"), null);
    assert.notEqual(validateEmail("missing-domain@"), null);
  });

  it("accepts valid emails", () => {
    assert.equal(validateEmail("user@example.com"), null);
    assert.equal(validateEmail("a+tag@sub.domain.org"), null);
  });
});

describe("validatePassword", () => {
  it("rejects null/undefined/empty", () => {
    assert.notEqual(validatePassword(null), null);
    assert.notEqual(validatePassword(undefined), null);
    assert.notEqual(validatePassword(""), null);
    assert.notEqual(validatePassword("   "), null);
  });

  it("rejects too-short passwords", () => {
    const result = validatePassword("a".repeat(PASSWORD_MIN_LENGTH - 1));
    assert.notEqual(result, null);
    assert.ok(result!.error.includes("at least"));
  });

  it("rejects too-long passwords (bcrypt 72-byte limit)", () => {
    const result = validatePassword("a".repeat(PASSWORD_MAX_LENGTH + 1));
    assert.notEqual(result, null);
    assert.ok(result!.error.includes("at most"));
  });

  it("accepts passwords within valid range", () => {
    assert.equal(validatePassword("a".repeat(PASSWORD_MIN_LENGTH)), null);
    assert.equal(validatePassword("a".repeat(PASSWORD_MAX_LENGTH)), null);
    assert.equal(validatePassword("SecureP@ssw0rd!"), null);
  });

  it("uses custom label in error messages", () => {
    const result = validatePassword("short", "New password");
    assert.notEqual(result, null);
    assert.ok(result!.error.startsWith("New password"));
  });
});
