<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import type { WallpaperAsset, WallpaperHost, WallpaperState } from "./wallpaperApi";
import { assetBlob, deleteAsset, ensurePalette, saveSettings, uploadAsset } from "./wallpaperApi";
import type { WallpaperRuntime, WallpaperRuntimeSnapshot } from "./wallpaperRuntime";

const props = defineProps<{ host: WallpaperHost; runtime: WallpaperRuntime; context?: Record<string, unknown> }>();

const settingsPanelId = "custom-wallpaper";
const settingsPanelToggleEvent = "nxp-settings-panel-toggle";
const settingsPanelStateEvent = "nxp-settings-panel-state";

const initial = props.runtime.snapshot();
const state = ref<WallpaperState | null>(initial.state);
const runtimeError = ref(initial.error);
const expanded = ref(false);
const busy = ref("");
const help = ref("");
const draggedId = ref("");
const thumbnails = ref<Record<string, string>>({});
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let unsubscribe: (() => void) | null = null;
let disposed = false;

const modes = computed(() => [
  { value: "timer", label: tr("rotation.timer", {}, "按时间随机轮换") },
  { value: "startup", label: tr("rotation.startup", {}, "每次启动 Web 随机轮换") },
  { value: "off", label: tr("rotation.off", {}, "不轮换") },
]);
const assets = computed(() => {
  const values = state.value?.assets || [];
  const byId = new Map(values.map(asset => [asset.id, asset]));
  const order = [...new Set([...(state.value?.order || []), ...values.map(asset => asset.id)])];
  return order.map(id => byId.get(id)).filter((asset): asset is WallpaperAsset => Boolean(asset));
});
const enabled = computed(() => state.value?.enabled === true);
const secondaryTransparency = computed(() => state.value?.effects?.applyTransparencyToSecondarySurfaces !== false);
const status = computed(() => {
  if (busy.value) return busy.value;
  if (runtimeError.value) return tr("status.read_failed", {}, "读取失败");
  return state.value?.effectiveEnabled === true
    ? tr("status.enabled", {}, "已启用")
    : tr("status.disabled", {}, "未启用");
});
const tone = computed<"muted" | "blue" | "ok" | "warn" | "bad">(() => {
  if (busy.value) return "blue";
  if (runtimeError.value) return "bad";
  return state.value?.effectiveEnabled === true ? "ok" : "muted";
});
const displayError = computed(() => help.value || runtimeError.value);

function tr(key: string, args: Record<string, unknown> = {}, fallback = ""): string {
  return props.host.i18n.t(key, args, fallback);
}

function errorMessage(error: unknown, fallbackKey: string, fallbackText: string): string {
  const code = (error as { code?: string } | null)?.code || "";
  const known: Record<string, string> = {
    invalid_type: tr("error.types", {}, "壁纸仅支持 JPEG、PNG 或 WebP"),
    too_large: tr("error.size", {}, "壁纸文件不能超过 8192 KB"),
    quota_count: tr("error.count", {}, "壁纸数量不能超过 32 张"),
    quota_total: tr("error.total", {}, "壁纸总容量不能超过 256 MiB"),
    invalid_image: tr("error.image", {}, "壁纸文件内容与声明类型不匹配"),
    invalid_config: tr("error.config", {}, "壁纸设置无效"),
    invalid_asset: tr("error.asset", {}, "壁纸资源无效"),
    not_found: tr("error.not_found", {}, "壁纸资源不存在"),
    invalid_palette: tr("error.palette", {}, "壁纸配色无效"),
  };
  if (known[code]) return known[code];
  if (code) return tr("error.generic", { code }, `操作失败：${code}`);
  return tr(fallbackKey, {}, fallbackText);
}

function formatBytes(bytes: number | undefined): string {
  const value = Number(bytes) || 0;
  return value < 1024 * 1024 ? `${Math.max(1, Math.round(value / 1024))} KiB` : `${(value / 1024 / 1024).toFixed(1)} MiB`;
}

