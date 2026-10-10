<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { countdown, instant } from "./activityPolicy";
import { formatTime, translator, versionLabel } from "./formatting";
import ActivityDetails from "./ActivityDetails.vue";
import ActivitySettings from "./ActivitySettings.vue";
import type { ActivityStateModel } from "./useActivityState";
import type { CoverAssetsModel } from "./useCoverAssets";
import { feedKey, type ActivityHost, type Settings, type TimePoint } from "./types";

const props = defineProps<{ host: ActivityHost; state: ActivityStateModel; covers: CoverAssetsModel }>();
const t = translator(props.host);
const { current, feeds, index, error, busy, refreshing, now, saveSettings, refresh } = props.state;
const settingsOpen = ref(false);
const detailsOpen = ref(false);
const hovered = ref(false);
const focused = ref(false);
const reduced = ref(false);
const paused = ref(false);
const selected = computed(() => current.value?.selectedFeeds[index.value]);
const feed = computed(() => selected.value ? feeds.value[feedKey(selected.value.gameId, selected.value.progressionId)] : null);
const slides = computed(() => (current.value?.selectedFeeds ?? []).map(summary => {
  const id = feedKey(summary.gameId, summary.progressionId);
  const data = feeds.value[id];
  return { id, summary, feed: data, overview: data?.overview };
}));
const { images, releaseImage } = props.covers;
const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
const displayZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const intervalMs = computed(() => (current.value?.settings.carouselIntervalSeconds ?? 30) * 1000);
let nextSlideAt = performance.now() + intervalMs.value;
let carousel: ReturnType<typeof setInterval> | undefined;

function selectSlide(value: number) {
  index.value = value;
  nextSlideAt = performance.now() + intervalMs.value;
}

watch(intervalMs, () => { nextSlideAt = performance.now() + intervalMs.value; });

function step(amount: number) {
  const size = slides.value.length;
  if (size > 1) selectSlide((index.value + amount + size) % size);
}

function carouselKey(event: KeyboardEvent) {
  if (event.target !== event.currentTarget) return;
  if (["ArrowLeft", "ArrowRight"].includes(event.key)) {
    event.preventDefault();
    step(event.key === "ArrowLeft" ? -1 : 1);
  }
}

function remaining(time: TimePoint | null | undefined) {
  const end = instant(time);
  if (end === null) return t("time.unverified");
  const value = countdown(end - now.value);
  return value.unit === "ended" ? t("state.ended") : t(`countdown.${value.unit}`, value);
}

