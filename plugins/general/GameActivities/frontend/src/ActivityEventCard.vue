<script setup lang="ts">
import { computed } from "vue";
import { instant, status } from "./activityPolicy";
import { formatStart, formatTime, translator } from "./formatting";
import ActivityDescription from "./ActivityDescription.vue";
import type { Activity, ActivityHost } from "./types";

const props = defineProps<{ item: Activity; now: number; host: ActivityHost }>();
const emit = defineEmits<{ official: [item: Activity] }>();
const t = translator(props.host);
const claimOpen = computed(() => {
  const end = instant(props.item.times.claimEnd);
  return status(props.item, props.now) === "ended" && end !== null && end > props.now;
});
</script>

<template>
  <article class="ga-event-card">
    <header class="ga-event-heading">
      <h4>{{ item.title }}</h4>
      <span v-if="['major-story', 'story', 'featured-gameplay'].includes(item.importance)" class="ga-event-tag">{{ t(`importance.${item.importance}`) }}</span>
    </header>
    <dl class="ga-event-times">
      <div><dt>{{ t('time.start') }}</dt><dd :title="item.times.start?.rawValue ?? undefined">{{ formatStart(item.times.start, host) }}</dd></div>
      <div><dt>{{ t('time.playEnd') }}</dt><dd>{{ item.availability === 'permanent' ? t('time.permanent') : formatTime(item.times.playEnd, host) }}</dd></div>
      <div v-if="item.times.claimEnd"><dt>{{ t('time.claimEnd') }}</dt><dd>{{ formatTime(item.times.claimEnd, host) }}</dd></div>
    </dl>
    <p v-if="claimOpen" class="ga-notice">{{ t('time.claimOpen') }}</p>
    <ActivityDescription :item="item" :host="host" />
    <footer class="ga-event-footer">
      <a v-if="item.officialUrl" :href="item.officialUrl" rel="noopener noreferrer" @click.prevent="emit('official', item)">{{ t(item.officialLinkKind === 'exact-activity' ? 'link.activity' : 'link.version') }} ↗</a>
      <span v-else class="ga-muted">{{ t('link.missing') }}</span>
    </footer>
  </article>
</template>
