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
    setStatus(snapshot.value.effectiveEnabled ? tr("status.enabled", {}, "已启用") : tr("status.disabled", {}, "未启用"), snapshot.value.effectiveEnabled ? "ok" : "muted");
  } catch (error) {
    setStatus(tr("status.read_failed", {}, "读取失败"), "bad");
    help.value = error instanceof Error ? error.message : String(error);
  }
}
async function save() {
  if (!snapshot.value) return;
  try {
    setStatus(tr("status.saving", {}, "保存中"), "blue");
    snapshot.value = await props.host.appearance.wallpaperStore.save(settings());
    setStatus(snapshot.value.effectiveEnabled ? tr("status.enabled", {}, "已启用") : tr("status.disabled", {}, "未启用"), snapshot.value.effectiveEnabled ? "ok" : "muted");
  } catch (error) {
    setStatus(tr("status.save_failed", {}, "保存失败"), "bad");
    help.value = error instanceof Error ? error.message : String(error);
  }
}
async function upload(files: File[] = []) {
  for (const file of files) {
    if (!snapshot.value || snapshot.value.assets?.length && snapshot.value.assets.length >= 32) {
      props.host.ui.toast(tr("error.count", {}, "壁纸数量不能超过 32 张"), "error");
      break;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(String(file.type).toLowerCase()) || file.size > 8 * 1024 * 1024) {
      props.host.ui.toast(tr("error.types", {}, "壁纸仅支持 JPEG、PNG 或 WebP，单张最大 8192 KB"), "error");
      continue;
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
  await save();
}
async function updateSetting(key: string, value: unknown) {
  if (!snapshot.value) return;
  if (key === "mode") snapshot.value.rotation = { ...(snapshot.value.rotation || {}), mode: String(value) };
  if (key === "interval") snapshot.value.rotation = { ...(snapshot.value.rotation || {}), intervalMinutes: Number(value) || 30 };
  if (key === "blur") snapshot.value.effects = { ...(snapshot.value.effects || {}), blurPx: Number(value) || 0 };
  if (key === "dim") snapshot.value.effects = { ...(snapshot.value.effects || {}), dimPercent: Number(value) || 0 };
  if (key === "transparency") snapshot.value.effects = { ...(snapshot.value.effects || {}), surfaceTransparencyPercent: Number(value) || 0 };
  await save();
}
async function drop(targetId: string) {
  if (!draggedId.value || draggedId.value === targetId || !snapshot.value) return;
  const order = assets.value.map(asset => asset.id).filter(id => id !== draggedId.value);
  const index = order.indexOf(targetId);
  order.splice(index < 0 ? order.length : index, 0, draggedId.value);
  snapshot.value.order = order;
  draggedId.value = "";
  await save();
}

onMounted(async () => {
  await load();
  subscription = props.host.appearance.wallpaperStore.subscribe(next => { if (next.revision !== snapshot.value?.revision) snapshot.value = next; });
});
onBeforeUnmount(() => subscription?.dispose());
</script>

<template>
  <section class="settings-card wallpaper-card" data-settings-panel="custom-wallpaper">
    <button class="settings-card-toggle" type="button" :aria-expanded="expanded" @click="expanded = !expanded"><span class="settings-card-copy"><strong class="settings-card-title">{{ tr("card.title", {}, "自定义壁纸") }}</strong><span class="muted">{{ tr("card.description", {}, "同步壁纸、轮换方式和显示效果") }}</span></span><span class="settings-card-arrow" aria-hidden="true">{{ expanded ? "⌄" : "›" }}</span></button>
    <div v-show="expanded" class="settings-card-body">
      <div class="row-actions"><nxp-switch :model-value="enabled" :label="tr('settings.enabled', {}, '启用自定义壁纸')" @change="toggle('enabled')" /><span class="badge" :class="tone">{{ status }}</span></div>
      <div class="form-grid wallpaper-controls">
        <label class="field"><span class="field-label">{{ tr("settings.rotation", {}, "轮换方式") }}</span><nxp-select :model-value="snapshot?.rotation?.mode || 'off'" :options="modes" aria-label="轮换方式" @change="updateSetting('mode', ($event as CustomEvent).detail?.[0] || ($event.target as any)?.modelValue || 'off')" /></label>
        <label class="field"><span class="field-label">{{ tr("settings.interval", {}, "轮换间隔（分钟）") }}</span><nxp-number-input :model-value="snapshot?.rotation?.intervalMinutes || 30" min="1" max="1440" step="1" aria-label="轮换间隔（分钟）" @change="updateSetting('interval', ($event as CustomEvent).detail?.[0] || ($event.target as any)?.modelValue)" /></label>
        <label class="field"><span class="field-label">{{ tr("settings.blur", {}, "模糊（像素）") }}</span><nxp-range :model-value="snapshot?.effects?.blurPx || 0" min="0" max="40" step="1" aria-label="模糊（像素）" @change="updateSetting('blur', ($event as CustomEvent).detail?.[0] || ($event.target as any)?.modelValue)" /></label>
        <label class="field"><span class="field-label">{{ tr("settings.dim", {}, "变暗") }}</span><nxp-range :model-value="snapshot?.effects?.dimPercent ?? 20" min="0" max="80" step="1" aria-label="变暗" @change="updateSetting('dim', ($event as CustomEvent).detail?.[0] || ($event.target as any)?.modelValue)" /></label>
        <label class="field"><span class="field-label">{{ tr("settings.transparency", {}, "卡片与侧边栏透明度") }}</span><nxp-range :model-value="snapshot?.effects?.surfaceTransparencyPercent || 0" min="0" max="50" step="1" aria-label="卡片与侧边栏透明度" @change="updateSetting('transparency', ($event as CustomEvent).detail?.[0] || ($event.target as any)?.modelValue)" /></label>
      </div>
      <div class="row-actions"><nxp-switch :model-value="secondaryTransparency" :label="tr('settings.secondary', {}, '透明度运用于非主页面')" @change="toggle('secondary')" /><nxp-file-picker accept="image/jpeg,image/png,image/webp" multiple :label="tr('settings.upload', {}, '添加壁纸')" @change="upload(($event as CustomEvent).detail?.[0] || ($event.target as any)?.files || [])" /></div>
      <div class="wallpaper-list"><p v-if="!assets.length" class="muted wallpaper-empty">{{ tr("empty", {}, "尚未添加壁纸。") }}</p><div v-for="asset in assets" :key="asset.id" class="wallpaper-item" draggable="true" @dragstart="draggedId = asset.id" @dragover.prevent @drop="drop(asset.id)"><span class="wallpaper-drag-handle" aria-hidden="true">⠿</span><img :src="asset.url" :alt="asset.originalName || asset.id"><div class="wallpaper-item-copy"><strong>{{ asset.originalName || asset.id }}</strong><span class="muted">{{ Math.max(1, Math.round((asset.sizeBytes || 0) / 1024)) }} KiB</span></div><nxp-button tone="danger" variant="ghost" size="sm" @click="remove(asset.id)">{{ tr("remove", {}, "删除") }}</nxp-button></div></div>
      <p v-if="help" class="req">{{ help }}</p>
    </div>
  </section>
</template>