function lastGoodTime(value: string) {
  return new Intl.DateTimeFormat(props.host.i18n.locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function openSettings() {
  if (!current.value) return;
  settingsOpen.value = true;
  error.value = "";
}

async function save(settings: Settings) {
  if (await saveSettings(settings)) settingsOpen.value = false;
}

function motionChanged() {
  reduced.value = media?.matches ?? false;
}

function focusChanged(event: FocusEvent) {
  focused.value = Boolean((event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null));
}

onMounted(() => {
  motionChanged();
  media?.addEventListener("change", motionChanged);
  carousel = setInterval(() => {
    if (intervalMs.value < 0 || document.hidden || reduced.value || paused.value || hovered.value || focused.value || settingsOpen.value || detailsOpen.value) {
      nextSlideAt = performance.now() + intervalMs.value;
      return;
    }
    if (performance.now() >= nextSlideAt) step(1);
  }, 250);
});

onBeforeUnmount(() => {
  clearInterval(carousel);
  media?.removeEventListener("change", motionChanged);
});
</script>

<template>
  <nxp-card class="game-activities" :unstyled="true" @mouseenter="hovered = true" @mouseleave="hovered = false" @focusin="focused = true" @focusout="focusChanged">
    <h2 class="ga-sr-only">{{ t('card.title') }}</h2>
    <p v-if="error && !settingsOpen" role="alert" class="ga-error">{{ error }}</p>
    <div v-if="!current || !current.selectedFeeds.length" class="ga-empty-carousel"><p>{{ t(current ? 'state.select' : 'state.loading') }}</p><button type="button" class="ga-icon-button ga-empty-settings" :disabled="!current" :aria-label="t('settings.title')" :title="t('settings.title')" @click="openSettings">⚙️</button></div>
    <template v-else-if="selected">
      <div class="ga-carousel" role="region" aria-roledescription="carousel" :aria-label="t('carousel.label')" tabindex="0" @keydown="carouselKey">
        <div class="ga-viewport">
          <div class="ga-track" :style="{ transform: `translateX(-${index * 100}%)` }">
            <article v-for="(slide, position) in slides" :key="slide.id" class="ga-slide" role="group" aria-roledescription="slide" :aria-label="`${position + 1}/${slides.length} · ${t(`game.${slide.summary.gameId}`)}`" :aria-hidden="position !== index" :inert="position !== index ? true : undefined">
              <img v-if="images[slide.id]" class="ga-cover" :src="images[slide.id]" :alt="slide.overview?.cover?.alt ?? ''" @error="releaseImage(slide.id)" />
              <div v-else class="ga-cover-fallback" aria-hidden="true"><span>{{ t(`game.${slide.summary.gameId}`) }}</span></div>
              <div class="ga-shade"></div>
              <div class="ga-slide-copy">
                <div class="ga-slide-meta">
                  <span class="ga-game-name">{{ t(`game.${slide.summary.gameId}`) }}</span>
                  <span v-if="slide.overview?.number" class="ga-version">{{ versionLabel(slide.feed, host) }}</span>
                  <span v-if="slide.summary.progressionId !== 'default'" class="ga-progression">{{ t(`progression.${slide.summary.progressionId}`) }}</span>
                </div>
                <h3>{{ slide.overview?.title || t('state.overview') }}</h3>
                <div v-if="slide.overview?.end" class="ga-deadline"><span>{{ t('time.overviewEnd') }}</span><time :datetime="slide.overview.end.instantUtc || undefined">{{ formatTime(slide.overview.end, host) }}</time><strong>{{ remaining(slide.overview.end) }}</strong></div>
                <p v-else-if="!slide.feed" class="ga-description">{{ t('state.loading') }}</p>
              </div>
              <button class="ga-open-details" type="button" :disabled="!slide.feed" :aria-label="t('details.open', { game: t(`game.${slide.summary.gameId}`) })" aria-haspopup="dialog" @click="detailsOpen = true"></button>
            </article>
          </div>
        </div>
        <div class="ga-tools">
          <button v-if="intervalMs > 0 && slides.length > 1" type="button" class="ga-icon-button" :aria-label="t(paused ? 'carousel.resume' : 'carousel.pause')" :title="t(paused ? 'carousel.resume' : 'carousel.pause')" :aria-pressed="paused" @click="paused = !paused">{{ paused ? '▶️' : '⏸️' }}</button>
          <button type="button" class="ga-icon-button" :aria-label="t('settings.title')" :title="t('settings.title')" @click="openSettings">⚙️</button>
        </div>
        <button type="button" class="ga-page-button ga-previous" :disabled="slides.length < 2" :aria-label="t('carousel.previous')" @click="step(-1)">‹</button>
        <button type="button" class="ga-page-button ga-next" :disabled="slides.length < 2" :aria-label="t('carousel.next')" @click="step(1)">›</button>
        <div class="ga-carousel-controls">
          <div class="ga-indicators">
            <button v-for="(slide, position) in slides" :key="slide.id" type="button" :aria-label="`${t('carousel.show')} ${t(`game.${slide.summary.gameId}`)}`" :aria-current="position === index ? 'true' : undefined" :class="{ 'ga-current': position === index }" @click="selectSlide(position)"><span></span></button>
          </div>
        </div>
      </div>
    </template>
    <nxp-modal v-if="settingsOpen && current" :open="settingsOpen" :title="t('settings.title')" size="wide" surface="secondary" :locked="busy" @close="settingsOpen = false">
      <ActivitySettings :settings="current.settings" :host="host" :busy="busy" :refreshing="refreshing || current.refreshing" :error="error" @save="save" @cancel="settingsOpen = false" @refresh="refresh">
        <span v-if="selected">{{ t(`cache.${selected.cacheState}`) }}<template v-if="feed?.health.lastGoodAt"> · {{ t('state.lastGood') }} {{ lastGoodTime(feed.health.lastGoodAt) }} ({{ displayZone }})</template></span>
      </ActivitySettings>
    </nxp-modal>
    <nxp-modal v-if="detailsOpen" :open="detailsOpen" :title="t('details.title')" size="wide" @close="detailsOpen = false">
      <ActivityDetails v-if="feed" :feed="feed" :host="host" :now="now" />
    </nxp-modal>
  </nxp-card>
</template>
