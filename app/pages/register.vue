<script setup lang="ts">
definePageMeta({ middleware: ["guest"] });

const route = useRoute();
const form = reactive({ firstName: "", lastName: "", email: "", phoneNumber: "", password: "", confirmPassword: "" });
const feedback = ref("");
const pending = ref(false);
const showPassword = ref(false);
const showConfirmPassword = ref(false);

function getSafeNextPath() {
  const next = route.query.next;
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//")
    ? next
    : null;
}

const loginTarget = computed(() => {
  const next = getSafeNextPath();
  return next ? { path: "/login", query: { next } } : "/login";
});

async function submit() {
  pending.value = true;
  feedback.value = "";
  try {
    await $fetch("/api/auth/register", { method: "POST", body: form });
    await navigateTo(loginTarget.value);
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : "Unable to create your account.";
  } finally {
    pending.value = false;
  }
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
        <form @submit.prevent="submit">
          <div class="field"><label for="firstName">FIRST NAME</label><input id="firstName" v-model="form.firstName" required></div>
          <div class="field"><label for="lastName">LAST NAME</label><input id="lastName" v-model="form.lastName" required></div>
          <div class="field"><label for="email">EMAIL ADDRESS</label><input id="email" v-model="form.email" type="email" required></div>
          <div class="field"><label for="phoneNumber">PHONE NUMBER</label><input id="phoneNumber" v-model="form.phoneNumber" required></div>
          <div class="field">
            <label for="password">PASSWORD</label>
            <div class="register-password-wrap">
              <input id="password" v-model="form.password" :type="showPassword ? 'text' : 'password'" required>
              <button
                class="register-password-toggle"
                type="button"
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
              <input id="confirmPassword" v-model="form.confirmPassword" :type="showConfirmPassword ? 'text' : 'password'" required>
              <button
                class="register-password-toggle"
                type="button"
                :aria-label="showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'"
                @click="showConfirmPassword = !showConfirmPassword"
              >
                {{ showConfirmPassword ? "Hide" : "Show" }}
              </button>
            </div>
          </div>
          <button class="primary register-submit" type="submit" :disabled="pending">{{ pending ? "Creating..." : "Create Account" }}</button>
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
