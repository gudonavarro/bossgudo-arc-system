<script setup lang="ts">
const route = useRoute();

const currentPage = computed(() => {
  let start = 0;
  let end = route.path.length;

  while (route.path.charAt(start) === "/") start += 1;
  while (end > start && route.path.charAt(end - 1) === "/") end -= 1;

  return route.path.slice(start, end) || "home";
});
const legacyPages = new Set([
  "about",
  "shop",
  "booking",
  "mybookings",
  "admin",
]);
const authPages = new Set(["customer-login", "register"]);
const standalonePages = new Set([
  "customer-login",
  "admin-login",
  "register",
  "forgot-password",
  "reset-password",
]);
const legacyPageVisible = computed(() => legacyPages.has(currentPage.value));
const headerVisible = computed(
  () =>
    currentPage.value === "home" ||
    legacyPageVisible.value ||
    authPages.has(currentPage.value),
);
const footerVisible = computed(() => !standalonePages.has(currentPage.value));
const chatVisible = computed(() => currentPage.value !== "admin-login");
const isAdminArea = computed(() =>
  ["admin", "admin-login"].includes(currentPage.value),
);

useHead(() => ({
  htmlAttrs: { "data-theme": isAdminArea.value ? "bossgudo-admin" : "bossgudo" },
  bodyAttrs: { "data-page": currentPage.value },
}));
</script>

<template>
  <a href="#content" class="btn btn-primary btn-sm fixed top-2 left-2 z-[100] -translate-y-20 focus:translate-y-0">Skip to content</a>

  <SiteHeader v-if="headerVisible" :overlay="currentPage === 'home'" />

  <div id="content" class="min-h-[60vh]">
    <main id="app" v-show="legacyPageVisible" class="legacy-view" />
    <div v-show="!legacyPageVisible"><NuxtPage /></div>
  </div>

  <div id="modalHost" />
  <div class="pointer-events-none fixed inset-x-0 top-4 z-[90] flex justify-center px-4 sm:justify-end sm:px-6">
    <output id="toast" class="app-toast" aria-live="polite" />
  </div>

  <SiteFooter v-if="footerVisible" />

  <ChatAssistant v-show="chatVisible" />
</template>
