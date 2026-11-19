<script setup lang="ts">
import {
  getSafeRedirectPath,
  normalizeLoginEmail,
  validateLoginCredentials,
} from "~/utils/customer-auth";

defineOptions({ name: "CustomerLogin" });
definePageMeta({ middleware: ["guest"] });
useHead({ title: "Customer Login | BOSSGUDO A.R.C. AQUA FARM" });

const route = useRoute();
const email = ref("");
const password = ref("");
const errorMessage = ref("");
const pending = ref(false);
const { login } = useAuth();
const { showToast } = useToast();

function getSafeNextPath() {
  return getSafeRedirectPath(route.query.next);
}

function getPostLoginTarget() {
  return getSafeNextPath() ?? "/";
}

const registerTarget = computed(() => {
  const next = getSafeNextPath();
  return next ? { path: "/register", query: { next } } : "/register";
});

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
    await login(email.value, password.value);
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

  await navigateTo(getPostLoginTarget(), { replace: true });
  showToast("Login successful!", "success");
}
</script>

<template>
  <AuthLayout with-header label="Customer login form">
    <div class="mb-6">
      <h1 class="text-2xl font-semibold tracking-tight">Customer login</h1>
      <p class="mt-1 text-sm text-base-content/65">Log in to book services and track your bookings.</p>
    </div>

    <form class="space-y-4" novalidate @submit.prevent="submit">
      <div>
        <label for="email" class="mb-1.5 block text-sm font-medium">Email address</label>
        <div class="input w-full">
          <AppIcon name="mail" size="size-4 text-base-content/40" />
          <input id="email" v-model="email" class="grow" type="email" autocomplete="email" placeholder="name@example.com" required :disabled="pending" @blur="email = normalizeLoginEmail(email)" @input="errorMessage = ''">
        </div>
      </div>

      <div>
        <div class="mb-1.5 flex items-center justify-between gap-2">
          <label for="password" class="block text-sm font-medium">Password</label>
          <NuxtLink to="/forgot-password" class="link link-primary text-sm">Forgot password?</NuxtLink>
        </div>
        <PasswordInput
          id="password"
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

      <button class="btn btn-primary w-full" type="submit" :disabled="pending" :aria-busy="pending">
        <span v-if="pending" class="loading loading-spinner loading-sm" aria-hidden="true" />
        {{ pending ? "Logging in..." : "Log In" }}
      </button>
    </form>

    <p class="mt-6 border-t border-base-300 pt-5 text-center text-sm text-base-content/70">
      Need an account?
      <NuxtLink :to="registerTarget" class="link link-primary font-semibold">Create Account</NuxtLink>
    </p>
  </AuthLayout>
</template>
