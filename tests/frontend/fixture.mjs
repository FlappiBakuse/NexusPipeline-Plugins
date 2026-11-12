import { screenshotLifecycle } from './screenshot-lifecycle.mjs';
import { choose, confirm } from './controls.mjs';
import fs from 'node:fs';
import crypto from 'node:crypto';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const startedAt = Date.now();
const options = new Map();
for (let index = 2; index < process.argv.length; index += 2) options.set(process.argv[index], process.argv[index + 1]);
const hostRoot = options.get('--host-root');
const workRoot = options.get('--work-root');
const bundles = options.get('--bundles');
const reportRoot = options.get('--report');
const extension = options.get('--extension');
const scenario = options.get('--scenario');
const browserExecutable = options.get('--browser');
const owners = { 'custom-wallpaper': 'wallpaper', 'game-activities': 'activities',
  'game-checkin': 'checkin', 'live-screenshot': 'screenshot', 'maa-framework': 'maa' };
if (!Object.hasOwn(owners, extension) || !scenario || !path.isAbsolute(browserExecutable || '') ||
    !fs.statSync(browserExecutable).isFile()) throw new Error('Explicit --extension, --scenario and --browser required');
if (![hostRoot, workRoot, bundles, reportRoot].every(value => value && path.isAbsolute(value)))
  throw new Error('Pass absolute --host-root, --work-root, --bundles and --report paths');
fs.mkdirSync(reportRoot, { recursive: true });
const buildReceipt = JSON.parse(fs.readFileSync(path.join(bundles, 'build-receipt.json')));
if (buildReceipt.status !== 'PASS' || !buildReceipt.artifacts?.some(item => item.path.startsWith(extension + '/')))
  throw new Error('Build the selected extension before its browser fixture');
function sourceFiles(directory) {
  return fs.readdirSync(directory, {withFileTypes:true}).flatMap(item => {
    const file = path.join(directory, item.name);
    if (item.isSymbolicLink()) throw new Error('Fixture source links are not allowed');
    return item.isDirectory() ? sourceFiles(file) : [{path:path.relative(hostRoot,file).replaceAll('\\','/'),
      sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}];
  });
}
const hostUiInputs = ['apps/web/src/ui','apps/web/src/extensions','sdk/frontend/src']
  .flatMap(name => sourceFiles(path.join(hostRoot,name)));
const esbuild = await import(pathToFileURL(path.join(workRoot, 'node_modules/esbuild/lib/main.js')).href);
await esbuild.build({ entryPoints: [path.join(hostRoot, 'apps/web/src/ui/register-elements.ts')],
  outfile: path.join(reportRoot, 'ui.js'), bundle: true, format: 'esm', platform: 'browser', target: 'es2022',
  plugins: [{ name: 'sdk', setup(plugin) {
    plugin.onResolve({ filter: /^@nexuspipeline\/extension-sdk$/ }, () => ({ path: path.join(hostRoot, 'sdk/frontend/src/index.ts') }));
  } }],
});
for (const [entry, name] of [
  ['apps/web/src/extensions/frontend-registry.ts', 'registry.js'],
  ['sdk/frontend/src/index.ts', 'sdk.js'],
]) await esbuild.build({ entryPoints: [path.join(hostRoot, entry)],
  outfile: path.join(reportRoot, name), bundle: true, format: 'esm', platform: 'browser', target: 'es2022',
  plugins: [{ name: 'sdk', setup(plugin) {
    plugin.onResolve({ filter: /^@nexuspipeline\/extension-sdk$/ }, () => ({ path: path.join(hostRoot, 'sdk/frontend/src/index.ts') }));
  } }],
});
await esbuild.build({ entryPoints: [path.join(repository, 'tests/frontend/checkin-row-owner.ts')],
  outfile: path.join(reportRoot, 'row-owner.js'), bundle: true, format: 'esm', platform: 'browser', target: 'es2022' });
