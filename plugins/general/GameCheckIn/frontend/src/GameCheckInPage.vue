<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import CheckInTaskEditor from "./CheckInTaskEditor.vue";
import CheckInTaskList from "./CheckInTaskList.vue";
import type { PluginHost, Task, TaskSavePayload, TaskState, Translate } from "./types";

const props = defineProps<{ host: PluginHost }>();

const state = ref<TaskState | null>(null);
const loading = ref(true);
const saving = ref(false);
const editorOpen = ref(false);
const editorTask = ref<Task | null>(null);
const pageError = ref("");
const editorError = ref("");
const nameError = ref("");
const deleteTarget = ref<Task | null>(null);
const deleting = ref(false);
const requestController = new AbortController();
let pollTimer: ReturnType<typeof setInterval> | null = null;
let disposed = false;
let loadingState = false;

const tasks = computed(() => state.value?.tasks || []);
const platforms = computed(() => state.value?.platforms || []);

const translate: Translate = (key, args = {}, fallback = "") =>
  props.host.i18n.t(key, args, fallback);

function t(key: string, args: Record<string, unknown> = {}, fallback = "") {
  return translate(key, args, fallback);
}

function backendCode(error: unknown) {
  const candidate = error as { code?: unknown; data?: unknown } | null;
  if (typeof candidate?.code === "string" && candidate.code) return candidate.code;
  const data = candidate?.data as { code?: unknown; error?: unknown } | null;
  if (typeof data?.code === "string" && data.code) return data.code;
  return typeof data?.error === "string" ? data.error : "";
}

function backendError(error: unknown, fallback: string) {
  const code = backendCode(error);
  return code ? t(`error.${code}`, {}, fallback) : fallback;
}

async function loadState(initial = false) {
  if (loadingState || disposed) return;
  loadingState = true;
  try {
    const result = await props.host.api.get("state", requestController.signal) as Partial<TaskState> | null;
    if (disposed) return;
    state.value = {
      tasks: Array.isArray(result?.tasks) ? result.tasks : [],
      platforms: Array.isArray(result?.platforms) ? result.platforms : [],
      timeZoneId: typeof result?.timeZoneId === "string" ? result.timeZoneId : "",
    };
    pageError.value = "";
  } catch (error) {
    if (!disposed && initial) pageError.value = backendError(error, t("error.state_failed", {}, "签到任务读取失败，请稍后重试。"));
  } finally {
    loadingState = false;
    if (initial && !disposed) loading.value = false;
  }
}

function openEditor(task: Task | null = null) {
  nameError.value = "";
  editorTask.value = task;
  editorError.value = "";
  editorOpen.value = true;
}

function closeEditor() {
  if (saving.value) return;
  editorOpen.value = false;
  editorTask.value = null;
  editorError.value = "";
}

async function saveTask(payload: TaskSavePayload) {
  if (saving.value) return;
  saving.value = true;
  editorError.value = "";
  try {
    if (payload.id) await props.host.api.put("tasks", payload, requestController.signal);
    else await props.host.api.post("tasks", payload, requestController.signal);
    editorOpen.value = false;
    editorTask.value = null;
    await loadState();
    props.host.ui?.toast(t("toast.saved", {}, "签到任务已保存。"), "success");
  } catch (error) {
    const code = backendCode(error);
    const message = backendError(error, t("error.save_failed", {}, "任务保存失败，请检查填写内容后重试。"));
    if (["task_name_invalid", "task_name_duplicate"].includes(code)) {
      nameError.value = message;
      editorError.value = "";
    } else {
      editorError.value = message;
    }
    props.host.ui?.toast(message, "error");
  } finally {
    saving.value = false;
  }
}

async function reorderTasks(taskIds: string[]) {
  if (!state.value || taskIds.length !== state.value.tasks.length) return;
  const taskMap = new Map(state.value.tasks.map(task => [task.id, task]));
  if (new Set(taskIds).size !== taskIds.length || taskIds.some(id => !taskMap.has(id))) return;
  const previous = state.value.tasks;
  state.value = { ...state.value, tasks: taskIds.map(id => taskMap.get(id)!) };
  try {
    await props.host.api.put("tasks/order", { taskIds }, requestController.signal);
    await loadState();
  } catch (error) {
    state.value = { ...state.value, tasks: previous };
    pageError.value = backendError(error, t("error.task_order_save_failed", {}, "任务顺序保存失败。"));
  }
}

