import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { TranslationHttpError } from "@/app/lib/translation/errors";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TOKEN_VERSION = "v1";

let cachedKey: Buffer | null = null;

function getRawSecret() {
  const secret = process.env.TRANSLATION_ENCRYPTION_SECRET?.trim();
  if (!secret) {
    throw new TranslationHttpError(
      500,
      "TRANSLATION_ENCRYPTION_SECRET is required for translation profile writes."
    );
  }

  return secret;
}

function getEncryptionKey() {
  if (cachedKey) {
    return cachedKey;
  }

  const secret = getRawSecret();
  cachedKey = createHash("sha256").update(secret, "utf8").digest();
  return cachedKey;
}

export function assertTranslationEncryptionConfigured() {
  getRawSecret();
}

export function encryptTranslationCredential(plaintext: string) {
  if (!plaintext) {
    throw new TranslationHttpError(400, "apiKey cannot be empty.");
  }

  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    TOKEN_VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(":");
}

export function decryptTranslationCredential(encryptedValue: string) {
  const [version, ivToken, tagToken, payloadToken] = encryptedValue.split(":");
  if (!version || !ivToken || !tagToken || !payloadToken || version !== TOKEN_VERSION) {
    throw new TranslationHttpError(500, "Stored translation credential is invalid.");
  }

  const key = getEncryptionKey();

  try {
    const decipher = createDecipheriv(
      ALGORITHM,
      key,
      Buffer.from(ivToken, "base64url")
    );
    decipher.setAuthTag(Buffer.from(tagToken, "base64url"));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(payloadToken, "base64url")),
      decipher.final(),
    ]);

    return decrypted.toString("utf8");
  } catch {
    throw new TranslationHttpError(
      500,
      "Stored translation credential could not be decrypted."
    );
  }
}