function publishPanelToggle(panelId: string | null) {
  window.dispatchEvent(new CustomEvent(settingsPanelToggleEvent, { detail: { panelId } }));
}

function onToggle(next: boolean) {
  expanded.value = next;
  publishPanelToggle(next ? settingsPanelId : null);
}

function syncPanelState(event: Event) {
  const panelId = (event as CustomEvent<{ panelId?: unknown }>).detail?.panelId;
  if (panelId !== null && typeof panelId !== "string") return;
  expanded.value = panelId === settingsPanelId;
}

function syncSnapshot(snapshot: WallpaperRuntimeSnapshot) {
  if (disposed) return;
  state.value = snapshot.state;
  runtimeError.value = snapshot.error;
}

async function releaseThumbnails(keep: string[] = []) {
  const keepSet = new Set(keep);
  Object.entries(thumbnails.value).forEach(([id, url]) => {
    if (keepSet.has(id)) return;
    URL.revokeObjectURL(url);
    delete thumbnails.value[id];
  });
}

async function loadThumbnails(items: WallpaperAsset[]) {
  await releaseThumbnails(items.map(item => item.id));
  for (const asset of items) {
    if (thumbnails.value[asset.id]) continue;
    try {
      const blob = await assetBlob(props.host, asset.id);
      if (disposed) return;
      thumbnails.value = { ...thumbnails.value, [asset.id]: URL.createObjectURL(blob) };
    } catch {
      // 缩略图读取失败时保留占位背景。
    }
  }
}

function requestSave(patch: unknown, optimistic: (current: WallpaperState) => WallpaperState) {
  if (state.value) state.value = optimistic(state.value);
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void (async () => {
      busy.value = tr("status.saving", {}, "保存中");
      try {
        const next = await saveSettings(props.host, patch);
        if (disposed) return;
        await props.runtime.apply(next);
      } catch (error) {
        help.value = errorMessage(error, "status.save_failed", "保存失败");
        await props.runtime.refresh();
      } finally {
        busy.value = "";
      }
    })();
  }, 0);
}

interface SettingsPatch {
  order: string[];
  selectedId: string;
  rotation: { mode: string; intervalMinutes: number; epochUnixMs: number };
  effects: {
    blurPx: number;
    dimPercent: number;
    surfaceTransparencyPercent: number;
    applyTransparencyToSecondarySurfaces: boolean;
  };
}

function settingsPatch(): SettingsPatch {
  const current = state.value || {};
  return {
    order: assets.value.map(asset => asset.id),
    selectedId: current.selectedId || "",
    rotation: {
      mode: current.rotation?.mode || "off",
      intervalMinutes: Number(current.rotation?.intervalMinutes) || 30,
      epochUnixMs: current.rotation?.epochUnixMs || Date.now(),
    },
    effects: {
      blurPx: Number(current.effects?.blurPx) || 0,
      dimPercent: Number(current.effects?.dimPercent) || 0,
      surfaceTransparencyPercent: Number(current.effects?.surfaceTransparencyPercent) || 0,
      applyTransparencyToSecondarySurfaces: secondaryTransparency.value,
    },
  };
}

function toggle(key: "enabled" | "secondary") {
  if (!state.value) return;
  if (key === "enabled") {
    const value = !enabled.value;
    requestSave({ enabled: value, rotation: settingsPatch().rotation }, current => ({ ...current, enabled: value, effectiveEnabled: value && (current.order?.length || 0) > 0 }));
    return;
  }
  const value = !secondaryTransparency.value;
  requestSave(
    { effects: { ...settingsPatch().effects, applyTransparencyToSecondarySurfaces: value } },
    current => ({ ...current, effects: { ...(current.effects || {}), applyTransparencyToSecondarySurfaces: value } }));
}

