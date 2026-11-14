export async function installFixture(page) {
await page.evaluate(async () => {
  const ui = await import('/ui.js'); ui.registerElements();
  const { EditorDraftStore } = await import('/drafts.js');
  window.fixturePng = () => new Blob([Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC'), char => char.charCodeAt(0))], { type: 'image/png' });
  window.testMount = async (name, ports, target, locale = 'zh-CN', production = false, task = {}) => {
    if (name === 'game-checkin') ports = { subscribe: () => () => {}, ...ports };
    document.documentElement.lang = locale;
    const style = document.createElement('link'); style.rel = 'stylesheet'; style.href = `/${name}/main.css`;
    document.head.append(style);
    const extension = await import(`/${name}/main.js`);
    const registered = [];
    const controller = new AbortController();
    let viewOwner = new AbortController();
    const drafts = new EditorDraftStore(error => { throw error; });
    const owned = [];
    const localeListeners = new Set();
    const host = { extensionId: name, scope: { signal: controller.signal, own: value => { owned.push(value); return value; } }, get locale() { return locale; }, appearance: 'dark',
      onLocaleChanged(listener) { localeListeners.add(listener); return () => localeListeners.delete(listener); },
      translate: key => key, registerSurface: item => registered.push(item), registerRoute: item => registered.push(item),
      registerStyle: () => {} };
    await (production ? extension.createFrontend(ports) : extension.createExtension(ports)).activate(host);
    const contribution = registered.find(item => item.target === target || (target === 'route' && item.path));
    if (!contribution) throw new Error(`Missing ${target} contribution`);
    const element = document.createElement('div'); document.querySelector('#app').append(element);
    const listeners = new Set();
    const surface = { element, context: { surfaceId: target === 'route' ? 'application.navigation' : target,
      instanceId: 'fixture-instance', entityId: 'fixture-entity', runId: 'fixture-run', attemptId: 'fixture-attempt', ...task },
      signal: AbortSignal.any([controller.signal, viewOwner.signal]), visible: true, scope: host.scope,
      drafts: drafts.target('fixture-instance', target, 'fixture-entity').child('extension/' + name),
      setAppearance(value) { window.fixtureAppearance = value; },
      onVisibilityChanged(listener) { listeners.add(listener); return () => listeners.delete(listener); } };
    let cleanup = await contribution.mount(surface);
    window.fixture = { element, controller, surface, listeners, cleanup, ports,
      get localeListenerCount() { return localeListeners.size; },
      setLocale(value) { locale = value; document.documentElement.lang = value;
        for (const listener of localeListeners) listener(value); },
      hide() { surface.visible = false; for (const listener of listeners) listener(false); },
      show() { surface.visible = true; for (const listener of listeners) listener(true); },
      async remount() {
        viewOwner.abort(); cleanup?.(); element.replaceChildren(); listeners.clear();
        viewOwner = new AbortController(); surface.signal = AbortSignal.any([controller.signal, viewOwner.signal]);
        surface.visible = true; surface.drafts = drafts.target('fixture-instance', target, 'fixture-entity').child('extension/' + name);
        cleanup = await contribution.mount(surface);
      },
      cancelDrafts() { surface.drafts.settle('cancel'); },
      dispose() { controller.abort(); viewOwner.abort(); cleanup?.(); drafts.dispose(); if (target === 'application.appearance') window.fixtureAppearance = null;
        for (const release of owned.splice(0)) release();
        element.remove(); style.remove(); } };
  };
});
}
