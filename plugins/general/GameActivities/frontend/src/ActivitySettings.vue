<script setup lang="ts">
import { computed, ref } from "vue";
import ActivityGameSetting from "./ActivityGameSetting.vue";
import { translator } from "./formatting";
import { gameIds, type ActivityHost, type Settings } from "./types";

const props = defineProps<{ settings: Settings; host: ActivityHost; busy: boolean;  error: string }>();
const emit = defineEmits<{ save: [settings: Settings]; cancel: []; refresh: [] }>();
const t = translator(props.host);
const draft = ref(structuredClone(props.settings));
const interval = ref<number | string>(draft.value.carouselIntervalSeconds);
const intervalValid = computed(() => typeof interval.value === "number" && Number.isInteger(interval.value)
  && (interval.value === -1 || interval.value >= 10 && interval.value <= 120));
const order = ref([...(draft.value.gameOrder || draft.value.selectedGames), ...gameIds.filter(game => !(draft.value.gameOrder || draft.value.selectedGames).includes(game))]);

function toggleGame(game: string, enabled: boolean) {
  if (enabled && !draft.value.selectedGames.includes(game)) draft.value.selectedGames.push(game);
  else if (!enabled) draft.value.selectedGames = draft.value.selectedGames.filter(id => id !== game);
}

function reorder(event: CustomEvent<[string[], string]>) {
  if (!props.busy) order.value = event.detail[0];
}

function save() {
  if (!props.busy && intervalValid.value) emit('save', { ...draft.value, gameOrder: order.value, selectedGames: order.value.filter(game => draft.value.selectedGames.includes(game)), carouselIntervalSeconds: Number(interval.value) });
}
defineExpose({ save, intervalValid });
</script>

<template>
  <div class="ga-settings">
    <section :aria-label="t('settings.games')" :data-help="t('settings.help')">
      <h3 class="ga-settings-heading">{{ t('settings.games') }}</h3>
      <div class="ga-settings-card">
        <nxp-sortable-list :disabled="busy" @reorder="reorder">
          <ActivityGameSetting v-for="game in order" :key="game" :data-dnd-id="game"
            :game="game" :host="host" :enabled="draft.selectedGames.includes(game)" :busy="busy" :progression="draft.progressions[game]"
            @toggle="toggleGame(game, $event)" @progression="draft.progressions[game] = $event" />
        </nxp-sortable-list>
      </div>
    </section>
    <div class="ga-interval-setting" :data-help="t('settings.intervalHelp')">
      <label for="ga-carousel-interval">{{ t('settings.interval') }} <span class="ga-muted">({{ t('settings.seconds') }})</span></label>
      <nxp-number-input id="ga-carousel-interval" :model-value="interval" :min="-1" :max="120" :step="1"
        :aria-label="t('settings.interval')" :disabled="busy" @change="interval = $event.detail[0]" />
      <p v-if="!intervalValid" class="ga-error" role="alert">{{ t('settings.intervalInvalid') }}</p>
    </div>
    <p v-if="error" role="alert" class="ga-error">{{ error }}</p>
    <div class="ga-muted"><slot /></div>
  </div>
</template>
