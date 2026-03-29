import assert from "node:assert/strict";
import test from "node:test";
import { TranslationStatus } from "@/app/generated/prisma/client";
import {
  calculateTranslationProgressPercent,
  canRetryTranslationStatus,
  canRunTranslationStatus,
  resolveTranslationStatusFromProgress,
} from "@/app/lib/translation/state";

test("translation progress percent is bounded by chapter totals", () => {
  assert.equal(calculateTranslationProgressPercent(0, 0), 0);
  assert.equal(calculateTranslationProgressPercent(2, 4), 50);
  assert.equal(calculateTranslationProgressPercent(9, 4), 100);
});

test("translation run/retry status helpers enforce valid transitions", () => {
  assert.equal(canRunTranslationStatus(TranslationStatus.PENDING), true);
  assert.equal(canRunTranslationStatus(TranslationStatus.IN_PROGRESS), true);
  assert.equal(canRunTranslationStatus(TranslationStatus.FAILED), false);
  assert.equal(canRunTranslationStatus(TranslationStatus.COMPLETED), false);

  assert.equal(canRetryTranslationStatus(TranslationStatus.FAILED), true);
  assert.equal(canRetryTranslationStatus(TranslationStatus.PENDING), false);
});

test("translation status resolves from failure and completion state", () => {
  assert.equal(
    resolveTranslationStatusFromProgress({
      hasFailure: true,
      totalChapters: 10,
      completedChapters: 4,
    }),
    TranslationStatus.FAILED
  );

  assert.equal(
    resolveTranslationStatusFromProgress({
      hasFailure: false,
      totalChapters: 3,
      completedChapters: 3,
    }),
    TranslationStatus.COMPLETED
  );

  assert.equal(
    resolveTranslationStatusFromProgress({
      hasFailure: false,
      totalChapters: 5,
      completedChapters: 2,
    }),
    TranslationStatus.IN_PROGRESS
  );
});
