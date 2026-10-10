<script setup lang="ts">
import { computed } from "vue";
import { descriptionBlocks, translator } from "./formatting";
import type { Activity, ActivityHost } from "./types";

const props = defineProps<{ item: Activity; host: ActivityHost }>();
const t = translator(props.host);
const blocks = computed(() => descriptionBlocks(props.item.description ?? "", props.item.title));
const preview = computed(() => blocks.value.slice(0, 3));
const remainder = computed(() => blocks.value.slice(3));
</script>

<template>
  <div class="ga-event-description">
    <p v-if="!blocks.length" class="ga-muted">{{ t('description.missing') }}</p>
    <div v-for="(block, index) in preview" :key="index" :class="`ga-text-${block.kind}`">
      <strong v-if="block.label">{{ block.label }}</strong><p>{{ block.text }}</p>
    </div>
    <details v-if="remainder.length" class="ga-description-expand">
      <summary>{{ t('description.expand') }}</summary>
      <div v-for="(block, index) in remainder" :key="index" :class="`ga-text-${block.kind}`">
        <strong v-if="block.label">{{ block.label }}</strong><p>{{ block.text }}</p>
      </div>
    </details>
    <p v-if="item.descriptionTruncated" class="ga-muted">{{ t('description.truncated') }}</p>
  </div>
</template>
