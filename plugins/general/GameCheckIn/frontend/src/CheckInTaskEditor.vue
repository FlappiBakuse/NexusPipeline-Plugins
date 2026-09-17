<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { PlatformOption, Schedule, Task, TaskDraft, TaskSavePayload, Translate } from "./types";

const props = defineProps<{
  open: boolean;
  task: Task | null;
  tasks: Task[];
  platforms: PlatformOption[];
  timeZoneId: string;
  submitting: boolean;
  error: string;
  nameError: string;
  translate: Translate;
}>();

const emit = defineEmits<{
  close: [];
  save: [payload: TaskSavePayload];
  invalid: [message: string];
  nameChange: [];
}>();

const draft = ref<TaskDraft | null>(null);
const secretInputs = ref<Record<string, string>>({});
const clearedSecrets = ref<Record<string, boolean>>({});
const settingsExpanded = ref(true);
const expandedScheduleIds = ref<string[]>([]);
const draggingScheduleId = ref("");
const dropScheduleId = ref("");
const localError = ref("");
const localNameError = ref("");
let scheduleSequence = 0;

const dayNames = computed(() => [
  t("day.0", {}, "周日"),
  t("day.1", {}, "周一"),
  t("day.2", {}, "周二"),
  t("day.3", {}, "周三"),
  t("day.4", {}, "周四"),
  t("day.5", {}, "周五"),
  t("day.6", {}, "周六"),
]);
const dayShortNames = computed(() => [
  t("common.sun", {}, "日"),
  t("common.mon", {}, "一"),
  t("common.tue", {}, "二"),
  t("common.wed", {}, "三"),
  t("common.thu", {}, "四"),
  t("common.fri", {}, "五"),
  t("common.sat", {}, "六"),
]);
watch(() => `${props.open}:${props.task?.id || "new"}`, () => {
  if (props.open) resetDraft();
  else draft.value = null;
}, { immediate: true });

function t(key: string, args: Record<string, unknown> = {}, fallback = "") {
  return props.translate(key, args, fallback);
}

function eventValue<T>(event: Event): T {
  const detail = (event as CustomEvent<unknown>).detail;
  if (Array.isArray(detail) && detail.length) return detail[0] as T;
  if (detail !== undefined) return detail as T;
  return (event.target as HTMLElement & { modelValue?: T })?.modelValue as T;
}

function resetDraft() {
  const task = props.task;
  draft.value = task ? {
    id: task.id,
    name: task.name,
    remark: task.remark || "",
    enabled: task.enabled,
    games: Object.fromEntries(Object.entries(task.games || {}).map(([platform, games]) => [platform, [...games]])),
    schedules: (task.schedules || []).map(schedule => ({ ...schedule, days: [...schedule.days] })),
    notification: { enabled: task.notification?.enabled === true, smtpTo: task.notification?.smtpTo || "" },
  } : {
    name: "",
    remark: "",
    enabled: true,
    games: {},
    schedules: [],
    notification: { enabled: false, smtpTo: "" },
  };
  secretInputs.value = Object.fromEntries(props.platforms.map(platform => [platform.id, ""]));
  clearedSecrets.value = Object.fromEntries(props.platforms.map(platform => [platform.id, false]));
  settingsExpanded.value = true;
  localError.value = "";
  localNameError.value = "";
  expandedScheduleIds.value = [];
}

function updateDraft<K extends keyof TaskDraft>(key: K, value: TaskDraft[K]) {
  if (draft.value) draft.value[key] = value;
  if (key === "name") {
    localNameError.value = "";
    localError.value = "";
    emit("nameChange");
  }
}

function setPlatformGames(platformId: string, event: Event) {
  if (!draft.value) return;
  const selected = eventValue<string[]>(event);
  const games = Array.isArray(selected) ? selected.map(String) : [];
  if (games.length) draft.value.games[platformId] = games;
  else delete draft.value.games[platformId];
}

function platformGamesDescription(platformId: string) {
  return t(`field.${platformId}_games_description`, {}, "可留空。");
}