async function runTask(task: Task) {
  try {
    await props.host.api.post("tasks/run", { taskId: task.id }, requestController.signal);
    await loadState();
    props.host.ui?.toast(t("toast.run_started", {}, "签到已开始。"), "info");
  } catch (error) {
    pageError.value = backendError(error, t("error.run_failed", {}, "签到启动失败，请稍后重试。"));
  }
}

async function deleteTask() {
  const task = deleteTarget.value;
  if (!task || deleting.value) return;
  deleting.value = true;
  try {
    await props.host.api.delete("tasks", { taskId: task.id }, requestController.signal);
    deleteTarget.value = null;
    if (editorTask.value?.id === task.id) closeEditor();
    await loadState();
    props.host.ui?.toast(t("toast.deleted", {}, "签到任务已删除。"), "success");
  } catch (error) {
    pageError.value = backendError(error, t("error.delete_failed", {}, "任务删除失败。"));
    props.host.ui?.toast(pageError.value, "error");
  } finally {
    deleting.value = false;
  }
}

onMounted(() => {
  void loadState(true);
  pollTimer = setInterval(() => void loadState(), 5000);
});

onBeforeUnmount(() => {
  disposed = true;
  requestController.abort();
  if (pollTimer) clearInterval(pollTimer);
});
</script>

<template>
  <section class="gci-page" data-game-check-in-page>
    <header class="gci-page-header">
      <div class="gci-page-header-copy">
        <div class="gci-page-header-eyebrow">{{ t("page.title", {}, "签到") }}</div>
        <h2>{{ t("page.title", {}, "签到") }}</h2>
        <p class="gci-page-header-description">{{ t("page.description", {}, "管理多平台签到任务和运行计划。") }}</p>
      </div>
      <div class="gci-page-header-actions">
        <nxp-button :label="t('action.add_task', {}, '添加签到任务')" tone="primary" type="button" @click="openEditor()" />
      </div>
    </header>

    <p v-if="pageError" class="gci-error" role="alert">{{ pageError }}</p>
    <p v-else-if="loading" class="gci-loading" role="status">{{ t("status.loading", {}, "正在读取…") }}</p>

    <CheckInTaskList
      v-if="tasks.length"
      :tasks="tasks"
      :platforms="platforms"
      :translate="translate"
      @run="runTask"
      @edit="openEditor"
      @remove="deleteTarget = $event"
      @reorder="reorderTasks"
    />
    <nxp-empty-state
      v-else-if="!loading && !pageError"
      :title="t('empty.title', {}, '还没有签到任务')"
      :description="t('empty.description', {}, '创建任务后设置游戏、凭据和定时计划。')"
    >
      <nxp-button :label="t('action.add_task', {}, '添加签到任务')" tone="primary" type="button" @click="openEditor()" />
    </nxp-empty-state>

    <CheckInTaskEditor
      :open="editorOpen"
      :task="editorTask"
      :tasks="state?.tasks || []"
      :platforms="platforms"
      :time-zone-id="state?.timeZoneId || ''"
      :submitting="saving"
      :error="editorError"
      :name-error="nameError"
      :translate="translate"
      @close="closeEditor"
      @save="saveTask"
      @invalid="props.host.ui?.toast($event, 'error')"
      @name-change="nameError = ''; editorError = ''"
    />
    <nxp-modal v-if="deleteTarget" open footer :title="t('action.delete', {}, '删除签到')" :locked="deleting" :closeable="!deleting" :close-label="t('action.close', {}, '关闭')" @close="!deleting && (deleteTarget = null)">
      <p class="gci-confirm-message">{{ t('task.delete_confirm', {}, '删除此任务、计划和凭据？') }} — {{ deleteTarget.name }}</p>
      <div slot="footer" class="gci-modal-footer-actions">
        <nxp-button :label="t('action.cancel', {}, '取消')" variant="ghost" :disabled="deleting" @click="deleteTarget = null" />
        <nxp-button :label="t('action.confirm', {}, '确定')" tone="danger" :busy="deleting" @click="deleteTask" />
      </div>
    </nxp-modal>
  </section>
</template>
