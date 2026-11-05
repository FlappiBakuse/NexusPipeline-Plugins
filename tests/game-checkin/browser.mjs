import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { browserCases } from './browser-cases.mjs';

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) args.set(process.argv[index], process.argv[index + 1]);
for (const name of ['--host-root', '--work-root', '--bundles', '--view-model', '--output'])
  if (!path.isAbsolute(args.get(name) ?? '')) throw Error(`Pass absolute ${name}`);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), output = args.get('--output');
const expectedChecks = Number(args.get('--case-limit') ?? 12);
if (!Number.isInteger(expectedChecks) || expectedChecks < 1 || expectedChecks > 12) throw Error('Invalid explicit case limit');
fs.mkdirSync(output, { recursive: true });
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const receiptBytes = fs.readFileSync(path.join(args.get('--bundles'), 'build-receipt.json')), receipt = JSON.parse(receiptBytes);
for (const input of receipt.sdkSourceRecords)
  if (sha(fs.readFileSync(path.join(args.get('--host-root'), input.path))) !== input.sha256) throw Error('SDK sources differ from frontend receipt');
for (const artifact of receipt.artifacts.filter(item => item.path.startsWith('game-checkin/')))
  if (sha(fs.readFileSync(path.join(args.get('--bundles'), artifact.path))) !== artifact.sha256) throw Error('CheckIn bundle identity differs');
const { build } = await import(pathToFileURL(path.join(args.get('--work-root'), 'node_modules/esbuild/lib/main.js')).href);
for (const [source, target] of [['apps/web/src/ui/register-elements.ts', 'ui.js'], ['sdk/frontend/src/index.ts', 'sdk.js']])
  await build({ entryPoints: [path.join(args.get('--host-root'), source)], outfile: path.join(output, target), bundle: true,
    format: 'esm', platform: 'browser', target: 'es2022', plugins: [{ name: 'sdk', setup(plugin) {
      plugin.onResolve({ filter: /^@nexuspipeline\/extension-sdk$/ }, () => ({ path: path.join(args.get('--host-root'), 'sdk/frontend/src/index.ts') }));
    } }] });
const routes = new Map([['/ui.js', path.join(output, 'ui.js')], ['/sdk.js', path.join(output, 'sdk.js')],
  ['/plugin.js', path.join(args.get('--bundles'), 'game-checkin/main.js')], ['/plugin.css', path.join(args.get('--bundles'), 'game-checkin/main.css')],
  ['/fixture.js', path.join(root, 'tests/game-checkin/browser-fixture.mjs')], ['/model.json', args.get('--view-model')]]);
const server = http.createServer((request, response) => {
  const route = new URL(request.url, 'http://localhost').pathname;
  if (route === '/') {
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.end('<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><link rel="stylesheet" href="/plugin.css"><style>body{margin:16px;background:#101722;color:#edf2ff;font:14px system-ui;--nx-color-surface:#202737;--nx-color-surface-secondary:#252e40;--nx-color-border:#414b60;--nx-color-text:#edf2ff;--nx-color-muted:#a9b4ca;--input-bg:#1c2433}</style></head><body><main id="app"></main><script type="module" src="/fixture.js"></script></body></html>');
  } else if (routes.has(route)) {
    response.setHeader('Content-Type', route.endsWith('.json') ? 'application/json' : route.endsWith('.css') ? 'text/css' : 'text/javascript');
    response.end(fs.readFileSync(routes.get(route)));
  } else { response.statusCode = 404; response.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const { chromium } = await import(pathToFileURL(path.join(args.get('--work-root'), 'node_modules/playwright-core/index.mjs')).href);
fs.mkdirSync(path.join(output, 'process-temp'), { recursive: true }); process.env.TEMP = process.env.TMP = path.join(output, 'process-temp');
const checks = [], errors = []; let browser, phase = 'launch'; const started = Date.now();
try {
  browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, timezoneId: 'America/New_York' }); page.setDefaultTimeout(10000);
  const origin = `http://127.0.0.1:${server.address().port}`;
  await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  page.on('pageerror', error => errors.push(String(error))); phase = 'cases'; await page.goto(origin); await page.waitForFunction(() => window.mountFixture);
  await browserCases(page, checks, output, expectedChecks);
} catch (error) { errors.push(String(error)); }
finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
const status = phase === 'launch' ? 'NOT_RUN' : checks.length === expectedChecks && checks.every(check => check.status === 'PASS') && !errors.length ? 'PASS' : 'FAIL';
const result = { status, scope: 'Production createFrontend + real SDK ExtensionScope and real P2 controls with synthetic authenticated Host transport; not installed Host, real account, login or sign-in qualification',
  contractFingerprint: receipt.contractFingerprint, sourceHash: receipt.sourceHash, bundleReceiptSha256: sha(receiptBytes), command: process.argv,
  inputs: ['browser.mjs', 'browser-cases.mjs', 'browser-fixture.mjs'].map(file => ({ path: `tests/game-checkin/${file}`, sha256: sha(fs.readFileSync(path.join(root, 'tests/game-checkin', file))) })),
  viewModelSha256: sha(fs.readFileSync(args.get('--view-model'))), expectedChecks, milliseconds: Date.now() - started, checks, errors };
result.compiledUiSha256 = sha(fs.readFileSync(path.join(output, 'ui.js')));
result.compiledSdkSha256 = sha(fs.readFileSync(path.join(output, 'sdk.js')));
result.sdkSourceRecords = receipt.sdkSourceRecords;
fs.writeFileSync(path.join(output, 'receipt.json'), JSON.stringify(result, null, 2) + '\n'); console.log(JSON.stringify(result));
process.exitCode = status === 'PASS' ? 0 : 1;
