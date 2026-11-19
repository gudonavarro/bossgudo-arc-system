<script setup lang="ts">
import type { IconName } from "~/utils/icons";
import { FARM, MAPS_URL } from "~/utils/site";

useHead({ title: "BOSSGUDO A.R.C. AQUA FARM | Australian Red Claw crayfish" });

interface CatalogPackage {
  code: string;
  name: string;
  description: string;
  price: number;
  layers: string;
  dimensions: string;
  inclusions: string[];
  featured: boolean;
  imageUrl: string | null;
}
interface CatalogResponse {
  packages: CatalogPackage[];
  customPondPricing?: { ratePerSquareMetrePerLayer: number };
}

// Same public endpoint the Shop uses; loaded in the browser so the page
// renders immediately and package highlights fill in when ready.
const { data: catalog, status: catalogStatus } = useFetch<CatalogResponse>(
  "/api/service-packages",
  { server: false, lazy: true },
);
const highlightedPackages = computed(() =>
  [...(catalog.value?.packages ?? [])]
    .sort((a, b) => Number(b.featured) - Number(a.featured))
    .slice(0, 3),
);
const lowestPrice = computed(() => {
  const prices = (catalog.value?.packages ?? []).map((item) => item.price);
  return prices.length ? Math.min(...prices) : null;
});

