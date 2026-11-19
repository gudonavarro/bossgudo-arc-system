<script setup lang="ts">
withDefaults(
  defineProps<{
    eyebrow?: string;
    heading?: string;
    copy?: string;
    benefits?: string[];
    variant?: "customer" | "admin";
    label?: string;
    /** Leaves room for the site header shown above login and register. */
    withHeader?: boolean;
  }>(),
  {
    eyebrow: "Sustainable aquaculture support",
    heading: "Welcome to Boss Gudo.",
    copy: "From pond packages to farm visits, we help growers build healthy, productive Australian Red Claw systems with practical support at every stage.",
    benefits: () => [
      "Pond packages and custom design",
      "Farm guidance and setup support",
      "Track services and bookings",
    ],
    variant: "customer",
    label: "Account form",
  },
);
</script>

<template>
  <main
    class="grid bg-base-200 lg:grid-cols-[1fr_minmax(28rem,36rem)]"
    :class="withHeader ? 'min-h-[calc(100dvh-4rem)] lg:min-h-[calc(100dvh-5rem)]' : 'min-h-dvh'"
  >
    <section
      class="relative hidden overflow-hidden lg:flex"
      :class="variant === 'admin' ? 'bg-neutral' : 'bg-primary'"
      aria-label="BOSSGUDO A.R.C. AQUA FARM"
    >
      <img
        v-if="variant === 'customer'"
        src="/images/home-hero-bg.jpg"
        alt=""
        class="absolute inset-0 size-full object-cover object-[50%_70%]"
      >
      <div
        class="absolute inset-0"
        :class="variant === 'admin'
          ? 'bg-[radial-gradient(circle_at_20%_20%,rgba(46,106,67,0.45),transparent_55%)]'
          : 'bg-gradient-to-br from-[#0f2418]/90 via-[#14301f]/75 to-[#14301f]/40'"
      />
      <div class="relative z-10 flex w-full flex-col justify-between p-12 text-white xl:p-16">
        <NuxtLink to="/" class="flex w-fit items-center gap-3">
          <img src="/images/boss-gudo-logo.png" alt="" class="size-12 rounded-full bg-white p-0.5" width="48" height="48">
          <span class="leading-tight">
            <span class="block font-display text-xl font-semibold">BOSSGUDO</span>
            <span class="block text-xs font-semibold uppercase tracking-[0.18em] text-white/70">A.R.C. Aqua Farm</span>
          </span>
        </NuxtLink>
        <div class="max-w-lg">
          <p class="text-sm font-semibold uppercase tracking-[0.16em] text-white/70">{{ eyebrow }}</p>
          <p class="mt-3 font-display text-4xl leading-tight font-semibold text-white xl:text-5xl">{{ heading }}</p>
          <p class="mt-5 text-base leading-relaxed text-white/80">{{ copy }}</p>
          <ul v-if="benefits.length" class="mt-8 space-y-3" aria-label="Highlights">
            <li v-for="benefit in benefits" :key="benefit" class="flex items-center gap-3 text-white/90">
              <span class="grid size-7 place-items-center rounded-full bg-white/15">
                <AppIcon name="check" size="size-4" />
              </span>
              {{ benefit }}
            </li>
          </ul>
        </div>
        <p class="text-xs text-white/50">&copy; BOSSGUDO A.R.C. AQUA FARM</p>
      </div>
    </section>

    <section class="flex items-center justify-center px-4 py-10 sm:px-8" :aria-label="label">
      <div class="w-full max-w-md">
        <NuxtLink to="/" class="mb-8 flex items-center justify-center gap-3 lg:hidden">
          <img src="/images/boss-gudo-logo.png" alt="" class="size-11 rounded-full" width="44" height="44">
          <span class="leading-tight">
            <span class="block font-display text-lg font-semibold">BOSSGUDO</span>
            <span class="block text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-primary">A.R.C. Aqua Farm</span>
          </span>
        </NuxtLink>
        <div class="rounded-box border border-base-300 bg-base-100 p-6 shadow-sm sm:p-8">
          <slot />
        </div>
        <slot name="after" />
      </div>
    </section>
  </main>
</template>
