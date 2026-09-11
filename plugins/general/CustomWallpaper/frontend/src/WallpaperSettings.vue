<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import type { WallpaperAsset, WallpaperHost, WallpaperSnapshot } from "./types";

const props = defineProps<{ host: WallpaperHost; context?: Record<string, unknown> }>();
const snapshot = ref<WallpaperSnapshot | null>(null);
const expanded = ref(false);
const status = ref("");
const tone = ref("muted");
const help = ref("");
const draggedId = ref("");
let subscription: { dispose(): void } | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let savePromise = Promise.resolve();
let lastSavedSignature = "";

const modes = computed(() => [
  { value: "timer", label: props.host.i18n.t("settings.rotation_timer", {}, "按时间随机轮换") },
  { value: "startup", label: props.host.i18n.t("settings.rotation_startup", {}, "每次启动 Web 随机轮换") },
  { value: "off", label: props.host.i18n.t("settings.rotation_off", {}, "不轮换") },
]);
const assets = computed(() => {
  const values = snapshot.value?.assets || [];
  const byId = new Map(values.map(asset => [asset.id, asset]));
  const order = [...new Set([...(snapshot.value?.order || []), ...values.map(asset => asset.id)])];
  return order.map(id => byId.get(id)).filter((asset): asset is WallpaperAsset => Boolean(asset));
});
const enabled = computed(() => snapshot.value?.provider?.enabled === true);
const secondaryTransparency = computed(() => snapshot.value?.effects?.applyTransparencyToSecondarySurfaces !== false);

function tr(key: string, args: Record<string, unknown> = {}, fallback = "") { return props.host.i18n.t(key, args, fallback); }
function setStatus(message: string, nextTone = "muted") { status.value = message; tone.value = nextTone; }
function formatBytes(bytes: number | undefined) {
  const value = Number(bytes) || 0;
  return value < 1024 * 1024 ? `${Math.max(1, Math.round(value / 1024))} KiB` : `${(value / 1024 / 1024).toFixed(1)} MiB`;
}
function settings() {
  const current = snapshot.value || {};
  return {
    order: assets.value.map(asset => asset.id),
    selectedId: current.selectedId || "",
    rotation: { mode: current.rotation?.mode || "off", intervalMinutes: Number(current.rotation?.intervalMinutes) || 30, epochUnixMs: current.rotation?.epochUnixMs || Date.now() },
    effects: {
      blurPx: Number(current.effects?.blurPx) || 0,
      dimPercent: Number(current.effects?.dimPercent) || 0,
      surfaceTransparencyPercent: Number(current.effects?.surfaceTransparencyPercent) || 0,
      applyTransparencyToSecondarySurfaces: secondaryTransparency.value,
    },
    provider: { enabled: enabled.value },
  };
}
async function load() {
  try {
    snapshot.value = await props.host.appearance.wallpaperStore.get();
    lastSavedSignature = JSON.stringify(settings());
    setStatus(snapshot.value.effectiveEnabled ? tr("status.enabled", {}, "已启用") : tr("status.disabled", {}, "未启用"), snapshot.value.effectiveEnabled ? "ok" : "muted");
  } catch (error) {
    setStatus(tr("status.read_failed", {}, "读取失败"), "bad");
    help.value = error instanceof Error ? error.message : String(error);
  }
}
async function save() {
  if (!snapshot.value) return;
  const nextSettings = settings();
  const signature = JSON.stringify(nextSettings);
  if (signature === lastSavedSignature) return;
  try {
    setStatus(tr("status.saving", {}, "保存中"), "blue");
    snapshot.value = await props.host.appearance.wallpaperStore.save(nextSettings);
    lastSavedSignature = signature;
    setStatus(snapshot.value.effectiveEnabled ? tr("status.enabled", {}, "已启用") : tr("status.disabled", {}, "未启用"), snapshot.value.effectiveEnabled ? "ok" : "muted");
  } catch (error) {
    setStatus(tr("status.save_failed", {}, "保存失败"), "bad");
    help.value = error instanceof Error ? error.message : String(error);
  }
}
function requestSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    savePromise = savePromise.then(save).catch(() => undefined);
  }, 0);
}
async function upload(files: File[] = []) {
  for (const file of files) {
    if (!snapshot.value || snapshot.value.assets?.length && snapshot.value.assets.length >= 32) {
      props.host.ui.toast(tr("error.count", {}, "壁纸数量不能超过 32 张"), "error");
      break;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(String(file.type).toLowerCase())) {
      props.host.ui.toast(tr("error.types", {}, "壁纸仅支持 JPEG、PNG 或 WebP"), "error");
      continue;
    }
    if (file.size > 8 * 1024 * 1024) {
      props.host.ui.toast(tr("error.size", {}, "壁纸文件不能超过 8192 KB"), "error");
      continue;
    }
    try {
      const bitmap = await createImageBitmap(file);
      const portrait = bitmap.height > bitmap.width;
      bitmap.close?.();
      if (portrait) props.host.ui.toast(tr("warning.portrait", {}, "该图片可能在电脑上显示效果不佳"), "warn");
    } catch {
      // 图片尺寸解析失败时交由服务端图片头校验处理。
    }
    try {
      setStatus(tr("status.uploading", { name: file.name }, `上传中：${file.name}`), "blue");
      const result = await props.host.appearance.wallpaperStore.upload(file, { name: file.name });
      if (result.asset?.id) {
        try { await props.host.appearance.wallpaperStore.savePalette(result.asset.id, await props.host.appearance.derivePalette(file)); } catch { /* 配色生成失败不回滚已上传资源。 */ }
      }
      await load();
    } catch (error) {
      setStatus(tr("status.upload_failed", {}, "上传失败"), "bad");
      help.value = error instanceof Error ? error.message : String(error);
    }
  }
}
async function remove(id: string) {
  try { await props.host.appearance.wallpaperStore.remove(id); await load(); } catch (error) { help.value = error instanceof Error ? error.message : String(error); setStatus(tr("status.delete_failed", {}, "删除失败"), "bad"); }
}
async function toggle(key: "enabled" | "secondary") {
  if (!snapshot.value) return;
  if (key === "enabled") snapshot.value.provider = { ...(snapshot.value.provider || {}), enabled: !enabled.value };
  else snapshot.value.effects = { ...(snapshot.value.effects || {}), applyTransparencyToSecondarySurfaces: !secondaryTransparency.value };
  requestSave();
}
async function updateSetting(key: string, value: unknown) {
  if (!snapshot.value) return;
  if (key === "mode") snapshot.value.rotation = { ...(snapshot.value.rotation || {}), mode: String(value) };
  if (key === "interval") snapshot.value.rotation = { ...(snapshot.value.rotation || {}), intervalMinutes: Number(value) || 30 };
  if (key === "blur") snapshot.value.effects = { ...(snapshot.value.effects || {}), blurPx: Number(value) || 0 };
  if (key === "dim") snapshot.value.effects = { ...(snapshot.value.effects || {}), dimPercent: Number(value) || 0 };
  if (key === "transparency") snapshot.value.effects = { ...(snapshot.value.effects || {}), surfaceTransparencyPercent: Number(value) || 0 };
  requestSave();
}
async function drop(targetId: string) {
  if (!draggedId.value || draggedId.value === targetId || !snapshot.value) return;
  const order = assets.value.map(asset => asset.id).filter(id => id !== draggedId.value);
  const index = order.indexOf(targetId);
  order.splice(index < 0 ? order.length : index, 0, draggedId.value);
  snapshot.value.order = order;
  draggedId.value = "";
  requestSave();
}

