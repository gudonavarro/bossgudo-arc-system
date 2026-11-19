<script setup lang="ts">
const route = useRoute();
const { user } = useAuth();

const adminName = computed(() =>
  user.value ? `${user.value.firstName} ${user.value.lastName}`.trim() : "Administrator",
);
const initials = computed(() =>
  adminName.value
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase(),
);
const logoutTarget = computed(() => ({
  path: "/logout",
  query: { returnTo: route.fullPath },
}));
</script>

<template>
  <header class="sticky top-0 z-40 border-b border-base-300 bg-base-100">
    <div class="flex h-16 items-center gap-3 px-3 sm:px-5">
      <!-- Opens the sidebar drawer rendered by the admin view. -->
      <label for="adminDrawer" class="btn btn-square btn-ghost lg:hidden" aria-label="Open admin navigation">
        <AppIcon name="menu" size="size-6" />
      </label>
      <NuxtLink to="/admin" class="flex items-center gap-2.5">
        <img src="/images/boss-gudo-logo.png" alt="" class="size-9 rounded-full" width="36" height="36">
        <span class="hidden leading-tight sm:block">
          <span class="block text-sm font-bold tracking-tight">BOSSGUDO</span>
          <span class="block text-[0.65rem] font-semibold tracking-[0.16em] text-base-content/55 uppercase">A.R.C. Aqua Farm</span>
        </span>
      </NuxtLink>
      <span class="badge badge-neutral badge-sm gap-1">
        <AppIcon name="shield-check" size="size-3" />
        Admin
      </span>

      <div class="ml-auto flex items-center gap-1 sm:gap-2">
        <NuxtLink to="/" class="btn btn-ghost btn-sm hidden sm:inline-flex">
          <AppIcon name="external-link" size="size-4" />
          View website
        </NuxtLink>
        <div class="dropdown dropdown-end">
          <div tabindex="0" role="button" class="btn btn-ghost btn-sm gap-2 px-2" aria-label="Account menu">
            <span class="grid size-8 place-items-center rounded-full bg-primary text-xs font-bold text-primary-content">{{ initials }}</span>
            <span class="hidden max-w-36 truncate text-sm font-medium md:inline">{{ adminName }}</span>
            <AppIcon name="chevron-down" size="size-4" />
          </div>
          <ul tabindex="-1" class="dropdown-content menu z-50 mt-2 w-56 rounded-box border border-base-300 bg-base-100 p-2 shadow-lg">
            <li class="menu-title truncate">{{ user?.email || "Signed in" }}</li>
            <li class="sm:hidden">
              <NuxtLink to="/"><AppIcon name="external-link" size="size-4" />View website</NuxtLink>
            </li>
            <li>
              <NuxtLink :to="logoutTarget"><AppIcon name="log-out" size="size-4" />Log out</NuxtLink>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </header>
</template>
