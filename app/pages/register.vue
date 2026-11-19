<script setup lang="ts">
import {
  getRegistrationApiError,
  isRegistrationSuccessResponse,
  normalizeRegistrationPhoneNumber,
  validateRegistration,
  type RegistrationField,
  type RegistrationFieldErrors,
} from "~/utils/registration";

definePageMeta({ middleware: ["guest"] });
useHead({ title: "Create an Account | BOSSGUDO A.R.C. AQUA FARM" });

const route = useRoute();
const form = reactive({ firstName: "", lastName: "", email: "", phoneNumber: "", password: "", confirmPassword: "" });
const feedback = ref("");
const fieldErrors = reactive<RegistrationFieldErrors>({});
const pending = ref(false);
const { showToast } = useToast();

function getSafeNextPath() {
  const next = route.query.next;
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//")
    ? next
    : null;
}

const loginTarget = computed(() => {
  const next = getSafeNextPath();
  return next ? { path: "/customer-login", query: { next } } : "/customer-login";
});

async function submit() {
  if (pending.value) return;

  for (const field of Object.keys(fieldErrors) as RegistrationField[]) {
    delete fieldErrors[field];
  }
  feedback.value = "";
  const validationErrors = validateRegistration(form);
  Object.assign(fieldErrors, validationErrors);
  if (Object.keys(validationErrors).length > 0) {
    const message = Object.values(validationErrors)[0];
    feedback.value = message ?? "";
    showToast(feedback.value);
    return;
  }

  pending.value = true;
  let accountCreated = false;
  try {
    const response = await $fetch<unknown>("/api/auth/register", {
      method: "POST",
      body: {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim().toLowerCase(),
        phoneNumber: normalizeRegistrationPhoneNumber(form.phoneNumber.trim()),
        password: form.password,
        confirmPassword: form.confirmPassword,
      },
    });
    if (!isRegistrationSuccessResponse(response)) {
      feedback.value = "The server returned an unexpected response. Please try again.";
      form.password = "";
      form.confirmPassword = "";
      showToast(feedback.value);
      return;
    }

    accountCreated = true;
    form.password = "";
    form.confirmPassword = "";
    await navigateTo(loginTarget.value);
    showToast("Account created. Please log in.", "success");
  } catch (error) {
    if (accountCreated) {
      feedback.value = "Account created. Please log in using your new account.";
      showToast(feedback.value, "success");
    } else {
      const apiError = getRegistrationApiError(error);
      Object.assign(fieldErrors, apiError.fieldErrors);
      feedback.value = apiError.message;
      showToast(apiError.message);
    }
    if (accountCreated || Object.keys(fieldErrors).length === 0) {
      form.password = "";
      form.confirmPassword = "";
    }
  } finally {
    pending.value = false;
  }
}

function clearFieldError(field: RegistrationField) {
  delete fieldErrors[field];
  feedback.value = "";
}
</script>

