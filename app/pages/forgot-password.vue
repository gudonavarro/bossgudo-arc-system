<script setup lang="ts">
const email = ref("");
const feedback = ref("");
async function submit() {
  try {
    const result = await $fetch<{ message: string }>("/api/auth/forgot-password", { method: "POST", body: { email: email.value } });
    feedback.value = result.message;
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : "Unable to send reset instructions.";
  }
}
</script>

<template>
  <section class="panel auth-card">
    <h1 class="page-title">Reset your password</h1>
    <p class="muted">Enter your account email to receive reset instructions.</p>
    <form @submit.prevent="submit">
      <div class="field"><label for="email">EMAIL ADDRESS</label><input id="email" v-model="email" type="email" required></div>
      <button class="primary" type="submit">Send reset instructions</button>
      <output class="form-feedback show" aria-live="polite">{{ feedback }}</output>
    </form>
    <NuxtLink to="/login">Return to Log In</NuxtLink>
  </section>
</template>
