<script setup lang="ts">
import { FARM, MAPS_URL } from "~/utils/site";

const year = new Date().getFullYear();
</script>

<template>
  <footer class="bg-neutral text-neutral-content">
    <div class="footer mx-auto max-w-7xl gap-10 px-4 py-14 sm:footer-horizontal sm:px-6 lg:px-8">
      <aside class="max-w-sm">
        <NuxtLink to="/" class="flex items-center gap-3">
          <img src="/images/boss-gudo-logo.png" alt="" class="size-12 rounded-full bg-white p-0.5" width="48" height="48">
          <span class="leading-tight">
            <span class="block font-display text-xl font-semibold text-white">BOSSGUDO</span>
            <span class="block text-xs font-semibold uppercase tracking-[0.18em] text-neutral-content/70">A.R.C. Aqua Farm</span>
          </span>
        </NuxtLink>
        <p class="mt-4 text-sm leading-relaxed text-neutral-content/75">
          Australian Red Claw crayfish supply, pond setup assistance, training,
          and after-sales support for new and growing crayfish enthusiasts.
        </p>
      </aside>

      <nav aria-label="Footer navigation">
        <h2 class="footer-title mb-1 text-xs font-semibold tracking-[0.14em] text-neutral-content/90 opacity-100">Explore</h2>
        <NuxtLink to="/about" class="link link-hover">About the farm</NuxtLink>
        <NuxtLink to="/shop" class="link link-hover">Pond packages</NuxtLink>
        <NuxtLink to="/booking" class="link link-hover">Book a service or visit</NuxtLink>
        <NuxtLink to="/mybookings" class="link link-hover">My bookings</NuxtLink>
      </nav>

      <address class="not-italic" aria-label="Contact details">
        <h2 class="footer-title mb-1 text-xs font-semibold tracking-[0.14em] text-neutral-content/90 opacity-100">Visit or call</h2>
        <a :href="MAPS_URL" target="_blank" rel="noopener noreferrer" class="link link-hover flex max-w-xs gap-2">
          <AppIcon name="map-pin" size="size-4 mt-0.5" />
          <span>{{ FARM.address }}<br><span class="text-neutral-content/60">{{ FARM.landmark }}</span></span>
        </a>
        <a :href="FARM.phoneHref" class="link link-hover flex items-center gap-2">
          <AppIcon name="phone" size="size-4" />
          {{ FARM.phoneDisplay }}
        </a>
      </address>

      <div>
        <h2 class="footer-title mb-1 text-xs font-semibold tracking-[0.14em] text-neutral-content/90 opacity-100">Follow us</h2>
        <div class="flex gap-3">
          <a
            :href="FARM.facebook"
            target="_blank"
            rel="noopener noreferrer"
            class="btn btn-circle btn-ghost border-neutral-content/20 text-neutral-content hover:bg-white/10"
            aria-label="Visit our Facebook page"
            title="Facebook"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="size-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073c0 6.019 4.388 11.015 10.125 11.927v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.514c-1.491 0-1.956.93-1.956 1.885v2.269h3.328l-.532 3.49h-2.796V24C19.612 23.088 24 18.092 24 12.073Z" />
            </svg>
          </a>
          <a
            :href="FARM.tiktok"
            target="_blank"
            rel="noopener noreferrer"
            class="btn btn-circle btn-ghost border-neutral-content/20 text-neutral-content hover:bg-white/10"
            aria-label="Visit our TikTok page"
            title="TikTok"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="size-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 3 15.68a6.33 6.33 0 0 0 10.81 4.48 6.37 6.37 0 0 0 1.86-4.57v-6.2a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.34z" />
            </svg>
          </a>
        </div>
      </div>
    </div>
    <div class="border-t border-white/10">
      <p class="mx-auto max-w-7xl px-4 py-5 text-xs text-neutral-content/60 sm:px-6 lg:px-8">
        &copy; <span id="footerYear">{{ year }}</span> BOSSGUDO A.R.C. AQUA FARM. All rights reserved.
      </p>
    </div>
  </footer>
</template>
