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
          <button class="primary" type="submit">Send reset instructions</button>
          <output class="form-feedback show" aria-live="polite">{{ feedback }}</output>
        </form>
        <NuxtLink to="/login">Return to Log In</NuxtLink>
      </section>
    </section>
  </main>
</template>
