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
    : { projectName: "Owned PI", projectVersion: "1", controller: [], resource: [], task: [], option: {} };
  const section = registrations.find(item => item.slot === "scripts.editor.sections");
  const element = document.createElement("div"); document.body.append(element);
  const context = { executionProviderId: "maa-framework", executionProviderConfigId: "owned-profile",
    primaryId: "owned-script", packageRoot: "C:/owned/fixture", mode: "edit" };
  let cleanup;
  try {
    cleanup = section.renderer({ element, context });
    if (typeof cleanup !== "function" || !resolveProfile) fail("Maa profile renderer lifecycle missing");
    const defaults = [...element.querySelectorAll("nxp-button")].find(item => item.textContent === "载入项目默认勾选任务");
    if (!defaults) fail("Maa default selection action missing");
    defaults.dispatchEvent(new Event("click")); await flushDom();
    if (toasts.at(-1)?.tone !== "error") fail("Maa action validation did not emit an error toast");
    const pathInput = [...element.querySelectorAll("nxp-text-input")].find(item => item.modelValue === "interface.json");
    if (!pathInput) fail("Maa interface input missing");
    pathInput.dispatchEvent(new CustomEvent("update:modelValue", { detail: ["edited.json"] }));
    resolveProfile({ profileId: "owned-profile", interfacePath: "stale.json" });
    await flushDom();
    if (pathInput.modelValue !== "edited.json" || !pathInput.isConnected) fail("Maa delayed profile load overwrote the edited draft");
    const inspect = [...element.querySelectorAll("nxp-button")].find(item => item.textContent === "读取项目");
    inspect.dispatchEvent(new Event("click")); await flushDom();
    if (!toasts.at(-1)?.message.includes("Owned PI") || toasts.at(-1)?.tone !== "info") fail("Maa readonly inspect did not emit its result toast");
    if (element.textContent.includes("Owned PI")) fail("Maa transient feedback remained in the form");
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
  } finally {
    cleanup?.(); element.remove(); host.api.post = originalPost; host.ui.toast = originalToast;
  }
}