onMounted(async () => {
  await load();
  subscription = props.host.appearance.wallpaperStore.subscribe(next => { if (next.revision !== snapshot.value?.revision) snapshot.value = next; });
});
onBeforeUnmount(() => {
  if (saveTimer) clearTimeout(saveTimer);
  subscription?.dispose();
});
</script>

<template>
  <section class="settings-card section-surface wallpaper-card" :class="{ 'is-expanded': expanded }" data-settings-panel="custom-wallpaper">
    <button class="settings-card-toggle" type="button" :aria-expanded="expanded" aria-controls="settings-panel-custom-wallpaper" @click="expanded = !expanded"><span class="settings-card-copy"><strong class="settings-card-title">{{ tr("card.title", {}, "自定义壁纸") }}</strong><span class="muted">{{ tr("card.description", {}, "同步壁纸、轮换方式和显示效果") }}</span></span><span class="settings-card-arrow" aria-hidden="true">{{ expanded ? "⌄" : "›" }}</span></button>
    <div id="settings-panel-custom-wallpaper" v-show="expanded" class="settings-card-body">
      <div class="wallpaper-settings-body">
        <div class="wallpaper-status-row"><span class="muted">{{ tr("settings.sync", {}, "服务端同步到当前 NexusPipeline 实例的全部浏览器。") }}</span><span class="badge" :class="tone">{{ status }}</span></div>
        <div class="switch-row settings-option switch-card wallpaper-enabled-row"><div class="switch-copy"><strong>{{ tr("settings.enabled", {}, "启用自定义壁纸") }}</strong><span id="wallpaper-enabled-description" class="muted">{{ tr("settings.enabled_help", {}, "启用后使用自定义壁纸作为页面背景。") }}</span></div><nxp-switch :model-value="enabled" label="" :aria-label="tr('settings.enabled', {}, '启用自定义壁纸')" @change="toggle('enabled')" /></div>
        <div class="switch-row settings-option switch-card wallpaper-secondary-transparency-row"><div class="switch-copy"><strong>{{ tr("settings.secondary", {}, "透明度运用于非主页面") }}</strong><span id="wallpaper-secondary-transparency-description" class="muted">{{ tr("settings.secondary_help", {}, "关闭后，二级浮层恢复为完全不透明；主页面一级卡片继续使用透明度设置。") }}</span></div><nxp-switch :model-value="secondaryTransparency" label="" :aria-label="tr('settings.secondary', {}, '透明度运用于非主页面')" @change="toggle('secondary')" /></div>
        <div class="form-grid wallpaper-controls">
          <label class="field wallpaper-mode-field"><span class="field-label">{{ tr("settings.rotation", {}, "轮换方式") }}</span><span class="plugin-field-description">{{ tr("settings.rotation_help", {}, "按时间随机轮换会按设定间隔切换壁纸；每次启动 Web 随机轮换只在服务启动后选择一次。") }}</span><nxp-select :model-value="snapshot?.rotation?.mode || 'off'" :options="modes" :aria-label="tr('settings.rotation', {}, '轮换方式')" @change="updateSetting('mode', ($event as CustomEvent).detail?.[0] || ($event.target as any)?.modelValue || 'off')" /></label>
          <label class="field"><span class="field-label">{{ tr("settings.interval", {}, "轮换间隔（分钟）") }}</span><span class="plugin-field-description">{{ tr("settings.interval_help", {}, "轮换方式为按时间随机轮换时生效，范围为 1 至 1440 分钟。") }}</span><nxp-number-input :model-value="snapshot?.rotation?.intervalMinutes || 30" min="1" max="1440" step="1" :aria-label="tr('settings.interval', {}, '轮换间隔（分钟）')" @change="updateSetting('interval', ($event as CustomEvent).detail?.[0] || ($event.target as any)?.modelValue)" /></label>
        </div>
        <div class="form-grid wallpaper-effects">
          <label class="field"><span class="field-label">{{ tr("settings.blur", {}, "模糊（像素）") }}</span><span class="plugin-field-description">{{ tr("settings.blur_help", {}, "模糊范围为 0 至 40 像素。") }}</span><span class="wallpaper-range-row"><nxp-range :model-value="snapshot?.effects?.blurPx || 0" min="0" max="40" step="1" :aria-label="tr('settings.blur', {}, '模糊（像素）')" @change="updateSetting('blur', ($event as CustomEvent).detail?.[0] || ($event.target as any)?.modelValue)" /><output>{{ snapshot?.effects?.blurPx || 0 }}px</output></span></label>
          <label class="field"><span class="field-label">{{ tr("settings.dim", {}, "变暗") }}</span><span class="plugin-field-description">{{ tr("settings.dim_help", {}, "变暗范围为 0 至 80%，用于调整壁纸与内容的对比度。") }}</span><span class="wallpaper-range-row"><nxp-range :model-value="snapshot?.effects?.dimPercent ?? 20" min="0" max="80" step="1" :aria-label="tr('settings.dim', {}, '变暗')" @change="updateSetting('dim', ($event as CustomEvent).detail?.[0] || ($event.target as any)?.modelValue)" /><output>{{ snapshot?.effects?.dimPercent ?? 20 }}%</output></span></label>
          <label class="field"><span class="field-label">{{ tr("settings.transparency", {}, "卡片与侧边栏透明度") }}</span><span class="plugin-field-description">{{ tr("settings.transparency_help", {}, "控制页面卡片、侧边栏和其他表面的透明度，范围为 0 至 50%。") }}</span><span class="wallpaper-range-row"><nxp-range :model-value="snapshot?.effects?.surfaceTransparencyPercent || 0" min="0" max="50" step="1" :aria-label="tr('settings.transparency', {}, '卡片与侧边栏透明度')" @change="updateSetting('transparency', ($event as CustomEvent).detail?.[0] || ($event.target as any)?.modelValue)" /><output>{{ snapshot?.effects?.surfaceTransparencyPercent || 0 }}%</output></span></label>
        </div>
        <div class="wallpaper-upload-row"><nxp-file-picker accept="image/jpeg,image/png,image/webp" multiple :label="tr('settings.add', {}, '添加壁纸')" @change="upload(($event as CustomEvent).detail?.[0] || ($event.target as any)?.files || [])" /><span class="muted">{{ tr("settings.file_help", {}, "JPEG、PNG、WebP，单张最大 8192 KB") }}</span></div>
        <div class="wallpaper-list"><p v-if="!assets.length" class="muted wallpaper-empty">{{ tr("empty", {}, "尚未添加壁纸。") }}</p><div v-for="asset in assets" :key="asset.id" class="wallpaper-item" :class="{ 'is-dragging': draggedId === asset.id }" @dragover.prevent @drop="drop(asset.id)"><button class="wallpaper-drag-handle" type="button" draggable="true" :aria-label="`${tr('drag', {}, '拖拽排序')}：${asset.originalName || asset.id}`" :title="tr('drag', {}, '拖拽排序')" @dragstart.stop="draggedId = asset.id" @dragend="draggedId = ''">⠿</button><img :src="asset.url" :alt="asset.originalName || asset.id"><div class="wallpaper-item-copy"><strong>{{ asset.originalName || asset.id }}</strong><span class="muted">{{ formatBytes(asset.sizeBytes) }}</span></div><nxp-button tone="danger" variant="ghost" size="sm" @click="remove(asset.id)">{{ tr("remove", {}, "删除") }}</nxp-button></div></div>
        <div class="wallpaper-card-footer"><span class="muted">{{ tr("settings.max_help", {}, "最多 32 张，实例总容量 256 MiB。") }}</span></div>
        <p v-if="help" class="req">{{ help }}</p>
      </div>
    </div>
  </section>
</template>