function updateSetting(key: string, value: unknown) {
  if (!state.value) return;
  const patch = settingsPatch();
  if (key === "mode") {
    patch.rotation.mode = String(value);
    patch.rotation.epochUnixMs = Date.now();
  }
  if (key === "interval") patch.rotation.intervalMinutes = Number(value) || 30;
  if (key === "blur") patch.effects.blurPx = Number(value) || 0;
  if (key === "dim") patch.effects.dimPercent = Number(value) || 0;
  if (key === "transparency") patch.effects.surfaceTransparencyPercent = Number(value) || 0;
  requestSave(patch, current => ({
    ...current,
    rotation: { ...(current.rotation || {}), ...patch.rotation },
    effects: { ...(current.effects || {}), ...patch.effects },
  }));
}

async function upload(files: File[] = []) {
  for (const file of files) {
    const limits = state.value?.limits || {};
    const maxAssets = Number(limits.maxAssets) || 32;
    const maxAssetBytes = Number(limits.maxAssetBytes) || 8 * 1024 * 1024;
    if ((state.value?.assets?.length || 0) >= maxAssets) {
      props.host.ui.toast(tr("error.count", {}, "壁纸数量不能超过 32 张"), "error");
      break;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(String(file.type).toLowerCase())) {
      props.host.ui.toast(tr("error.types", {}, "壁纸仅支持 JPEG、PNG 或 WebP"), "error");
      continue;
    }
    if (file.size > maxAssetBytes) {
      props.host.ui.toast(tr("error.size", {}, "壁纸文件不能超过 8192 KB"), "error");
      continue;
    }
    try {
      const bitmap = await createImageBitmap(file);
      const portrait = bitmap.height > bitmap.width;
      bitmap.close?.();
      if (portrait) props.host.ui.toast(tr("warning.portrait", {}, "该图片可能在电脑上显示效果不佳"), "warn");
    } catch {
      // 尺寸解析失败时交给服务端图片头校验处理。
    }
    try {
      busy.value = tr("status.uploading", { name: file.name }, `上传中：${file.name}`);
      const result = await uploadAsset(props.host, file);
      if (disposed) return;
      if (result.asset) {
        try {
          await ensurePalette(props.host, result.asset, file);
        } catch (error) {
          props.host.ui.toast(tr("warning.palette", { error: error instanceof Error ? error.message : String(error) }, "壁纸已上传，配色稍后生成"), "warn");
        }
      }
      await props.runtime.refresh();
      await loadThumbnails(state.value?.assets || []);
    } catch (error) {
      help.value = errorMessage(error, "status.upload_failed", "上传失败");
    } finally {
      busy.value = "";
    }
  }
}

async function remove(id: string) {
  try {
    const next = await deleteAsset(props.host, id);
    if (disposed) return;
    const url = thumbnails.value[id];
    if (url) {
      URL.revokeObjectURL(url);
      delete thumbnails.value[id];
    }
    await props.runtime.apply(next);
  } catch (error) {
    help.value = errorMessage(error, "status.delete_failed", "删除失败");
  }
}

function drop(targetId: string) {
  if (!draggedId.value || draggedId.value === targetId || !state.value) return;
  const order = assets.value.map(asset => asset.id).filter(id => id !== draggedId.value);
  const index = order.indexOf(targetId);
  order.splice(index < 0 ? order.length : index, 0, draggedId.value);
  draggedId.value = "";
  requestSave({ order }, current => ({ ...current, order }));
}

function onDragStart(event: DragEvent, id: string) {
  draggedId.value = id;
  const dataTransfer = event.dataTransfer;
  if (!dataTransfer) return;
  dataTransfer.effectAllowed = "move";
  dataTransfer.setData("text/plain", id);
  const handle = event.currentTarget as HTMLElement | null;
  const card = handle?.closest<HTMLElement>(".cw-item");
  if (!card) return;
  const rect = card.getBoundingClientRect();
  dataTransfer.setDragImage(card, Math.max(1, rect.width / 2), Math.max(1, rect.height / 2));
}

