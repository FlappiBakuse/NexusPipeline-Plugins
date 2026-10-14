import { fail } from "../contract.mjs";
import { flushDom } from "../support/dom.mjs";

export async function assertMaaRenderer(host, registrations) {
  const originalPost = host.api.post;
  const originalToast = host.ui.toast;
  const toasts = [];
  host.ui.toast = (message, tone = "info") => toasts.push({ message, tone });
  let resolveProfile;
  host.api.post = async route => route === "profile"
    ? await new Promise(resolve => { resolveProfile = resolve; })
    : { interfacePath: "interface.json", candidates: [{ id: "owned-source", name: "Owned source", kind: "mfa" }],
      schema: { projectName: "Owned PI", projectVersion: "1", controller: [], resource: [], task: [], option: {} } };
  const section = registrations.find(item => item.slot === "scripts.editor.sections");
  const element = document.createElement("div"); document.body.append(element);
  const context = { executionProviderId: "maa-framework", executionProviderConfigId: "owned-profile",
    primaryId: "owned-script", packageRoot: "C:/owned/fixture", mode: "edit" };
  let cleanup;
  try {
    cleanup = section.renderer({ element, context });
    if (typeof cleanup !== "function" || !resolveProfile) fail("Maa profile renderer lifecycle missing");
    if (element.querySelectorAll("nxp-text-input").length) fail("Maa normal flow exposed technical fields");
    const advanced = [...element.querySelectorAll("nxp-button")].find(item => item.textContent === "高级设置");
    if (!advanced) fail("Maa advanced settings action missing");
    advanced.dispatchEvent(new Event("click")); await flushDom();
    const pathInput = [...element.querySelectorAll("nxp-text-input")].find(item => item.modelValue === "interface.json");
    if (!pathInput) fail("Maa interface input missing");
    pathInput.dispatchEvent(new CustomEvent("update:modelValue", { detail: ["edited.json"] }));
    resolveProfile({ profileId: "owned-profile", interfacePath: "stale.json" });
    await flushDom();
    if (pathInput.modelValue !== "edited.json" || !pathInput.isConnected) fail("Maa delayed profile load overwrote the edited draft");
    const inspect = [...element.querySelectorAll("nxp-button")].find(item => item.textContent === "重新查找来源");
    if (!inspect) fail("Maa source refresh action missing");
    inspect.dispatchEvent(new Event("click")); await flushDom();
    if (!element.textContent.includes("Owned source")) fail("Maa discovered source summary missing");
    host.api.post = async () => { throw new Error("Owned API failure"); };
    inspect.dispatchEvent(new Event("click")); await flushDom();
    if (toasts.at(-1)?.message !== "Owned API failure" || toasts.at(-1)?.tone !== "error") fail("Maa request failure did not emit an error toast");
    const beforeAbort = toasts.length;
    host.api.post = async () => { throw new DOMException("Owned abort", "AbortError"); };
    inspect.dispatchEvent(new Event("click")); await flushDom();
    if (toasts.length !== beforeAbort) fail("Maa aborted request emitted a toast");
    host.api.post = async () => await new Promise(resolve => { resolveProfile = resolve; });
    inspect.dispatchEvent(new Event("click")); await flushDom();
    cleanup(); cleanup = null;
    resolveProfile({ projectName: "Disposed project", projectVersion: "1" }); await flushDom();
    if (toasts.length !== beforeAbort) fail("Maa disposed renderer emitted delayed feedback");
    if (element.childElementCount !== 0) fail("Maa renderer did not remove its card");
    cleanup = section.renderer({ element, context });
    cleanup(); cleanup = null;
    resolveProfile({ profileId: "owned-profile", interfacePath: "late.json" });
    await flushDom();
    if (element.childElementCount !== 0) fail("Maa disposed renderer applied a delayed response");
    const draft = { schemaVersion: 3, profileId: "owned-profile", packageRoot: context.packageRoot, interfacePath: "interface.json",
      nativeDirectory: "", nativeVersion: "", language: "zh_cn", controller: "", resource: "", options: {}, resourceOptions: {},
      controllerOptions: {}, controllerConfiguration: {}, taskOptions: {}, selectedTasks: [], taskOccurrences: [
        { occurrenceId: "a", piTaskName: "Task A", enabled: true, repeatCount: 1, options: {} },
        { occurrenceId: "b", piTaskName: "Task B", enabled: true, repeatCount: 1, options: {} }] };
    host.api.post = async route => route === "profile" ? structuredClone(draft) : { interfacePath: "interface.json",
      candidates: [{ id: "owned-source", name: "Owned source", kind: "mfa" }],
      schema: { controller: [], resource: [], task: [], option: {}, preset: [] } };
    let configured;
    const receive = event => { configured = event.detail; };
    element.addEventListener("nxp-provider-configured", receive);
    cleanup = section.renderer({ element, context }); await flushDom();
    [...element.querySelectorAll("nxp-button")].find(item => item.textContent === "高级设置").dispatchEvent(new Event("click"));
    await flushDom();
    const switches = element.querySelectorAll("nxp-switch");
    if (switches.length !== 2) fail("Maa task controls must use the public switch");
    switches[0].dispatchEvent(new CustomEvent("update:modelValue", { detail: [false] }));
    if (configured.configuration.profile.taskOccurrences[0].enabled !== false) fail("Maa task toggle did not publish the draft");
    element.querySelector("nxp-sortable-list").dispatchEvent(new CustomEvent("reorder", { detail: [["b", "a"]] }));
    if (configured.configuration.profile.taskOccurrences.map(item => item.occurrenceId).join() !== "b,a") fail("Maa reorder did not publish the draft");
    [...element.querySelectorAll("nxp-button")].find(item => item.textContent === "移除").dispatchEvent(new Event("click"));
    if (configured.configuration.profile.taskOccurrences.length !== 1) fail("Maa task removal did not publish the draft");
    element.removeEventListener("nxp-provider-configured", receive);
    cleanup(); cleanup = null;
    const bindingSection = registrations.find(item => item.slot === 'users.binding.sections');
    const calls = [];
    host.api.post = async (route, body) => {
      calls.push({ route, body });
      return route === 'profile' ? structuredClone(draft) : route === 'preview'
        ? { project: { executionFingerprint: 'reviewed' } } : { controller: [], resource: [], task: [], option: {} };
    };
    let userSave;
    const receiveUser = event => { userSave = event.detail; };
    element.addEventListener('nxp-provider-user-save', receiveUser);
    cleanup = bindingSection.renderer({ element, context: { ...context, mode: 'binding', secondaryId: 'owned-user', userConfigRevision: 'owned-user-revision' } });
    await flushDom();
    const click = label => [...element.querySelectorAll('nxp-button')].find(item => item.textContent === label).dispatchEvent(new Event('click'));
    click('只读执行预览'); await flushDom();
    click('保存用户配置'); await flushDom();
    const confirmation = element.querySelector('nxp-confirm-dialog');
    if (!confirmation || userSave) fail('Maa user initialization must wait for the public confirmation');
    confirmation.dispatchEvent(new Event('confirm')); await flushDom();
    if (!userSave?.configuration?.profile || calls.some(item => item.route === 'authorize')) fail('Maa user save must request Host initialization');
    if (userSave.expectedUserRevision !== 'owned-user-revision') fail('Maa user save must preserve the editor revision for CAS');
    if (calls.find(item => item.route === 'profile').body.userRevision !== 'owned-user-revision') fail('Maa user profile load must use the committed binding revision');
    element.removeEventListener('nxp-provider-user-save', receiveUser);
  } finally {
    cleanup?.(); element.remove(); host.api.post = originalPost; host.ui.toast = originalToast;
  }
}