const server = http.createServer((request, response) => {
  const target = new URL(request.url ?? '/', 'http://localhost');
  if (target.pathname === '/') {
    response.setHeader('content-type', 'text/html; charset=utf-8');
    response.end('<!doctype html><html><head><meta charset="utf-8"><style>body{margin:1rem;background:#101722;color:#edf2ff;font:14px system-ui;--nx-color-surface:#202737;--nx-color-surface-secondary:#252e40;--nx-color-border:#414b60;--nx-color-text:#edf2ff;--nx-color-muted:#a9b4ca;--nx-color-danger:#ff8793;--input-bg:#1c2433}a{color:#a7c7ff}</style></head><body><main id="app"></main></body></html>');
    return;
  }
  const local = ['/ui.js', '/registry.js', '/sdk.js', '/row-owner.js'].includes(target.pathname);
  const file = local ? path.join(reportRoot, target.pathname.slice(1))
    : path.join(bundles, target.pathname.slice(1));
  if (!path.resolve(file).startsWith(path.resolve(local ? reportRoot : bundles) + path.sep)
    || !fs.existsSync(file)) { response.statusCode = 404; response.end(); return; }
  response.setHeader('content-type', file.endsWith('.css') ? 'text/css' : 'text/javascript');
  response.end(fs.readFileSync(file));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const browserTools = options.get('--browser-tools') || workRoot;
if (!path.isAbsolute(browserTools)) throw new Error('Browser tools must be an explicit absolute dependency root');
const playwrightPath = path.join(browserTools, 'node_modules/playwright-core/index.mjs');
const { chromium } = await import(pathToFileURL(playwrightPath).href);
fs.mkdirSync(path.join(reportRoot, 'process-temp'), {recursive:true});
process.env.TEMP=process.env.TMP=path.join(reportRoot, 'process-temp');
const browser = await chromium.launch({ executablePath: browserExecutable,
  headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, timezoneId: 'Asia/Tokyo' });
page.setDefaultTimeout(10000);
page.on('dialog', dialog => { void dialog.dismiss(); failures.push({ name: 'unexpected native dialog', error: dialog.type() }); });
const failures = [];
const checks = [];
async function test(name, action) {
  const owner = /screenshot/i.test(name) ? 'live-screenshot' : /wallpaper/i.test(name) ? 'custom-wallpaper'
    : /activit/i.test(name) ? 'game-activities' : /check-?in/i.test(name) ? 'game-checkin'
      : /maa|^Production script editor/i.test(name) ? 'maa-framework' : /^registry /.test(name) ? 'shared' : null;
  if (!owner) throw new Error('Browser case lacks an explicit plugin owner: ' + name);
  if (owner !== 'shared' && owner !== extension || scenario !== 'all' && scenario !== name) return;
  const started = Date.now();
  try { await action(); checks.push({ name, status: 'PASS', milliseconds: Date.now() - started }); }
  catch (error) {
    const text=await page.locator('body').innerText();
    failures.push({ name, error: String(error), visibleText:text.slice(-3000) });
    checks.push({ name, status: 'FAIL', milliseconds: Date.now() - started });
  }
  finally { await page.evaluate(() => { window.fixture?.dispose?.(); window.restoreCheckinTimeout?.(); delete window.fixture; }); }
}
async function captureViewports(name) {
  for (const width of [360, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(280);
    const extent = await page.evaluate(() => document.documentElement.scrollWidth);
    const invalidControls = await page.evaluate(() => {
      const invalid = [...document.querySelectorAll('.plugin-panel textarea')]
        .filter(element => getComputedStyle(element).resize !== 'none').map(() => 'native textarea resize');
      for (const range of document.querySelectorAll('nexus-range')) {
        const input = range.shadowRoot.querySelector('input');
        const track = range.shadowRoot.querySelector('.range-track');
        if (!input || !track || track.getBoundingClientRect().width < 1 || track.getBoundingClientRect().height < 1
          || getComputedStyle(track).backgroundColor === 'rgba(0, 0, 0, 0)') invalid.push('invisible public range track');
      }
      return invalid;
    });
    if (invalidControls.length) throw new Error(`${name}: ${invalidControls.join(', ')}`);
    if (extent > width + 2) {
      const offenders = await page.evaluate(limit => [...document.querySelectorAll('*')]
        .map(element => ({ tag: element.tagName.toLowerCase(), className: String(element.className),
          right: Math.round(element.getBoundingClientRect().right) }))
        .filter(item => item.right > limit + 2).sort((left, right) => right.right - left.right).slice(0, 5), width);
      throw new Error(`${name} overflows at ${width}px: ${extent}px ${JSON.stringify(offenders)}`);
    }
    await page.screenshot({ path: path.join(reportRoot, `${name}-${width}.png`), fullPage: true });
  }
}
await page.goto(`http://127.0.0.1:${port}/`);
await page.evaluate(async () => {
  const ui = await import('/ui.js'); ui.registerElements();
  window.fixturePng = () => new Blob([Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC'), char => char.charCodeAt(0))], { type: 'image/png' });
  window.testMount = async (name, ports, target, locale = 'zh-CN', production = false, task = {}) => {
    if (name === 'game-checkin') ports = { subscribe: () => () => {}, ...ports };
    document.documentElement.lang = locale;
    const style = document.createElement('link'); style.rel = 'stylesheet'; style.href = `/${name}/main.css`;
    document.head.append(style);
    const extension = await import(`/${name}/main.js`);
    const registered = [];
    const controller = new AbortController();
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
      signal: controller.signal, visible: true, scope: host.scope,
      setAppearance(value) { window.fixtureAppearance = value; },
      onVisibilityChanged(listener) { listeners.add(listener); return () => listeners.delete(listener); } };
    const cleanup = await contribution.mount(surface);
    window.fixture = { element, controller, surface, listeners, cleanup, ports,
      get localeListenerCount() { return localeListeners.size; },
      setLocale(value) { locale = value; document.documentElement.lang = value;
        for (const listener of localeListeners) listener(value); },
      hide() { surface.visible = false; for (const listener of listeners) listener(false); },
      show() { surface.visible = true; for (const listener of listeners) listener(true); },
      dispose() { controller.abort(); cleanup?.(); if (target === 'application.appearance') window.fixtureAppearance = null;
        for (const release of owned.splice(0)) release();
        element.remove(); style.remove(); } };
  };
});

await test('live screenshot visible frame and cleanup', async () => {
  await page.evaluate(async () => {
    await window.testMount('live-screenshot', { async readFrame() {
      const pixels = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC'), value => value.charCodeAt(0));
      return { state: 'ready', blob: new Blob([pixels], { type: 'image/png' }), capturedAt: 'fixture' };
    } }, 'execution.running.preview');
  });
  await page.locator('.screenshot-image').waitFor();
  await captureViewports('screenshot');
  await page.evaluate(() => { window.fixture.hide(); if (document.querySelector('.screenshot-image')?.hasAttribute('src')) throw Error('Hidden screenshot retained its Blob URL'); window.fixture.dispose(); });
  if (await page.locator('.screenshot-image').count()) throw new Error('Frame survived disposal');
});

await test('live screenshot rejects late frame', async () => {
  const result = await page.evaluate(async () => {
    let deliver;
    let created = 0;
    const original = URL.createObjectURL;
    URL.createObjectURL = (...args) => { created++; return original(...args); };
    await window.testMount('live-screenshot', { readFrame: () => new Promise(resolve => { deliver = resolve; }) },
      'execution.running.preview');
    window.fixture.hide();
    window.fixture.dispose();
    deliver({ state: 'ready', blob: new Blob(['late']) });
    await new Promise(resolve => setTimeout(resolve, 10));
    URL.createObjectURL = original;
    return { created };
  });
  if (result.created) throw new Error('Late frame created a Blob URL');
});

await test('live screenshot waiting states and visibility', async () => {
  await page.evaluate(async () => {
    window.frameReads = 0;
    window.frameStates = [
      { state: 'waiting_for_game', source: 'pc_game' },
      { state: 'window_not_ready', source: 'pc_game' },
      { state: 'emulator_not_ready', source: 'emulator' },
      { state: 'unavailable', source: 'emulator' },
    ];
    await window.testMount('live-screenshot', { async readFrame() {
      return window.frameStates[Math.min(window.frameReads++, window.frameStates.length - 1)];
    } }, 'execution.running.preview');
  });
  await page.getByText('正在等待游戏窗口…').waitFor();
  await page.evaluate(() => window.fixture.hide());
  const before = await page.evaluate(() => window.frameReads);
  await page.waitForTimeout(100);
  if (await page.evaluate(() => window.frameReads) !== before) throw new Error('Hidden preview polled');
  await page.evaluate(() => window.fixture.show());
  await page.getByText('正在等待游戏窗口…').waitFor();
  await page.evaluate(() => { window.fixture.hide(); window.fixture.show(); });
  await page.getByText('正在等待模拟器画面…').waitFor();
  await page.evaluate(() => { window.fixture.hide(); window.fixture.show(); });
  await page.getByText('暂时无法获取游戏窗口画面').waitFor();
});

await test('registry late cleanup and rollback', async () => {
  const outcome = await page.evaluate(async () => {
    const { FrontendRegistry } = await import('/registry.js');
    const { sdkVersion, contractFingerprint } = await import('/sdk.js');
    const registry = new FrontendRegistry({ locale: 'zh-CN', appearance: 'dark', translate: key => key });
    const manifest = { format: 'nexus.extension.manifest', version: 1, extensionId: 'fixture',
      artifactName: 'Fixture', displayName: 'Fixture', packageVersion: '0.5.0', kind: 'managed-code',
      minHostVersion: '0.18.0', sdkVersion, contractFingerprint, capabilities: ['ui.contribute'],
      permissions: {}, managed: { entryAssembly: 'Fixture.dll', entryType: 'Fixture' },
      frontend: { entry: 'main.js', styles: 'main.css', sdkVersion } };
    let begin;
    const started = new Promise(resolve => { begin = resolve; });
    let finish;
    const waiting = new Promise(resolve => { finish = resolve; });
    let cleaned = 0, cleanupDone;
    const cleanup = new Promise(resolve => { cleanupDone = resolve; });
    const extension = { extensionId: 'fixture', sdkVersion, contractFingerprint,
      activate(context) { context.registerSurface({ id: 'fixture.late', target: 'overview.cards',
        mount: async () => { begin(); await waiting; return () => { cleaned++; cleanupDone(); }; } }); } };
    const owner = await registry.activate(manifest, extension);
    const holder = document.createElement('div'); document.body.append(holder);
    const pending = registry.mount('fixture', 'fixture.late', holder,
      { surfaceId: 'overview.cards', instanceId: 'fixture-instance' }).catch(() => {});
    await started;
    await owner.dispose();
    finish();
    await pending; await cleanup;
    const result = { cleaned, children: holder.children.length, active: registry.listSurfaces('overview.cards').length };
    holder.remove();
    return result;
  });
  if (outcome.cleaned !== 1 || outcome.children !== 0 || outcome.active !== 0)
    throw new Error(`Late cleanup failed: ${JSON.stringify(outcome)}`);
});

await test('wallpaper settings and appearance', async () => {
  await page.evaluate(async () => {
    let state = { revision: 1, enabled: true, effectiveEnabled: true,
      assets: [{ id: 'a', name: 'A.png', sizeBytes: 1024 }, { id: 'b', name: 'B.png', sizeBytes: 1024 }],
      order: ['a', 'b'], selectedId: 'a', currentId: 'a',
      rotation: { mode: 'timer', intervalMinutes: 5, nextSwitchAt: '2030-01-01T00:00:00Z' },
      effects: { blurPx: 2, dimPercent: 10, surfaceTransparencyPercent: 20,
        secondaryTransparency: true } };
    const callbacks = new Set();
    await window.testMount('custom-wallpaper', {
      connectionKind: async () => 'local',
      readState: async () => state,
      saveSettings: async patch => { state = { ...state, ...patch, revision: state.revision + 1 }; callbacks.forEach(fn => fn(state)); return state; },
      uploadAsset: async file => { state = { ...state, revision: state.revision + 1,
        assets: [...state.assets, { id: file.name, name: file.name, sizeBytes: file.size }] }; return state; },
      savePalette: async (id, palette) => { state = { ...state, revision: state.revision + 1,
        assets: state.assets.map(asset => asset.id === id ? { ...asset, palette } : asset) }; return state; },
      deleteAsset: async id => { state = { ...state, revision: state.revision + 1,
        assets: state.assets.filter(item => item.id !== id) }; return state; },
      readAsset: async () => window.fixturePng(),
      advanceRotation: async () => state,
      subscribe: callback => { callbacks.add(callback); return () => callbacks.delete(callback); },
      setAppearance: () => { window.appearanceApplied = true; }, clearAppearance: () => {},
    }, 'settings.panels');
  });
  await page.locator('.wallpaper-settings').getByRole('button').first().click();
  await page.getByText('A.png').waitFor();
  if (!await page.locator('nexus-file-picker').count()) throw new Error(`Picker absent initially: ${await page.locator('#app').innerHTML()}`);
  await choose(page.getByText('轮换方式').locator('..').locator('nexus-select'), 'startup');
  await page.locator('.wallpaper-list').waitFor();
  await page.locator('nexus-sortable-list nexus-drag-handle').last().press('ArrowUp');
  await page.waitForTimeout(150);
  if (!await page.locator('nexus-file-picker').count()) throw new Error(`Picker absent after reorder: ${await page.locator('#app').innerHTML()}`);
  const fileInput = await page.locator('nexus-file-picker').evaluateHandle(element => element.shadowRoot.querySelector('input'));
  await fileInput.asElement().setInputFiles({ name: 'C.png', mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC', 'base64') });
  await page.locator('.wallpaper-item-copy').getByText('C.png', { exact: true }).waitFor();
  await page.getByText('删除', { exact: true }).last().click();
  await page.locator('.wallpaper-item-copy').getByText('C.png', { exact: true }).waitFor({ state: 'detached' });
  if (await page.locator('nexus-confirm-dialog').count()) throw Error('Wallpaper deletion added a confirmation absent from the legacy flow');
  await captureViewports('wallpaper');
  await page.evaluate(() => window.fixture.dispose());
});

await test('activities carousel and details', async () => {
  await page.evaluate(async () => {
    let state = { revision: 1, selectedFeedIds: ['feed', 'other'], rotationSeconds: 30,
      pauseOnHover: true, pauseWhenHidden: true, pauseOnInteraction: true,
      displayZone: 'Asia/Shanghai', gameOrder: ['Game', 'Other'], progressionOptions: { Game: [{ value: 'cn', label: '国服' }, { value: 'jp', label: '日服' }] },
      feeds: [{ id: 'feed', game: 'Game', server: 'CN', progressionId: 'cn', contentLocale: 'zh-CN', enabled: true,
        overview: { title: 'Version One', number: '1.0', coverId: 'one',
          end: { instantUtc: '2030-01-01T00:00:00Z', rawValue: '', timeBasis: 'utc', sourceZone: 'UTC' } },
        events: [{ id: 'one', title: 'Event One', coverId: 'one', endsAt: '2030-01-01T00:00:00Z' }] },
        { id: 'feed-jp', game: 'Game', server: 'JP', progressionId: 'jp', contentLocale: 'ja-JP', enabled: true,
          overview: { title: 'Version JP' }, events: [] },
        { id: 'other', game: 'Other', server: 'Global', progressionId: 'global', contentLocale: 'en-US', enabled: true,
          overview: { title: 'Version Two', coverId: 'two' },
          events: [{ id: 'two', title: 'Event Two', coverId: 'two', endsAt: '2030-01-02T00:00:00Z' }] }] };
    await window.testMount('game-activities', { readState: async () => state,
      saveSettings: async next => { state = { ...next, revision: state.revision + 1 }; window.activitySaved = state; return state; }, refreshAll: async () => state,
      readCover: async () => new Blob(['<svg xmlns="http://www.w3.org/2000/svg" width="800" height="300"><defs><linearGradient id="g"><stop stop-color="#19345e"/><stop offset="1" stop-color="#4c6ba1"/></linearGradient></defs><rect width="800" height="300" fill="url(#g)"/><circle cx="650" cy="100" r="95" fill="#879bd6" opacity=".55"/></svg>'],
        { type: 'image/svg+xml' }), subscribe: () => () => {}, }, 'overview.cards');
  });
  await page.getByText(/Version One/).waitFor();
  await page.getByRole('button', { name: '下一款游戏', exact: true }).click();
  await page.locator('.activity-slide[aria-hidden=false]').getByText('Version Two', { exact: true }).waitFor();
  await page.getByRole('button', { name: '暂停轮播', exact: true }).click();
  await page.getByRole('button', { name: '继续轮播', exact: true }).waitFor();
  await page.getByRole('button', { name: '放大卡片', exact: true }).click();
  await page.getByRole('button', { name: '查看Other活动详情', exact: true }).click();
  await page.getByRole('heading', { name: '活动详情', exact: true }).waitFor();
  await page.getByRole('heading', { name: 'Event Two', exact: true }).waitFor();
  await page.locator('nexus-modal').getByRole('button', { name: '关闭', exact: true }).click();
  await page.locator('nexus-modal').waitFor({ state: 'detached' });
  await page.getByRole('button', { name: '活动设置', exact: true }).click();
  await choose(page.locator('nexus-select[aria-label="Game 内容进度"]'), 'jp');
  await page.locator('.activity-game-row[data-item-id="Other"] nexus-drag-handle').press('ArrowUp');
  await page.locator('nexus-modal').getByRole('button', { name: '保存', exact: true }).click();
  if (!await page.evaluate(() => window.activitySaved?.selectedFeedIds.includes('feed-jp')
    && window.activitySaved?.gameOrder?.[0] === 'Other'))
    throw new Error('Game progression/order not saved');
  await page.locator('nexus-modal').waitFor({ state: 'detached' });
  await captureViewports('activities');
  await page.evaluate(() => window.fixture.dispose());
});

await test('checkin task editor and secret draft', async () => {
  await page.evaluate(async () => {
    let state = { revision: 1, timeZoneId: 'Asia/Shanghai', tasks: [],
      platforms: [{ id: 'cn', name: '米游社', games: [{ id: 'game', name: '游戏' }],
        browserLogin: { ready: true, status: 'ready' } },
        { id: 'tajiduo', name: '塔吉多', games: [{ id: 'game', name: '游戏' }],
          browserLogin: { ready: true, status: 'ready' } }],
      notificationTasks: [{ id: 'notice', name: '测试通知', enabled: true, configured: true }] };
    await window.testMount('game-checkin', { canReveal: true, readState: async () => state,
      openEditor: async () => ({ editorSessionId: 'edit', fields: {
        cn: { configured: true, fieldGeneration: 1 }, tajiduo: { configured: false, fieldGeneration: 1 } } }),
      readEditor: async () => ({ editorSessionId: 'edit', fields: {
        cn: { configured: true, fieldGeneration: 1 }, tajiduo: { configured: false, fieldGeneration: 1 } } }),
      leaseEditor: async () => {}, closeEditor: async () => {},
      confirmReveal: async () => { window.revealGranted = true; },
      cancelBrowserLogin: async () => {},
      saveTask: async (_operationId, draft, session, secrets) => { window.savedSecrets = structuredClone(secrets); state = { ...state, revision: state.revision + 1,
        tasks: [{ ...draft, id: 'task', isRunning: false, nextRunAt: null, recentRun: null }] }; return state; },
      deleteTask: async () => state, reorderTasks: async () => state, runTask: async () => state,
      beginBrowserLogin: async () => ({ candidateId: 'candidate' }), cancelTajiduo: async () => {},
      prepareTajiduo: async () => ({ operationId: 'tajiduo' }), sendTajiduoCode: async () => {},
      loginTajiduo: async () => ({ candidateId: 'candidate', platformId: 'tajiduo' }),
      revealCredential: async () => {
        if (!window.revealGranted) throw { code: 'reveal_confirmation_required' };
        return { value: 'fixture-secret', remainingSeconds: 1 };
      },
    }, 'route');
  });
  await page.getByText('添加签到任务').click();
  await page.locator('.checkin-editor').waitFor();
  await page.locator('.checkin-editor nexus-text-input').first().locator('input').fill('每日签到');
  await choose(page.locator('nexus-select[aria-label="米游社 签到游戏"]'), 'game');
  await page.keyboard.press('Escape');
  await page.getByText('+ 添加定时').click();
  await page.getByRole('button',{name:'显示凭据',exact:true}).click();
  await confirm(page);
  await page.waitForFunction(() => [...document.querySelectorAll('.checkin-editor nexus-text-input')]
    .some(input => input.value === 'fixture-secret' && input.type === 'text'));
  if (!await page.evaluate(() => window.revealGranted)) throw new Error('Credential reveal lacked confirmation');
  await page.getByText('浏览器登录').click();
  await page.getByText('塔吉多登录').click();
  await page.locator('.checkin-login-modal').getByRole('textbox',{name:'手机号',exact:true}).fill('12345678901');
  await page.locator('.checkin-login-modal').getByRole('textbox',{name:'短信验证码',exact:true}).fill('123456');
  await page.getByText('发送验证码').click();
  await page.locator('.checkin-login-modal').getByText('登录', { exact: true }).click();
  await page.locator('.checkin-login-modal').getByRole('textbox',{name:'手机号',exact:true}).waitFor({ state: 'detached' });
  await page.getByRole('switch',{name:'启用通知',exact:true}).click();
  await page.locator('.checkin-editor').getByText('保存', { exact: true }).click();
  await page.getByText('每日签到').waitFor();
  const secrets = await page.evaluate(() => window.savedSecrets);
  if (secrets.cn?.candidateId !== 'candidate' || secrets.tajiduo?.candidateId !== 'candidate')
    throw new Error('Multi-platform login candidates not saved');
  await captureViewports('checkin');
  await page.evaluate(() => window.fixture.dispose());
});

await test('maa discovery tasks and preview', async () => {
  await page.evaluate(async () => {
    const profile = { profileId: 'profile', revision: '', packageRoot: 'D:/project', interfacePath: 'interface.json',
      nativeDirectory: '', language: 'zh_cn', controller: 'win', resource: 'main', taskOccurrences: [], options: {},
      resourceOptions: {}, controllerOptions: {}, windowSelection: 'exact_process', windowExecutable: '',
      sourceSnapshot: { compilation: { compilationFingerprint: 'a'.repeat(64) } },
      windowHandle: 0, windowProcessId: 0, windowWaitMilliseconds: 10000, adbPath: '', adbSerial: '' };
    const schema = { projectName: 'Fixture Maa', projectVersion: '1',
      controllers: [{ name: 'win', label: 'Win32', type: 'Win32' }], resources: [{ name: 'main', label: 'Main' }],
      tasks: [{ name: 'daily', label: 'Daily', defaultCheck: true, groups: ['daily-group'] }],
      groups: [{ name: 'daily-group', label: 'Daily Group' }],
      pretasks: [{ name: 'prepare', label: 'Prepare', options: ['pre'] }],
      settings: [{ name: 'advanced', label: 'Advanced', options: ['hotkey'] }],
      globalOptions: ['auth'], options: { auth: { label: 'Auth', type: 'input',
        inputs: [{ name: 'token', label: 'Token', password: true }] },
        pre: { label: 'Pre Task Option', type: 'switch', cases: [{ name: 'yes', label: 'Yes' }] },
        hotkey: { label: 'Hotkey Option', type: 'hotkey', hotkeys: [{ name: 'key', label: 'Key', default: 'F8' }] } }, presets: [] };
    await window.testMount('maa-framework', { readEditor: async () => ({ providerId: 'maa-framework', mode: 'binding', profile }),
      discover: async () => ({ interfaceCandidates: ['interface.json'], candidates: [], schema }),
      inspect: async () => ({ schema }), preview: async () => ({ ready: true }), applyPreset: async p => p,
      findWindows: async () => [], previewImport: async () => ({ details: {}, profile }),
      publishDraft: (context, next) => {
        window.publishedProfile = next;
      }, saveBinding: async () => {},
    }, 'automation.binding.editor');
  });
  await page.getByText('读取项目', { exact: true }).click();
  await page.getByText('Controller', { exact: true }).waitFor();
  await page.getByText('Pre Task Option').waitFor();
  await page.getByRole('textbox', { name: 'Hotkey Option / key', exact: true }).waitFor();
  await page.getByText('载入项目默认勾选任务').click();
  await page.locator('.maa-occurrence').getByText('daily', { exact: true }).waitFor();
  await page.locator('nexus-text-input[aria-label="Auth / token"]').locator('input').fill('fixture-token');
  await page.getByText('使用新密钥草稿').click();
  await page.waitForFunction(() => typeof window.publishedProfile?.options?.auth?.token?.$maaSecret === 'string');
  if (!await page.evaluate(() => /^input-[a-f0-9]{64}$/.test(window.publishedProfile.options.auth.token.$maaSecret)
    && !JSON.stringify(window.publishedProfile).includes('fixture-token')))
    throw new Error('Secret reference missing from Maa draft');
  await page.getByText('只读执行预览').click();
  await page.locator('.maa-output').filter({ hasText: '"ready": true' }).waitFor();
  await page.getByText('预览显式导入').click();
  await page.getByText('使用已预览映射').click();
  await confirm(page);
  await captureViewports('maa');
  await page.evaluate(() => window.fixture.dispose());
});

const { runAdditionalCases } = await import('./fixture-cases.mjs');
await runAdditionalCases({ page, test, reportRoot });
if (['game-checkin', 'maa-framework'].includes(extension)) {
  const { runRaceCases } = await import('./race-cases.mjs'); await runRaceCases({ page, test });
}
if (extension === 'game-activities') {
  const { runActivityRules } = await import('./activity-rules.mjs'); await runActivityRules({test});
  const { activitySurfaceCases } = await import('./activity-surface-cases.mjs'); await activitySurfaceCases({page,test});
  const { activityLifecycle } = await import('./activity-lifecycle.mjs'); await activityLifecycle({page,test});
  const { activityCoverCases } = await import('./activity-cover-cases.mjs'); await activityCoverCases({page,test});
}
if (extension === 'live-screenshot') await screenshotLifecycle({page,test});
if (extension === 'custom-wallpaper') {
  const { runRefreshCases } = await import('./refresh-cases.mjs'); await runRefreshCases({page,test});
}
if (extension === 'maa-framework') {
  const { maaProjectCases } = await import('./maa-project-cases.mjs'); await maaProjectCases({page,test});
}

await test('checkin repeated row updates release only their own locale listeners', async () => {
  const result = await page.evaluate(async () => (await import('/row-owner.js')).rowOwnership());
  if (!result.checks.length || result.counts.at(-1) !== 0) throw new Error('Incomplete row owner report');
  fs.writeFileSync(path.join(reportRoot, 'row-owner.json'), JSON.stringify(result, null, 2) + '\n');
});

if (extension === 'game-checkin') {
  const { checkinLayoutCases } = await import('./checkin-layout-cases.mjs');
  await checkinLayoutCases({ page, test });
  const { checkinPublicationCases } = await import('./checkin-publication-cases.mjs');
  await checkinPublicationCases({ page, test });
}

const browserVersion = browser.version();
await browser.close();
await new Promise(resolve => server.close(resolve));
for (const input of hostUiInputs) {
  if (crypto.createHash('sha256').update(fs.readFileSync(path.join(hostRoot,input.path))).digest('hex') !== input.sha256)
    failures.push({name:'Host UI source integrity',error:'Source changed during the fixture: '+input.path});
}
const runtimeArtifacts = ['ui.js','registry.js','sdk.js','row-owner.js'].map(name => ({path:name,
  sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(reportRoot,name))).digest('hex')}));
const fixtureHash = crypto.createHash('sha256');
for (const file of ['fixture.mjs', 'checkin-row-owner.ts', 'fixture-cases.mjs', 'checkin-editor-cases.mjs', 'checkin-publication-cases.mjs', 'checkin-layout-cases.mjs', 'maa-editor-cases.mjs', 'maa-project-cases.mjs', 'maa-script-cases.mjs', 'locale-cases.mjs', 'race-cases.mjs', 'activity-rules.mjs', 'activity-surface-cases.mjs', 'activity-lifecycle.mjs', 'activity-cover-cases.mjs', 'screenshot-lifecycle.mjs', 'refresh-cases.mjs', 'controls.mjs'])
  fixtureHash.update(fs.readFileSync(path.join(repository, 'tests/frontend', file)));
if (!checks.length) failures.push({name:'selection',error:'Unknown scenario or zero selected cases'});
const result = { extension, scenario, status: failures.length ? 'FAIL' : 'PASS', scope: 'contract-only browser fixture',
  sourceMode: 'local-uncommitted', sourceCommit: null, sourceTree: null,
  sourceHash: buildReceipt.sourceHash, fixtureHash: fixtureHash.digest('hex'), artifacts: buildReceipt.artifacts,
  hostUiInputs, runtimeArtifacts,
  browser: { executable: browserExecutable, version: browserVersion }, command: process.argv.join(' '),
  exitCode: failures.length ? 1 : 0, milliseconds: Date.now() - startedAt, checks, failures };
fs.writeFileSync(path.join(reportRoot, 'result.json'), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result));
if (failures.length) process.exitCode = 1;
