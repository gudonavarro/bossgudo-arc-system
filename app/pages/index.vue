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
  icon: IconName;
  to: string;
  cta: string;
}[] = [
  {
    title: "Pond packages",
    text: "Ready-to-book pond setups from the farm, each with an included freebie.",
    icon: "package",
    to: "/shop",
    cta: "View packages",
  },
  {
    title: "Custom pond design",
    text: "Choose 1–3 layers, set your own width and length, and decide on filtration.",
    icon: "ruler",
    to: "/booking",
    cta: "Plan a custom pond",
  },
  {
    title: "Farm visitation",
    text: "Visit the farm with 1–5 visitors on an available Saturday or Sunday.",
    icon: "trees",
    to: "/booking",
    cta: "Plan a farm visit",
  },
];

const steps: { title: string; text: string }[] = [
  {
    title: "Choose a service",
    text: "Pick a pond package, design a custom pond, or plan a farm visit.",
  },
  {
    title: "Pick a weekend date",
    text: "Select an open date on the farm calendar and add your details.",
  },
  {
    title: "Pay the 50% down payment",
    text: "Send it through GCash and upload your receipt with the booking.",
  },
  {
    title: "Track your booking",
    text: "Your booking is confirmed once the owner verifies the payment.",
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
    <section class="border-b border-base-300 bg-base-100" aria-labelledby="hero-title">
      <div class="mx-auto grid max-w-7xl items-center gap-10 px-4 pt-10 pb-14 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-14 lg:px-8 lg:pt-16 lg:pb-20">
        <div>
          <p class="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
            <AppIcon name="map-pin" size="size-4" />
            General Trias, Cavite
          </p>
          <h1 id="hero-title" class="mt-5 text-4xl leading-[1.1] font-bold tracking-tight text-base-content sm:text-5xl lg:text-[3.4rem]">
            Australian Red Claw crayfish and the ponds to raise them
          </h1>
          <p class="mt-5 max-w-xl text-lg leading-relaxed text-base-content/70">
            Boss Gudo A.R.C. Aqua Farm supplies Red Claw stock and builds pond
            setups for new and growing farms, with training and after-sales
            support. Book a pond package, design a custom pond, or visit the farm.
          </p>
          <div class="mt-8 flex flex-wrap gap-3">
            <NuxtLink to="/booking" class="btn btn-primary btn-lg">
              <AppIcon name="calendar-plus" />
              Book a service
            </NuxtLink>
            <NuxtLink to="/shop" class="btn btn-outline btn-lg border-base-300 hover:border-primary hover:bg-primary/5 hover:text-primary">
              View pond packages
            </NuxtLink>
          </div>
          <dl class="mt-10 grid max-w-xl grid-cols-1 gap-x-8 gap-y-4 border-t border-base-300 pt-6 sm:grid-cols-3">
            <div>
              <dt class="text-sm text-base-content/60">Pond packages</dt>
              <dd class="mt-0.5 font-semibold">
                <template v-if="lowestPrice !== null">From {{ peso(lowestPrice) }}</template>
                <template v-else>With a freebie</template>
              </dd>
            </div>
            <div>
              <dt class="text-sm text-base-content/60">Farm visits</dt>
              <dd class="mt-0.5 font-semibold">Weekends, 1–5 visitors</dd>
            </div>
            <div>
              <dt class="text-sm text-base-content/60">Payment</dt>
              <dd class="mt-0.5 font-semibold">50% down via GCash</dd>
            </div>
          </dl>
        </div>

        <figure class="relative">
          <img
            src="/images/redclaw-crayfish.jpg"
            alt="An Australian Red Claw crayfish showing the red patch on its claw"
            class="aspect-4/3 w-full rounded-box object-cover"
            width="1280"
            height="750"
            fetchpriority="high"
          >
          <figcaption class="mt-3 flex items-start gap-2 text-sm text-base-content/60">
            <AppIcon name="shrimp" size="size-4 mt-0.5 text-secondary" />
            <span>Australian Red Claw (<em>Cherax quadricarinatus</em>), named for the red patch on mature males’ claws.</span>
          </figcaption>
        </figure>
      </div>
    </section>

    <!-- Services -->
    <section class="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20" aria-labelledby="services-title">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div class="max-w-2xl">
          <p class="text-sm font-semibold text-primary">Our services</p>
          <h2 id="services-title" class="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
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

      <div class="mt-10 grid divide-y divide-base-300 rounded-box border border-base-300 md:grid-cols-3 md:divide-x md:divide-y-0">
        <article v-for="service in services" :key="service.title" class="flex flex-col p-6 lg:p-8">
          <span class="grid size-11 place-items-center rounded-lg bg-primary/10 text-primary">
            <AppIcon :name="service.icon" />
          </span>
          <h3 class="mt-5 text-lg font-semibold">{{ service.title }}</h3>
          <p class="mt-2 flex-1 text-base-content/70">{{ service.text }}</p>
          <NuxtLink :to="service.to" class="link mt-5 inline-flex items-center gap-1.5 font-semibold text-primary no-underline hover:underline">
            {{ service.cta }}
            <AppIcon name="arrow-right" size="size-4" />
          </NuxtLink>
        </article>
      </div>
    </section>

    <!-- Package highlights (live catalog) -->
    <section class="bg-base-200 py-16 lg:py-20" aria-labelledby="packages-title">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div class="flex flex-wrap items-end justify-between gap-4">
          <div class="max-w-2xl">
            <p class="text-sm font-semibold text-primary">Package highlights</p>
            <h2 id="packages-title" class="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
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
              <div class="skeleton aspect-4/3 rounded-b-none" />
              <div class="card-body gap-3">
                <div class="skeleton h-6 w-2/3" />
                <div class="skeleton h-4 w-full" />
                <div class="skeleton h-4 w-4/5" />
              </div>
            </div>
            <output class="sr-only">Loading packages…</output>
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
            <figure class="relative aspect-4/3 bg-base-200">
              <img v-if="item.imageUrl" :src="item.imageUrl" :alt="item.name" class="size-full object-cover" loading="lazy">
              <AppIcon v-else name="shrimp" size="size-16 text-primary/30" />
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
    <section class="mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:gap-14 lg:px-8 lg:py-20" aria-labelledby="about-title">
      <img
        src="/images/aquaculture-ponds.jpg"
        alt="Aerated aquaculture ponds with a farm building beside them"
        class="aspect-4/3 w-full rounded-box object-cover"
        width="1280"
        height="720"
        loading="lazy"
      >
      <div>
        <p class="text-sm font-semibold text-primary">About the farm</p>
        <h2 id="about-title" class="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
          Supporting new and growing crayfish enthusiasts
        </h2>
        <p class="mt-5 leading-relaxed text-base-content/75">
          BOSSGUDO A.R.C. AQUA FARM provides Australian Red Claw crayfish
          supply, pond setup assistance, training, and after-sales support. The
          farm aims to help customers understand the basics of raising crayfish
          and setting up suitable ponds.
        </p>
        <ul class="mt-6 grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <li class="flex items-center gap-3 font-medium">
            <AppIcon name="shrimp" size="size-5 text-primary" />
            Crayfish supply
          </li>
          <li class="flex items-center gap-3 font-medium">
            <AppIcon name="wrench" size="size-5 text-primary" />
            Pond setup assistance
          </li>
          <li class="flex items-center gap-3 font-medium">
            <AppIcon name="graduation-cap" size="size-5 text-primary" />
            Training
          </li>
          <li class="flex items-center gap-3 font-medium">
            <AppIcon name="handshake" size="size-5 text-primary" />
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
    <section class="bg-neutral py-16 text-neutral-content lg:py-20" aria-labelledby="arc-title">
      <div class="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:gap-14 lg:px-8">
        <div>
          <p class="text-sm font-semibold text-[#e8a39d]">The species</p>
          <h2 id="arc-title" class="mt-1 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Australian Red Claw crayfish
          </h2>
          <p class="mt-5 leading-relaxed text-neutral-content/80">
            The Australian Red Claw (<em>Cherax quadricarinatus</em>) is a
            freshwater crayfish named for the red patch on the claws of mature
            males. Boss Gudo supplies Red Claw stock in several sizes, from
            young craylings for growing out to breeders for your own ponds.
          </p>
          <img
            src="/images/redclaw-crayfish-wild.jpg"
            alt="A Red Claw crayfish on leaf litter"
            class="mt-8 aspect-16/7 w-full rounded-box object-cover"
            width="1280"
            height="465"
            loading="lazy"
          >
        </div>
        <div class="lg:pt-10">
          <h3 class="text-sm font-semibold text-neutral-content/70">Available stock sizes</h3>
          <ul class="mt-4 divide-y divide-white/10 border-y border-white/10">
            <li v-for="size in stockSizes" :key="size.name" class="flex items-center justify-between gap-4 py-4">
              <span class="font-medium text-white">{{ size.name }}</span>
              <span class="text-sm text-neutral-content/70">{{ size.detail }}</span>
            </li>
          </ul>
          <p class="mt-4 text-sm text-neutral-content/60">Prices and availability are answered by the ARC Assistant from the farm’s latest price list.</p>
          <div class="mt-6 flex flex-wrap gap-3">
            <button type="button" class="btn btn-primary" @click="openAssistant">
              <AppIcon name="message-circle" />
              Ask about current prices
            </button>
            <NuxtLink to="/shop" class="btn btn-ghost text-neutral-content hover:bg-white/10">
              Pond setups for Red Claw
            </NuxtLink>
          </div>
        </div>
      </div>
    </section>

    <!-- How it works -->
    <section class="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20" aria-labelledby="steps-title">
      <div class="max-w-2xl">
        <p class="text-sm font-semibold text-primary">How it works</p>
        <h2 id="steps-title" class="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">From choosing to confirmed in four steps</h2>
      </div>
      <ol class="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        <li v-for="(step, index) in steps" :key="step.title" class="border-t-2 border-primary pt-5">
          <span class="text-sm font-semibold text-primary">Step {{ index + 1 }}</span>
          <h3 class="mt-2 text-lg font-semibold">{{ step.title }}</h3>
          <p class="mt-2 text-sm leading-relaxed text-base-content/70">{{ step.text }}</p>
        </li>
      </ol>
    </section>

    <!-- Why choose us -->
    <section class="bg-base-200 py-16 lg:py-20" aria-labelledby="why-title">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div class="max-w-2xl">
          <p class="text-sm font-semibold text-primary">Why choose us</p>
          <h2 id="why-title" class="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">Practical support for your crayfish farm</h2>
        </div>
        <div class="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
          <div v-for="reason in reasons" :key="reason.title">
            <AppIcon :name="reason.icon" size="size-6 text-primary" />
            <h3 class="mt-3 font-semibold">{{ reason.title }}</h3>
            <p class="mt-1.5 text-sm leading-relaxed text-base-content/70">{{ reason.text }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- FAQ + contact -->
    <section class="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.4fr_1fr] lg:px-8 lg:py-20" aria-labelledby="faq-title">
      <div>
        <p class="text-sm font-semibold text-primary">FAQs</p>
        <h2 id="faq-title" class="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">Common questions</h2>
        <div class="mt-8 divide-y divide-base-300 border-y border-base-300">
          <details
            v-for="(item, index) in faqs"
            :key="item.q"
            class="collapse collapse-arrow rounded-none"
            :open="index === 0"
          >
            <summary class="collapse-title px-0 font-semibold">{{ item.q }}</summary>
            <div class="collapse-content px-0 text-base-content/75">
              <p>{{ item.a }}</p>
            </div>
          </details>
        </div>
        <p class="mt-6 text-base-content/70">
          Have another question?
          <button type="button" class="link link-primary font-semibold" @click="openAssistant">Ask the ARC Assistant</button>
        </p>
      </div>

      <aside class="h-fit rounded-box bg-primary p-8 text-primary-content" aria-labelledby="contact-title">
        <h2 id="contact-title" class="text-2xl font-bold text-primary-content">Visit or contact the farm</h2>
        <ul class="mt-6 space-y-5">
          <li class="flex gap-3">
            <AppIcon name="map-pin" size="size-5 mt-0.5 shrink-0" />
            <span>
              {{ FARM.address }}<br>
              <span class="text-sm text-primary-content/75">{{ FARM.landmark }} · Search “{{ FARM.mapsQuery }}” on Waze or Google Maps</span>
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
