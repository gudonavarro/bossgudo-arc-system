<script setup lang="ts">
const email = ref("");
const feedback = ref("");
const feedbackStatus = ref<"success" | "error">("error");
async function submit() {
  feedback.value = "";
  try {
    const result = await $fetch<{ message: string }>("/api/auth/forgot-password", { method: "POST", body: { email: email.value } });
    feedback.value = result.message;
    feedbackStatus.value = "success";
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : "Unable to send reset instructions.";
    feedbackStatus.value = "error";
  }
}
</script>

<template>
  <main class="recovery-shell">
    <section class="login-visual" aria-label="Boss Gudo farm preview">
      <div class="login-visual-content">
        <div class="brand-chip">
          <img class="brand-mark" src="/images/boss-gudo-logo.png" alt="BOSSGUDO A.R.C. AQUA FARM logo">
          <div>
            <strong>BOSSGUDO</strong>
            <small>A.R.C. AQUA FARM</small>
          </div>
        </div>

        <p class="eyebrow login-eyebrow">Sustainable aquaculture support</p>
        <h1>Welcome to Boss Gudo.</h1>
        <p class="login-visual-copy">
          From pond packages to farm visits, we help growers build healthy, productive Australian Red Claw systems with practical support at every stage.
        </p>

        <ul class="login-benefits" aria-label="Business highlights">
          <li>Pond packages and custom design</li>
          <li>Farm guidance and setup support</li>
          <li>Track services and bookings</li>
        </ul>
      </div>
    </section>
    <section class="recovery-panel" aria-label="Forgot password form">
      <section class="panel auth-card recovery-card">
        <h1 class="page-title">Forgot Password</h1>
        <p class="recovery-subtitle">Enter your account email to receive reset instructions.</p>
        <form @submit.prevent="submit">
          <div class="field"><label for="email">EMAIL ADDRESS</label><input id="email" v-model="email" type="email" required></div>
          <button class="primary recovery-submit" type="submit">Send Reset Link</button>
          <output v-if="feedback" class="form-feedback show" :class="{ success: feedbackStatus === 'success' }" aria-live="polite">{{ feedback }}</output>
        </form>
        <p class="auth-card-footer recovery-login-link">
          Remember your password?
          <NuxtLink to="/login">Login</NuxtLink>
        </p>
      </section>
    </section>
  </main>
</template>
