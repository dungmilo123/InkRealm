import assert from "node:assert/strict";
import test from "node:test";
import {
  decryptTranslationCredential,
  encryptTranslationCredential,
} from "@/app/lib/translation/crypto";

test("translation credentials are encrypted and recoverable", () => {
  process.env.TRANSLATION_ENCRYPTION_SECRET = "test-secret-for-unit-tests";

  const plaintext = "sk-live-translation-key";
  const encrypted = encryptTranslationCredential(plaintext);

  assert.notEqual(encrypted, plaintext);
  assert.ok(!encrypted.includes(plaintext));
  assert.ok(encrypted.startsWith("v1:"));

  const decrypted = decryptTranslationCredential(encrypted);
  assert.equal(decrypted, plaintext);
});
