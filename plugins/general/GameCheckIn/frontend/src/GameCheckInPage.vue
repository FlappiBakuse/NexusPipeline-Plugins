<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

type Host = {
  api: {
    get(route: string, signal?: AbortSignal): Promise<unknown>;
    post(route: string, body: unknown, signal?: AbortSignal): Promise<unknown>;
    put(route: string, body: unknown, signal?: AbortSignal): Promise<unknown>;
    delete(route: string, body: unknown, signal?: AbortSignal): Promise<unknown>;
  };
  i18n: { t(key: string, args?: Record<string, unknown>, fallback?: string): string };
  ui?: { toast(message: string, tone?: string): void };
};

type GameOption = { id: string; name: string };
type PlatformOption = { id: string; name: string; games: GameOption[] };
type Schedule = { id: string; days: number[]; enabled: boolean; time: string };
type RunResult = { platform: string; gameCode: string; success: boolean; code: string; message: string };
type Run = { id: string; trigger: string; startedAt: string; completedAt: string | null; status: string; results: RunResult[] };
type Task = {
  id: string;
  name: string;
  enabled: boolean;
  games: Record<string, string[]>;
  cnDeviceId: string;
  kuroDevCode: string;
  kuroDistinctId: string;
  schedules: Schedule[];
  notifications: {
    webhook: { enabled: boolean; type: string; template: string };
    smtp: { enabled: boolean; host: string; port: number; secure: string; from: string; to: string; subjectPrefix: string };
  };
  runs: Run[];
  credentials: Record<string, boolean>;
  webhookSecrets: { urlConfigured: boolean; signingSecretConfigured: boolean };
  smtpSecrets: { userConfigured: boolean; passwordConfigured: boolean };
  isRunning: boolean;
  nextRunAt: string | null;
  recentRun: Run | null;
};
type TaskState = { tasks: Task[]; platforms: PlatformOption[]; webhookTypes: string[]; timeZoneId: string; localTime: string };
type ScheduleDraft = { id: string; days: number[]; enabled: boolean; time: string };
type TaskDraft = {
  id?: string;
  name: string;
  enabled: boolean;
  games: Record<string, string[]>;
  cnDeviceId: string;
  kuroDevCode: string;
  kuroDistinctId: string;
  schedules: ScheduleDraft[];
  notifications: Task["notifications"];
};

const props = defineProps<{ host: Host }>();
const state = ref<TaskState | null>(null);
const loading = ref(true);
const saving = ref(false);
const pageError = ref("");
const editorError = ref("");
const editor = ref<TaskDraft | null>(null);
const editingId = computed(() => editor.value?.id || "");
const secretInputs = ref<Record<string, string>>({});
const clearedSecrets = ref<Record<string, boolean>>({});
const secretKeys = ["cn", "os", "skland", "skport", "kuro", "webhookUrl", "webhookSecret", "smtpUser", "smtpPassword"];
const days = [0, 1, 2, 3, 4, 5, 6];
const smtpSecureOptions = [
  { value: "auto", label: "" },
  { value: "ssl", label: "" },
  { value: "starttls", label: "" },
  { value: "none", label: "" },
];
const credentialPlatforms = ["cn", "os", "skland", "skport", "kuro"];
let pollTimer: ReturnType<typeof setInterval> | null = null;
let scheduleDraftSequence = 0;
let disposed = false;
let loadingState = false;
const controller = new AbortController();

const tasks = computed(() => state.value?.tasks || []);
const platforms = computed(() => state.value?.platforms || []);
const editingTask = computed(() => tasks.value.find(task => task.id === editingId.value));
const taskWebhookConfigured = computed(() => editingTask.value?.webhookSecrets?.urlConfigured === true);
const taskWebhookSecretConfigured = computed(() => editingTask.value?.webhookSecrets?.signingSecretConfigured === true);
const taskSmtpUserConfigured = computed(() => editingTask.value?.smtpSecrets?.userConfigured === true);
const taskSmtpPasswordConfigured = computed(() => editingTask.value?.smtpSecrets?.passwordConfigured === true);

function t(key: string, args: Record<string, unknown> = {}, fallback = ""): string {
  return props.host.i18n.t(key, args, fallback);
}

function eventValue<T>(event: Event): T {
  const detail = (event as CustomEvent<unknown[]>).detail;
  if (Array.isArray(detail) && detail.length) return detail[0] as T;
  return (event.target as HTMLElement & { modelValue?: T })?.modelValue as T;
}

function setSecret(key: string, value: string) {
  secretInputs.value[key] = value;
  if (value.trim()) clearedSecrets.value[key] = false;
}

