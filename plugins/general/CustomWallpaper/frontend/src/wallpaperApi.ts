import { derivePalette } from "./palette";

export interface WallpaperAsset {
  id: string;
  originalName?: string;
  mimeType?: string;
  sizeBytes?: number;
  createdAt?: string;
  paletteVersion?: number;
  palette?: Record<string, string>;
}

export interface WallpaperState {
  revision?: number;
  enabled?: boolean;
  effectiveEnabled?: boolean;
  assets?: WallpaperAsset[];
  order?: string[];
  selectedId?: string;
  currentId?: string;
  rotation?: { mode?: string; intervalMinutes?: number; epochUnixMs?: number; nextSwitchAt?: string | null };
  effects?: {
    blurPx?: number;
    dimPercent?: number;
    surfaceTransparencyPercent?: number;
    applyTransparencyToSecondarySurfaces?: boolean;
  };
  limits?: { maxAssetBytes?: number; maxAssets?: number; maxTotalBytes?: number };
}

export interface WallpaperHost {
  i18n: {
    locale: string;
    t(key: string, args?: Record<string, unknown>, fallback?: string): string;
  };
  ui: { toast(message: string, tone?: string): void };
  appearance: {
    setBackground(surface: {
      url: string;
      blurPx?: number;
      dimPercent?: number;
      surfaceTransparencyPercent?: number;
      secondarySurfaceTransparency?: boolean;
    }): void;
    clearBackground(): void;
    setTokens(tokens: Record<string, string>): void;
    clearTokens(): void;
  };
  api: {
    get(route: string, signal?: AbortSignal): Promise<WallpaperState>;
    put(route: string, body?: unknown, signal?: AbortSignal): Promise<WallpaperState>;
    post(route: string, body?: unknown, signal?: AbortSignal): Promise<WallpaperState>;
    blob(route: string, options?: { query?: Record<string, string>; signal?: AbortSignal }): Promise<Blob>;
    upload(route: string, body: Blob, options?: {
      method?: string;
      contentType?: string;
      query?: Record<string, string>;
      signal?: AbortSignal;
    }): Promise<{ ok?: boolean; duplicate?: boolean; asset?: WallpaperAsset; state?: WallpaperState }>;
  };
}

/** 资源二进制读取路由与请求参数由插件自有 Web API 决定。 */
export function assetBlob(host: WallpaperHost, assetId: string, signal?: AbortSignal): Promise<Blob> {
  return host.api.blob("asset", { query: { id: assetId }, signal });
}

export function loadState(host: WallpaperHost, signal?: AbortSignal): Promise<WallpaperState> {
  return host.api.get("state", signal);
}

export function saveSettings(host: WallpaperHost, patch: unknown, signal?: AbortSignal): Promise<WallpaperState> {
  return host.api.put("settings", patch, signal);
}

export function deleteAsset(host: WallpaperHost, id: string, signal?: AbortSignal): Promise<WallpaperState> {
  return host.api.post("assets/delete", { id }, signal);
}

export function savePalette(host: WallpaperHost, id: string, palette: Record<string, string>, signal?: AbortSignal): Promise<WallpaperState> {
  return host.api.put("assets/palette", { id, palette }, signal);
}

export function advanceRotation(host: WallpaperHost, reason: string, signal?: AbortSignal): Promise<WallpaperState> {
  return host.api.post("rotation/advance", { reason }, signal);
}

export async function uploadAsset(
  host: WallpaperHost,
  file: File,
  signal?: AbortSignal): Promise<{ asset?: WallpaperAsset; state?: WallpaperState }> {
  const result = await host.api.upload("assets", file, {
    contentType: file.type || "application/octet-stream",
    query: { name: file.name },
    signal,
  });
  return { asset: result?.asset, state: result?.state };
}

/** 生成并保存当前资产的配色；配色生成失败不回滚已上传的资产。 */
export async function ensurePalette(host: WallpaperHost, asset: WallpaperAsset, blob: Blob): Promise<Record<string, string> | null> {
  if (asset.paletteVersion === 3 && asset.palette && Object.keys(asset.palette).length > 0) {
    return asset.palette;
  }
  try {
    const palette = await derivePalette(blob);
    await savePalette(host, asset.id, palette);
    return palette;
  } catch (error) {
    return null;
  }
}
