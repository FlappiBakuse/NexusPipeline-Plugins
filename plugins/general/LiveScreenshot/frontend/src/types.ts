export interface ScreenshotHost {
  i18n: { t(key: string, args?: Record<string, unknown>, fallback?: string): string; formatTime(value: string, options?: Intl.DateTimeFormatOptions): string };
  executionPreview: { capture(runId: string, signal?: AbortSignal): Promise<{ state: string; url?: string; source?: string; capturedAt?: string }> };
}
