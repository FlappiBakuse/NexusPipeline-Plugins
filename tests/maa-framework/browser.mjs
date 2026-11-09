import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { browserCases } from './browser-cases.mjs';

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) args.set(process.argv[index], process.argv[index + 1]);
for (const name of ['--host-root', '--work-root', '--bundles', '--output'])
  if (!path.isAbsolute(args.get(name) ?? '')) throw Error('Pass absolute ' + name);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), output = args.get('--output');
if (fs.existsSync(path.join(output, 'receipt.json'))) throw Error('Keep the previous immutable browser report');
fs.mkdirSync(output, { recursive: true });
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const receiptBytes = fs.readFileSync(path.join(args.get('--bundles'), 'build-receipt.json')), receipt = JSON.parse(receiptBytes);
if (receipt.status !== 'PASS') throw Error('Frontend build did not pass');
for (const item of receipt.inputs)
  if (sha(fs.readFileSync(path.join(root, item.path))) !== item.sha256) throw Error('Frontend source changed');
for (const item of receipt.sdkSourceRecords)
  if (sha(fs.readFileSync(path.join(args.get('--host-root'), item.path))) !== item.sha256) throw Error('SDK source changed');
for (const item of receipt.artifacts)
  if (sha(fs.readFileSync(path.join(args.get('--bundles'), item.path))) !== item.sha256) throw Error('Frontend bundle changed');
const esbuild = await import(pathToFileURL(path.join(args.get('--work-root'), 'node_modules/esbuild/lib/main.js')).href);
for (const [source, target] of [['apps/web/src/ui/register-elements.ts', 'ui.js'], ['sdk/frontend/src/index.ts', 'sdk.js']])
  await esbuild.build({ entryPoints: [path.join(args.get('--host-root'), source)], outfile: path.join(output, target),
    bundle: true, format: 'esm', platform: 'browser', target: 'es2022', plugins: [{ name: 'sdk', setup(plugin) {
      plugin.onResolve({ filter: /^@nexuspipeline\/extension-sdk$/ }, () => ({ path: path.join(args.get('--host-root'), 'sdk/frontend/src/index.ts') }));
    } }] });
const model = { instanceId: '00000000-0000-4000-8000-000000000001', bindingId: '00000000-0000-4000-8000-000000000002', assets: [], pages: {} };
function asset(kind, value) {
  const bytes = Buffer.from(JSON.stringify(value)), hash = sha(bytes);
  const name = kind === 'index' ? 'editor-index' : 'editor-page-' + hash;
  model.assets.push({ name, kind, sizeBytes: bytes.length, sha256: hash }); model.pages[name] = bytes.toString('base64');
  return { sha256: hash, bytes: bytes.length, count: value.length };
}
const inline = value => ({ kind: 'inline', value });
const taskName = '重复任务 🌌';
const pages = [0, 1].map(index => asset('page', [
  inline({ Id: 'row-' + index, SourceId: 'original-' + index, Name: taskName, Order: index, Enabled: true, RepeatCount: 1, Options: {} })
]));
asset('index', { format: 'maa.editor.index', version: 1, compilation: { canExecute: false },
  selection: { InterfacePath: 'interface.json', Language: 'zh_cn', Source: { Kind: 'mfa', InstanceId: 'b', Path: 'config/instances/b.json' } },
  schema: inline({ controller: [{ name: 'primary' }, { name: 'alternate' }], resource: [{ name: 'base' }],
    task: [{ name: taskName }], option: {} }), translations: inline({}),
  configurationBindings: inline([]), diagnostics: inline([{ code: 'maa_enabled_task_unmapped', severity: 'blocking' }]),
  profile: { Controller: 'primary', Resource: 'base', Tasks: { kind: 'array', count: pages.length, pages },
    Pretasks: inline([]), GlobalOptions: inline({}), ResourceOptions: inline({}), ControllerOptions: inline({}) } });
fs.writeFileSync(path.join(output, 'model.json'), JSON.stringify(model));
const routes = new Map([['/ui.js', path.join(output, 'ui.js')], ['/sdk.js', path.join(output, 'sdk.js')],
  ['/plugin.js', path.join(args.get('--bundles'), 'maa-framework/main.js')], ['/plugin.css', path.join(args.get('--bundles'), 'maa-framework/main.css')],
  ['/fixture.js', path.join(root, 'tests/maa-framework/browser-fixture.mjs')], ['/model.json', path.join(output, 'model.json')]]);
const server = http.createServer((request, response) => {
  const route = new URL(request.url, 'http://localhost').pathname;
  if (route === '/') {
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.end('<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><link rel="stylesheet" href="/plugin.css"><style>body{margin:16px;background:#101722;color:#edf2ff;font:14px system-ui;--nx-color-surface:#202737;--nx-color-border:#414b60;--nx-color-text:#edf2ff;--nx-color-muted:#a9b4ca;--input-bg:#1c2433}</style></head><body><main id="app"></main><script type="module" src="/fixture.js"></script></body></html>');
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
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } }); page.setDefaultTimeout(10000);
  const origin = `http://127.0.0.1:${server.address().port}`;
  await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  page.on('pageerror', error => errors.push(String(error))); phase = 'cases'; await page.goto(origin); await page.waitForFunction(() => window.disposeFixture);
  await browserCases(page, checks, output);
} catch (error) { errors.push(String(error)); }
finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
const passed = checks.length > 0 && checks.every(check => check.status === 'PASS') && !errors.length;
const status = phase === 'launch' ? 'NOT_RUN' : passed ? 'PASS' : 'FAIL';
const result = { status, scope: 'Actual production Maa frontend, SDK scope and Host elements with controlled project transport; not installed provider or real execution',
  contractFingerprint: receipt.contractFingerprint, sourceHash: receipt.sourceHash, bundleReceiptSha256: sha(receiptBytes), command: process.argv,
  inputs: ['browser.mjs', 'browser-cases.mjs', 'browser-fixture.mjs'].map(file => ({ path: 'tests/maa-framework/' + file, sha256: sha(fs.readFileSync(path.join(root, 'tests/maa-framework', file))) })),
  viewModelSha256: sha(fs.readFileSync(path.join(output, 'model.json'))), milliseconds: Date.now() - started, checks, errors };
fs.writeFileSync(path.join(output, 'receipt.json'), JSON.stringify(result, null, 2) + '\n'); console.log(JSON.stringify(result));
process.exitCode = status === 'PASS' ? 0 : 1;
