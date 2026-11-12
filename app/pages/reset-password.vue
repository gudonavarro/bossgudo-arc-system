<script setup lang="ts">
const route = useRoute();
const password = ref("");
const confirmPassword = ref("");
const feedback = ref("");
async function submit() {
  try {
    await $fetch("/api/auth/reset-password", {
      method: "POST",
      body: { token: route.query.token, password: password.value, confirmPassword: confirmPassword.value },
    });
    feedback.value = "Your password was reset. You can now log in.";
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : "Unable to reset your password.";
  }
}
</script>

<template>
  <main class="recovery-shell">
    <section class="recovery-visual" aria-hidden="true" />
    <section class="recovery-panel" aria-label="Reset password form">
      <section class="panel auth-card">
        <h1 class="page-title">Choose a new password</h1>
        <form @submit.prevent="submit">
          <div class="field"><label for="password">PASSWORD</label><input id="password" v-model="password" type="password" required></div>
          <div class="field"><label for="confirmPassword">CONFIRM PASSWORD</label><input id="confirmPassword" v-model="confirmPassword" type="password" required></div>
          <button class="primary" type="submit">Reset Password</button>
          <output class="form-feedback show" aria-live="polite">{{ feedback }}</output>
        </form>
      </section>
    </section>
  </main>
</template>