onMounted(async () => {
  window.addEventListener(settingsPanelStateEvent, syncPanelState);
  unsubscribe = props.runtime.subscribe(syncSnapshot);
  syncSnapshot(props.runtime.snapshot());
  await loadThumbnails(state.value?.assets || []);
});

onBeforeUnmount(() => {
  disposed = true;
  window.removeEventListener(settingsPanelStateEvent, syncPanelState);
  unsubscribe?.();
  unsubscribe = null;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  Object.values(thumbnails.value).forEach(url => URL.revokeObjectURL(url));
  thumbnails.value = {};
});
</script>

<template>
  <nxp-collapsible-card
    :title="tr('card.title', {}, '自定义壁纸')"
    :description="tr('card.description', {}, '同步壁纸、轮换方式和显示效果')"
    :expanded="expanded"
    :panel-id="'settings-panel-custom-wallpaper'"
    data-settings-panel="custom-wallpaper"
    data-testid="custom-wallpaper-card"
    @toggle="onToggle(($event as CustomEvent).detail?.[0] === true)"
  >
    <div class="cw-body">
      <div class="cw-status-row">
        <span class="cw-muted">{{ tr("settings.sync", {}, "服务端同步到当前 NexusPipeline 实例的全部浏览器。") }}</span>
        <nxp-badge :tone="tone" :label="status" />
      </div>
      <nxp-switch-list>
        <nxp-switch-setting
          :label="tr('settings.enabled', {}, '启用自定义壁纸')"
          :description="tr('settings.enabled_help', {}, '启用后使用自定义壁纸作为页面背景。')"
          :model-value="enabled"
          :aria-label="tr('settings.enabled', {}, '启用自定义壁纸')"
          @change="toggle('enabled')"
        />
        <nxp-switch-setting
          :label="tr('settings.secondary', {}, '透明度运用于非主页面')"
          :description="tr('settings.secondary_help', {}, '关闭后，二级浮层恢复为完全不透明；主页面一级卡片继续使用透明度设置。')"
          :model-value="secondaryTransparency"
          :aria-label="tr('settings.secondary', {}, '透明度运用于非主页面')"
          @change="toggle('secondary')"
        />
      </nxp-switch-list>
      <div class="cw-grid cw-controls">
        <label
          class="cw-field"
          :data-help="tr('settings.rotation_help', {}, '按时间随机轮换会按设定间隔切换壁纸；每次启动 Web 随机轮换只在服务启动后选择一次。')"
        >
          <span class="cw-field-label">{{ tr("settings.rotation", {}, "轮换方式") }}</span>
          <nxp-select
            :model-value="state?.rotation?.mode || 'off'"
            :options="modes"
            :aria-label="tr('settings.rotation', {}, '轮换方式')"
            @change="updateSetting('mode', ($event as CustomEvent).detail?.[0] || ($event.target as any)?.modelValue || 'off')"
          />
        </label>
        <label
          class="cw-field"
          :data-help="tr('settings.interval_help', {}, '轮换方式为按时间随机轮换时生效，范围为 1 至 1440 分钟。')"
        >
          <span class="cw-field-label">{{ tr("settings.interval", {}, "轮换间隔（分钟）") }}</span>
          <nxp-number-input
            :model-value="state?.rotation?.intervalMinutes || 30"
            min="1"
            max="1440"
            step="1"
            :aria-label="tr('settings.interval', {}, '轮换间隔（分钟）')"
            @change="updateSetting('interval', ($event as CustomEvent).detail?.[0] || ($event.target as any)?.modelValue)"
          />
        </label>
      </div>
      <div class="cw-grid cw-effects">
        <label class="cw-field" :data-help="tr('settings.blur_help', {}, '模糊范围为 0 至 40 像素。')">
          <span class="cw-field-label">{{ tr("settings.blur", {}, "模糊（像素）") }}</span>
          <span class="cw-range-row">
            <nxp-range
              :model-value="state?.effects?.blurPx || 0"
              min="0"
              max="40"
              step="1"
              :aria-label="tr('settings.blur', {}, '模糊（像素）')"
              @change="updateSetting('blur', ($event as CustomEvent).detail?.[0] || ($event.target as any)?.modelValue)"
            />
            <output>{{ state?.effects?.blurPx || 0 }}px</output>
          </span>
        </label>
        <label class="cw-field" :data-help="tr('settings.dim_help', {}, '变暗范围为 0 至 80%，用于调整壁纸与内容的对比度。')">
          <span class="cw-field-label">{{ tr("settings.dim", {}, "变暗") }}</span>
          <span class="cw-range-row">
            <nxp-range
              :model-value="state?.effects?.dimPercent ?? 20"
              min="0"
              max="80"
              step="1"
              :aria-label="tr('settings.dim', {}, '变暗')"
              @change="updateSetting('dim', ($event as CustomEvent).detail?.[0] || ($event.target as any)?.modelValue)"
            />
            <output>{{ state?.effects?.dimPercent ?? 20 }}%</output>
          </span>
        </label>
        <label class="cw-field" :data-help="tr('settings.transparency_help', {}, '控制页面卡片、侧边栏和其他表面的透明度，范围为 0 至 50%。')">
          <span class="cw-field-label">{{ tr("settings.transparency", {}, "卡片与侧边栏透明度") }}</span>
          <span class="cw-range-row">
            <nxp-range
              :model-value="state?.effects?.surfaceTransparencyPercent || 0"
              min="0"
              max="50"
              step="1"
              :aria-label="tr('settings.transparency', {}, '卡片与侧边栏透明度')"
              @change="updateSetting('transparency', ($event as CustomEvent).detail?.[0] || ($event.target as any)?.modelValue)"
            />
            <output>{{ state?.effects?.surfaceTransparencyPercent || 0 }}%</output>
          </span>
        </label>
      </div>
      <div class="cw-upload-row">
        <nxp-file-picker
          accept="image/jpeg,image/png,image/webp"
          multiple
          :label="tr('settings.add', {}, '添加壁纸')"
          @change="upload(($event as CustomEvent).detail?.[0] || ($event.target as any)?.files || [])"
        />
        <span class="cw-muted">{{ tr("settings.file_help", {}, "JPEG、PNG、WebP，单张最大 8192 KB") }}</span>
      </div>
      <div class="cw-list">
        <p v-if="!assets.length" class="cw-muted cw-empty">{{ tr("empty", {}, "尚未添加壁纸。") }}</p>
        <div
          v-for="asset in assets"
          :key="asset.id"
          class="cw-item"
          :class="{ 'is-dragging': draggedId === asset.id }"
          @dragover.prevent
          @drop="drop(asset.id)"
        >
          <button
            class="cw-drag-handle"
            type="button"
            draggable="true"
            :aria-label="`${tr('drag', {}, '拖拽排序')}：${asset.originalName || asset.id}`"
            :title="tr('drag', {}, '拖拽排序')"
            @dragstart.stop="onDragStart($event, asset.id)"
            @dragend="draggedId = ''"
          >⠿</button>
          <img v-if="thumbnails[asset.id]" :src="thumbnails[asset.id]" :alt="asset.originalName || asset.id" />
          <span v-else class="cw-thumb-placeholder" aria-hidden="true"></span>
          <div class="cw-item-copy">
            <strong>{{ asset.originalName || asset.id }}</strong>
            <span class="cw-muted">{{ formatBytes(asset.sizeBytes) }}</span>
          </div>
          <nxp-button
            tone="danger"
            variant="ghost"
            size="sm"
            :label="tr('remove', {}, '删除')"
            @click="remove(asset.id)"
          />
        </div>
      </div>
      <div class="cw-card-footer">
        <span class="cw-muted">{{ tr("settings.max_help", {}, "最多 32 张，实例总容量 256 MiB。") }}</span>
      </div>
      <p v-if="displayError" class="cw-error">{{ displayError }}</p>
    </div>
  </nxp-collapsible-card>
</template>
