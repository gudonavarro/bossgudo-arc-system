<script setup lang="ts">
const password = ref("");
const confirmPassword = ref("");
const showPassword = ref(false);
const showConfirmPassword = ref(false);
const feedback = ref("");
const feedbackStatus = ref<"success" | "error">("error");
const submitting = ref(false);
const completed = ref(false);

function getErrorMessage(error: unknown, fallback: string) {
  if (error !== null && typeof error === "object" && "data" in error) {
    const data = error.data;
    if (
      data !== null &&
      typeof data === "object" &&
      "error" in data &&
      typeof data.error === "string"
    ) {
      return data.error;
    }
  }
  return fallback;
}

async function submit() {
  if (submitting.value || completed.value) return;
  feedback.value = "";
  submitting.value = true;
  try {
    await $fetch("/api/auth/reset-password", {
      method: "POST",
      body: { password: password.value, confirmPassword: confirmPassword.value },
    });
    feedback.value = "Your password was reset. You can now log in.";
    feedbackStatus.value = "success";
    completed.value = true;
    password.value = "";
    confirmPassword.value = "";
  } catch (error) {
    feedback.value = getErrorMessage(error, "Unable to reset your password.");
    feedbackStatus.value = "error";
  } finally {
    submitting.value = false;
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
        <p class="recovery-subtitle">Choose a new password for your account. Use at least 8 characters with uppercase, lowercase, a number, and a symbol.</p>
        <form @submit.prevent="submit" :aria-busy="submitting">
          <div class="field">
            <label for="password">PASSWORD</label>
            <div class="register-password-wrap">
              <input id="password" v-model="password" :type="showPassword ? 'text' : 'password'" autocomplete="new-password" minlength="8" required :disabled="completed">
              <button
                class="register-password-toggle"
                type="button"
                :disabled="completed"
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
              <input id="confirmPassword" v-model="confirmPassword" :type="showConfirmPassword ? 'text' : 'password'" autocomplete="new-password" minlength="8" required :disabled="completed">
              <button
                class="register-password-toggle"
                type="button"
                :disabled="completed"
                :aria-label="showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'"
                @click="showConfirmPassword = !showConfirmPassword"
              >
                {{ showConfirmPassword ? "Hide" : "Show" }}
              </button>
            </div>
          </div>
          <button class="primary recovery-submit" type="submit" :disabled="submitting || completed">
            {{ submitting ? "Resetting..." : "Reset Password" }}
          </button>
          <output v-if="feedback" class="form-feedback show" :class="{ success: feedbackStatus === 'success' }" aria-live="polite">{{ feedback }}</output>
        </form>
        <p class="auth-card-footer recovery-login-link">
          <NuxtLink to="/customer-login">{{ completed ? "Login" : "Back to Customer Login" }}</NuxtLink>
        </p>
      </section>
    </section>
  </main>
</template>
