<script setup lang="ts">
import { getLogoutCancelRedirect } from "~/utils/logout-navigation";

const route = useRoute();
const { user } = useAuth();
const { logout, isLoggingOut } = useLogout();
const errorMessage = ref("");
const cancelButton = ref<HTMLButtonElement | null>(null);
const confirmButton = ref<HTMLButtonElement | null>(null);

const cancelRedirect = computed(() =>
  getLogoutCancelRedirect(route.query.returnTo, user.value?.role),
);

async function cancelLogout() {
  if (isLoggingOut.value) return;
  await navigateTo(cancelRedirect.value, { replace: true });
}

async function confirmLogout() {
  if (isLoggingOut.value) return;
  errorMessage.value = "";
  const result = await logout();
  if (!result.ok) {
    errorMessage.value = result.error || "Unable to log out right now.";
  }
}

function trapDialogFocus(event: KeyboardEvent) {
  const activeElement = document.activeElement;
  if (event.shiftKey && activeElement === cancelButton.value) {
    event.preventDefault();
    confirmButton.value?.focus();
  } else if (!event.shiftKey && activeElement === confirmButton.value) {
    event.preventDefault();
    cancelButton.value?.focus();
  }
}

onMounted(() => cancelButton.value?.focus());
</script>

<template>
  <div class="modal-backdrop logout-confirmation-backdrop">
    <section
      class="modal logout-confirmation"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="logout-title"
      aria-describedby="logout-message"
      :aria-busy="isLoggingOut"
      @keydown.esc.prevent="cancelLogout"
      @keydown.tab="trapDialogFocus"
    >
      <header class="modal-head">
        <h1 id="logout-title">Confirm Logout</h1>
      </header>
      <div class="modal-body">
        <p id="logout-message">Are you sure you want to log out of your account?</p>
        <output v-if="errorMessage" class="form-feedback show" role="alert" aria-live="assertive">
          {{ errorMessage }}
        </output>
      </div>
      <footer class="modal-foot">
        <button
          ref="cancelButton"
          class="secondary small logout-action"
          type="button"
          :disabled="isLoggingOut"
          @click="cancelLogout"
        >
          Cancel
        </button>
        <button
          ref="confirmButton"
          class="primary small logout-action"
          type="button"
          :disabled="isLoggingOut"
          @click="confirmLogout"
        >
          {{ isLoggingOut ? "Logging out…" : "Log Out" }}
        </button>
      </footer>
    </section>
  </div>
</template>
