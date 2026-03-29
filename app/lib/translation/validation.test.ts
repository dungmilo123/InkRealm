import assert from "node:assert/strict";
import test from "node:test";
import { TranslationHttpError } from "@/app/lib/translation/errors";
import {
  parseCreateProfilePayload,
  parseStartTranslationPayload,
} from "@/app/lib/translation/validation";

function expectBadRequest(fn: () => unknown, messagePattern: RegExp) {
  assert.throws(fn, (error) => {
    assert.ok(error instanceof TranslationHttpError);
    assert.equal(error.status, 400);
    assert.match(error.message, messagePattern);
    return true;
  });
}

test("create profile payload rejects unsupported provider", () => {
  expectBadRequest(
    () =>
      parseCreateProfilePayload({
        provider: "invalid-provider",
        model: "gpt-4o-mini",
        apiKey: "sk-test",
      }),
    /Unsupported provider/i
  );
});

test("create profile payload rejects missing model and credential", () => {
  expectBadRequest(
    () =>
      parseCreateProfilePayload({
        provider: "OPENAI",
        apiKey: "sk-test",
      }),
    /model must be a string/i
  );

  expectBadRequest(
    () =>
      parseCreateProfilePayload({
        provider: "OPENAI",
        model: "gpt-4o-mini",
      }),
    /apiKey must be a string/i
  );
});

test("start translation payload rejects missing profile and invalid target language", () => {
  expectBadRequest(
    () =>
      parseStartTranslationPayload({
        targetLanguage: "Vietnamese",
        batchSize: 4,
      }),
    /profileId must be a string/i
  );

  expectBadRequest(
    () =>
      parseStartTranslationPayload({
        profileId: "profile-1",
        targetLanguage: "vi3t",
        batchSize: 4,
      }),
    /targetLanguage may only contain letters/i
  );
});

test("start translation payload rejects out-of-range batch size", () => {
  expectBadRequest(
    () =>
      parseStartTranslationPayload({
        profileId: "profile-1",
        targetLanguage: "Vietnamese",
        batchSize: 99,
      }),
    /batchSize must be 1-20/i
  );
});
