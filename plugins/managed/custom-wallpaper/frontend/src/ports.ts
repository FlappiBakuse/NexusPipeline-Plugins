export interface WallpaperAsset {
  readonly id: string;
  readonly name: string;
  readonly sizeBytes: number;
  readonly palette?: Readonly<Record<string, string>>;
}

export interface WallpaperEffects {
  readonly blurPx: number;
  readonly dimPercent: number;
  readonly surfaceTransparencyPercent: number;
  readonly secondaryTransparency: boolean;
}

export interface WallpaperState {
  readonly revision: number;
  readonly enabled: boolean;
  readonly effectiveEnabled: boolean;
  readonly assets: readonly WallpaperAsset[];
  readonly order: readonly string[];
  readonly selectedId?: string;
  readonly currentId?: string;
  readonly rotation: {
    readonly mode: 'off' | 'startup' | 'timer';
    readonly intervalMinutes: number;
    readonly epochUnixMs?: number;
    readonly nextSwitchAt?: string;
  };
  readonly effects: WallpaperEffects;
  readonly limits?: {
    readonly maxAssetBytes: number;
    readonly maxAssets: number;
    readonly maxTotalBytes: number;
  };
}

export interface WallpaperPatch {
  readonly enabled?: boolean;
  readonly selectedId?: string;
  readonly order?: readonly string[];
  readonly rotation?: WallpaperState['rotation'];
  readonly effects?: WallpaperEffects;
}

export interface WallpaperPorts {
  connectionKind(signal: AbortSignal): Promise<'local' | 'remote'>;
  readState(signal: AbortSignal): Promise<WallpaperState>;
  readSettingsResult?(operationId: string, signal: AbortSignal): Promise<boolean>;
  saveSettings(patch: WallpaperPatch, revision: number, signal: AbortSignal, operationId?: string): Promise<WallpaperState>;
  uploadAsset(file: File, signal: AbortSignal): Promise<WallpaperState>;
  savePalette(
    id: string,
    palette: Readonly<Record<string, string>>,
    signal: AbortSignal
  ): Promise<WallpaperState>;
  deleteAsset(id: string, signal: AbortSignal): Promise<WallpaperState>;
  readAsset(id: string, signal: AbortSignal): Promise<Blob>;
  advanceRotation(signal: AbortSignal): Promise<WallpaperState>;
  subscribe(listener: (state: WallpaperState) => void): () => void;
}
