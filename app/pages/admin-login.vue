<script setup lang="ts">
import {
  normalizeLoginEmail,
  validateLoginCredentials,
} from "~/utils/customer-auth";

defineOptions({ name: "AdminLogin" });
useHead({ title: "Admin Login | BOSSGUDO A.R.C. AQUA FARM" });

const email = ref("");
const password = ref("");
const errorMessage = ref("");
const pending = ref(false);
const { loginAdmin } = useAuth();
const { showToast } = useToast();

async function submit() {
  if (pending.value) return;

  const validationError = validateLoginCredentials(email.value, password.value);
  if (validationError) {
    errorMessage.value = validationError;
    return;
  }

  email.value = normalizeLoginEmail(email.value);
  pending.value = true;
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
    return;
  } finally {
    pending.value = false;
  }

  await navigateTo("/admin", { replace: true });
  showToast("Login successful!", "success");
}
</script>

<template>
  <AuthLayout
    variant="admin"
    label="Administrator login form"
    eyebrow="Administrator portal"
    heading="Farm operations, in one place."
    copy="A dedicated sign-in page for BOSSGUDO administrators to manage bookings, payments, visits, the calendar and the package catalog."
    :benefits="['Verify GCash payments', 'Manage bookings and visits', 'Maintain packages and FAQs']"
  >
    <div class="mb-6">
      <span class="badge badge-neutral badge-sm mb-3 gap-1">
        <AppIcon name="shield-check" size="size-3" />
        Admin
      </span>
      <h1 class="text-2xl font-semibold tracking-tight">Admin login</h1>
      <p class="mt-1 text-sm text-base-content/65">Sign in with your administrator account.</p>
    </div>

    <form class="space-y-4" novalidate @submit.prevent="submit">
      <div>
        <label for="admin-email" class="mb-1.5 block text-sm font-medium">Email address</label>
        <div class="input w-full">
          <AppIcon name="mail" size="size-4 text-base-content/40" />
          <input id="admin-email" v-model="email" class="grow" type="email" autocomplete="username" placeholder="name@example.com" required :disabled="pending" @blur="email = normalizeLoginEmail(email)" @input="errorMessage = ''">
        </div>
      </div>

      <div>
        <label for="admin-password" class="mb-1.5 block text-sm font-medium">Password</label>
        <PasswordInput
          id="admin-password"
          v-model="password"
          autocomplete="current-password"
          placeholder="Enter your password"
          required
          :disabled="pending"
          @input="errorMessage = ''"
        />
      </div>

      <output v-if="errorMessage" class="alert alert-error alert-soft text-sm" role="alert" aria-live="polite">
        <AppIcon name="circle-alert" size="size-4" />
        <span>{{ errorMessage }}</span>
      </output>

      <button class="btn btn-neutral w-full" type="submit" :disabled="pending" :aria-busy="pending">
        <span v-if="pending" class="loading loading-spinner loading-sm" aria-hidden="true" />
        {{ pending ? "Signing in..." : "Log In" }}
      </button>
    </form>

    <p class="mt-6 border-t border-base-300 pt-5 text-center text-sm">
      <NuxtLink to="/" class="link link-hover inline-flex items-center gap-1 text-base-content/70">
        <AppIcon name="arrow-left" size="size-4" />
        Return to the main website
      </NuxtLink>
    </p>
  </AuthLayout>
</template>
