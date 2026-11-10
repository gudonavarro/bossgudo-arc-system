<script setup lang="ts">
defineProps<{
  title: string;
  description: string;
}>();
</script>

<template>
  <section class="section-head page-section">
    <div>
      <h1 class="page-title">{{ title }}</h1>
      <p class="muted">{{ description }}</p>
    </div>
    <slot />
  </section>
</template>