function peso(value: number) {
  return `₱${value.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function inclusionText(value: string) {
  return value.replace(/^\s*[-•*]\s*/, "");
}
function openAssistant() {
  document.getElementById("chatLaunch")?.click();
}

const services: {
  title: string;
  text: string;
  image: string;
  alt: string;
  icon: IconName;
  to: string;
  cta: string;
}[] = [
  {
    title: "Pond Packages",
    text: "Ready-to-book pond installation packages, each with an included freebie.",
    image: "https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=900&q=80",
    alt: "Clear water in a pond installation",
    icon: "package",
    to: "/shop",
    cta: "View packages",
  },
  {
    title: "Custom Pond Design",
    text: "Choose 1–3 layers, set your own width and length, and decide on filtration.",
    image: "https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=900&q=80",
    alt: "Water pond landscape",
    icon: "ruler",
    to: "/booking",
    cta: "Plan a custom pond",
  },
  {
    title: "Farm Visitation",
    text: "Visit the farm with 1–5 visitors on an available Saturday or Sunday.",
    image: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=900&q=80",
    alt: "Farm landscape for a visit",
    icon: "trees",
    to: "/booking",
    cta: "Plan a farm visit",
  },
];

const steps: { title: string; text: string; icon: IconName }[] = [
  {
    title: "Choose a service",
    text: "Pick a pond package, design a custom pond, or plan a farm visit.",
    icon: "list-checks",
  },
  {
    title: "Pick a weekend date",
    text: "Select an open date on the farm calendar and add your details.",
    icon: "calendar-days",
  },
  {
    title: "Pay the 50% down payment",
    text: "Send it through GCash and upload your receipt with the booking.",
    icon: "smartphone",
  },
  {
    title: "Track your booking",
    text: "Your booking is confirmed once the owner verifies the payment.",
    icon: "badge-check",
  },
];

const reasons: { title: string; text: string; icon: IconName }[] = [
  {
    title: "Complete pond setups",
    text: "Packages cover the pond configuration and include a freebie to help you start.",
    icon: "package",
  },
  {
    title: "Built to your size",
    text: "Custom pond pricing is calculated from your dimensions, layers and filtration.",
    icon: "ruler",
  },
  {
    title: "Training and support",
    text: "Get guidance on raising crayfish and after-sales support from the farm.",
    icon: "graduation-cap",
  },
  {
    title: "Transparent booking",
    text: "See booking and payment status, updates and balances in one place.",
    icon: "clipboard-list",
  },
];

const stockSizes = [
  { name: "Craylings", detail: "1–2 inches" },
  { name: "Juveniles", detail: "2–3 inches" },
  { name: "Breeder trios & quadros", detail: "3–5 inches" },
  { name: "Kilo orders", detail: "4–5 inches" },
];

const faqs = [
  {
    q: "How do I pay for a service booking?",
    a: "Pay the 50% down payment through GCash, then upload your receipt and transaction reference when you submit the booking. The owner checks it against the actual GCash transaction, and your booking is confirmed once it is verified.",
  },
  {
    q: "Is the down payment refundable?",
    a: "No. Payments for a service booking, including the 50% down payment, are non-refundable once the booking is submitted.",
  },
  {
    q: "When is the remaining balance paid?",
    a: "After the service is done, the owner adds any Lalamove delivery fee. You then pay the remaining balance from My Bookings.",
  },
  {
    q: "When can I visit the farm?",
    a: "Farm visits are open on available Saturdays and Sundays for 1–5 visitors. If you need a different date, you can send a special-date request for the owner to review.",
  },
  {
    q: "How is a custom pond priced?",
    a: "The price is based on your pond’s width × length × the rate per square metre per layer, plus a fee if you add filtration. Current rates are shown in the Shop.",
  },
];
</script>

<template>
  <div class="bg-base-100">
    <!-- Hero -->
    <section class="hero relative min-h-[88vh] overflow-hidden bg-neutral">
      <img
        src="/images/home-hero-bg.jpg"
        alt=""
        class="absolute inset-0 size-full object-cover object-[50%_70%]"
        fetchpriority="high"
      >
      <div class="absolute inset-0 bg-gradient-to-r from-[#0f2418]/90 via-[#14301f]/70 to-[#14301f]/20" />
      <div class="hero-content relative z-10 w-full max-w-7xl justify-start px-4 pt-28 pb-16 sm:px-6 lg:px-8">
        <div class="max-w-2xl text-white">
          <p class="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-white/90">
            <AppIcon name="shrimp" size="size-4" />
            Australian Red Claw · Crayfish services
          </p>
          <h1 class="font-display text-4xl leading-[1.08] font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
            Good ponds make good beginnings.
          </h1>
          <p class="mt-6 max-w-xl text-base leading-relaxed text-white/85 sm:text-lg">
            Welcome to Boss Gudo A.R.C. Aqua Farm. Find a pond package, plan a
            custom setup, or arrange a farm visit with a clear, friendly booking
            process.
          </p>
          <div class="mt-8 flex flex-wrap gap-3">
            <NuxtLink to="/booking" class="btn btn-primary btn-lg">
              <AppIcon name="calendar-plus" />
              Book a service
            </NuxtLink>
            <NuxtLink to="/shop" class="btn btn-lg border-white/40 bg-white/10 text-white backdrop-blur hover:bg-white hover:text-primary">
              Explore pond packages
              <AppIcon name="arrow-right" />
            </NuxtLink>
          </div>
          <ul class="mt-10 grid gap-3 text-sm text-white/85 sm:grid-cols-3" aria-label="Highlights">
            <li class="flex items-center gap-2">
              <AppIcon name="calendar-check" size="size-4 text-white" />
              Farm visits on weekends
            </li>
            <li class="flex items-center gap-2">
              <AppIcon name="sprout" size="size-4 text-white" />
              For new and growing farms
            </li>
            <li class="flex items-center gap-2">
              <AppIcon name="smartphone" size="size-4 text-white" />
              Simple GCash payments
            </li>
          </ul>
        </div>
      </div>
    </section>

    <!-- Services -->
    <section class="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8" aria-labelledby="services-title">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div class="max-w-2xl">
          <p class="text-sm font-semibold uppercase tracking-[0.14em] text-primary">Our services</p>
          <h2 id="services-title" class="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Services built around your needs
          </h2>
          <p class="mt-3 text-base-content/70">
            Choose a pond package, design your own pond, or visit the farm.
          </p>
        </div>
        <NuxtLink to="/about" class="btn btn-ghost text-primary">
          About the farm
          <AppIcon name="arrow-right" size="size-4" />
        </NuxtLink>
      </div>

      <div class="mt-10 grid gap-6 md:grid-cols-3">
        <article
          v-for="service in services"
          :key="service.title"
          class="card group overflow-hidden p-0 border border-base-300 bg-base-100 transition-shadow hover:shadow-xl"
        >
          <figure class="aspect-[4/3] overflow-hidden">
            <img
              :src="service.image"
              :alt="service.alt"
              class="size-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            >
          </figure>
          <div class="card-body">
            <span class="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
              <AppIcon :name="service.icon" />
            </span>
            <h3 class="card-title mt-2 text-xl">{{ service.title }}</h3>
            <p class="text-base-content/70">{{ service.text }}</p>
            <div class="card-actions mt-3">
              <NuxtLink :to="service.to" class="btn btn-outline btn-primary btn-sm">
                {{ service.cta }}
                <AppIcon name="arrow-right" size="size-4" />
              </NuxtLink>
            </div>
          </div>
        </article>
      </div>
    </section>

    <!-- Package highlights (live catalog) -->
    <section class="bg-base-200 py-20" aria-labelledby="packages-title">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div class="flex flex-wrap items-end justify-between gap-4">
          <div class="max-w-2xl">
            <p class="text-sm font-semibold uppercase tracking-[0.14em] text-primary">Package highlights</p>
            <h2 id="packages-title" class="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              Pond packages ready to book
            </h2>
            <p class="mt-3 text-base-content/70">
              <template v-if="lowestPrice !== null">Packages start at <strong class="text-base-content">{{ peso(lowestPrice) }}</strong>, each with an included freebie.</template>
              <template v-else>Each package includes a freebie to help you get started.</template>
            </p>
          </div>
          <NuxtLink to="/shop" class="btn btn-primary">
            <AppIcon name="store" size="size-4" />
            See all packages
          </NuxtLink>
        </div>

        <div class="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <template v-if="catalogStatus === 'pending' || catalogStatus === 'idle'">
            <div v-for="n in 3" :key="n" class="card p-0 border border-base-300 bg-base-100" aria-hidden="true">
              <div class="skeleton aspect-[4/3] rounded-b-none" />
              <div class="card-body gap-3">
                <div class="skeleton h-6 w-2/3" />
                <div class="skeleton h-4 w-full" />
                <div class="skeleton h-4 w-4/5" />
              </div>
            </div>
            <span class="sr-only" role="status">Loading packages…</span>
          </template>

          <div v-else-if="catalogStatus === 'error'" role="alert" class="alert alert-warning sm:col-span-2 lg:col-span-3">
            <AppIcon name="triangle-alert" />
            <span>Packages could not be loaded right now. You can still browse them in the Shop.</span>
          </div>

          <div v-else-if="!highlightedPackages.length" class="alert sm:col-span-2 lg:col-span-3">
            <AppIcon name="info" />
            <span>No predefined packages are available right now. You can still book a Custom Pond Design.</span>
          </div>

          <article
            v-for="item in highlightedPackages"
            v-else
            :key="item.code"
            class="card overflow-hidden border border-base-300 bg-base-100 p-0"
          >
            <figure class="relative aspect-[4/3] bg-gradient-to-br from-primary/10 to-accent/20">
              <img v-if="item.imageUrl" :src="item.imageUrl" :alt="`${item.name} photo`" class="size-full object-cover" loading="lazy">
              <AppIcon v-else name="shrimp" size="size-16 text-primary/40" />
              <span v-if="item.featured" class="badge badge-secondary absolute top-3 left-3 gap-1 font-semibold">
                <AppIcon name="star" size="size-3" />
                Most popular
              </span>
            </figure>
            <div class="card-body">
              <h3 class="card-title">{{ item.name }}</h3>
              <p class="line-clamp-2 text-sm text-base-content/70">{{ item.description }}</p>
              <div class="flex flex-wrap gap-2">
                <span class="badge badge-ghost gap-1"><AppIcon name="layers" size="size-3" />{{ item.layers }}</span>
                <span class="badge badge-ghost gap-1"><AppIcon name="ruler" size="size-3" />{{ item.dimensions }}</span>
              </div>
              <ul v-if="item.inclusions.length" class="mt-1 space-y-1 text-sm">
                <li v-for="inclusion in item.inclusions" :key="inclusion" class="flex gap-2 text-base-content/80">
                  <AppIcon name="gift" size="size-4 mt-0.5 text-secondary" />
                  {{ inclusionText(inclusion) }}
                </li>
              </ul>
              <div class="mt-auto flex items-end justify-between gap-3 border-t border-base-300 pt-4">
                <div>
                  <p class="text-xs text-base-content/60">Package price</p>
                  <p class="text-xl font-bold text-primary">{{ peso(item.price) }}</p>
                </div>
                <NuxtLink to="/shop" class="btn btn-primary btn-sm">Details</NuxtLink>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>

    <!-- About the farm -->
    <section class="mx-auto grid max-w-7xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:px-8" aria-labelledby="about-title">
      <div class="relative">
        <img
          src="https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1100&q=80"
          alt="Open farmland under a clear sky"
          class="aspect-[4/3] w-full rounded-box object-cover"
          loading="lazy"
        >
        <div class="absolute -bottom-6 left-6 hidden items-center gap-3 rounded-box border border-base-300 bg-base-100 p-4 shadow-lg sm:flex">
          <img src="/images/boss-gudo-logo.png" alt="" class="size-12 rounded-full" width="48" height="48">
          <div>
            <p class="font-display text-lg font-semibold">Boss Gudo</p>
            <p class="text-xs text-base-content/60">General Trias, Cavite</p>
          </div>
        </div>
      </div>
      <div>
        <p class="text-sm font-semibold uppercase tracking-[0.14em] text-primary">About the farm</p>
        <h2 id="about-title" class="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Supporting new and growing crayfish enthusiasts
        </h2>
        <p class="mt-5 leading-relaxed text-base-content/75">
          BOSSGUDO A.R.C. AQUA FARM provides Australian Red Claw crayfish
          supply, pond setup assistance, training, and after-sales support. The
          farm aims to help customers understand the basics of raising crayfish
          and setting up suitable ponds.
        </p>
        <ul class="mt-6 grid gap-3 sm:grid-cols-2">
          <li class="flex items-center gap-3 text-sm font-medium">
            <span class="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary"><AppIcon name="shrimp" size="size-4" /></span>
            Crayfish supply
          </li>
          <li class="flex items-center gap-3 text-sm font-medium">
            <span class="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary"><AppIcon name="wrench" size="size-4" /></span>
            Pond setup assistance
          </li>
          <li class="flex items-center gap-3 text-sm font-medium">
            <span class="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary"><AppIcon name="graduation-cap" size="size-4" /></span>
            Training
          </li>
          <li class="flex items-center gap-3 text-sm font-medium">
            <span class="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary"><AppIcon name="handshake" size="size-4" /></span>
            After-sales support
          </li>
        </ul>
        <NuxtLink to="/about" class="btn btn-outline btn-primary mt-8">
          Learn more about us
          <AppIcon name="arrow-right" size="size-4" />
        </NuxtLink>
      </div>
    </section>

    <!-- Australian Red Claw -->
    <section class="bg-neutral py-20 text-neutral-content" aria-labelledby="arc-title">
      <div class="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:px-8">
        <div>
          <p class="text-sm font-semibold uppercase tracking-[0.14em] text-[#e8a39d]">The species</p>
          <h2 id="arc-title" class="mt-2 font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Australian Red Claw crayfish
          </h2>
          <p class="mt-5 leading-relaxed text-neutral-content/80">
            The Australian Red Claw (<em>Cherax quadricarinatus</em>) is a
            freshwater crayfish named for the red patch on the claws of mature
            males. Boss Gudo supplies Red Claw stock in several sizes, from
            young craylings for growing out to breeders for your own ponds.
          </p>
          <div class="mt-8 flex flex-wrap gap-3">
            <button type="button" class="btn btn-primary" @click="openAssistant">
              <AppIcon name="message-circle" />
              Ask about current prices
            </button>
            <NuxtLink to="/shop" class="btn btn-ghost text-neutral-content hover:bg-white/10">
              Pond setups for Red Claw
            </NuxtLink>
          </div>
        </div>
        <div>
          <h3 class="text-sm font-semibold uppercase tracking-[0.14em] text-neutral-content/60">Available stock sizes</h3>
          <ul class="mt-4 divide-y divide-white/10 rounded-box border border-white/10 bg-white/5">
            <li v-for="size in stockSizes" :key="size.name" class="flex items-center justify-between gap-4 px-5 py-4">
              <span class="flex items-center gap-3 font-medium text-white">
                <AppIcon name="shrimp" size="size-5 text-[#e8a39d]" />
                {{ size.name }}
              </span>
              <span class="text-sm text-neutral-content/70">{{ size.detail }}</span>
            </li>
          </ul>
          <p class="mt-3 text-xs text-neutral-content/60">Prices and availability are answered by the ARC Assistant from the farm’s latest price list.</p>
        </div>
      </div>
    </section>

    <!-- How it works -->
    <section class="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8" aria-labelledby="steps-title">
      <div class="mx-auto max-w-2xl text-center">
        <p class="text-sm font-semibold uppercase tracking-[0.14em] text-primary">How it works</p>
        <h2 id="steps-title" class="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">From choosing to confirmed in four steps</h2>
      </div>
      <ol class="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <li v-for="(step, index) in steps" :key="step.title" class="relative rounded-box border border-base-300 bg-base-100 p-6">
          <span class="text-xs font-bold tracking-[0.14em] text-base-content/50">STEP {{ String(index + 1).padStart(2, "0") }}</span>
          <span class="mt-4 grid size-12 place-items-center rounded-xl bg-primary text-primary-content">
            <AppIcon :name="step.icon" />
          </span>
          <h3 class="mt-4 text-lg font-semibold">{{ step.title }}</h3>
          <p class="mt-2 text-sm leading-relaxed text-base-content/70">{{ step.text }}</p>
        </li>
      </ol>
    </section>

    <!-- Why choose us -->
    <section class="bg-base-200 py-20" aria-labelledby="why-title">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div class="max-w-2xl">
          <p class="text-sm font-semibold uppercase tracking-[0.14em] text-primary">Why choose us</p>
          <h2 id="why-title" class="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">Practical support from pond to harvest</h2>
        </div>
        <div class="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div v-for="reason in reasons" :key="reason.title" class="rounded-box bg-base-100 p-6">
            <AppIcon :name="reason.icon" size="size-7 text-primary" />
            <h3 class="mt-4 font-semibold">{{ reason.title }}</h3>
            <p class="mt-2 text-sm leading-relaxed text-base-content/70">{{ reason.text }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- FAQ + contact -->
    <section class="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1.4fr_1fr] lg:px-8" aria-labelledby="faq-title">
      <div>
        <p class="text-sm font-semibold uppercase tracking-[0.14em] text-primary">FAQs</p>
        <h2 id="faq-title" class="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">Common questions</h2>
        <div class="mt-8 space-y-3">
          <details
            v-for="(item, index) in faqs"
            :key="item.q"
            class="collapse collapse-arrow rounded-box border border-base-300 bg-base-100"
            :open="index === 0"
          >
            <summary class="collapse-title font-semibold">{{ item.q }}</summary>
            <div class="collapse-content text-sm leading-relaxed text-base-content/75">
              <p>{{ item.a }}</p>
            </div>
          </details>
        </div>
        <p class="mt-6 text-sm text-base-content/70">
          Have another question?
          <button type="button" class="link link-primary font-semibold" @click="openAssistant">Ask the ARC Assistant</button>
        </p>
      </div>

      <aside class="h-fit rounded-box bg-primary p-8 text-primary-content" aria-labelledby="contact-title">
        <h2 id="contact-title" class="font-display text-2xl font-semibold text-primary-content">Visit or contact the farm</h2>
        <ul class="mt-6 space-y-5 text-sm">
          <li class="flex gap-3">
            <AppIcon name="map-pin" size="size-5 mt-0.5 shrink-0" />
            <span>
              {{ FARM.address }}<br>
              <span class="text-primary-content/75">{{ FARM.landmark }} · Search “{{ FARM.mapsQuery }}” on Waze or Google Maps</span>
            </span>
          </li>
          <li class="flex items-center gap-3">
            <AppIcon name="phone" size="size-5 shrink-0" />
            <a :href="FARM.phoneHref" class="link link-hover font-semibold">{{ FARM.phoneDisplay }}</a>
          </li>
          <li class="flex items-center gap-3">
            <AppIcon name="calendar-check" size="size-5 shrink-0" />
            Farm visits on available weekends
          </li>
        </ul>
        <div class="mt-8 flex flex-wrap gap-3">
          <NuxtLink to="/booking" class="btn bg-white text-primary hover:bg-white/90">Book now</NuxtLink>
          <a :href="MAPS_URL" target="_blank" rel="noopener noreferrer" class="btn btn-ghost text-primary-content hover:bg-white/10">
            <AppIcon name="map-pin" size="size-4" />
            Open in Maps
          </a>
        </div>
      </aside>
    </section>
  </div>
</template>
