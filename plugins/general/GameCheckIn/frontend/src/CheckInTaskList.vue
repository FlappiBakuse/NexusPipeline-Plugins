<script setup lang="ts">
import type { PlatformOption, Task, Translate } from "./types";

const props = defineProps<{
  tasks: Task[];
  platforms: PlatformOption[];
  translate: Translate;
}>();

const emit = defineEmits<{
  run: [task: Task];
  edit: [task: Task];
  remove: [task: Task];
  reorder: [taskIds: string[]];
}>();

function t(key: string, args: Record<string, unknown> = {}, fallback = "") {
  return props.translate(key, args, fallback);
}

function eventValue<T>(event: Event): T {
  const detail = (event as CustomEvent<unknown>).detail;
  if (Array.isArray(detail) && detail.length) return detail[0] as T;
  if (detail !== undefined) return detail as T;
  return (event.target as HTMLElement & { modelValue?: T })?.modelValue as T;
}

function initial(name: string) {
  return Array.from(name.trim())[0]?.toLocaleUpperCase() || "?";
}

function selectedGameCount(task: Task) {
  return Object.values(task.games || {}).reduce((count, games) => count + games.length, 0);
}

function nextRunLabel(value: string | null) {
  if (!value) return t("task.no_next_run", {}, "未安排下次运行");
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return t("task.no_next_run", {}, "未安排下次运行");
  return t("task.next_run_badge", { time: date.toLocaleString(undefined, { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) }, `下次 ${date.toLocaleString(undefined, { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}`);
}

function runTone(status?: string) {
  if (status === "running") return "blue";
  if (status === "success") return "ok";
  if (status === "partial") return "warn";
  if (status === "failed" || status === "cancelled") return "bad";
  return "muted";
}

function formatDate(value?: string | null) {
  if (!value) return t("task.no_results", {}, "没有运行记录");
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function gameName(platformId: string, gameId: string) {
  const platform = props.platforms.find(item => item.id === platformId);
  return platform?.games.find(game => game.id === gameId)?.name || gameId;
}

function reorderTasks(ids: string[]) {
  const currentIds = props.tasks.map(task => task.id);
  if (
    ids.length !== currentIds.length
    || new Set(ids).size !== currentIds.length
    || ids.some(id => !currentIds.includes(id))
    || ids.every((id, index) => id === currentIds[index])
  ) return;
  emit("reorder", ids);
}
</script>

<template>
  <nxp-sortable-list
    class="gci-task-list"
    tag="div"
    role="list"
    :aria-label="t('page.title', {}, '签到任务')"
    @reorder="reorderTasks(eventValue<string[]>($event))"
  >
    <article
      v-for="task in tasks"
      :key="task.id"
      class="gci-task-row"
      :data-task-id="task.id"
      :data-dnd-id="task.id"
      role="listitem"
    >
      <div class="gci-task-row-main">
        <nxp-drag-handle
          class="gci-drag-handle"
          :label="t('common.reorder.task', { name: task.name }, `调整 ${task.name} 的顺序`)"
          :title="t('common.drag_to_reorder', {}, '拖动以调整顺序')"
        />
        <span class="gci-task-avatar" aria-hidden="true">{{ initial(task.name) }}</span>
        <div class="gci-task-copy">
          <div class="gci-task-heading">
            <h2>{{ task.name }}</h2>
          </div>
          <p v-if="task.remark" class="gci-task-remark">{{ task.remark }}</p>
          <div class="gci-task-meta">
            <nxp-badge
              :label="task.enabled ? t('status.enabled', {}, '已启用') : t('status.disabled', {}, '已停用')"
              :tone="task.enabled ? 'ok' : 'muted'"
            />
            <nxp-badge
              v-if="task.recentRun"
              :label="t(`status.${task.recentRun.status}`, {}, task.recentRun.status)"
              :tone="runTone(task.recentRun.status)"
            />
            <nxp-badge
              :label="task.notification?.enabled ? t('status.notifications_on', {}, '通知已开启') : t('status.notifications_off', {}, '通知已关闭')"
              :tone="task.notification?.enabled ? 'blue' : 'muted'"
            />
            <nxp-badge :label="t('task.games_count', { count: selectedGameCount(task) }, `${selectedGameCount(task)} 个游戏`)" tone="muted" />
            <nxp-badge :label="nextRunLabel(task.nextRunAt)" tone="blue" />
          </div>
        </div>
        <div class="gci-task-actions">
          <nxp-button
            :label="t('action.run', {}, '立即签到')"
            variant="ghost"
            :disabled="task.isRunning"
            @click="emit('run', task)"
          />
          <nxp-button :label="t('action.edit', {}, '编辑签到')" variant="ghost" @click="emit('edit', task)" />
          <nxp-button
            :label="t('action.delete', {}, '删除签到')"
            tone="danger"
            variant="ghost"
            :disabled="task.isRunning"
            @click="emit('remove', task)"
          />
        </div>
      </div>

      <details v-if="task.runs?.length" class="gci-run-history">
        <summary>{{ t("action.show_results", {}, "运行记录") }} · {{ task.runs.length }}</summary>
        <div class="gci-run-list">
          <section v-for="run in task.runs" :key="run.id" class="gci-run-entry">
            <header class="gci-run-entry-head">
              <span>{{ formatDate(run.completedAt || run.startedAt) }}</span>
              <nxp-badge :label="t(`status.${run.status}`, {}, run.status)" :tone="runTone(run.status)" />
            </header>
            <ul v-if="run.results?.length">
              <li v-for="(result, index) in run.results" :key="`${result.platform}-${result.gameCode}-${index}`">
                <span>{{ gameName(result.platform, result.gameCode) }}</span>
                <span>{{ result.message }}</span>
              </li>
            </ul>
          </section>
        </div>
      </details>
    </article>
  </nxp-sortable-list>
</template>
