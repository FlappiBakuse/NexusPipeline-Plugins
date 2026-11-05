import type { SurfaceContext } from '@nexuspipeline/extension-sdk';

export interface ScreenshotFrame {
  readonly state:
    | 'waiting_run'
    | 'waiting_for_game'
    | 'window_not_ready'
    | 'emulator_not_ready'
    | 'unavailable'
    | 'ready';
  readonly blob?: Blob;
  readonly capturedAt?: string;
  readonly source?: 'pc_game' | 'emulator';
  readonly release?: () => void;
}

export interface ScreenshotPorts {
  readFrame(context: SurfaceContext, signal: AbortSignal): Promise<ScreenshotFrame>;
}
