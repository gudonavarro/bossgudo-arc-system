<script setup lang="ts">
import { iconSvg, type IconName } from "~/utils/icons";

const props = withDefaults(
  defineProps<{ name: IconName; size?: string }>(),
  { size: "size-5" },
);
const svg = computed(() => iconSvg(props.name, props.size));
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html -- trusted, generated from Lucide data -->
  <span class="inline-flex shrink-0" aria-hidden="true" v-html="svg" />
</template>
