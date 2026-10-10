<script setup lang="ts">
import { computed } from "vue";
import { translator } from "./formatting";
import type { ActivityHost } from "./types";

const props = defineProps<{ game: string; host: ActivityHost; enabled: boolean; busy: boolean; progression?: string }>();
const emit = defineEmits<{ toggle: [enabled: boolean]; progression: [value: string] }>();
const t = translator(props.host);
const progressions = computed(() => props.game === "blue-archive" ? ["cn", "jp", "global"]
  : props.game === "neverness-to-everness" ? ["cn", "global"] : []);
const options = computed(() => progressions.value.map(value => ({ value, label: t(`progression.${value}`) })));
</script>

<template>
  <article class="ga-game-setting">
    <div class="ga-game-handle">
      <nxp-drag-handle v-if="enabled" :disabled="busy" :label="t('settings.drag', { game: t(`game.${game}`) })"
        :title="t('settings.dragHelp')" />
    </div>
    <div class="ga-game-copy">
      <strong>{{ t(`game.${game}`) }}</strong>
    </div>
    <div v-if="options.length" class="ga-game-progression" :data-help="t('settings.progressionHelp')">
      <nxp-select :id="`ga-progression-${game}`" :model-value="progression" :options="options" :disabled="busy"
        :aria-label="`${t(`game.${game}`)} · ${t('settings.progression')}`"
        @change="emit('progression', $event.detail[0])" />
    </div>
    <nxp-switch :model-value="enabled" semantic-role="switch" :disabled="busy" :aria-label="t(`game.${game}`)"
      @change="emit('toggle', $event.detail[0])" />
  </article>
</template>
