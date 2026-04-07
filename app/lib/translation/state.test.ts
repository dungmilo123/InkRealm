import { TranslationStatus } from "@/app/generated/prisma/client";
import {
  calculateTranslationProgressPercent,
  canRetryTranslationStatus,
  canRunTranslationStatus,
  resolveTranslationStatusFromProgress,
} from "@/app/lib/translation/state";

test("translation progress percent is bounded by chapter totals", () => {
  expect(calculateTranslationProgressPercent(0, 0)).toBe(0);
  expect(calculateTranslationProgressPercent(2, 4)).toBe(50);
  expect(calculateTranslationProgressPercent(9, 4)).toBe(100);
});

test("translation run/retry status helpers enforce valid transitions", () => {
  expect(canRunTranslationStatus(TranslationStatus.PENDING)).toBe(true);
  expect(canRunTranslationStatus(TranslationStatus.IN_PROGRESS)).toBe(true);
  expect(canRunTranslationStatus(TranslationStatus.FAILED)).toBe(false);
  expect(canRunTranslationStatus(TranslationStatus.COMPLETED)).toBe(false);

  expect(canRetryTranslationStatus(TranslationStatus.FAILED)).toBe(true);
  expect(canRetryTranslationStatus(TranslationStatus.PENDING)).toBe(false);
});

test("translation status resolves from failure and completion state", () => {
  expect(resolveTranslationStatusFromProgress({
    hasFailure: true,
    totalChapters: 10,
    completedChapters: 4,
  })).toBe(TranslationStatus.FAILED);

  expect(resolveTranslationStatusFromProgress({
    hasFailure: false,
    totalChapters: 3,
    completedChapters: 3,
  })).toBe(TranslationStatus.COMPLETED);

  expect(resolveTranslationStatusFromProgress({
    hasFailure: false,
    totalChapters: 5,
    completedChapters: 2,
  })).toBe(TranslationStatus.IN_PROGRESS);
});
