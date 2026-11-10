<script setup lang="ts">
defineProps<{
  title: string;
  description: string;
}>();
</script>

<template>
  <section class="feature-page">
    <div class="section-head">
      <div>
        <h1 class="page-title">{{ title }}</h1>
        <p class="muted">{{ description }}</p>
      </div>
    </div>
    <div class="feature-page-content">
      <slot />
    </div>
  </section>
</template>
