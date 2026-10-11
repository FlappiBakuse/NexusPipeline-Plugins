<script setup lang="ts">
import { formatTime, translator } from "./formatting";
import type { Activity, ActivityHost } from "./types";
const props = defineProps<{ item: Activity; now: number; host: ActivityHost; image?: string; zone: string }>();
const t = translator(props.host);
</script>
<template>
  <article class="ga-event-card" :class="{ 'ga-event-card--no-image': !image }">
    <div class="ga-event-copy">
      <h4>{{ item.title }}</h4><p v-if="item.kind" class="ga-muted">{{ item.kind }}</p>
      <p class="ga-event-summary">{{ item.summary || t('details.summaryMissing') }}</p>
      <div class="ga-event-time"><span>{{ formatTime(item.times.start, host, zone) }}</span><span> — </span><span>{{ formatTime(item.times.playEnd, host, zone) }}</span></div>
    </div>
    <div v-if="image" class="ga-event-media"><img :src="image" :alt="item.cover?.alt ?? ''" /></div>
  </article>
</template>
