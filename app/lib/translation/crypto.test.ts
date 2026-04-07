import {
  decryptTranslationCredential,
  encryptTranslationCredential,
} from "@/app/lib/translation/crypto";

test("translation credentials are encrypted and recoverable", () => {
  process.env.TRANSLATION_ENCRYPTION_SECRET = "test-secret-for-unit-tests";

  const plaintext = "sk-live-translation-key";
  const encrypted = encryptTranslationCredential(plaintext);

  expect(encrypted).not.toBe(plaintext);
  expect(encrypted).not.toContain(plaintext);
  expect(encrypted.startsWith("v1:")).toBeTruthy();

  const decrypted = decryptTranslationCredential(encrypted);
  expect(decrypted).toBe(plaintext);
});