<template>
  <AuthLayout with-header label="Create account form">
    <div class="mb-6">
      <h1 class="text-2xl font-semibold tracking-tight">Create account</h1>
      <p class="mt-1 text-sm text-base-content/65">Register to submit and track your bookings.</p>
    </div>

    <form class="space-y-4" novalidate @submit.prevent="submit">
      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label for="firstName" class="mb-1.5 block text-sm font-medium">First name</label>
          <input id="firstName" v-model="form.firstName" class="input w-full" :class="{ 'input-error': fieldErrors.firstName }" autocomplete="given-name" maxlength="80" required :disabled="pending" :aria-invalid="Boolean(fieldErrors.firstName)" :aria-describedby="fieldErrors.firstName ? 'firstName-error' : undefined" @input="clearFieldError('firstName')">
          <p v-if="fieldErrors.firstName" id="firstName-error" class="mt-1 text-xs text-error">{{ fieldErrors.firstName }}</p>
        </div>
        <div>
          <label for="lastName" class="mb-1.5 block text-sm font-medium">Last name</label>
          <input id="lastName" v-model="form.lastName" class="input w-full" :class="{ 'input-error': fieldErrors.lastName }" autocomplete="family-name" maxlength="80" required :disabled="pending" :aria-invalid="Boolean(fieldErrors.lastName)" :aria-describedby="fieldErrors.lastName ? 'lastName-error' : undefined" @input="clearFieldError('lastName')">
          <p v-if="fieldErrors.lastName" id="lastName-error" class="mt-1 text-xs text-error">{{ fieldErrors.lastName }}</p>
        </div>
      </div>
      <div>
        <label for="email" class="mb-1.5 block text-sm font-medium">Email address</label>
        <input id="email" v-model="form.email" class="input w-full" :class="{ 'input-error': fieldErrors.email }" type="email" autocomplete="email" maxlength="254" placeholder="name@example.com" required :disabled="pending" :aria-invalid="Boolean(fieldErrors.email)" :aria-describedby="fieldErrors.email ? 'email-error' : undefined" @input="clearFieldError('email')">
        <p v-if="fieldErrors.email" id="email-error" class="mt-1 text-xs text-error">{{ fieldErrors.email }}</p>
      </div>
      <div>
        <label for="phoneNumber" class="mb-1.5 block text-sm font-medium">Phone number</label>
        <input id="phoneNumber" v-model="form.phoneNumber" class="input w-full" :class="{ 'input-error': fieldErrors.phoneNumber }" type="tel" inputmode="tel" autocomplete="tel" maxlength="20" placeholder="09XX XXX XXXX" required :disabled="pending" :aria-invalid="Boolean(fieldErrors.phoneNumber)" :aria-describedby="fieldErrors.phoneNumber ? 'phoneNumber-error' : undefined" @input="clearFieldError('phoneNumber')">
        <p v-if="fieldErrors.phoneNumber" id="phoneNumber-error" class="mt-1 text-xs text-error">{{ fieldErrors.phoneNumber }}</p>
      </div>
      <div>
        <label for="password" class="mb-1.5 block text-sm font-medium">Password</label>
        <PasswordInput id="password" v-model="form.password" autocomplete="new-password" required :disabled="pending" :invalid="Boolean(fieldErrors.password)" :aria-describedby="fieldErrors.password ? 'password-error' : undefined" @input="clearFieldError('password')" />
        <p v-if="fieldErrors.password" id="password-error" class="mt-1 text-xs text-error">{{ fieldErrors.password }}</p>
      </div>
      <div>
        <label for="confirmPassword" class="mb-1.5 block text-sm font-medium">Confirm password</label>
        <PasswordInput id="confirmPassword" v-model="form.confirmPassword" toggle-label="confirm password" autocomplete="new-password" required :disabled="pending" :invalid="Boolean(fieldErrors.confirmPassword)" :aria-describedby="fieldErrors.confirmPassword ? 'confirmPassword-error' : undefined" @input="clearFieldError('confirmPassword')" />
        <p v-if="fieldErrors.confirmPassword" id="confirmPassword-error" class="mt-1 text-xs text-error">{{ fieldErrors.confirmPassword }}</p>
      </div>

      <output v-if="feedback" class="alert alert-error alert-soft text-sm" aria-live="polite">
        <AppIcon name="circle-alert" size="size-4" />
        <span>{{ feedback }}</span>
      </output>

      <button class="btn btn-primary w-full" type="submit" :disabled="pending" :aria-busy="pending">
        <span v-if="pending" class="loading loading-spinner loading-sm" aria-hidden="true" />
        {{ pending ? "Creating..." : "Create Account" }}
      </button>
    </form>

    <p class="mt-6 border-t border-base-300 pt-5 text-center text-sm text-base-content/70">
      Already have an account?
      <NuxtLink :to="loginTarget" class="link link-primary font-semibold">Log in</NuxtLink>
    </p>
  </AuthLayout>
</template>