function credentialKey(platformId: string) {
  return platformId === "cn" ? "cnCookie"
    : platformId === "os" ? "osCookie"
      : platformId === "skland" ? "sklandToken"
        : platformId === "skport" ? "skportToken"
          : platformId === "kuro" ? "kuroToken" : platformId;
}

function credentialDescription(platformId: string) {
  return t(`field.${credentialKey(platformId)}_description`, {}, "填写该平台凭据。");
}

function credentialPlaceholder(platformId: string) {
  return t(`field.${credentialKey(platformId)}_placeholder`, {}, "");
}

function addSchedule() {
  if (!draft.value || draft.value.schedules.length >= 30) return;
  const randomUUID = globalThis.crypto?.randomUUID;
  const id = typeof randomUUID === "function"
    ? randomUUID.call(globalThis.crypto)
    : `draft-${Date.now().toString(36)}-${(++scheduleSequence).toString(36)}`;
  const schedule: Schedule = { id, days: [1, 2, 3, 4, 5], enabled: true, time: "09:00" };
  draft.value.schedules.push(schedule);
  expandedScheduleIds.value = [...expandedScheduleIds.value, id];
}

function removeSchedule(index: number) {
  if (!draft.value) return;
  const [removed] = draft.value.schedules.splice(index, 1);
  if (removed) expandedScheduleIds.value = expandedScheduleIds.value.filter(id => id !== removed.id);
}

function isScheduleExpanded(id: string) {
  return expandedScheduleIds.value.includes(id);
}

function toggleSchedule(id: string) {
  expandedScheduleIds.value = isScheduleExpanded(id)
    ? expandedScheduleIds.value.filter(value => value !== id)
    : [...expandedScheduleIds.value, id];
}

function toggleDay(schedule: Schedule, day: number) {
  schedule.days = schedule.days.includes(day)
    ? schedule.days.filter(value => value !== day)
    : [...schedule.days, day].sort((left, right) => left - right);
}

function beginScheduleDrag(event: DragEvent, scheduleId: string) {
  draggingScheduleId.value = scheduleId;
  dropScheduleId.value = "";
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", scheduleId);
  }
}

function moveSchedule(sourceId: string, targetId: string) {
  if (!draft.value || !sourceId || !targetId || sourceId === targetId) return;
  const schedules = draft.value.schedules;
  const sourceIndex = schedules.findIndex(schedule => schedule.id === sourceId);
  if (sourceIndex < 0) return;
  const [schedule] = schedules.splice(sourceIndex, 1);
  const targetIndex = schedules.findIndex(item => item.id === targetId);
  schedules.splice(targetIndex < 0 ? schedules.length : targetIndex, 0, schedule);
}

function dropSchedule(event: DragEvent, targetId: string) {
  moveSchedule(event.dataTransfer?.getData("text/plain") || draggingScheduleId.value, targetId);
  draggingScheduleId.value = "";
  dropScheduleId.value = "";
}

function finishScheduleDrag() {
  draggingScheduleId.value = "";
  dropScheduleId.value = "";
}

