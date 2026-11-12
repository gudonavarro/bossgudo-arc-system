<script setup lang="ts">
const route = useRoute();
const password = ref("");
const confirmPassword = ref("");
const showPassword = ref(false);
const showConfirmPassword = ref(false);
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
    <section class="recovery-panel" aria-label="Reset password form">
      <section class="panel auth-card recovery-card">
        <h1 class="page-title">Reset Password</h1>
        <p class="recovery-subtitle">Choose a new password for your account.</p>
        <form @submit.prevent="submit">
          <div class="field">
            <label for="password">PASSWORD</label>
            <div class="register-password-wrap">
              <input id="password" v-model="password" :type="showPassword ? 'text' : 'password'" required>
              <button
                class="register-password-toggle"
                type="button"
                :aria-label="showPassword ? 'Hide password' : 'Show password'"
                @click="showPassword = !showPassword"
              >
                {{ showPassword ? "Hide" : "Show" }}
              </button>
            </div>
          </div>
          <div class="field">
            <label for="confirmPassword">CONFIRM PASSWORD</label>
            <div class="register-password-wrap">
              <input id="confirmPassword" v-model="confirmPassword" :type="showConfirmPassword ? 'text' : 'password'" required>
              <button
                class="register-password-toggle"
                type="button"
                :aria-label="showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'"
                @click="showConfirmPassword = !showConfirmPassword"
              >
                {{ showConfirmPassword ? "Hide" : "Show" }}
              </button>
            </div>
          </div>
          <button class="primary" type="submit">Reset Password</button>
          <output class="form-feedback show" aria-live="polite">{{ feedback }}</output>
        </form>
      </section>
    </section>
  </main>
</template>
