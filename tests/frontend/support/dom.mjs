import { JSDOM } from "jsdom";

export function installDom() {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/", pretendToBeVisual: true });
  const names = ["window", "document", "navigator", "location", "Element", "HTMLElement", "SVGElement", "Node", "Text", "Comment", "Event", "CustomEvent", "MutationObserver", "getComputedStyle", "Blob", "AbortController", "AbortSignal", "DOMException", "requestAnimationFrame", "cancelAnimationFrame"];
  const previous = new Map();
  for (const name of names) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, name);
    previous.set(name, descriptor);
    Object.defineProperty(globalThis, name, {
      configurable: true,
      enumerable: descriptor?.enumerable ?? true,
      writable: true,
      value: dom.window[name] ?? dom.window,
    });
  }
  // jsdom 不实现 Blob URL；插件托管的壁纸地址需要一个可计数的等价实现来验证创建与释放。
  const createdUrls = new Set();
  let urlCounter = 0;
  const nativeCreateObjectUrl = URL.createObjectURL;
  const nativeRevokeObjectUrl = URL.revokeObjectURL;
  URL.createObjectURL = () => {
    const value = `blob:nexus-plugin-test/${++urlCounter}`;
    createdUrls.add(value);
    return value;
  };
  URL.revokeObjectURL = value => {
    createdUrls.delete(String(value));
  };
  return {
    createdUrls,
    restore() {
      URL.createObjectURL = nativeCreateObjectUrl;
      URL.revokeObjectURL = nativeRevokeObjectUrl;
      for (const name of names) {
        const descriptor = previous.get(name);
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else delete globalThis[name];
      }
      dom.window.close();
    },
    dom,
  };
}

export function installLifecycleProbe(window, pluginRoot) {
  const attribute = pluginRoot.replaceAll("\\", "/").toLowerCase();
  const fromPlugin = () => {
    const stack = new Error().stack;
    return typeof stack === "string" && stack.replaceAll("\\", "/").toLowerCase().includes(attribute);
  };
  const probe = { intervals: new Set(), timeouts: new Set(), listeners: new Map() };
  const nativeSetInterval = globalThis.setInterval;
  const nativeClearInterval = globalThis.clearInterval;
  const nativeSetTimeout = globalThis.setTimeout;
  const nativeClearTimeout = globalThis.clearTimeout;
  const nativeAdd = window.addEventListener.bind(window);
  const nativeRemove = window.removeEventListener.bind(window);
  globalThis.setInterval = (handler, delay, ...rest) => {
    const attributeCall = fromPlugin();
    const handle = nativeSetInterval(handler, delay, ...rest);
    if (attributeCall) probe.intervals.add(handle);
    return handle;
  };
  globalThis.clearInterval = handle => {
    probe.intervals.delete(handle);
    return nativeClearInterval(handle);
  };
  globalThis.setTimeout = (handler, delay, ...rest) => {
    const attributeCall = fromPlugin();
    const handle = nativeSetTimeout((...args) => {
      probe.timeouts.delete(handle);
      handler(...args);
    }, delay, ...rest);
    if (attributeCall) probe.timeouts.add(handle);
    return handle;
  };
  globalThis.clearTimeout = handle => {
    probe.timeouts.delete(handle);
    return nativeClearTimeout(handle);
  };
  window.addEventListener = (type, listener, options) => {
    if (fromPlugin()) {
      const list = probe.listeners.get(type) || [];
      list.push(listener);
      probe.listeners.set(type, list);
    }
    return nativeAdd(type, listener, options);
  };
  window.removeEventListener = (type, listener, options) => {
    const list = probe.listeners.get(type) || [];
    const index = list.indexOf(listener);
    if (index >= 0) list.splice(index, 1);
    if (!list.length) probe.listeners.delete(type);
    return nativeRemove(type, listener, options);
  };
  probe.restore = () => {
    globalThis.setInterval = nativeSetInterval;
    globalThis.clearInterval = nativeClearInterval;
    globalThis.setTimeout = nativeSetTimeout;
    globalThis.clearTimeout = nativeClearTimeout;
    window.addEventListener = nativeAdd;
    window.removeEventListener = nativeRemove;
  };
  return probe;
}

export async function flushDom() {
  await Promise.resolve();
  await new Promise(resolve => setTimeout(resolve, 0));
}
