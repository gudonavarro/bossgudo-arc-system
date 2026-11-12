<script setup>
import { useLogout } from "~/composables/useLogout";

const { logout, isLoggingOut } = useLogout();
const errorMessage = ref("");

async function handleLogout() {
  const result = await logout();
  if (!result.ok) {
    errorMessage.value = result.error || "Unable to log out right now.";
  }
}

onMounted(() => {
  void handleLogout();
});
</script>

<template>
  <section class="panel auth-card">
    <div class="auth-card-header login-header">
      <img class="login-logo" src="/images/boss-gudo-logo.png" alt="BOSSGUDO A.R.C. AQUA FARM logo">
      <h1 class="page-title">Signing out</h1>
      <p class="muted">Please wait while your session is cleared.</p>
    </div>

    <p v-if="isLoggingOut" class="muted">Logging you out…</p>
    <output v-if="errorMessage" class="form-feedback show" aria-live="polite">{{ errorMessage }}</output>
  </section>
</template>
