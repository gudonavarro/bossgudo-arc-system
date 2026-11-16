<script setup lang="ts">
import { getApiErrorMessage } from "~/utils/api-error";

const email = ref("");
const code = ref("");
const step = ref<"request" | "verify">("request");
const feedback = ref("");
const feedbackStatus = ref<"success" | "error">("error");
const submitting = ref(false);

async function requestCode() {
  if (submitting.value) return;
  feedback.value = "";
  submitting.value = true;
  try {
    const result = await $fetch<{ message: string }>("/api/auth/forgot-password", { method: "POST", body: { email: email.value } });
    feedback.value = result.message;
    feedbackStatus.value = "success";
    step.value = "verify";
  } catch (error) {
    feedback.value = getApiErrorMessage(
      error,
      "Unable to send a verification code.",
    );
    feedbackStatus.value = "error";
  } finally {
    submitting.value = false;
  }
}

async function verifyCode() {
  if (submitting.value) return;
  feedback.value = "";
  submitting.value = true;
  try {
    await $fetch("/api/auth/verify-reset-code", {
      method: "POST",
      body: { email: email.value, code: code.value },
    });
    await navigateTo("/reset-password");
  } catch (error) {
    feedback.value = getApiErrorMessage(
      error,
      "The code is invalid or expired.",
    );
    feedbackStatus.value = "error";
  } finally {
    submitting.value = false;
  }
}

function changeEmail() {
  step.value = "request";
  code.value = "";
  feedback.value = "";
  feedbackStatus.value = "error";
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
        <p class="recovery-subtitle">
          {{ step === "request" ? "Enter your account email to receive a password reset verification code." : "Enter the 6-digit code sent to your email address." }}
        </p>
        <form v-if="step === 'request'" @submit.prevent="requestCode">
          <div class="field"><label for="email">EMAIL ADDRESS</label><input id="email" v-model="email" type="email" required></div>
          <button class="primary recovery-submit" type="submit" :disabled="submitting" :aria-busy="submitting">
            {{ submitting ? "Sending..." : "Send Verification Code" }}
          </button>
        </form>
        <form v-else @submit.prevent="verifyCode">
          <div class="field">
            <label for="verification-email">EMAIL ADDRESS</label>
            <input id="verification-email" :value="email" type="email" readonly>
          </div>
          <div class="field">
            <label for="verification-code">6-DIGIT CODE</label>
            <input
              id="verification-code"
              v-model="code"
              type="text"
              inputmode="numeric"
              autocomplete="one-time-code"
              pattern="[0-9]{6}"
              maxlength="6"
              required
            >
          </div>
          <button class="primary recovery-submit" type="submit" :disabled="submitting" :aria-busy="submitting">
            {{ submitting ? "Verifying..." : "Verify Code" }}
          </button>
          <button class="recovery-text-button" type="button" :disabled="submitting" @click="requestCode">
            Resend code
          </button>
          <button class="recovery-text-button" type="button" :disabled="submitting" @click="changeEmail">
            Use a different email
          </button>
        </form>
        <output v-if="feedback" class="form-feedback show" :class="{ success: feedbackStatus === 'success' }" aria-live="polite">{{ feedback }}</output>
        <p class="auth-card-footer recovery-login-link">
          Remember your password?
          <NuxtLink to="/customer-login">Login</NuxtLink>
        </p>
      </section>
    </section>
  </main>
</template>
