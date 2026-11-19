<script setup lang="ts">
import { getApiErrorMessage } from "~/utils/api-error";

useHead({ title: "Forgot Password | BOSSGUDO A.R.C. AQUA FARM" });

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
  <AuthLayout label="Forgot password form">
    <div class="mb-6">
      <span class="mb-4 grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
        <AppIcon :name="step === 'request' ? 'mail' : 'shield-check'" />
      </span>
      <h1 class="text-2xl font-semibold tracking-tight">Forgot password</h1>
      <p class="mt-1 text-sm text-base-content/65">
        {{ step === "request" ? "Enter your account email to receive a password reset verification code." : "Enter the 6-digit code sent to your email address." }}
      </p>
    </div>

    <ul class="steps mb-6 w-full text-xs" aria-label="Password reset progress">
      <li class="step step-primary">Email</li>
      <li class="step" :class="{ 'step-primary': step === 'verify' }">Verify code</li>
      <li class="step">New password</li>
    </ul>

    <form v-if="step === 'request'" class="space-y-4" @submit.prevent="requestCode">
      <div>
        <label for="email" class="mb-1.5 block text-sm font-medium">Email address</label>
        <div class="input w-full">
          <AppIcon name="mail" size="size-4 text-base-content/40" />
          <input id="email" v-model="email" class="grow" type="email" autocomplete="email" placeholder="name@example.com" required>
        </div>
      </div>
      <button class="btn btn-primary w-full" type="submit" :disabled="submitting" :aria-busy="submitting">
        <span v-if="submitting" class="loading loading-spinner loading-sm" aria-hidden="true" />
        {{ submitting ? "Sending..." : "Send Verification Code" }}
      </button>
    </form>
    <form v-else class="space-y-4" @submit.prevent="verifyCode">
      <div>
        <label for="verification-email" class="mb-1.5 block text-sm font-medium">Email address</label>
        <input id="verification-email" :value="email" class="input w-full bg-base-200" type="email" readonly>
      </div>
      <div>
        <label for="verification-code" class="mb-1.5 block text-sm font-medium">6-digit code</label>
        <input
          id="verification-code"
          v-model="code"
          class="input input-lg w-full text-center font-mono tracking-[0.5em]"
          type="text"
          inputmode="numeric"
          autocomplete="one-time-code"
          pattern="[0-9]{6}"
          maxlength="6"
          placeholder="000000"
          required
        >
      </div>
      <button class="btn btn-primary w-full" type="submit" :disabled="submitting" :aria-busy="submitting">
        <span v-if="submitting" class="loading loading-spinner loading-sm" aria-hidden="true" />
        {{ submitting ? "Verifying..." : "Verify Code" }}
      </button>
      <div class="flex flex-wrap justify-center gap-2">
        <button class="btn btn-ghost btn-sm" type="button" :disabled="submitting" @click="requestCode">
          <AppIcon name="refresh-cw" size="size-4" />
          Resend code
        </button>
        <button class="btn btn-ghost btn-sm" type="button" :disabled="submitting" @click="changeEmail">
          <AppIcon name="pencil" size="size-4" />
          Use a different email
        </button>
      </div>
    </form>

    <output
      v-if="feedback"
      class="alert alert-soft mt-4 text-sm"
      :class="feedbackStatus === 'success' ? 'alert-success' : 'alert-error'"
      aria-live="polite"
    >
      <AppIcon :name="feedbackStatus === 'success' ? 'circle-check' : 'circle-alert'" size="size-4" />
      <span>{{ feedback }}</span>
    </output>

    <p class="mt-6 border-t border-base-300 pt-5 text-center text-sm text-base-content/70">
      Remember your password?
      <NuxtLink to="/customer-login" class="link link-primary font-semibold">Log in</NuxtLink>
    </p>
  </AuthLayout>
</template>
