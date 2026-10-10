import path from "node:path";
import { stat, readdir, readFile } from "node:fs/promises";

export const FRONTEND_API_VERSION = "1.7";

export const allowedSlots = new Set([
  "dashboard.cards",
  "dashboard.after-running",
  "users.list.badges",
  "users.binding.sections",
  "users.global.sections",
  "scripts.list.badges",
  "scripts.editor.sections",
  "queues.list.badges",
  "queues.editor.sections",
  "dispatch.cards",
  "dispatch.running.badges",
  "dispatch.running.sidecar",
  "dispatch.run.sections",
  "history.list.badges",
  "history.detail.sections",
  "settings.sections",
  "settings.cards",
  "shell.nav",
]);

export const hostPrivateClasses = new Set([
  "badge",
  "content-card",
  "eyebrow",
  "field",
  "field-label",
  "form-grid",
  "ghost",
  "muted",
  "page-head",
  "page-head-actions",
  "page-head-copy",
  "page-kicker",
  "plugin-surface",
  "primary",
  "req",
  "secondary-surface",
  "section-surface",
  "settings-card",
  "settings-card-arrow",
  "settings-card-body",
  "settings-card-copy",
  "settings-card-title",
  "settings-card-toggle",
  "settings-list",
  "switch-copy",
  "switch-row",
  "tertiary",
]);

export const scannableExtensions = new Set([".css", ".html", ".js", ".ts", ".vue"]);

export function fail(message) {
  throw new Error(message);
}

export function safeRelative(root, value, label, suffix) {
  if (typeof value !== "string" || !value.trim()) fail(`${label} 不能为空`);
  const normalized = value.trim().replaceAll("\\", "/");
  const parts = normalized.split("/");
  if (normalized.startsWith("/") || /^[A-Za-z]:\//.test(normalized)
    || parts.some(part => !part || part === "." || part === "..")) {
    fail(`${label} 必须是插件目录内的安全相对路径：${value}`);
  }
  if (!normalized.toLowerCase().endsWith(suffix)) fail(`${label} 必须使用 ${suffix} 扩展名：${value}`);
  const candidate = path.resolve(root, ...parts);
  const relative = path.relative(root, candidate);
  if (relative.startsWith("..") || path.isAbsolute(relative)) fail(`${label} 越出插件目录：${value}`);
  return candidate;
}

export async function isFile(filePath) {
  try {
    return (await stat(filePath)).isFile();
  } catch {
    return false;
  }
}

export async function collectSourceFiles(directory) {
  const result = [];
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return result;
  }
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await collectSourceFiles(fullPath));
    else if (entry.isFile() && scannableExtensions.has(path.extname(entry.name).toLowerCase())) result.push(fullPath);
  }
  return result;
}

export async function resolvePublicElements(hostRoot) {
  const candidates = [
    hostRoot ? path.join(hostRoot, "frontend", "src", "ui", "register.ts") : "",
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (!await isFile(candidate)) continue;
    const text = await readFile(candidate, "utf8");
    const block = /NEXUS_PUBLIC_ELEMENTS\s*=\s*\{([\s\S]*?)\}/.exec(text);
    if (!block) continue;
    const names = [...block[1].matchAll(/"([a-z0-9-]+)"\s*:/g)].map(match => match[1]);
    if (names.length) return new Set(names);
  }
  fail("缺少宿主公共元素注册表；请检出锁定或候选宿主并传入 --host-root。");
}

export function cssClassTokens(text) {
  return new Set([...text.matchAll(/\.(-?[A-Za-z_][\w-]*)/g)].map(match => match[1]));
}

export function markupClassTokens(text) {
  const tokens = new Set();
  const patterns = [
    /class\s*[:=]\s*"([^"]*)"/g,
    /class\s*[:=]\s*'([^']*)'/g,
    /className\s*[:=]\s*"([^"]*)"/g,
    /classList\.(?:add|remove|toggle)\(\s*"([^"]*)"/g,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      for (const token of match[1].split(/\s+/)) {
        if (token) tokens.add(token);
      }
    }
  }
  return tokens;
}

export function usedElementNames(text) {
  const names = new Set();
  const patterns = [
    /<(nxp-[a-z0-9-]+)/g,
    /createElement[A-Za-z]*\(\s*["'](nxp-[a-z0-9-]+)["']/g,
    /querySelector(?:All)?\(\s*["'](nxp-[a-z0-9-]+)["']/g,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) names.add(match[1]);
  }
  return names;
}

export async function assertPluginFrontendBoundaries(pluginDirectory, artifactName, publicElements) {
  const scanned = [
    ...await collectSourceFiles(path.join(pluginDirectory, "frontend", "src")),
    ...await collectSourceFiles(path.join(pluginDirectory, "web")),
  ];
  for (const file of scanned) {
    const relative = path.relative(pluginDirectory, file).replaceAll("\\", "/");
    const name = path.basename(file);
    if (file.includes(`${path.sep}frontend${path.sep}`) && /^Nxp[A-Z].*\.vue$/.test(name)) {
      fail(`${artifactName} 复制了宿主 Nexus UI 组件：${relative}`);
    }
    const text = await readFile(file, "utf8");
    const tokens = path.extname(file).toLowerCase() === ".css" ? cssClassTokens(text) : markupClassTokens(text);
    const violations = [...tokens].filter(token => hostPrivateClasses.has(token));
    if (violations.length) {
      fail(`${artifactName} 使用了宿主私有 class：${relative} -> ${violations.join(", ")}`);
    }
    const unknownElements = [...usedElementNames(text)].filter(name => !publicElements.has(name));
    if (unknownElements.length) {
      fail(`${artifactName} 使用了非公开宿主元素：${relative} -> ${unknownElements.join(", ")}`);
    }
  }
}

export function activationCleanup(result) {
  if (typeof result === "function") return result;
  if (result && typeof result.dispose === "function") return () => result.dispose();
  if (result && typeof result.deactivate === "function") return () => result.deactivate();
  return null;
}
