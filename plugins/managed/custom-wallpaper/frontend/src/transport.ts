import type { FrontendTransport } from '@nexuspipeline/extension-sdk';
import type { WallpaperPorts, WallpaperState } from './ports.js';
import { createIdentity } from '../../../frontend-ui/src/identity.js';
import { boundedImage } from '../../../frontend-ui/src/image-bound.js';

export function wallpaperPorts(transport: FrontendTransport): WallpaperPorts {
  const readState = async (signal: AbortSignal): Promise<WallpaperState> =>
    decodeState(await transport.invoke('read-state', {}, signal));
  const write = async (operation: string, input: unknown, signal: AbortSignal): Promise<WallpaperState> =>
    decodeState(await transport.invoke(operation, input, signal, createIdentity()));
  return {
    connectionKind: async () => transport.connectionKind,
    readState,
    saveSettings: (patch, revision, signal) => write('save-settings', { patch, revision }, signal),
    async uploadAsset(file, signal) {
      await boundedImage(file);
      signal.throwIfAborted();
      return decodeState(await transport.upload('upload-asset', file, signal, createIdentity()));
    },
    savePalette: (id, palette, signal) => write('save-palette', { id, palette }, signal),
    deleteAsset: (id, signal) => write('delete-asset', { id }, signal),
    async readAsset(id, signal) {
      const image = await transport.image('read-asset', id, signal);
      if (signal.aborted) {
        image.release();
        signal.throwIfAborted();
      }
      signal.addEventListener('abort', () => image.release(), { once: true });
      return image.blob;
    },
    advanceRotation: readState,
    subscribe(listener) {
      const request = new AbortController();
      let pending: Promise<void> | undefined;
      let changed = false;
      const publish = () => {
        changed = true;
        if (pending || request.signal.aborted) return;
        pending = (async () => {
          do {
            changed = false;
            const next = await readState(request.signal);
            if (!request.signal.aborted) listener(next);
          } while (changed && !request.signal.aborted);
        })().catch(() => {}).finally(() => {
          pending = undefined;
          if (changed && !request.signal.aborted) publish();
        });
      };
      const unsubscribe = transport.subscribe(publish);
      return () => { request.abort(); unsubscribe(); };
    }
  };
}

function decodeState(input: unknown): WallpaperState {
  const value = input as WallpaperState;
  if (!value || !Number.isSafeInteger(value.revision) || value.revision < 0 || typeof value.enabled !== 'boolean' ||
      typeof value.effectiveEnabled !== 'boolean' || !Array.isArray(value.assets) || value.assets.length > 32 ||
      !Array.isArray(value.order) || !value.effects || !value.rotation)
    throw new Error('wallpaper_state_invalid');
  const ids = new Set<string>();
  for (const asset of value.assets) {
    if (!/^[0-9a-f]{64}$/.test(asset.id) || ids.has(asset.id) || typeof asset.name !== 'string' ||
        !Number.isSafeInteger(asset.sizeBytes) || asset.sizeBytes < 1 || asset.sizeBytes > 8388608)
      throw new Error('wallpaper_asset_invalid');
    ids.add(asset.id);
  }
  if (value.order.length !== ids.size || new Set(value.order).size !== ids.size ||
      value.order.some(id => !ids.has(id)) || value.currentId !== undefined && !ids.has(value.currentId))
    throw new Error('wallpaper_order_invalid');
  return value;
}
