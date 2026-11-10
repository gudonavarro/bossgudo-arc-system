<script setup lang="ts">
const email = ref("");
const password = ref("");
const feedback = ref("");
const pending = ref(false);

async function submit() {
  pending.value = true;
  feedback.value = "";
  try {
    await $fetch("/api/auth/login", {
      method: "POST",
      body: { email: email.value, password: password.value },
    });
    await navigateTo("/mybookings");
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : "Unable to log in.";
  } finally {
    pending.value = false;
  }
}
</script>

<template>
  <section class="panel auth-card">
    <div class="auth-card-header login-header">
      <img class="login-logo" src="/images/boss-gudo-logo.png" alt="BOSSGUDO A.R.C. AQUA FARM logo">
      <h1 class="page-title">Welcome back</h1>
      <p class="muted">Sign in to track your booking requests.</p>
    </div>
    <form @submit.prevent="submit">
      <div class="field">
        <label for="email">EMAIL ADDRESS</label>
        <input id="email" v-model="email" type="email" autocomplete="email" required>
      </div>
      <div class="field">
        <label for="password">PASSWORD</label>
        <input id="password" v-model="password" type="password" autocomplete="current-password" required>
      </div>
      <button class="primary" type="submit" :disabled="pending">{{ pending ? "Signing in..." : "Log In" }}</button>
      <output class="form-feedback show" aria-live="polite">{{ feedback }}</output>
    </form>
    <p class="auth-card-footer"><NuxtLink to="/forgot-password">Forgot Password?</NuxtLink> · <NuxtLink to="/register">Create Account</NuxtLink></p>
  </section>
</template>
