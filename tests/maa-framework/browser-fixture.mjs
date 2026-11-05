import { registerElements } from '/ui.js';
import { ExtensionScope } from '/sdk.js';
import { createFrontend } from '/plugin.js';

registerElements();
const model = await (await fetch('/model.json')).json();
window.calls = []; window.mode = ''; window.late = null;
let sequence = 0, currentId = '', contribution, scope;
const transport = {
  connectionKind: 'remote',
  async project(context, action, input, signal, operationId) {
    signal.throwIfAborted(); window.calls.push({ action, input: structuredClone(input), operationId });
    if (context.entityId !== model.bindingId || context.instanceId !== model.instanceId) throw Error('fixture_context_unbound');
    if (action === 'context') return { providerId: 'maa-framework', compilerId: 'project', scriptName: 'Maa 重复任务项目',
      bindingRevision: 7, selectionRevision: 2, selection: null };
    if (action === 'discover') return { Interfaces: ['interface.json', 'assets/interface.json'], SelectedInterface: null,
      Sources: [{ Id: 'local-a', Kind: 'mfa', Path: 'config/instances/a.json', InstanceId: 'a', Name: '同名实例' },
        { Id: 'local-b', Kind: 'mfa', Path: 'config/instances/b.json', InstanceId: 'b', Name: '同名实例' }] };
    if (action === 'select') {
      if (!operationId || input.expectedBindingRevision !== 7 || input.expectedSelectionRevision !== 2) throw Error('fixture_save_unbound');
      if (window.mode === 'uncertain') throw Object.assign(Error('write_outcome_unknown'), { uncertain: true });
      return { operationId, revision: 3, isNew: true };
    }
    if (action === 'preview') {
      if (window.mode === 'late') await new Promise(resolve => { window.late = resolve; });
      currentId = `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`;
      return { previewId: currentId, expiresAt: new Date(Date.now() + 120000).toISOString(), rootIndex: 'editor-index',
        fingerprint: 'a'.repeat(64), canExecute: false, assets: model.assets };
    }
    if (action === 'page') {
      if (input.previewId !== currentId || !model.pages[input.asset]) throw Error('fixture_page_unbound');
      const asset = model.assets.find(item => item.name === input.asset);
      return { name: input.asset, sha256: window.mode === 'tamper' ? '0'.repeat(64) : asset.sha256, contentBase64: model.pages[input.asset] };
    }
    if (action === 'release') return { released: true };
    throw Error('fixture_action_unknown');
  },
  invoke() { throw Error('unexpected_plugin_handler'); }, upload() { throw Error('unexpected_upload'); },
  image() { throw Error('unexpected_image'); }, preview() { throw Error('unexpected_target_preview'); }, subscribe() { return () => {}; }
};
window.mountFixture = async () => {
  await window.disposeFixture?.(); document.querySelector('#app').replaceChildren(); window.calls = []; window.mode = '';
  scope = new ExtensionScope(); const extension = createFrontend(transport);
  await extension.activate({ extensionId: extension.extensionId, scope, locale: 'zh-CN', appearance: 'dark',
    registerSurface(value) { if (value.target === 'automation.binding.editor') contribution = value; },
    registerRoute() {}, registerStyle() {}, translate: text => text });
  const element = document.createElement('div'); document.querySelector('#app').append(element);
  const surface = { get element() { return element; },
    get context() { return { surfaceId: 'automation.binding.editor', instanceId: model.instanceId, entityId: model.bindingId }; },
    get scope() { return scope; }, get signal() { return scope.signal; }, get visible() { return true; },
    onVisibilityChanged() { return () => {}; }, setAppearance() {} };
  const cleanup = await contribution.mount(surface);
  window.disposeFixture = async () => { cleanup?.(); await scope.dispose(); };
};