function scheduleHandleKeydown(event: KeyboardEvent, scheduleId: string) {
  if (!draft.value || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return;
  event.preventDefault();
  const index = draft.value.schedules.findIndex(schedule => schedule.id === scheduleId);
  const target = index + (event.key === "ArrowUp" ? -1 : 1);
  if (index < 0 || target < 0 || target >= draft.value.schedules.length) return;
  [draft.value.schedules[index], draft.value.schedules[target]] = [draft.value.schedules[target], draft.value.schedules[index]];
}

function setSecret(platformId: string, value: string) {
  secretInputs.value[platformId] = value;
  if (value.trim()) clearedSecrets.value[platformId] = false;
}

function toggleSecretClear(platformId: string, value: boolean) {
  clearedSecrets.value[platformId] = value;
  if (value) secretInputs.value[platformId] = "";
}

function submit() {
  if (!draft.value || props.submitting) return;
  const value = draft.value;
  if (!value.name.trim() || value.name.trim().length > 100) {
    const message = t("error.task_name_invalid", {}, "请输入不超过 100 个字符的任务名称。");
    localNameError.value = message;
    emit("invalid", message);
    return;
  }
  if (props.tasks.some(task => task.id !== value.id && task.name.toLocaleLowerCase() === value.name.trim().toLocaleLowerCase())) {
    const message = t("error.task_name_duplicate", {}, "签到任务名称已存在。");
    localNameError.value = message;
    emit("invalid", message);
    return;
  }
  if (new TextEncoder().encode(value.remark).length > 512) {
    localError.value = t("error.task_remark_invalid", {}, "备注不能超过 512 字节。");
    return;
  }
  if (value.schedules.some(schedule => schedule.days.length === 0 || !/^\d{2}:\d{2}$/.test(schedule.time))) {
    localError.value = t("error.schedule_settings_invalid", {}, "请检查计划时间和执行星期。");
    return;
  }
  if (value.notification.smtpTo.length > 4096) {
    localError.value = t("error.smtp_recipient_invalid", {}, "SMTP 收件人内容过长。");
    return;
  }
  localError.value = "";
  const secrets: TaskSavePayload["secrets"] = {};
  for (const platform of props.platforms) {
    const input = secretInputs.value[platform.id] || "";
    if (input.trim()) secrets[platform.id] = { action: "set", value: input };
    else if (clearedSecrets.value[platform.id]) secrets[platform.id] = { action: "clear" };
    else secrets[platform.id] = { action: "keep" };
  }
  emit("save", {
    ...value,
    id: value.id,
    name: value.name.trim(),
    remark: value.remark.trim(),
    schedules: value.schedules.map(schedule => ({ ...schedule, days: [...schedule.days] })),
    notification: { ...value.notification, smtpTo: value.notification.smtpTo.trim() },
    secrets,
  });
}

</script>

<template>
  <nxp-modal
    v-if="open"
    :open="open"
    :title="task ? t('editor.edit_title', {}, '编辑签到任务') : t('editor.new_title', {}, '新建签到任务')"
    :aria-label="task ? t('editor.edit_title', {}, '编辑签到任务') : t('editor.new_title', {}, '新建签到任务')"
    size="wide"
    locked
    footer
    :close-label="t('action.close', {}, '关闭')"
    @close="emit('close')"
  >
    <div v-if="draft" class="gci-editor" data-task-editor>
      <section class="gci-editor-section">
        <div class="gci-form-grid">
          <nxp-field :label="t('field.name', {}, '任务名称')" required>
            <nxp-text-input
              id="gci-task-name"
              :model-value="draft.name"
              required
              :aria-invalid="Boolean(localNameError || nameError) ? 'true' : 'false'"
              :aria-label="t('field.name', {}, '任务名称')"
              @change="updateDraft('name', String(eventValue($event) || ''))"
              @update:model-value="updateDraft('name', String(eventValue($event) || ''))"
            />
          </nxp-field>
          <nxp-field :label="t('field.remark', {}, '备注')">
            <nxp-text-area
              id="gci-task-remark"
              :model-value="draft.remark"
              rows="2"
              :aria-label="t('field.remark', {}, '备注')"
              @change="updateDraft('remark', String(eventValue($event) || ''))"
            />
          </nxp-field>
        </div>
        <nxp-switch-setting
          id="gci-task-enabled"
          :model-value="draft.enabled"
          :label="t('field.task_enabled', {}, '启用此任务')"
          :description="t('field.task_enabled_help', {}, '停用后不会按计划自动签到。')"
          :aria-label="t('field.task_enabled', {}, '启用此任务')"
          @change="updateDraft('enabled', eventValue<boolean>($event))"
        />
      </section>

      <nxp-collapsible-card
        class="gci-checkin-settings"
        :title="t('field.checkin_settings', {}, '签到设置')"
        :description="t('field.checkin_settings_help', {}, '按需配置五个平台的游戏和凭据，本任务触发时将对所选游戏执行签到。')"
        panel-id="gci-checkin-settings"
        surface="secondary"
        :expanded="settingsExpanded"
        @toggle="settingsExpanded = eventValue<boolean>($event)"
      >
        <div class="gci-checkin-fields">
        <div class="gci-platform-list">
          <nxp-field
            v-for="platform in platforms"
            :key="`${platform.id}-games`"
            :label="t('field.platform_games', { platform: platform.name }, `${platform.name} 签到游戏`)"
            :help="platformGamesDescription(platform.id)"
          >
            <nxp-select
              :id="`gci-games-${platform.id}`"
              :model-value="draft.games[platform.id] || []"
              :options="platform.games.map(game => ({ value: game.id, label: game.name }))"
              :multiple="true"
              :disabled="platform.games.length === 0"
              :placeholder="t('common.choose', {}, '请选择')"
              :aria-label="t('field.platform_games', { platform: platform.name }, `${platform.name} 签到游戏`)"
              @change="setPlatformGames(platform.id, $event)"
            />
          </nxp-field>
        </div>

        <div class="gci-credential-list">
          <div v-for="platform in platforms" :key="platform.id" class="gci-credential-row">
            <nxp-field
              :label="t('field.credential', { platform: platform.name }, `${platform.name} 凭据`)"
              :help="credentialDescription(platform.id)"
            >
              <nxp-text-input
                :id="`gci-secret-${platform.id}`"
                :model-value="secretInputs[platform.id] || ''"
                type="password"
                autocomplete="new-password"
                :placeholder="task?.credentials?.[platform.id] ? t('field.secret_configured', {}, '已保存，留空保留') : credentialPlaceholder(platform.id)"
                :aria-label="t('field.credential', { platform: platform.name }, `${platform.name} 凭据`)"
                @change="setSecret(platform.id, String(eventValue($event) || ''))"
              />
            </nxp-field>
            <nxp-switch-setting
              v-if="task?.credentials?.[platform.id]"
              :id="`gci-clear-${platform.id}`"
              :model-value="clearedSecrets[platform.id] === true"
              :label="t('field.secret_clear', {}, '清除已保存凭据')"
              :aria-label="`${platform.name} · ${t('field.secret_clear', {}, '清除已保存凭据')}`"
              @change="toggleSecretClear(platform.id, eventValue<boolean>($event))"
            />
          </div>
        </div>

        <section class="gci-notification-settings">
          <nxp-switch-setting
            id="gci-notification-enabled"
            :model-value="draft.notification.enabled"
            :label="t('field.notifications_enabled', {}, '启用通知')"
            :description="t('field.notifications_help', {}, '使用宿主全局 Webhook 与 SMTP 设置。')"
            :aria-label="t('field.notifications_enabled', {}, '启用通知')"
            @change="draft.notification.enabled = eventValue<boolean>($event)"
          />
          <nxp-field
            :label="t('field.smtp_to', {}, 'SMTP 收件人')"
            :help="t('field.smtp_to_help', {}, '留空时继承宿主全局 SMTP 收件人。')"
          >
            <nxp-text-input
              id="gci-smtp-to"
              :model-value="draft.notification.smtpTo"
              autocomplete="email"
              :aria-label="t('field.smtp_to', {}, 'SMTP 收件人')"
              @change="draft.notification.smtpTo = String(eventValue($event) || '')"
            />
          </nxp-field>
        </section>
        </div>
      </nxp-collapsible-card>

      <section class="gci-schedules">
        <header class="gci-section-heading">
          <div>
            <h3>{{ t("field.schedule", {}, "定时计划") }}</h3>
            <p>{{ t("field.schedule_help", { zone: timeZoneId }, `按本机时区 ${timeZoneId} 执行；应用关闭期间错过的时间不会补跑。`) }}</p>
          </div>
        </header>

        <div v-if="draft.schedules.length" class="gci-schedule-list">
          <article
            v-for="(schedule, index) in draft.schedules"
            :key="schedule.id"
            class="gci-schedule-card"
            :class="{ 'is-open': isScheduleExpanded(schedule.id), 'is-dragging': draggingScheduleId === schedule.id, 'is-drop-target': dropScheduleId === schedule.id }"
            :data-schedule-id="schedule.id"
            @dragover.prevent="dropScheduleId = schedule.id"
            @dragleave.self="dropScheduleId = ''"
            @drop.prevent="dropSchedule($event, schedule.id)"
          >
            <div class="gci-schedule-head">
              <span
                class="gci-drag-handle"
                role="button"
                tabindex="0"
                draggable="true"
                :aria-label="t('common.reorder.schedule', { index: index + 1 }, `调整计划 ${index + 1} 的顺序`)"
                :title="t('common.drag_to_reorder', {}, '拖动以调整顺序')"
                @dragstart.stop="beginScheduleDrag($event, schedule.id)"
                @dragend="finishScheduleDrag"
                @keydown="scheduleHandleKeydown($event, schedule.id)"
              >⠿</span>
              <button
                class="gci-schedule-summary"
                type="button"
                :aria-expanded="isScheduleExpanded(schedule.id)"
                :aria-controls="`gci-schedule-${schedule.id}`"
                @click="toggleSchedule(schedule.id)"
              >
                <span class="gci-schedule-summary-main"><strong>{{ t('schedule.label', { index: index + 1 }, `定时 ${index + 1}`) }}</strong><span>{{ schedule.time }} · {{ t('schedule.days_count', { count: schedule.days.length }, `${schedule.days.length} 天`) }}</span></span>
                <span class="gci-schedule-chevron" aria-hidden="true">{{ isScheduleExpanded(schedule.id) ? "⌄" : "›" }}</span>
              </button>
            </div>
            <div v-if="isScheduleExpanded(schedule.id)" :id="`gci-schedule-${schedule.id}`" class="gci-schedule-details">
              <div class="gci-schedule-layout">
                <div class="gci-schedule-days">
                  <span class="gci-field-label">{{ t("field.schedule_days", {}, "执行周期（可多选）") }}</span>
                  <div class="gci-day-buttons" role="group" :aria-label="t('field.schedule_days', {}, '执行星期')">
                    <button
                      v-for="(name, day) in dayNames"
                      :key="day"
                      class="gci-day-button"
                      type="button"
                      :aria-pressed="schedule.days.includes(day)"
                      :aria-label="name"
                      :title="name"
                      @click="toggleDay(schedule, day)"
                    >{{ dayShortNames[day] }}</button>
                  </div>
                </div>
                <label class="gci-field gci-schedule-time">
                  <span>{{ t("field.schedule_time", {}, "执行时间") }}</span>
                  <nxp-time-picker
                    :id="`gci-time-${schedule.id}`"
                    :model-value="schedule.time"
                    :aria-label="t('field.schedule_time', {}, '时间')"
                    @change="schedule.time = String(eventValue($event) || schedule.time)"
                  />
                </label>
              </div>
              <footer class="gci-schedule-actions">
                <nxp-switch
                  :model-value="schedule.enabled"
                  semantic-role="switch"
                  :aria-label="`${t('field.schedule_enabled', {}, '启用此计划')} ${index + 1}`"
                  @change="schedule.enabled = eventValue<boolean>($event)"
                />
                <nxp-button :label="t('action.remove_schedule', {}, '删除计划')" variant="ghost" @click="removeSchedule(index)" />
              </footer>
            </div>
          </article>
        </div>
        <p v-else class="gci-empty-schedules">{{ t("empty.schedules", {}, "还没有定时计划") }}</p>
        <nxp-button
          :label="`+ ${t('action.add_schedule', {}, '添加定时')}`"
          variant="ghost"
          :disabled="draft.schedules.length >= 30"
          @click="addSchedule"
        />
      </section>

      <p v-if="localError || error" class="gci-error" role="alert">{{ localError || error }}</p>
    </div>

    <div slot="footer" class="gci-modal-footer-actions">
      <nxp-button
        :label="submitting ? t('status.saving', {}, '保存中…') : t('action.save', {}, '保存')"
        tone="primary"
        :busy="submitting"
        @click="submit"
      />
      <nxp-button :label="t('action.cancel', {}, '取消')" variant="ghost" :disabled="submitting" @click="emit('close')" />
    </div>
  </nxp-modal>
</template>
