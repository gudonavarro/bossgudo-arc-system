<script setup lang="ts">
definePageMeta({ middleware: ["guest"] });

const route = useRoute();
const email = ref("");
const password = ref("");
const errorMessage = ref("");
const pending = ref(false);
const showPassword = ref(false);
const authUser = useState<{ id?: string; firstName?: string } | null>("auth:user", () => null);
const authReady = useState<boolean>("auth:ready", () => false);

watch(
  () => [authReady.value, authUser.value],
  ([ready, user]) => {
    if (ready && user) {
      void navigateTo("/", { replace: true });
    }
  },
  { immediate: true },
);

async function submit() {
  pending.value = true;
  errorMessage.value = "";
  try {
    const result = await $fetch<{ user: { id: string; firstName: string } }>("/api/auth/login", {
      method: "POST",
      body: { email: email.value, password: password.value },
    });

    authUser.value = result.user ?? null;
    authReady.value = true;
    window.dispatchEvent(
      new CustomEvent("app:session-change", { detail: result.user }),
    );

    const redirectTarget = typeof route.query.next === "string" && route.query.next.startsWith("/") ? route.query.next : "/";
    await navigateTo(redirectTarget, { replace: true });
  } catch (error) {
    const responseError = error as {
      data?: { error?: string };
      message?: string;
    };
    errorMessage.value =
      responseError.data?.error ||
      responseError.message ||
      "Unable to log in.";
  } finally {
    pending.value = false;
  }
}
</script>

<template>
  <main class="login-shell">
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

    <section class="login-panel" aria-label="Login form">
      <div class="login-card">
        <div class="login-card-header">
          <h2>Login</h2>
        </div>

        <form @submit.prevent="submit">
          <div class="field">
            <label for="email">Email address</label>
            <input id="email" v-model="email" type="email" autocomplete="email" placeholder="name@example.com" required>
          </div>

          <div class="field">
            <label for="password">Password</label>
            <div class="password-input-wrap">
              <input
                id="password"
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                autocomplete="current-password"
                placeholder="••••••••"
                required
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

          <div class="login-form-actions">
            <NuxtLink to="/forgot-password">Forgot password?</NuxtLink>
          </div>

          <button class="primary login-submit" type="submit" :disabled="pending" :aria-busy="pending">
            {{ pending ? "Logging in..." : "Login" }}
          </button>

          <output v-if="errorMessage" class="form-feedback show" aria-live="polite">{{ errorMessage }}</output>
        </form>

        <p class="auth-card-footer login-signup">
          Need an account?
          <NuxtLink to="/register">Create Account</NuxtLink>
        </p>
      </div>
    </section>
  </main>
</template>
