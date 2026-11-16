<script setup lang="ts">
import {
  normalizeLoginEmail,
  validateLoginCredentials,
} from "~/utils/customer-auth";

defineOptions({ name: "AdminLogin" });
useHead({ title: "Admin Login | BOSSGUDO A.R.C. AQUA FARM" });

const email = ref("");
const password = ref("");
const showPassword = ref(false);
const errorMessage = ref("");
const { loginAdmin } = useAuth();

async function submit() {
  const validationError = validateLoginCredentials(email.value, password.value);
  if (validationError) {
    errorMessage.value = validationError;
    return;
  }

  email.value = normalizeLoginEmail(email.value);
  errorMessage.value = "";
  try {
    await loginAdmin(email.value, password.value);
  } catch (error) {
    const responseError = error as Error & {
      data?: { error?: string };
    };
    errorMessage.value =
      responseError.data?.error ||
      responseError.message ||
      "Unable to log in.";
    password.value = "";
  }
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
          <h2>Admin Login</h2>
        </div>

        <form novalidate @submit.prevent="submit">
          <div class="field">
            <label for="admin-email">Email address</label>
            <input id="admin-email" v-model="email" type="email" autocomplete="username" placeholder="name@example.com" required @blur="email = normalizeLoginEmail(email)" @input="errorMessage = ''">
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
                @input="errorMessage = ''"
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
