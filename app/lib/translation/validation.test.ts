import { TranslationHttpError } from "@/app/lib/translation/errors";
import {
  parseCreateProfilePayload,
  parseStartTranslationPayload,
} from "@/app/lib/translation/validation";

function expectBadRequest(fn: () => unknown, messagePattern: RegExp) {
  try {
    fn();
    expect.unreachable("Expected function to throw");
  } catch (error) {
    expect(error).toBeInstanceOf(TranslationHttpError);
    expect((error as TranslationHttpError).status).toBe(400);
    expect((error as TranslationHttpError).message).toMatch(messagePattern);
  }
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

test("start translation payload rejects missing profile", () => {
  expectBadRequest(
    () =>
      parseStartTranslationPayload({
        chapterFrom: 1,
        chapterTo: 5,
      }),
    /profileId must be a string/i
  );
});

test("start translation payload rejects invalid chapterFrom", () => {
  expectBadRequest(
    () =>
      parseStartTranslationPayload({
        profileId: "profile-1",
        chapterFrom: -1,
      }),
    /chapterFrom must be a positive integer/i
  );
});