function errorCode(error: unknown): string {
  const value = error as { code?: unknown } | null;
  return typeof value?.code === "string" ? value.code : "";
}

function backendError(error: unknown, fallback: string): string {
  const code = errorCode(error);
  return code ? t(`error.${code}`, {}, fallback) : fallback;
}

async function loadState(initial = false) {
  if (loadingState || disposed) return;
  loadingState = true;
  try {
    const result = await props.host.api.get("state", controller.signal) as TaskState;
    if (disposed) return;
    state.value = {
      tasks: Array.isArray(result?.tasks) ? result.tasks : [],
      platforms: Array.isArray(result?.platforms) ? result.platforms : [],
      webhookTypes: Array.isArray(result?.webhookTypes) ? result.webhookTypes : [],
      timeZoneId: result?.timeZoneId || "",
      localTime: result?.localTime || "",
    };
    pageError.value = "";
  } catch {
    if (!disposed && initial) pageError.value = t("error.state_failed", {}, "签到任务读取失败，请稍后重试。 ");
  } finally {
    loadingState = false;
    if (initial && !disposed) loading.value = false;
  }
}

function newDraft(task?: Task): TaskDraft {
  return task ? {
    id: task.id,
    name: task.name,
    enabled: task.enabled,
    games: Object.fromEntries(Object.entries(task.games || {}).map(([platform, selected]) => [platform, [...selected]])),
    cnDeviceId: task.cnDeviceId,
    kuroDevCode: task.kuroDevCode,
    kuroDistinctId: task.kuroDistinctId,
    schedules: (task.schedules || []).map(schedule => ({ ...schedule, days: [...schedule.days] })),
    notifications: JSON.parse(JSON.stringify(task.notifications)),
  } : {
    name: t("task.new", {}, "新签到任务"),
    enabled: true,
    games: {},
    cnDeviceId: "",
    kuroDevCode: "",
    kuroDistinctId: "",
    schedules: [],
    notifications: {
      webhook: { enabled: false, type: "generic", template: "{\"text\":{text}}" },
      smtp: { enabled: false, host: "", port: 465, secure: "auto", from: "", to: "", subjectPrefix: "[NexusPipeline]" },
    },
  };
}

function openEditor(task?: Task) {
  editor.value = newDraft(task);
  secretInputs.value = Object.fromEntries(secretKeys.map(key => [key, ""]));
  clearedSecrets.value = Object.fromEntries(secretKeys.map(key => [key, false]));
  editorError.value = "";
  requestAnimationFrame(() => {
    const input = document.querySelector<HTMLInputElement>("#gci-task-name input");
    input?.focus();
  });
}

function closeEditor() {
  editor.value = null;
  editorError.value = "";
}

function hasGame(platformId: string, gameId: string): boolean {
  return editor.value?.games[platformId]?.includes(gameId) === true;
}

function toggleGame(platformId: string, gameId: string, checked: boolean) {
  if (!editor.value) return;
  const selected = new Set(editor.value.games[platformId] || []);
  if (checked) selected.add(gameId);
  else selected.delete(gameId);
  if (selected.size) editor.value.games[platformId] = [...selected];
  else delete editor.value.games[platformId];
}

function addSchedule() {
  if (!editor.value) return;
  const randomUUID = globalThis.crypto?.randomUUID;
  const id = typeof randomUUID === "function"
    ? randomUUID.call(globalThis.crypto)
    : `draft-${Date.now().toString(36)}-${(++scheduleDraftSequence).toString(36)}`;
  editor.value.schedules.push({ id, days: [1, 2, 3, 4, 5], enabled: true, time: "09:00" });
}

function toggleDay(schedule: ScheduleDraft, day: number, checked: boolean) {
  const selected = new Set(schedule.days);
  if (checked) selected.add(day);
  else selected.delete(day);
  schedule.days = [...selected].sort((a, b) => a - b);
}

function scheduleDayLabels(selectedDays: number[]): string {
  return selectedDays.map(day => t(`day.${day}`, {}, ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][day])).join("、");
}

function dayLabel(day: number): string {
  return t(`day.${day}`, {}, ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][day]);
}

function selectedGameNames(task: Task): string[] {
  return Object.entries(task.games || {}).flatMap(([platformId, selected]) => {
    const platform = platforms.value.find(item => item.id === platformId);
    const platformName = platform?.name || t(`platform.${platformId}`, {}, platformId);
    return selected.map(gameId => {
      const game = platform?.games.find(item => item.id === gameId);
      return `${platformName} · ${game?.name || t(`game.${gameId}`, {}, gameId)}`;
    });
  });
}

