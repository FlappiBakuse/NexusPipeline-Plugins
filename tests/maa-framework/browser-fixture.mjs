import { registerElements } from '/ui.js';
import { ExtensionScope } from '/sdk.js';
import { createFrontend } from '/plugin.js';

registerElements();
const model = await (await fetch('/model.json')).json();
let revision = 2;
window.writes = [];
const transport = {
  connectionKind: 'remote',
  async project(context, action, input, signal, operationId) {
    signal.throwIfAborted();
    if (context.entityId !== model.bindingId || context.instanceId !== model.instanceId) throw Error('fixture_context_unbound');
    if (action === 'context') return { providerId: 'maa-framework', compilerId: 'project', scriptName: 'Maa 重复任务项目',
      bindingRevision: 7, selectionRevision: revision, selection: null };
    if (action === 'discover') return { Interfaces: ['interface.json', 'assets/interface.json'], SelectedInterface: null,
      Sources: [{ Id: 'local-a', Kind: 'mfa', Path: 'config/instances/a.json', InstanceId: 'a', Name: '同名实例' },
        { Id: 'local-b', Kind: 'mfa', Path: 'config/instances/b.json', InstanceId: 'b', Name: '同名实例' }] };
    if (action === 'select') {
      window.writes.push({ input: structuredClone(input), operationId });
      return { operationId, revision: ++revision, isNew: true };
    }
    if (action === 'preview') {
      if (input.selection?.Source?.InstanceId !== 'b' || input.selection.InterfacePath !== 'interface.json')
        throw Error('fixture_preview_source_unbound');
      if (window.mode === 'late') await new Promise(resolve => { window.late = resolve; });
      window.previewId = crypto.randomUUID();
      return { previewId: window.previewId, expiresAt: new Date(Date.now() + 120000).toISOString(), rootIndex: 'editor-index',
        fingerprint: 'a'.repeat(64), canExecute: false, assets: model.assets };
    }
    if (action === 'page') {
      if (!window.previewId || input.previewId !== window.previewId || !model.pages[input.asset]) throw Error('fixture_page_unbound');
      const asset = model.assets.find(item => item.name === input.asset);
      return { name: input.asset, sha256: window.mode === 'tamper' && asset.kind === 'page' ? '0'.repeat(64) : asset.sha256,
        contentBase64: model.pages[input.asset] };
    }
    if (action === 'release') {
      window.releasedId = input.previewId;
      return { released: true };
    }
    throw Error('fixture_action_unknown');
  },
  invoke() { throw Error('unexpected_plugin_handler'); }, upload() { throw Error('unexpected_upload'); },
  image() { throw Error('unexpected_image'); }, preview() { throw Error('unexpected_target_preview'); }, subscribe() { return () => {}; }
};
const scope = new ExtensionScope(), extension = createFrontend(transport);
let contribution;
await extension.activate({ extensionId: extension.extensionId, scope, locale: 'zh-CN', appearance: 'dark',
  registerSurface(value) { if (value.target === 'automation.binding.editor') contribution = value; },
  registerRoute() {}, registerStyle() {}, onLocaleChanged: () => () => {}, translate: text => text });
const context = Object.freeze({ surfaceId: 'automation.binding.editor', instanceId: model.instanceId, entityId: model.bindingId });
const surface = { element: document.querySelector('#app'), context, scope, signal: scope.signal, visible: true,
  onVisibilityChanged() { return () => {}; }, setAppearance() {} };
const cleanup = await contribution.mount(surface);
window.disposeFixture = async () => { cleanup?.(); await scope.dispose(); };
