<script setup lang="ts">
defineProps<{
  title: string;
  description: string;
}>();
</script>

<template>
  <section class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
    <div class="page-head">
      <div>
        <h1 class="page-title">{{ title }}</h1>
        <p class="page-sub">{{ description }}</p>
      </div>
    </div>
    <div>
      <slot />
    </div>
  </section>
</template>
