<script setup lang="ts">
defineOptions({ name: "AdminLogin" });
useHead({ title: "Admin Login | BOSSGUDO A.R.C. AQUA FARM" });

const email = ref("");
const password = ref("");
const showPassword = ref(false);
const errorMessage = ref("");

function submit() {
  errorMessage.value = "Administrator sign-in is not connected yet. Your credentials were not sent.";
}
</script>

<template>
  <main class="login-shell admin-login-shell">
    <section class="login-visual" aria-label="Boss Gudo administrator portal">
      <div class="login-visual-content">
        <div class="brand-chip">
          <img class="brand-mark" src="/images/boss-gudo-logo.png" alt="BOSSGUDO A.R.C. AQUA FARM logo">
          <div>
            <strong>BOSSGUDO</strong>
            <small>A.R.C. AQUA FARM</small>
          </div>
        </div>

        <p class="eyebrow login-eyebrow">Administrator portal</p>
        <h1>Farm operations, in one place.</h1>
        <p class="login-visual-copy">
          A dedicated sign-in page for BOSSGUDO administrators.
        </p>
      </div>
    </section>

    <section class="login-panel" aria-label="Administrator login form">
      <div class="login-card">
        <div class="login-card-header">
          <span class="admin-portal-badge">ADMINISTRATOR PORTAL</span>
          <h2>Administrator Login</h2>
          <p class="muted">Admin sign-in is not connected. This page does not submit or verify credentials.</p>
        </div>

        <form @submit.prevent="submit">
          <div class="field">
            <label for="admin-email">Email address</label>
            <input id="admin-email" v-model="email" type="email" autocomplete="username" placeholder="name@example.com" required>
          </div>

          <div class="field">
            <label for="admin-password">Password</label>
            <div class="password-input-wrap">
              <input
                id="admin-password"
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                autocomplete="current-password"
                placeholder="••••••••"
                required
              >
              <button
                class="password-toggle"
                type="button"
                :aria-label="showPassword ? 'Hide password' : 'Show password'"
                @click="showPassword = !showPassword"
              >
                {{ showPassword ? "Hide" : "Show" }}
              </button>
            </div>
          </div>

          <button class="primary login-submit" type="submit">Log In</button>
          <output v-if="errorMessage" class="form-feedback show" aria-live="polite">{{ errorMessage }}</output>
        </form>

        <p class="auth-card-footer recovery-login-link">
          <NuxtLink to="/">Return to the main website</NuxtLink>
        </p>
      </div>
    </section>
  </main>
</template>
