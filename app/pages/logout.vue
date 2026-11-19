<script setup lang="ts">
import { getLogoutCancelRedirect } from "~/utils/logout-navigation";

useHead({ title: "Log Out | BOSSGUDO A.R.C. AQUA FARM" });

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
  <div class="fixed inset-0 z-80 grid place-items-center bg-neutral/60 p-4 backdrop-blur-sm">
    <section
      class="w-full max-w-sm rounded-box bg-base-100 p-6 shadow-2xl"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="logout-title"
      aria-describedby="logout-message"
      :aria-busy="isLoggingOut"
      @keydown.esc.prevent="cancelLogout"
      @keydown.tab="trapDialogFocus"
    >
      <span class="grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
        <AppIcon name="log-out" size="size-6" />
      </span>
      <h1 id="logout-title" class="mt-4 text-xl font-semibold">Confirm logout</h1>
      <p id="logout-message" class="mt-2 text-sm text-base-content/70">Are you sure you want to log out of your account?</p>
      <output v-if="errorMessage" class="alert alert-error alert-soft mt-4 text-sm" role="alert" aria-live="assertive">
        <AppIcon name="circle-alert" size="size-4" />
        <span>{{ errorMessage }}</span>
      </output>
      <div class="mt-6 flex justify-end gap-2">
        <button
          ref="cancelButton"
          class="btn btn-ghost"
          type="button"
          :disabled="isLoggingOut"
          @click="cancelLogout"
        >
          Cancel
        </button>
        <button
          ref="confirmButton"
          class="btn btn-primary"
          type="button"
          :disabled="isLoggingOut"
          @click="confirmLogout"
        >
          <span v-if="isLoggingOut" class="loading loading-spinner loading-sm" aria-hidden="true" />
          {{ isLoggingOut ? "Logging out…" : "Log Out" }}
        </button>
      </div>
    </section>
  </div>
</template>
