<script setup lang="ts">
import type { IconName } from "~/utils/icons";

const route = useRoute();
const { isAuthenticated, isCustomer, user } = useAuth();
const menuOpen = ref(false);

const links: { label: string; to: string; page: string; icon: IconName }[] = [
  { label: "Home", to: "/", page: "home", icon: "house" },
  { label: "About", to: "/about", page: "about", icon: "info" },
  { label: "Shop", to: "/shop", page: "shop", icon: "store" },
  { label: "Bookings", to: "/booking", page: "booking", icon: "calendar-plus" },
];

const logoutTarget = computed(() => ({
  path: "/logout",
  query: { returnTo: route.fullPath },
}));
const isAdmin = computed(
  () => isAuthenticated.value && user.value?.role === "admin",
);
const firstName = computed(() => user.value?.firstName || "Account");

watch(
  () => route.fullPath,
  () => {
    menuOpen.value = false;
  },
);
</script>

<template>
  <header class="site-header sticky top-0 z-40 w-full border-b border-base-300 bg-base-100/95 backdrop-blur">
    <div class="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:h-[4.5rem] lg:px-8">
      <NuxtLink to="/" class="flex min-w-0 items-center gap-3 rounded-lg" aria-label="BOSSGUDO A.R.C. AQUA FARM home">
        <img
          src="/images/boss-gudo-logo.png"
          alt=""
          class="size-10 shrink-0 rounded-full"
          width="40"
          height="40"
        >
        <span class="leading-tight">
          <span class="block text-base font-bold tracking-tight">BOSSGUDO</span>
          <span class="block text-[0.68rem] font-semibold tracking-[0.16em] text-primary uppercase">A.R.C. Aqua Farm</span>
        </span>
      </NuxtLink>

      <nav id="mainNav" class="nav ml-auto hidden items-center gap-1 lg:flex" aria-label="Main navigation">
        <NuxtLink
          v-for="item in links"
          :key="item.to"
          :to="item.to"
          :data-page="item.page"
          class="nav-link rounded-lg px-3 py-2 text-[0.95rem] font-medium text-base-content/75 transition-colors hover:bg-primary/5 hover:text-primary"
        >
          {{ item.label }}
        </NuxtLink>
        <NuxtLink
          v-if="isCustomer"
          to="/mybookings"
          data-page="mybookings"
          class="nav-link inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[0.95rem] font-medium text-base-content/75 transition-colors hover:bg-primary/5 hover:text-primary"
        >
          My Bookings
          <span data-nav-badge class="badge badge-secondary badge-sm" hidden />
        </NuxtLink>
      </nav>

      <div class="ml-auto flex items-center gap-2 lg:ml-4">
        <template v-if="isCustomer">
          <span class="hidden items-center gap-2 text-sm text-base-content/70 xl:inline-flex">
            <AppIcon name="user" size="size-4" />
            {{ firstName }}
          </span>
          <NuxtLink :to="logoutTarget" class="btn btn-ghost btn-sm hidden sm:inline-flex">
            <AppIcon name="log-out" size="size-4" />
            Log out
          </NuxtLink>
        </template>
        <template v-else-if="isAdmin">
          <NuxtLink to="/admin" class="btn btn-sm btn-primary hidden sm:inline-flex">
            <AppIcon name="layout-dashboard" size="size-4" />
            Dashboard
          </NuxtLink>
          <NuxtLink :to="logoutTarget" class="btn btn-ghost btn-sm hidden sm:inline-flex">
            Log out
          </NuxtLink>
        </template>
        <NuxtLink v-else to="/customer-login" class="btn btn-primary btn-sm hidden sm:inline-flex">
          <AppIcon name="log-in" size="size-4" />
          Log in
        </NuxtLink>

        <button
          type="button"
          class="btn btn-square btn-ghost lg:hidden"
          :aria-expanded="menuOpen"
          aria-controls="mobileNav"
          :aria-label="menuOpen ? 'Close menu' : 'Open menu'"
          @click="menuOpen = !menuOpen"
        >
          <AppIcon :name="menuOpen ? 'x' : 'menu'" size="size-6" />
        </button>
      </div>
    </div>

    <nav
      v-show="menuOpen"
      id="mobileNav"
      class="nav border-t border-base-300 bg-base-100 text-base-content shadow-lg lg:hidden"
      aria-label="Mobile navigation"
    >
      <ul class="menu mx-auto w-full max-w-7xl gap-1 px-4 py-3 text-base">
        <li v-for="item in links" :key="item.to">
          <NuxtLink :to="item.to" :data-page="item.page" class="py-3">
            <AppIcon :name="item.icon" />
            {{ item.label }}
          </NuxtLink>
        </li>
        <li v-if="isCustomer">
          <NuxtLink to="/mybookings" data-page="mybookings" class="py-3">
            <AppIcon name="clipboard-list" />
            My Bookings
            <span data-nav-badge class="badge badge-secondary badge-sm" hidden />
          </NuxtLink>
        </li>
        <li v-if="isAdmin">
          <NuxtLink to="/admin" class="py-3">
            <AppIcon name="layout-dashboard" />
            Admin dashboard
          </NuxtLink>
        </li>
        <li class="mt-2 border-t border-base-300 pt-2">
          <NuxtLink v-if="isAuthenticated" :to="logoutTarget" class="py-3">
            <AppIcon name="log-out" />
            Log out
          </NuxtLink>
          <NuxtLink v-else to="/customer-login" class="py-3 font-semibold text-primary">
            <AppIcon name="log-in" />
            Log in or create an account
          </NuxtLink>
        </li>
      </ul>
    </nav>
  </header>
</template>

<style scoped>
.nav-link.router-link-exact-active,
.nav-link.active {
  color: var(--color-primary);
  background: color-mix(in oklab, var(--color-primary) 8%, transparent);
  font-weight: 600;
}
</style>
