<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import type { ScreenshotHost } from "./types";

const props = defineProps<{ host: ScreenshotHost; context?: Record<string, unknown> }>();
const state = ref("waiting_run");
const source = ref("");
const capturedAt = ref("");
const imageUrl = ref("");
let timer: ReturnType<typeof setInterval> | null = null;
let request: AbortController | null = null;
let disposed = false;

function tr(key: string, args: Record<string, unknown> = {}, fallback = "") { return props.host.i18n.t(key, args, fallback); }
function runId() { return String(props.context?.primaryId || "").trim(); }
function revoke(url: string) {
  if (url.startsWith("blob:")) URL.revokeObjectURL(url);
}
function replaceImageUrl(next: string) {
  if (imageUrl.value && imageUrl.value !== next) revoke(imageUrl.value);
  imageUrl.value = next;
}
async function capture() {
  if (disposed || request || !runId()) return;
  request = new AbortController();
  try {
    const result = await props.host.executionPreview.capture(runId(), request.signal);
    if (disposed) {
      if (result.url) revoke(result.url);
      return;
    }
    state.value = result.state === "ready" && result.url ? "ready" : result.state;
    replaceImageUrl(result.url || "");
    source.value = result.source === "emulator" ? tr("emulator", {}, "模拟器") : result.source ? tr("pc_game", {}, "PC 游戏") : "";
    capturedAt.value = result.capturedAt ? tr("recent_update", { time: props.host.i18n.formatTime(result.capturedAt, { hour12: false }) }, `最近更新 ${result.capturedAt}`) : "";
  } catch (error) {
    if (!disposed && (error as Error)?.name !== "AbortError") { state.value = "unavailable"; replaceImageUrl(""); }
  } finally { request = null; }
}
function message() {
  if (state.value === "waiting_for_game" || state.value === "window_not_ready") return tr("waiting_game", {}, "正在等待游戏窗口…");
  if (state.value === "emulator_not_ready") return tr("waiting_emulator", {}, "正在等待模拟器画面…");
  if (state.value === "unavailable") return tr("unavailable", {}, "暂时无法获取游戏窗口画面");
  return tr("waiting_run", {}, "等待任务画面");
}
onMounted(() => { void capture(); timer = setInterval(() => void capture(), 5000); });
onBeforeUnmount(() => { disposed = true; if (timer) clearInterval(timer); request?.abort(); replaceImageUrl(""); });
</script>

<template>
  <section class="live-screenshot-card" data-live-screenshot-card><div class="live-screenshot-heading"><strong>{{ tr("title", {}, "实时画面") }}</strong><span class="badge" :class="state === 'ready' ? 'ok' : 'muted'">{{ source || tr("waiting", {}, "等待") }}</span></div><div class="live-screenshot-stage"> <img v-if="imageUrl" class="live-screenshot-image" :src="imageUrl" :alt="tr('current_game', {}, '当前游戏画面')"><span v-else class="muted">{{ message() }}</span></div><div class="live-screenshot-footer"><span class="muted">{{ capturedAt }}</span><span class="muted">{{ tr("refresh", {}, "每 5 秒更新") }}</span></div></section>
</template>
