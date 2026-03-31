import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const secret = process.env.TRANSLATION_ENCRYPTION_SECRET;
  if (!secret) {
    throw new Error(
      "TRANSLATION_ENCRYPTION_SECRET environment variable is not set. " +
      "Please set a 32-byte (or longer) secret key for encrypting translation API keys."
    );
  }
  return scryptSync(secret, "translation-salt", KEY_LENGTH);
}

export function encryptApiKey(apiKey: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  
  const encrypted = Buffer.concat([
    cipher.update(apiKey, "utf8"),
    cipher.final(),
  ]);
  
  const authTag = cipher.getAuthTag();
  
  return `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptApiKey(encryptedApiKey: string): string {
  const key = getEncryptionKey();
  const parts = encryptedApiKey.split(":");
  
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted API key format");
  }
  
  const [ivBase64, authTagBase64, encryptedBase64] = parts;
  const iv = Buffer.from(ivBase64, "base64");
  const authTag = Buffer.from(authTagBase64, "base64");
  const encrypted = Buffer.from(encryptedBase64, "base64");
  
  if (iv.length !== IV_LENGTH) {
    throw new Error("Invalid IV length in encrypted API key");
  }
  
  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error("Invalid auth tag length in encrypted API key");
  }
  
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);
  
  return decrypted.toString("utf8");
}

export function isTranslationConfigured(): boolean {
  try {
    getEncryptionKey();
    return true;
  } catch {
    return false;
  }
}