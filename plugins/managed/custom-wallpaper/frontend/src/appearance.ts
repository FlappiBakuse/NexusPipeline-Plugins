import type { ExtensionSurface } from '@nexuspipeline/extension-sdk';
import type { AppearanceFrame, createRuntime } from './runtime.js';
import { accentHex } from './palette.js';

type Runtime = ReturnType<typeof createRuntime>;

export function mountAppearance(surface: ExtensionSurface, runtime: Runtime | undefined) {
  if (!runtime) return () => {};
  const layer = document.createElement('div');
  const image = document.createElement('div');
  const shade = document.createElement('div');
  layer.className = 'wallpaper-appearance';
  image.className = 'wallpaper-appearance-image';
  shade.className = 'wallpaper-appearance-shade';
  layer.setAttribute('aria-hidden', 'true');
  layer.append(image, shade);
  surface.element.append(layer);
  let frame: AppearanceFrame | undefined;
  let visible = surface.visible;
  let url: string | undefined;
  let displayedBlob: Blob | undefined;
  let disposed = false;
  const release = () => {
    image.style.backgroundImage = '';
    layer.hidden = true;
    if (url) URL.revokeObjectURL(url);
    url = undefined;
    displayedBlob = undefined;
  };
  const render = () => {
    if (disposed || !visible || surface.signal.aborted) {
      release();
      return;
    }
    if (!frame) {
      release();
      surface.setAppearance(null);
      return;
    }
    const palette = frame.palette;
    const accent = accentHex(palette?.['--accent']);
    const accentStrong = accentHex(palette?.['--accent-strong']);
    const cardDark = accentHex(palette?.['--wallpaper-card-dark']);
    const cardLight = accentHex(palette?.['--wallpaper-card-light']);
    surface.setAppearance({
      ...(accent ? { accent } : {}),
      ...(accentStrong ? { accentStrong } : {}),
      ...(cardDark ? { cardDark } : {}),
      ...(cardLight ? { cardLight } : {}),
      cardOpacity: 1 - Math.max(0, Math.min(100, frame.effects.surfaceTransparencyPercent)) / 100,
      secondaryTransparent: frame.effects.secondaryTransparency
    });
    if (displayedBlob !== frame.blob) {
      release();
      displayedBlob = frame.blob;
      url = URL.createObjectURL(frame.blob);
      image.style.backgroundImage = `url("${url}")`;
    }
    image.style.filter = `blur(${Math.max(0, Math.min(80, frame.effects.blurPx))}px)`;
    const dim = Math.max(0, Math.min(100, frame.effects.dimPercent)) / 100;
    const mask = frame.palette?.['--mask'];
    shade.style.backgroundColor = mask && CSS.supports('color', mask) ? mask : `rgba(0, 0, 0, ${dim})`;
    shade.style.opacity = mask ? String(dim) : '1';
    layer.hidden = false;
  };
  const unsubscribe = runtime.listenAppearance((next) => {
    frame = next;
    render();
  });
  const unobserve = surface.onVisibilityChanged((next) => {
    visible = next;
    runtime.setAppearanceVisible(next);
    if (!next) {
      frame = undefined;
      release();
    }
  });
  runtime.setAppearanceVisible(visible);
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    unobserve();
    unsubscribe();
    runtime.setAppearanceVisible(false);
    if (!surface.signal.aborted) surface.setAppearance(null);
    release();
    layer.remove();
  };
  surface.signal.addEventListener('abort', dispose, { once: true });
  return dispose;
}
