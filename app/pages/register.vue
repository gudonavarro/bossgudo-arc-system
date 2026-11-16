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

const route = useRoute();
const form = reactive({ firstName: "", lastName: "", email: "", phoneNumber: "", password: "", confirmPassword: "" });
const feedback = ref("");
const fieldErrors = reactive<RegistrationFieldErrors>({});
const pending = ref(false);
const showPassword = ref(false);
const showConfirmPassword = ref(false);
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
  <main class="register-shell">
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
    <section class="register-panel" aria-label="Create account form">
      <section class="panel auth-card register-card">
        <h1 class="page-title">Create Account</h1>
        <form novalidate @submit.prevent="submit">
          <div class="field">
            <label for="firstName">FIRST NAME</label>
            <input id="firstName" v-model="form.firstName" autocomplete="given-name" required :disabled="pending" :aria-invalid="Boolean(fieldErrors.firstName)" :aria-describedby="fieldErrors.firstName ? 'firstName-error' : undefined" @input="clearFieldError('firstName')">
            <small v-if="fieldErrors.firstName" id="firstName-error" class="field-error show">{{ fieldErrors.firstName }}</small>
          </div>
          <div class="field">
            <label for="lastName">LAST NAME</label>
            <input id="lastName" v-model="form.lastName" autocomplete="family-name" required :disabled="pending" :aria-invalid="Boolean(fieldErrors.lastName)" :aria-describedby="fieldErrors.lastName ? 'lastName-error' : undefined" @input="clearFieldError('lastName')">
            <small v-if="fieldErrors.lastName" id="lastName-error" class="field-error show">{{ fieldErrors.lastName }}</small>
          </div>
          <div class="field">
            <label for="email">EMAIL ADDRESS</label>
            <input id="email" v-model="form.email" type="email" autocomplete="email" required :disabled="pending" :aria-invalid="Boolean(fieldErrors.email)" :aria-describedby="fieldErrors.email ? 'email-error' : undefined" @input="clearFieldError('email')">
            <small v-if="fieldErrors.email" id="email-error" class="field-error show">{{ fieldErrors.email }}</small>
          </div>
          <div class="field">
            <label for="phoneNumber">PHONE NUMBER</label>
            <input id="phoneNumber" v-model="form.phoneNumber" type="tel" autocomplete="tel" required :disabled="pending" :aria-invalid="Boolean(fieldErrors.phoneNumber)" :aria-describedby="fieldErrors.phoneNumber ? 'phoneNumber-error' : undefined" @input="clearFieldError('phoneNumber')">
            <small v-if="fieldErrors.phoneNumber" id="phoneNumber-error" class="field-error show">{{ fieldErrors.phoneNumber }}</small>
          </div>
          <div class="field">
            <label for="password">PASSWORD</label>
            <div class="register-password-wrap">
              <input id="password" v-model="form.password" :type="showPassword ? 'text' : 'password'" autocomplete="new-password" required :disabled="pending" :aria-invalid="Boolean(fieldErrors.password)" :aria-describedby="fieldErrors.password ? 'password-error' : undefined" @input="clearFieldError('password')">
              <button
                class="register-password-toggle"
                type="button"
                :disabled="pending"
                :aria-label="showPassword ? 'Hide password' : 'Show password'"
                @click="showPassword = !showPassword"
              >
                {{ showPassword ? "Hide" : "Show" }}
              </button>
            </div>
            <small v-if="fieldErrors.password" id="password-error" class="field-error show">{{ fieldErrors.password }}</small>
          </div>
          <div class="field">
            <label for="confirmPassword">CONFIRM PASSWORD</label>
            <div class="register-password-wrap">
              <input id="confirmPassword" v-model="form.confirmPassword" :type="showConfirmPassword ? 'text' : 'password'" autocomplete="new-password" required :disabled="pending" :aria-invalid="Boolean(fieldErrors.confirmPassword)" :aria-describedby="fieldErrors.confirmPassword ? 'confirmPassword-error' : undefined" @input="clearFieldError('confirmPassword')">
              <button
                class="register-password-toggle"
                type="button"
                :disabled="pending"
                :aria-label="showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'"
                @click="showConfirmPassword = !showConfirmPassword"
              >
                {{ showConfirmPassword ? "Hide" : "Show" }}
              </button>
            </div>
            <small v-if="fieldErrors.confirmPassword" id="confirmPassword-error" class="field-error show">{{ fieldErrors.confirmPassword }}</small>
          </div>
          <button class="primary register-submit" type="submit" :disabled="pending" :aria-busy="pending">{{ pending ? "Creating..." : "Create Account" }}</button>
          <output v-if="feedback" class="form-feedback show" aria-live="polite">{{ feedback }}</output>
        </form>
        <p class="auth-card-footer register-login-link">
          Already have an account?
          <NuxtLink :to="loginTarget">Login</NuxtLink>
        </p>
      </section>
    </section>
  </main>
</template>
