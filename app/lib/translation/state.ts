import { TranslationStatus } from "@/app/generated/prisma/client";

export function calculateTranslationProgressPercent(
  completedChapters: number,
  totalChapters: number
) {
  if (totalChapters <= 0) {
    return 0;
  }

  const boundedCompleted = Math.min(Math.max(completedChapters, 0), totalChapters);
  return Math.floor((boundedCompleted / totalChapters) * 100);
}

export function canRunTranslationStatus(status: TranslationStatus) {
  return status === TranslationStatus.PENDING || status === TranslationStatus.IN_PROGRESS;
}

export function canRetryTranslationStatus(status: TranslationStatus) {
  return status === TranslationStatus.FAILED;
}

export function resolveTranslationStatusFromProgress(input: {
  hasFailure: boolean;
  totalChapters: number;
  completedChapters: number;
}) {
  if (input.hasFailure) {
    return TranslationStatus.FAILED;
  }

  if (input.totalChapters > 0 && input.completedChapters >= input.totalChapters) {
    return TranslationStatus.COMPLETED;
  }

  return TranslationStatus.IN_PROGRESS;
}
