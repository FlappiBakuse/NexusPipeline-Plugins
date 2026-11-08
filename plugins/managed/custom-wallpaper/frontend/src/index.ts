import { contractFingerprint, sdkVersion, type FrontendExtension, type FrontendTransport } from '@nexuspipeline/extension-sdk';
import { mountSettings } from './settings.js';
import { createRuntime } from './runtime.js';
import { mountAppearance } from './appearance.js';
import type { WallpaperPorts } from './ports.js';
import { localize } from '../../../frontend-ui/src/localize.js';
import { english } from './messages.js';
import { wallpaperPorts } from './transport.js';
import '../../../frontend-ui/src/style.css';
import './style.css';

export function createExtension(ports?: WallpaperPorts): FrontendExtension {
  return {
    extensionId: 'custom-wallpaper',
    sdkVersion,
    contractFingerprint,
    async activate(context) {
      const runtime = ports ? createRuntime(ports, context.scope.signal) : undefined;
      if (runtime) await runtime.refresh();
      context.scope.signal.throwIfAborted();
      context.registerSurface({
        id: 'custom-wallpaper.settings',
        target: 'settings.panels',
        mount: (surface) => mountSettings(surface, ports, runtime, localize(context, english))
      });
      context.registerSurface({
        id: 'custom-wallpaper.appearance',
        target: 'application.appearance',
        mount: (surface) => mountAppearance(surface, runtime)
      });
    }
  };
}

export default createExtension();

export function createFrontend(transport: FrontendTransport): FrontendExtension {
  return createExtension(wallpaperPorts(transport));
}
