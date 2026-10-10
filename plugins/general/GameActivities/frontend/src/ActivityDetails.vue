<script setup lang="ts">
import { computed, ref } from "vue";
import { isGacha, order, status } from "./activityPolicy";
import { formatTime, translator, versionLabel } from "./formatting";
import ActivityEventCard from "./ActivityEventCard.vue";
import type { Activity, ActivityHost, Feed } from "./types";

const props = defineProps<{ feed: Feed; now: number; host: ActivityHost }>();
const t = translator(props.host);
const error = ref("");
const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const sections = computed(() => {
  const items = order(props.feed.activities, props.now);
  return ["gacha", "activities"].map(id => ({
    id,
    groups: ["ongoing", "upcoming", "ended", "unknown"].map(state => ({
      state,
      items: items.filter(item => isGacha(item) === (id === "gacha") && status(item, props.now) === state),
    })).filter(group => group.items.length),
  }));
});

const officialHosts: Record<string, string[]> = {
  "blue-archive": ["bluearchive-cn.com", "www.bluearchive-cn.com", "bluearchive.jp", "forum.nexon.com"],
  "genshin-impact": ["ys.mihoyo.com", "www.miyoushe.com", "operation-webstatic.mihoyo.com"],
  "arknights-endfield": ["endfield.hypergryph.com"],
  "stella-sora": ["stellasora.yostar.cn"],
  "honkai-star-rail": ["sr.mihoyo.com", "www.miyoushe.com"],
  "neverness-to-everness": ["yh.wanmei.com", "nte.perfectworld.com"],
  "wuthering-waves": ["mc.kurogames.com", "wiki.kurobbs.com"],
  "zenless-zone-zero": ["zzz.mihoyo.com", "www.miyoushe.com"],
};

async function openOfficial(item: Activity) {
  if (!item.officialUrl) return;
  try {
    const url = new URL(item.officialUrl);
    if (url.protocol !== "https:" || url.username || url.password || !officialHosts[props.feed.gameId]?.includes(url.hostname)) throw new Error(t("link.invalid"));
    await props.host.navigation.openExternal(url.href);
    error.value = "";
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : String(reason);
  }
}

function diagnosticLabel(code: string): string {
  return props.host.i18n.t(`diagnostic.${code}`, {}, t("diagnostic.other"));
}
</script>

<template>
  <div class="ga-details">
    <header class="ga-detail-intro">
      <div><span class="ga-eyebrow">{{ t('details.game') }}</span><h2>{{ t(`game.${feed.gameId}`) }}</h2></div>
      <div class="ga-detail-badges"><span v-if="feed.overview?.number">{{ versionLabel(feed, host) }}</span><span v-if="feed.progressionId !== 'default'">{{ t(`progression.${feed.progressionId}`) }}</span></div>
      <p class="ga-muted">{{ t('details.timezone', { zone }) }}</p>
      <p v-if="feed.overview?.end" class="ga-version-end">{{ t('time.overviewEnd') }} · {{ formatTime(feed.overview.end, host) }}</p>
    </header>
    <p v-if="error" class="ga-error" role="alert">{{ error }}</p>
    <section v-for="section in sections" :key="section.id" class="ga-detail-section" :aria-label="t(`section.${section.id}`)">
      <div class="ga-section-title"><h3>{{ t(`section.${section.id}`) }}</h3><span>{{ section.groups.reduce((count, group) => count + group.items.length, 0) }}</span></div>
      <div v-if="section.id === 'gacha' && feed.coverage.gacha.status !== 'complete'" class="ga-coverage-note"><strong>{{ t(`coverage.${feed.coverage.gacha.status}`) }}</strong><p>{{ t('coverage.help') }}</p></div>
      <p v-if="!section.groups.length" class="ga-muted ga-section-empty">{{ t(section.id === 'gacha' ? 'coverage.empty' : 'details.empty') }}</p>
      <details v-for="group in section.groups" :key="group.state" class="ga-state-group" :open="group.state !== 'ended'">
        <summary><span class="ga-state-dot" :data-state="group.state"></span><span>{{ t(`state.${group.state}`) }}</span><span class="ga-group-count">{{ group.items.length }}</span></summary>
        <div class="ga-event-list"><ActivityEventCard v-for="item in group.items" :key="item.eventId" :item="item" :host="host" :now="now" @official="openOfficial" /></div>
      </details>
    </section>
    <details class="ga-source-details">
      <summary>{{ t('sources') }}</summary>
      <ul v-if="feed.health.diagnostics.length" class="ga-diagnostics">
        <li v-for="(diagnostic, index) in feed.health.diagnostics" :key="`${diagnostic.code}-${index}`"><strong>{{ diagnosticLabel(diagnostic.code) }}</strong><span class="ga-muted">{{ diagnostic.code }} · {{ diagnostic.message }}</span></li>
      </ul>
      <ul class="ga-source-list">
        <li v-for="source in feed.sources" :key="source.sourceId"><strong>{{ t(source.kind === 'aggregate' ? 'source.aggregate' : 'source.official') }}</strong><span class="ga-source-url">{{ source.url }}</span><p>{{ source.note }}</p></li>
      </ul>
    </details>
  </div>
</template>
