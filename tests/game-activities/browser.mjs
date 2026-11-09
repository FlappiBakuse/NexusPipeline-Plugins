import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { browserCases } from './browser-cases.mjs';

const options = new Map();
for (let index = 2; index < process.argv.length; index += 2) options.set(process.argv[index], process.argv[index + 1]);
for (const name of ['--host-root', '--work-root', '--bundles', '--view-model', '--output'])
  if (!path.isAbsolute(options.get(name) ?? '')) throw Error(`Pass absolute ${name}`);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const host = options.get('--host-root'), work = options.get('--work-root'), bundles = options.get('--bundles');
const output = options.get('--output'); fs.mkdirSync(output, { recursive: true });
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const receipt = JSON.parse(fs.readFileSync(path.join(bundles, 'build-receipt.json')));
for (const artifact of receipt.artifacts.filter(item => item.path.startsWith('game-activities/')))
  if (sha(fs.readFileSync(path.join(bundles, artifact.path))) !== artifact.sha256) throw Error('Bundle identity changed');
const { build } = await import(pathToFileURL(path.join(work, 'node_modules/esbuild/lib/main.js')).href);
for (const [source, target] of [['apps/web/src/ui/register-elements.ts', 'ui.js'], ['sdk/frontend/src/index.ts', 'sdk.js']])
  await build({ entryPoints: [path.join(host, source)], outfile: path.join(output, target), bundle: true,
    format: 'esm', platform: 'browser', target: 'es2022', plugins: [{ name: 'sdk', setup(plugin) {
      plugin.onResolve({ filter: /^@nexuspipeline\/extension-sdk$/ }, () => ({ path: path.join(host, 'sdk/frontend/src/index.ts') }));
    } }] });
const routes = new Map([['/ui.js', path.join(output, 'ui.js')], ['/sdk.js', path.join(output, 'sdk.js')],
  ['/plugin.js', path.join(bundles, 'game-activities/main.js')], ['/plugin.css', path.join(bundles, 'game-activities/main.css')],
  ['/model.json', options.get('--view-model')]]);
const server = http.createServer((request, response) => {
  const route = new URL(request.url, 'http://localhost').pathname;
  if (route === '/') {
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.end('<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><link rel="stylesheet" href="/plugin.css"><style>body{margin:16px;background:#101722;color:#edf2ff;font:14px system-ui;--nx-color-surface:#202737;--nx-color-surface-secondary:#252e40;--nx-color-border:#414b60;--nx-color-text:#edf2ff;--nx-color-muted:#a9b4ca;--input-bg:#1c2433}</style></head><body><main id="app"></main></body></html>');
  } else if (routes.has(route)) {
    response.setHeader('Content-Type', route.endsWith('.json') ? 'application/json' : route.endsWith('.css') ? 'text/css' : 'text/javascript');
    response.end(fs.readFileSync(routes.get(route)));
  } else { response.statusCode = 404; response.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const { chromium } = await import(pathToFileURL(path.join(work, 'node_modules/playwright-core/index.mjs')).href);
fs.mkdirSync(path.join(output, 'process-temp'), { recursive: true }); process.env.TEMP = process.env.TMP = path.join(output, 'process-temp');
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, timezoneId: 'America/New_York' });
const checks = [], errors = []; const started = Date.now(); page.setDefaultTimeout(10000);
page.on('pageerror', error => errors.push(String(error)));
await page.goto(`http://127.0.0.1:${server.address().port}/`);
try { await browserCases(page, checks, output); }
finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
const passed = checks.length > 0 && checks.every(item => item.status === 'PASS') && !errors.length;
const result = { status: passed ? 'PASS' : 'FAIL',
  scope: 'Production createFrontend with real P2 controls and SDK ExtensionScope; fake authenticated Host transport, not installed Host',
  command: process.argv, exitCode: passed ? 0 : 1,
  milliseconds: Date.now() - started, contractFingerprint: receipt.contractFingerprint, buildSourceHash: receipt.sourceHash,
  inputs: ['browser.mjs', 'browser-cases.mjs'].map(file => ({ file, sha256: sha(fs.readFileSync(path.join(root, 'tests/game-activities', file))) })),
  modelSha256: sha(fs.readFileSync(options.get('--view-model'))), checks, errors };
fs.writeFileSync(path.join(output, 'receipt.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result)); process.exitCode = result.exitCode;
