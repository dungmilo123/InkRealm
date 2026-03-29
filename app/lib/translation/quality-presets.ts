export type QualityPreset = "fast" | "standard" | "premium";

const QUALITY_PRESETS: Record<QualityPreset, {
  contextChapters: number;
  contextSummaries: number;
  useGlossary: boolean;
}> = {
  fast: { contextChapters: 0, contextSummaries: 0, useGlossary: false },
  standard: { contextChapters: 1, contextSummaries: 3, useGlossary: true },
  premium: { contextChapters: 3, contextSummaries: 5, useGlossary: true },
};

export function resolveQualityPreset(preset?: string) {
  if (!preset || !(preset in QUALITY_PRESETS)) {
    return QUALITY_PRESETS.fast;
  }
  return QUALITY_PRESETS[preset as QualityPreset];
}
