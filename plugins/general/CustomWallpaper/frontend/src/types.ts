export interface WallpaperAsset {
  id: string;
  originalName?: string;
  url: string;
  sizeBytes?: number;
}

export interface WallpaperSnapshot {
  revision?: number;
  assets?: WallpaperAsset[];
  order?: string[];
  selectedId?: string;
  effectiveEnabled?: boolean;
  provider?: { enabled?: boolean };
  rotation?: { mode?: string; intervalMinutes?: number; epochUnixMs?: number };
  effects?: { blurPx?: number; dimPercent?: number; surfaceTransparencyPercent?: number; applyTransparencyToSecondarySurfaces?: boolean };
}

export interface WallpaperHost {
  i18n: { t(key: string, args?: Record<string, unknown>, fallback?: string): string };
  ui: { toast(message: string, tone?: string): void };
  appearance: {
    wallpaperStore: {
      get(): Promise<WallpaperSnapshot>;
      save(settings: Record<string, unknown>): Promise<WallpaperSnapshot>;
      upload(file: File, options?: Record<string, unknown>): Promise<{ asset?: WallpaperAsset }>;
      remove(id: string): Promise<void>;
      savePalette(id: string, palette: unknown): Promise<void>;
      subscribe(listener: (snapshot: WallpaperSnapshot) => void): { dispose(): void };
    };
    derivePalette(file: File): Promise<unknown>;
  };
}