function localizedDate(value: string | null | undefined): string {
  if (!value) return t("task.never_run", {}, "尚未运行");
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function taskStatus(task: Task): string {
  return task.isRunning ? t("status.running", {}, "运行中") : t(`status.${task.recentRun?.status || "idle"}`, {}, task.recentRun?.status || t("status.idle", {}, "待运行"));
}

function resultLabel(result: RunResult): string {
  if (result.code === "already") return t("result.already", {}, "今日已签到");
  if (result.success) return t("result.success", {}, "成功");
  return result.message || t(`result.${result.code}`, {}, "签到失败");
}

function gameName(platformId: string, gameCode: string): string {
  const platform = platforms.value.find(item => item.id === platformId);
  return platform?.games.find(game => game.id === gameCode)?.name || t(`game.${gameCode}`, {}, gameCode);
}

function secretIsConfigured(task: Task | undefined, key: string): boolean {
  if (credentialPlatforms.includes(key)) return task?.credentials?.[key] === true;
  if (key === "webhookUrl") return task?.webhookSecrets?.urlConfigured === true;
  if (key === "webhookSecret") return task?.webhookSecrets?.signingSecretConfigured === true;
  if (key === "smtpUser") return task?.smtpSecrets?.userConfigured === true;
  return task?.smtpSecrets?.passwordConfigured === true;
}

function secretLabel(key: string): string {
  const labels: Record<string, string> = {
    cn: "field.cn_credential",
    os: "field.os_credential",
    skland: "field.skland_credential",
    skport: "field.skport_credential",
    kuro: "field.kuro_credential",
    webhookUrl: "field.webhook_url",
    webhookSecret: "field.webhook_secret",
    smtpUser: "field.smtp_user",
    smtpPassword: "field.smtp_password",
  };
  return t(labels[key] || key, {}, key);
}

function secureOptions() {
  return smtpSecureOptions.map(option => ({
    ...option,
    label: t(`secure.${option.value}`, {}, option.value),
  }));
}

function secretActions(): Record<string, { action: "set" | "clear"; value?: string }> {
  const result: Record<string, { action: "set" | "clear"; value?: string }> = {};
  for (const key of secretKeys) {
    if (clearedSecrets.value[key]) result[key] = { action: "clear" };
    else if (secretInputs.value[key]) result[key] = { action: "set", value: secretInputs.value[key] };
  }
  return result;
}

async function saveTask() {
  if (!editor.value) return;
  editorError.value = "";
  const draft = editor.value;
  if (!draft.name.trim()) {
    editorError.value = t("error.task_name_invalid", {}, "请填写任务名称。");
    return;
  }
  if (!Object.values(draft.games).some(selected => selected.length > 0)) {
    editorError.value = t("error.games_invalid", {}, "请选择至少一个平台游戏。");
    return;
  }
  if (draft.schedules.some(schedule => schedule.days.length === 0 || !/^\d{2}:\d{2}$/.test(schedule.time))) {
    editorError.value = t("error.schedule_settings_invalid", {}, "请检查固定时间和星期设置。");
    return;
  }
  saving.value = true;
  const payload = {
    ...(draft.id ? { id: draft.id } : {}),
    name: draft.name,
    enabled: draft.enabled,
    games: draft.games,
    cnDeviceId: draft.cnDeviceId,
    kuroDevCode: draft.kuroDevCode,
    kuroDistinctId: draft.kuroDistinctId,
    schedules: draft.schedules,
    notifications: draft.notifications,
    secrets: secretActions(),
  };
  try {
    if (draft.id) await props.host.api.put("tasks", payload, controller.signal);
    else await props.host.api.post("tasks", payload, controller.signal);
    closeEditor();
    await loadState();
    props.host.ui?.toast(t("toast.saved", {}, "签到任务已保存。"), "success");
  } catch (error) {
    editorError.value = backendError(error, t("error.save_failed", {}, "任务保存失败，请检查填写内容后重试。"));
  } finally {
    saving.value = false;
  }
}

async function runTask(task: Task) {
  try {
    await props.host.api.post("tasks/run", { taskId: task.id }, controller.signal);
    await loadState();
    props.host.ui?.toast(t("toast.run_started", {}, "签到已开始。"), "info");
  } catch (error) {
    pageError.value = backendError(error, t("error.run_failed", {}, "签到启动失败，请稍后重试。"));
  }
}

async function deleteTask(task: Task) {
  if (!window.confirm(t("task.delete_confirm", {}, "删除此任务及其凭据？"))) return;
  try {
    await props.host.api.delete("tasks", { taskId: task.id }, controller.signal);
    if (editingId.value === task.id) closeEditor();
    await loadState();
    props.host.ui?.toast(t("toast.deleted", {}, "签到任务已删除。"), "success");
  } catch (error) {
    pageError.value = backendError(error, t("error.delete_failed", {}, "任务删除失败。"));
  }
}

function refreshLabel() {
  return loading.value ? t("status.loading", {}, "正在读取…") : pageError.value;
}

onMounted(() => {
  void loadState(true);
  pollTimer = setInterval(() => void loadState(), 5000);
});

onBeforeUnmount(() => {
  disposed = true;
  controller.abort();
  if (pollTimer) clearInterval(pollTimer);
});
</script>

<template>
  <section class="gci-page" data-game-check-in-page>
    <header class="gci-page-head">
      <div>
        <h1>{{ t("page.title", {}, "签到") }}</h1>
        <p>{{ t("page.description", {}, "管理游戏签到任务、执行计划与独立通知。") }}</p>
      </div>
      <nxp-button :label="t('action.add_task', {}, '添加签到任务')" tone="primary" @click="openEditor()" />
    </header>

    <p v-if="state?.timeZoneId" class="gci-timezone" role="note">
      {{ t("page.timezone", { zone: state.timeZoneId }, `本机时区：${state.timeZoneId}`) }}
    </p>
    <p v-if="pageError" class="gci-error" role="alert">{{ pageError }}</p>
    <p v-else-if="loading" class="gci-loading" role="status">{{ refreshLabel() }}</p>

    <form v-if="editor" class="gci-editor" data-task-editor @submit.prevent="saveTask">
      <header class="gci-editor-head">
        <div>
          <h2>{{ editingId ? t("editor.edit_title", {}, "编辑签到任务") : t("editor.new_title", {}, "新建签到任务") }}</h2>
          <p>{{ t("editor.description", {}, "每项任务独立保存账号凭据和通知目标。") }}</p>
        </div>
      </header>

      <div class="gci-form-grid">
        <label class="gci-field gci-field-wide">
          <span>{{ t("field.name", {}, "任务名称") }}</span>
          <nxp-text-input id="gci-task-name" :model-value="editor.name" maxlength="100" autocomplete="off" :aria-label="t('field.name', {}, '任务名称')" @change="editor.name = eventValue<string>($event).trim()" />
        </label>
        <div class="gci-toggle-row gci-field-wide">
          <span>{{ t('field.enabled', {}, '启用任务') }}</span>
          <nxp-switch class="gci-toggle" :model-value="editor.enabled" :aria-label="t('field.enabled', {}, '启用任务')" semantic-role="switch" @change="editor.enabled = eventValue<boolean>($event)" />
        </div>
      </div>

      <section class="gci-form-section">
        <div class="gci-section-head">
          <div>
            <h3>{{ t("field.platform_games", {}, "签到平台与游戏") }}</h3>
            <p>{{ t("editor.games_hint", {}, "选择任务要签到的平台和游戏。") }}</p>
          </div>
        </div>
        <div class="gci-platform-grid">
          <fieldset v-for="platform in platforms" :key="platform.id" class="gci-platform">
            <legend>{{ platform.name }}</legend>
            <label v-for="game in platform.games" :key="game.id" class="gci-check-row">
              <span>{{ game.name }}</span>
              <nxp-switch class="gci-check-switch" :model-value="hasGame(platform.id, game.id)" :aria-label="`${platform.name} · ${game.name}`" semantic-role="switch" @change="toggleGame(platform.id, game.id, eventValue<boolean>($event))" />
            </label>
          </fieldset>
        </div>
      </section>

      <section class="gci-form-section">
        <div class="gci-section-head">
          <div>
            <h3>{{ t("field.credential", {}, "独立凭据") }}</h3>
            <p>{{ t("editor.secret_hint", {}, "凭据只属于当前签到任务。编辑时留空会保留已保存值。") }}</p>
          </div>
        </div>
        <div class="gci-secret-grid">
          <div v-for="key in credentialPlatforms" :key="key" class="gci-secret-field">
            <label :for="`gci-secret-${key}`">{{ secretLabel(key) }}</label>
            <nxp-text-input :id="`gci-secret-${key}`" :model-value="secretInputs[key]" type="password" autocomplete="new-password" :placeholder="secretIsConfigured(editingTask, key) ? t('field.credential_placeholder', {}, '留空以保留已保存的凭据') : t('field.credential_missing', {}, '未配置')" :aria-label="secretLabel(key)" @change="setSecret(key, eventValue<string>($event))" />
            <div v-if="secretIsConfigured(editingTask, key)" class="gci-clear-secret-row">
              <span>{{ t('action.clear_secret', {}, '清除已保存凭据') }}</span>
              <nxp-switch class="gci-clear-secret" :model-value="clearedSecrets[key]" :aria-label="`${secretLabel(key)} · ${t('action.clear_secret', {}, '清除已保存凭据')}`" semantic-role="switch" @change="clearedSecrets[key] = eventValue<boolean>($event)" />
            </div>
          </div>
        </div>
      </section>

      <section class="gci-form-section">
        <div class="gci-section-head">
          <div>
            <h3>{{ t("field.device_settings", {}, "设备标识") }}</h3>
            <p>{{ t("editor.device_hint", {}, "留空时会为任务自动生成设备标识。") }}</p>
          </div>
        </div>
        <div class="gci-form-grid">
          <label class="gci-field"><span>{{ t("field.cn_device_id", {}, "米游社设备 ID") }}</span><nxp-text-input :model-value="editor.cnDeviceId" :aria-label="t('field.cn_device_id', {}, '米游社设备 ID')" @change="editor.cnDeviceId = eventValue<string>($event).trim()" /></label>
          <label class="gci-field"><span>{{ t("field.kuro_dev_code", {}, "库街区设备码") }}</span><nxp-text-input :model-value="editor.kuroDevCode" :aria-label="t('field.kuro_dev_code', {}, '库街区设备码')" @change="editor.kuroDevCode = eventValue<string>($event).trim()" /></label>
          <label class="gci-field gci-field-wide"><span>{{ t("field.kuro_distinct_id", {}, "库街区设备 ID") }}</span><nxp-text-input :model-value="editor.kuroDistinctId" :aria-label="t('field.kuro_distinct_id', {}, '库街区设备 ID')" @change="editor.kuroDistinctId = eventValue<string>($event).trim()" /></label>
        </div>
      </section>

      <section class="gci-form-section">
        <div class="gci-section-head">
          <div>
            <h3>{{ t("field.schedule", {}, "固定时间计划") }}</h3>
            <p>{{ t("field.schedule_hint", {}, "按本机时区执行；程序关闭期间错过的时间不会补跑。") }}</p>
          </div>
            <nxp-button :label="t('action.add_schedule', {}, '添加固定时间')" variant="ghost" @click="addSchedule" />
        </div>
        <div v-if="editor.schedules.length" class="gci-schedule-editor-list">
          <fieldset v-for="(schedule, index) in editor.schedules" :key="schedule.id" class="gci-schedule-editor-row">
            <legend>{{ t("field.schedule", {}, "固定时间计划") }} {{ index + 1 }}</legend>
            <div class="gci-schedule-controls">
              <label class="gci-field">
                <span>{{ t("field.schedule_time", {}, "时间") }}</span>
                <nxp-time-picker :model-value="schedule.time" :aria-label="`${t('field.schedule_time', {}, '时间')} ${index + 1}`" @change="schedule.time = eventValue<string>($event)" />
              </label>
              <div class="gci-toggle-row gci-schedule-toggle">
                <span>{{ t('field.schedule_enabled', {}, '启用此时间') }}</span>
                <nxp-switch class="gci-toggle" :model-value="schedule.enabled" :aria-label="`${t('field.schedule_enabled', {}, '启用此时间')} ${index + 1}`" semantic-role="switch" @change="schedule.enabled = eventValue<boolean>($event)" />
              </div>
              <nxp-button :label="t('action.remove_schedule', {}, '移除时间')" tone="danger" @click="editor.schedules.splice(index, 1)" />
            </div>
            <div class="gci-days" role="group" :aria-label="t('field.schedule_days', {}, '星期')">
              <label v-for="day in days" :key="day" class="gci-day-choice">
                <span>{{ dayLabel(day) }}</span>
                <nxp-switch class="gci-day-switch" :model-value="schedule.days.includes(day)" :aria-label="`${t('field.schedule_days', {}, '星期')} ${dayLabel(day)}`" semantic-role="switch" @change="toggleDay(schedule, day, eventValue<boolean>($event))" />
              </label>
            </div>
          </fieldset>
        </div>
        <p v-else class="gci-inline-empty">{{ t("empty.schedules", {}, "未设置固定时间") }}</p>
      </section>

      <section class="gci-form-section">
        <div class="gci-section-head">
          <div>
            <h3>{{ t("field.webhook", {}, "Webhook 通知") }}</h3>
            <p>{{ t("editor.notification_hint", {}, "每种通知单独设置目标和凭据。") }}</p>
          </div>
        </div>
        <div class="gci-toggle-row">
          <span>{{ t('field.webhook_enabled', {}, '启用 Webhook') }}</span>
          <nxp-switch class="gci-toggle" :model-value="editor.notifications.webhook.enabled" :aria-label="t('field.webhook_enabled', {}, '启用 Webhook')" semantic-role="switch" @change="editor.notifications.webhook.enabled = eventValue<boolean>($event)" />
        </div>
        <div class="gci-form-grid gci-form-grid-three">
          <label class="gci-field">
            <span>{{ t("field.webhook_type", {}, "Webhook 类型") }}</span>
            <nxp-select :model-value="editor.notifications.webhook.type" :options="(state?.webhookTypes || ['generic', 'feishu', 'dingtalk', 'wecom', 'discord', 'slack']).map(type => ({ value: type, label: t(`channel.${type}`, {}, type) }))" :aria-label="t('field.webhook_type', {}, 'Webhook 类型')" @change="editor.notifications.webhook.type = eventValue<string>($event)" />
          </label>
          <div class="gci-secret-field gci-field-wide">
            <label for="gci-webhook-url">{{ secretLabel("webhookUrl") }}</label>
            <nxp-text-input id="gci-webhook-url" :model-value="secretInputs.webhookUrl" type="password" autocomplete="new-password" :placeholder="taskWebhookConfigured ? t('field.secret_configured', {}, '已保存，留空保留') : ''" :aria-label="secretLabel('webhookUrl')" @change="setSecret('webhookUrl', eventValue<string>($event))" />
            <div v-if="taskWebhookConfigured" class="gci-clear-secret-row">
              <span>{{ t('field.secret_clear', {}, '清除已保存值') }}</span>
              <nxp-switch class="gci-clear-secret" :model-value="clearedSecrets.webhookUrl" :aria-label="`${secretLabel('webhookUrl')} · ${t('field.secret_clear', {}, '清除已保存值')}`" semantic-role="switch" @change="clearedSecrets.webhookUrl = eventValue<boolean>($event)" />
            </div>
          </div>
          <div class="gci-secret-field">
            <label for="gci-webhook-secret">{{ secretLabel("webhookSecret") }}</label>
            <nxp-text-input id="gci-webhook-secret" :model-value="secretInputs.webhookSecret" type="password" autocomplete="new-password" :placeholder="taskWebhookSecretConfigured ? t('field.secret_configured', {}, '已保存，留空保留') : ''" :aria-label="secretLabel('webhookSecret')" @change="setSecret('webhookSecret', eventValue<string>($event))" />
            <div v-if="taskWebhookSecretConfigured" class="gci-clear-secret-row">
              <span>{{ t('field.secret_clear', {}, '清除已保存值') }}</span>
              <nxp-switch class="gci-clear-secret" :model-value="clearedSecrets.webhookSecret" :aria-label="`${secretLabel('webhookSecret')} · ${t('field.secret_clear', {}, '清除已保存值')}`" semantic-role="switch" @change="clearedSecrets.webhookSecret = eventValue<boolean>($event)" />
            </div>
          </div>
          <label v-if="editor.notifications.webhook.type === 'generic'" class="gci-field gci-field-wide">
            <span>{{ t("field.webhook_template", {}, "自定义 JSON 模板") }}</span>
            <nxp-text-area :model-value="editor.notifications.webhook.template" rows="3" :aria-label="t('field.webhook_template', {}, '自定义 JSON 模板')" @change="editor.notifications.webhook.template = eventValue<string>($event)" />
            <small>{{ t("editor.template_hint", {}, "将 {text} 裸写在 JSON 值位置，不要加引号，以插入签到结果。") }}</small>
          </label>
        </div>
      </section>

      <section class="gci-form-section">
        <div class="gci-section-head">
          <div>
            <h3>{{ t("field.smtp", {}, "SMTP 邮件通知") }}</h3>
            <p>{{ t("editor.smtp_hint", {}, "SMTP 用户名和密码保存在当前任务的独立凭据中。") }}</p>
          </div>
        </div>
        <div class="gci-toggle-row">
          <span>{{ t('field.smtp_enabled', {}, '启用 SMTP') }}</span>
          <nxp-switch class="gci-toggle" :model-value="editor.notifications.smtp.enabled" :aria-label="t('field.smtp_enabled', {}, '启用 SMTP')" semantic-role="switch" @change="editor.notifications.smtp.enabled = eventValue<boolean>($event)" />
        </div>
        <div class="gci-form-grid gci-form-grid-three">
          <label class="gci-field"><span>{{ t("field.smtp_host", {}, "SMTP 服务器") }}</span><nxp-text-input :model-value="editor.notifications.smtp.host" autocomplete="off" :aria-label="t('field.smtp_host', {}, 'SMTP 服务器')" @change="editor.notifications.smtp.host = eventValue<string>($event).trim()" /></label>
          <label class="gci-field"><span>{{ t("field.smtp_port", {}, "端口") }}</span><nxp-number-input :model-value="editor.notifications.smtp.port" min="1" max="65535" :aria-label="t('field.smtp_port', {}, '端口')" @change="editor.notifications.smtp.port = Number(eventValue<number | string>($event))" /></label>
          <label class="gci-field"><span>{{ t("field.smtp_secure", {}, "安全连接") }}</span><nxp-select :model-value="editor.notifications.smtp.secure" :options="secureOptions()" :aria-label="t('field.smtp_secure', {}, '安全连接')" @change="editor.notifications.smtp.secure = eventValue<string>($event)" /></label>
          <div class="gci-secret-field"><label for="gci-smtp-user">{{ secretLabel("smtpUser") }}</label><nxp-text-input id="gci-smtp-user" :model-value="secretInputs.smtpUser" type="password" autocomplete="new-password" :placeholder="taskSmtpUserConfigured ? t('field.secret_configured', {}, '已保存，留空保留') : ''" :aria-label="secretLabel('smtpUser')" @change="setSecret('smtpUser', eventValue<string>($event))" /><div v-if="taskSmtpUserConfigured" class="gci-clear-secret-row"><span>{{ t('field.secret_clear', {}, '清除已保存值') }}</span><nxp-switch class="gci-clear-secret" :model-value="clearedSecrets.smtpUser" :aria-label="`${secretLabel('smtpUser')} · ${t('field.secret_clear', {}, '清除已保存值')}`" semantic-role="switch" @change="clearedSecrets.smtpUser = eventValue<boolean>($event)" /></div></div>
          <div class="gci-secret-field"><label for="gci-smtp-password">{{ secretLabel("smtpPassword") }}</label><nxp-text-input id="gci-smtp-password" :model-value="secretInputs.smtpPassword" type="password" autocomplete="new-password" :placeholder="taskSmtpPasswordConfigured ? t('field.secret_configured', {}, '已保存，留空保留') : ''" :aria-label="secretLabel('smtpPassword')" @change="setSecret('smtpPassword', eventValue<string>($event))" /><div v-if="taskSmtpPasswordConfigured" class="gci-clear-secret-row"><span>{{ t('field.secret_clear', {}, '清除已保存值') }}</span><nxp-switch class="gci-clear-secret" :model-value="clearedSecrets.smtpPassword" :aria-label="`${secretLabel('smtpPassword')} · ${t('field.secret_clear', {}, '清除已保存值')}`" semantic-role="switch" @change="clearedSecrets.smtpPassword = eventValue<boolean>($event)" /></div></div>
          <label class="gci-field"><span>{{ t("field.smtp_from", {}, "发件人（可留空）") }}</span><nxp-text-input :model-value="editor.notifications.smtp.from" autocomplete="off" :aria-label="t('field.smtp_from', {}, '发件人（可留空）')" @change="editor.notifications.smtp.from = eventValue<string>($event).trim()" /></label>
          <label class="gci-field gci-field-wide"><span>{{ t("field.smtp_to", {}, "收件人") }}</span><nxp-text-input :model-value="editor.notifications.smtp.to" autocomplete="off" :aria-label="t('field.smtp_to', {}, '收件人')" @change="editor.notifications.smtp.to = eventValue<string>($event).trim()" /><small>{{ t("editor.recipient_hint", {}, "可使用逗号分隔多个收件人。") }}</small></label>
          <label class="gci-field gci-field-wide"><span>{{ t("field.smtp_subject", {}, "邮件主题前缀") }}</span><nxp-text-input :model-value="editor.notifications.smtp.subjectPrefix" maxlength="120" :aria-label="t('field.smtp_subject', {}, '邮件主题前缀')" @change="editor.notifications.smtp.subjectPrefix = eventValue<string>($event).trim()" /></label>
        </div>
      </section>

      <p v-if="editorError" class="gci-error" role="alert">{{ editorError }}</p>
      <footer class="gci-editor-actions">
        <nxp-button :label="t('action.cancel', {}, '取消')" variant="ghost" @click="closeEditor" />
        <nxp-button :label="saving ? t('status.saving', {}, '保存中…') : t('action.save', {}, '保存任务')" tone="primary" :disabled="saving" @click="saveTask" />
      </footer>
    </form>

    <div v-if="tasks.length" class="gci-task-list" :aria-label="t('page.title', {}, '签到任务')">
      <article v-for="task in tasks" :key="task.id" class="gci-task-card">
        <header class="gci-task-head">
          <div class="gci-task-title">
            <h2>{{ task.name }}</h2>
            <nxp-badge :label="taskStatus(task)" :tone="task.isRunning ? 'blue' : task.recentRun?.status === 'success' ? 'ok' : task.recentRun?.status === 'failed' ? 'bad' : 'muted'" />
            <nxp-badge :label="task.enabled ? t('status.enabled', {}, '已启用') : t('status.disabled', {}, '已停用')" :tone="task.enabled ? 'ok' : 'muted'" />
          </div>
          <div class="gci-task-actions">
            <nxp-button :label="t('action.run', {}, '立即签到')" tone="primary" :disabled="task.isRunning" @click="runTask(task)" />
            <nxp-button :label="t('action.edit', {}, '编辑')" variant="ghost" @click="openEditor(task)" />
            <nxp-button :label="t('action.delete', {}, '删除任务')" tone="danger" :disabled="task.isRunning" @click="deleteTask(task)" />
          </div>
        </header>

        <div class="gci-task-meta">
          <div><span>{{ t("task.next_run", {}, "下次签到") }}</span><strong>{{ localizedDate(task.nextRunAt) }}</strong></div>
          <div><span>{{ t("task.last_run", {}, "最近运行") }}</span><strong>{{ localizedDate(task.recentRun?.completedAt || task.recentRun?.startedAt) }}</strong></div>
        </div>

        <section class="gci-task-section">
          <h3>{{ t("field.platform_games", {}, "签到平台与游戏") }}</h3>
          <div v-if="selectedGameNames(task).length" class="gci-tag-list"><span v-for="name in selectedGameNames(task)" :key="name" class="gci-tag">{{ name }}</span></div>
          <p v-else class="gci-inline-empty">{{ t("empty.games", {}, "未选择游戏") }}</p>
        </section>

        <section class="gci-task-section">
          <div class="gci-section-head"><h3>{{ t("field.schedule", {}, "固定时间计划") }}</h3><span class="gci-muted">{{ t("page.timezone", { zone: state?.timeZoneId || "" }, `本机时区：${state?.timeZoneId || ""}`) }}</span></div>
          <div v-if="task.schedules?.length" class="gci-schedule-list">
            <div v-for="schedule in task.schedules" :key="schedule.id" class="gci-schedule-row">
              <span class="gci-schedule-days">{{ scheduleDayLabels(schedule.days) }}</span>
              <strong>{{ schedule.time }}</strong>
              <nxp-badge :label="schedule.enabled ? t('status.enabled', {}, '已启用') : t('status.disabled', {}, '已停用')" :tone="schedule.enabled ? 'ok' : 'muted'" />
            </div>
          </div>
          <p v-else class="gci-inline-empty">{{ t("empty.schedules", {}, "未设置固定时间") }}</p>
        </section>

        <details class="gci-run-history">
          <summary>{{ t("action.show_results", {}, "运行结果") }} <span>({{ task.runs?.length || 0 }})</span></summary>
          <div v-if="task.runs?.length" class="gci-run-list">
            <section v-for="run in task.runs" :key="run.id" class="gci-run-card">
              <header class="gci-run-head">
                <div><strong>{{ localizedDate(run.startedAt) }}</strong><span>{{ t(`trigger.${run.trigger}`, {}, run.trigger) }}</span></div>
                <nxp-badge :label="t(`status.${run.status}`, {}, run.status)" :tone="run.status === 'success' ? 'ok' : run.status === 'running' ? 'blue' : run.status === 'partial' ? 'warn' : 'bad'" />
              </header>
              <ul v-if="run.results?.length" class="gci-result-list">
                <li v-for="(result, index) in run.results" :key="`${result.platform}-${result.gameCode}-${index}`" :class="result.success ? 'is-success' : 'is-failed'">
                  <span>{{ t(`platform.${result.platform}`, {}, result.platform) }} · {{ gameName(result.platform, result.gameCode) }}</span>
                  <strong>{{ resultLabel(result) }}</strong>
                </li>
              </ul>
              <p v-else class="gci-inline-empty">{{ t("task.no_results", {}, "没有运行结果") }}</p>
            </section>
          </div>
          <p v-else class="gci-inline-empty">{{ t("task.no_results", {}, "没有运行结果") }}</p>
        </details>
      </article>
    </div>
    <nxp-empty-state v-else-if="!loading && !pageError" :title="t('empty.title', {}, '还没有签到任务')" :description="t('empty.description', {}, '添加任务后，可设置游戏、固定时间和独立通知。')">
      <nxp-button :label="t('action.add_task', {}, '添加签到任务')" tone="primary" @click="openEditor()" />
    </nxp-empty-state>
  </section>
</template>
