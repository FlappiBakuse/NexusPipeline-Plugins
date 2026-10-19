<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from "vue";
import { order, status } from "./activityPolicy";
import { translator } from "./formatting";
import ActivityEventCard from "./ActivityEventCard.vue";
import type { CoverAssetsModel } from "./useCoverAssets";
import type { ActivityHost, Feed } from "./types";
const props = defineProps<{ feed: Feed; now: number; host: ActivityHost; covers: CoverAssetsModel; zone: string }>();
const t = translator(props.host);
const groupPrefix = props.covers.createGroup();
const expanded = ref(new Set(["ongoing", "upcoming", "unknown"]));
watch(() => props.feed.activities.filter(item => expanded.value.has(status(item, props.now))).map(item => ({ id: item.eventId, entityId: item.eventId, cover: item.cover })),
  values => props.covers.bindMany(groupPrefix, values), { immediate: true });
onBeforeUnmount(() => props.covers.releaseGroup(groupPrefix));
function toggle(event: Event, state: string) { const next = new Set(expanded.value); if ((event.target as HTMLDetailsElement).open) next.add(state); else next.delete(state); expanded.value = next; }
const groups = computed(() => {
  const items = order(props.feed.activities, props.now);
  return ["ongoing", "upcoming", "ended", "unknown"].map(state => ({ state, items: items.filter(item => status(item, props.now) === state) })).filter(group => group.items.length);
});
</script>
<template>
  <div class="ga-details">
    <header class="ga-detail-intro">
      <div><span class="ga-eyebrow">{{ t('details.game') }}</span><h2>{{ t(`game.${feed.gameId}`) }}</h2></div>
      <div v-if="feed.progressionId !== 'default'" class="ga-detail-badges"><span>{{ t(`progression.${feed.progressionId}`) }}</span></div>
      <p class="ga-muted">{{ t('details.timezone', { zone }) }}</p>
      <p class="ga-muted">{{ t('source.sra') }}</p>
      <p v-if="feed.health.cacheState === 'stale'" class="ga-notice">{{ t('sra.cached') }}</p>
    </header>
    <section class="ga-detail-section" :aria-label="t('section.activities')">
      <div class="ga-section-title"><h3>{{ t('section.activities') }}</h3><span>{{ feed.activities.length }}</span></div>
      <p v-if="!groups.length" class="ga-muted ga-section-empty">{{ t('details.empty') }}</p>
      <details v-for="group in groups" :key="group.state" class="ga-state-group" :open="expanded.has(group.state)" @toggle="toggle($event, group.state)">
        <summary><span class="ga-state-dot" :data-state="group.state"></span><span>{{ t(`state.${group.state}`) }}</span><span class="ga-group-count">{{ group.items.length }}</span></summary>
        <div class="ga-event-list"><ActivityEventCard v-for="item in group.items" :key="item.eventId" :item="item" :image="covers.images.value[groupPrefix + item.eventId]" :host="host" :now="now" :zone="zone" /></div>
      </details>
    </section>
  </div>
</template>
