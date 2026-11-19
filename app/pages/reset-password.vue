<script setup lang="ts">
import { getApiErrorMessage } from "~/utils/api-error";

useHead({ title: "Reset Password | BOSSGUDO A.R.C. AQUA FARM" });

const password = ref("");
const confirmPassword = ref("");
const feedback = ref("");
const feedbackStatus = ref<"success" | "error">("error");
const submitting = ref(false);
const completed = ref(false);

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
    feedback.value = getApiErrorMessage(
      error,
      "Unable to reset your password.",
    );
    feedbackStatus.value = "error";
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <AuthLayout label="Reset password form">
    <div class="mb-6">
      <span class="mb-4 grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
        <AppIcon name="lock" />
      </span>
      <h1 class="text-2xl font-semibold tracking-tight">Reset password</h1>
      <p class="mt-1 text-sm text-base-content/65">Choose a new password for your account. Use at least 8 characters with uppercase, lowercase, a number, and a symbol.</p>
    </div>

    <ul class="steps mb-6 w-full text-xs" aria-label="Password reset progress">
      <li class="step step-primary">Email</li>
      <li class="step step-primary">Verify code</li>
      <li class="step step-primary">New password</li>
    </ul>

    <form class="space-y-4" :aria-busy="submitting" @submit.prevent="submit">
      <div>
        <label for="password" class="mb-1.5 block text-sm font-medium">New password</label>
        <PasswordInput id="password" v-model="password" autocomplete="new-password" minlength="8" required :disabled="completed" />
      </div>
      <div>
        <label for="confirmPassword" class="mb-1.5 block text-sm font-medium">Confirm password</label>
        <PasswordInput id="confirmPassword" v-model="confirmPassword" toggle-label="confirm password" autocomplete="new-password" minlength="8" required :disabled="completed" />
      </div>
      <button class="btn btn-primary w-full" type="submit" :disabled="submitting || completed">
        <span v-if="submitting" class="loading loading-spinner loading-sm" aria-hidden="true" />
        {{ submitting ? "Resetting..." : "Reset Password" }}
      </button>
      <output
        v-if="feedback"
        class="alert alert-soft text-sm"
        :class="feedbackStatus === 'success' ? 'alert-success' : 'alert-error'"
        aria-live="polite"
      >
        <AppIcon :name="feedbackStatus === 'success' ? 'circle-check' : 'circle-alert'" size="size-4" />
        <span>{{ feedback }}</span>
      </output>
    </form>

    <p class="mt-6 border-t border-base-300 pt-5 text-center text-sm">
      <NuxtLink to="/customer-login" class="link link-primary font-semibold">{{ completed ? "Login" : "Back to Customer Login" }}</NuxtLink>
    </p>
  </AuthLayout>
</template>
