import { bindLocale } from '../../../frontend-ui/src/localize.js';
import {
  contractFingerprint,
  sdkVersion,
  type FrontendExtension,
  type ExtensionSurface,
  type FrontendTransport,
  type UiElement
} from '@nexuspipeline/extension-sdk';
import { createPanel } from '../../../frontend-ui/src/elements.js';
import { localize, type Translate } from '../../../frontend-ui/src/localize.js';
import { decodePreview, type PreviewImage } from './preview-image.js';
import type { ScreenshotPorts, ScreenshotFrame } from './ports.js';
import { english } from './messages.js';
import '../../../frontend-ui/src/style.css';
import './style.css';

function mountPreview(surface: ExtensionSurface, t: Translate, ports?: ScreenshotPorts, locale = 'zh-CN') {
  const panel = createPanel(surface, '实时画面', t);
  panel.card.classList.add('screenshot-panel');
  panel.card.querySelector('h3')?.remove();
  panel.status.remove();
  const heading = document.createElement('div');
  heading.className = 'screenshot-heading';
  const title = document.createElement('strong');
  bindLocale(t, panel.signal, title, 'textContent', () => {
    title.textContent = t('实时画面');
  });
  const source = document.createElement('nexus-badge') as UiElement<'nexus-badge'>;
  bindLocale(t, panel.signal, source, 'label', () => {
    source.label = t('等待');
  });
  heading.append(title, source);
  const stage = document.createElement('div');
  stage.className = 'screenshot-stage';
  const message = document.createElement('span');
  bindLocale(t, panel.signal, message, 'textContent', () => {
    message.textContent = t('等待任务画面');
  });
  let image = document.createElement('img');
  image.className = 'screenshot-image';
  bindLocale(t, panel.signal, image, 'alt', () => {
    image.alt = t('当前游戏画面');
  });
  image.hidden = true;
  stage.append(image, message);
  const footer = document.createElement('div');
  footer.className = 'screenshot-footer';
  const updated = document.createElement('span'),
    frequency = document.createElement('span');
  bindLocale(t, panel.signal, frequency, 'textContent', () => {
    frequency.textContent = t('每 5 秒更新');
  });
  footer.append(updated, frequency);
  panel.body.append(heading, stage, footer);
  let visible = surface.visible && !document.hidden;
  let timer: ReturnType<typeof setInterval> | undefined;
  let request: AbortController | undefined;
  let displayed: PreviewImage | undefined;
  let releaseFrame: (() => void) | undefined;
  let serial = 0;
  const clearImage = () => {
    image.removeAttribute('src');
    image.hidden = true;
    displayed?.release();
    displayed = undefined;
    releaseFrame?.();
    releaseFrame = undefined;
  };
  const show = (frame: ScreenshotFrame, decoded?: PreviewImage) => {
    clearImage();
    bindLocale(t, panel.signal, source, 'label', () => {
      source.label = t(
        frame.source === 'emulator' ? '模拟器' : frame.source === 'pc_game' ? 'PC 游戏' : '等待'
      );
    });
    source.tone = frame.state === 'ready' && frame.blob ? 'success' : 'neutral';
    message.hidden = frame.state === 'ready' && !!frame.blob;
    bindLocale(t, panel.signal, updated, 'textContent', () => {
      updated.textContent = frame.capturedAt ? `${t('最近更新')} ${captureTime(frame.capturedAt, t.locale?.() ?? locale)}` : '';
    });
    if (frame.state === 'ready' && decoded) {
      releaseFrame = frame.release;
      displayed = decoded;
      decoded.element.className = image.className;
      decoded.element.alt = image.alt;
      image.replaceWith(decoded.element);
      image = decoded.element;
      image.hidden = false;
    } else {
      frame.release?.();
      bindLocale(t, panel.signal, message, 'textContent', () => {
        message.textContent = t(
          (
            {
              waiting_run: '等待任务画面',
              waiting_for_game: '正在等待游戏窗口…',
              window_not_ready: '正在等待游戏窗口…',
              emulator_not_ready: '正在等待模拟器画面…',
              unavailable: '暂时无法获取游戏窗口画面',
              ready: '暂时无法获取游戏窗口画面'
            } as const
          )[frame.state]
        );
      });
    }
  };
  const poll = async () => {
    if (!ports || !visible || request || !panel.alive()) return;
    const own = ++serial;
    const nextRequest = new AbortController();
    request = nextRequest;
    let acquired: ScreenshotFrame | undefined;
    let decoded: PreviewImage | undefined;
    try {
      const frame = await ports.readFrame(surface.context, nextRequest.signal);
      acquired = frame;
      if (!panel.alive() || !visible || own !== serial) return;
      if (frame.state === 'ready') {
        if (!frame.blob) throw new Error('media_preview_frame_missing');
        decoded = await decodePreview(frame.blob, nextRequest.signal);
      }
      if (panel.alive() && visible && own === serial) {
        show(frame, decoded); acquired = undefined; decoded = undefined;
      }
    } catch (error) {
      if (panel.alive() && visible && own === serial && !nextRequest.signal.aborted) {
        clearImage();
        source.tone = 'neutral';
        message.hidden = false;
        bindLocale(t, panel.signal, message, 'textContent', () => {
          message.textContent = t('暂时无法获取游戏窗口画面');
        });
        panel.say(error instanceof Error ? error.message : String(error), true);
      }
    } finally {
      decoded?.release();
      acquired?.release?.();
      if (request === nextRequest) request = undefined;

    }
  };
  const syncVisibility = () => {
    const next = surface.visible && !document.hidden;
    if (next === visible && timer !== undefined) return;
    visible = next;
    if (timer !== undefined) clearInterval(timer);
    timer = undefined;
    serial += 1;
    request?.abort();
    if (!next) clearImage();
    else if (ports && panel.alive()) {
      timer = setInterval(() => { void poll(); }, 5000);
      void poll();
    }
  };
  const visibility = surface.onVisibilityChanged(syncVisibility);
  document.addEventListener('visibilitychange', syncVisibility, { signal: panel.signal });
  if (ports) syncVisibility();
  else bindLocale(t, panel.signal, message, 'textContent', () => {
    message.textContent = t('实时截图服务尚未接入');
  });
  return () => {
    serial += 1;
    if (timer !== undefined) clearInterval(timer);
    request?.abort();
    visibility();
    clearImage();
    panel.cleanup();
  };
}

export function createExtension(ports?: ScreenshotPorts): FrontendExtension {
  return {
    extensionId: 'live-screenshot',
    sdkVersion,
    contractFingerprint,
    activate(context) {
      context.registerSurface({
        id: 'live-screenshot.preview',
        target: 'execution.running.preview',
        mount: (surface) => mountPreview(surface, localize(context, english), ports, context.locale)
      });
    }
  };
}

function captureTime(value: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, { timeStyle: 'short', hour12: false }).format(new Date(value));
  } catch {
    return value;
  }
}

export default createExtension();

export function createFrontend(transport: FrontendTransport): FrontendExtension {
  return createExtension({
    async readFrame(context, signal) {
      if (!context.runId || !context.attemptId) return { state: 'waiting_run' };
      const preview = await transport.preview(context, 'current-task', signal);
      return preview.state === 'ready' ? { ...preview.image, state: 'ready', capturedAt: preview.capturedAt } : preview;
    }
  });
}
