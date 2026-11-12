<script setup lang="ts">
definePageMeta({ middleware: ["auth"] });
</script>

<template>
  <section class="hero">
    <header class="topbar home-navbar">
      <NuxtLink to="/" class="brand">
        <img src="/images/boss-gudo-logo.png" alt="BOSSGUDO A.R.C. AQUA FARM logo" class="brand-logo">
        <span class="brand-name">BOSSGUDO<small>A.R.C. AQUA FARM</small></span>
      </NuxtLink>
      <nav class="nav" aria-label="Main navigation">
        <NuxtLink to="/">Home</NuxtLink>
        <NuxtLink to="/about">About</NuxtLink>
        <NuxtLink to="/shop">Shop</NuxtLink>
        <NuxtLink to="/booking">Bookings</NuxtLink>
        <NuxtLink to="/login">Log In</NuxtLink>
      </nav>
    </header>

    <div class="hero-content">
      <div class="eyebrow">Australian Red Claw · Crayfish Services</div>
      <h1>Good ponds make good beginnings.</h1>
      <p>
        Welcome to BossGudo ARC. Find a pond package, plan a custom setup, or
        arrange a farm visit with a clear, friendly booking process.
      </p>
      <div class="hero-actions">
        <NuxtLink class="primary" to="/booking">Book a Service</NuxtLink>
        <NuxtLink class="secondary" to="/shop">Explore Shop</NuxtLink>
      </div>
      <div class="hero-trust">
        <span>Farm visits available on weekends</span>
        <span>Packages for new and growing farms</span>
      </div>
    </div>
  </section>

  <section class="section-head">
    <div>
      <h2>Services built around your needs</h2>
      <p>Choose a pond package, design your own pond, or visit the farm.</p>
    </div>
    <NuxtLink class="secondary" to="/about">About the Farm</NuxtLink>
  </section>

  <section class="grid3" aria-label="Farm services">
    <article class="card">
      <img
        class="service-photo"
        src="https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&amp;fit=crop&amp;w=1000&amp;q=85"
        alt="Clear water in a pond installation"
      >
      <h3>Pond Packages</h3>
      <p>Explore pond installation packages with an included freebie.</p>
      <NuxtLink class="secondary" to="/shop">View Shop</NuxtLink>
    </article>
    <article class="card">
      <img
        class="service-photo"
        src="https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&amp;fit=crop&amp;w=1000&amp;q=85"
        alt="Water pond landscape"
      >
      <h3>Custom Pond Design</h3>
      <p>Plan pond dimensions, layers, and filtration for your setup.</p>
      <NuxtLink class="secondary" to="/booking">Discuss a custom pond</NuxtLink>
    </article>
    <article class="card">
      <img
        class="service-photo"
        src="https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&amp;fit=crop&amp;w=1000&amp;q=85"
        alt="Farm landscape for a visit"
      >
      <h3>Farm Visitation</h3>
      <p>Arrange a weekend visit for 1–5 visitors.</p>
      <NuxtLink class="secondary" to="/booking">Plan a farm visit</NuxtLink>
    </article>
  </section>

  <section class="section-head">
    <div>
      <h2>How it works</h2>
      <p>Choose a service, discuss the details, and follow up with the farm.</p>
    </div>
  </section>
  <section class="steps" aria-label="Booking steps">
    <article class="step-card">
      <div class="step-num">STEP 01</div>
      <h3>Choose what you need</h3>
      <p>Explore pond packages, request a custom setup, or plan a farm visit.</p>
    </article>
    <article class="step-card">
      <div class="step-num">STEP 02</div>
      <h3>Discuss your schedule</h3>
      <p>Share your requirements and preferred date with the farm.</p>
    </article>
    <article class="step-card">
      <div class="step-num">STEP 03</div>
      <h3>Confirm the details</h3>
      <p>The farm will confirm availability and next steps for your request.</p>
    </article>
  </section>
</template>
