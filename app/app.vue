<script setup lang="ts">
const route = useRoute();
const currentPage = computed(() => {
  const path = route.path.replace(/^\/+/, "");
  return path || "home";
});

useHead(() => ({
  bodyAttrs: { "data-page": currentPage.value },
}));
</script>

<template>
  <header class="topbar" :hidden="currentPage === 'home'">
    <NuxtLink to="/" class="brand">
      <img src="/images/boss-gudo-logo.png" alt="BOSSGUDO A.R.C. AQUA FARM logo" class="brand-logo">
      <span class="brand-name">BOSSGUDO<small>A.R.C. AQUA FARM</small></span>
    </NuxtLink>
    <nav class="nav" aria-label="Main navigation">
      <NuxtLink to="/" data-page="home">Home</NuxtLink>
      <NuxtLink to="/about" data-page="about">About</NuxtLink>
      <NuxtLink to="/shop" data-page="shop">Shop</NuxtLink>
      <NuxtLink to="/booking" data-page="booking">Bookings</NuxtLink>
      <NuxtLink to="/mybookings" data-page="mybookings" style="display: none">My Bookings</NuxtLink>
      <NuxtLink to="/login" data-page="login">Log In</NuxtLink>
    </nav>
  </header>

  <template id="homeTemplate">
    <section class="hero">
      <header class="topbar home-navbar">
        <NuxtLink to="/" class="brand">
          <img src="/images/boss-gudo-logo.png" alt="BOSSGUDO A.R.C. AQUA FARM logo" class="brand-logo">
          <span class="brand-name">BOSSGUDO<small>A.R.C. AQUA FARM</small></span>
        </NuxtLink>
        <nav class="nav" aria-label="Main navigation">
          <NuxtLink to="/" data-page="home">Home</NuxtLink>
          <NuxtLink to="/about" data-page="about">About</NuxtLink>
          <NuxtLink to="/shop" data-page="shop">Shop</NuxtLink>
          <NuxtLink to="/booking" data-page="booking">Bookings</NuxtLink>
          <NuxtLink to="/mybookings" data-page="mybookings" style="display: none">My Bookings</NuxtLink>
          <NuxtLink to="/login" data-page="login">Log In</NuxtLink>
        </nav>
      </header>
      <div class="hero-content">
        <div class="eyebrow">Australian Red Claw · Crayfish Services</div>
        <h1>Good ponds make good beginnings.</h1>
        <p>Welcome to BossGudo ARC. Find a pond package, plan a custom setup, or arrange a farm visit with a clear, friendly booking process.</p>
        <div class="hero-actions">
          <button class="primary" type="button" data-action="start-booking">Book a Service</button>
          <button class="secondary" type="button" data-action="show-packages">Explore Shop</button>
        </div>
        </div>
    </section>
    <div class="section-head">
      <div><h2>Services built around your needs</h2><p>Choose a pond package, design your own pond, or visit the farm.</p></div>
      <button class="secondary" type="button" data-action="show-about">About the Farm →</button>
    </div>
    <section class="grid3">
      <div class="card"><img class="service-photo" src="https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&amp;fit=crop&amp;w=1000&amp;q=85" alt="Clear water in a pond installation"><h3>Pond Packages</h3><p>Predefined pond installation packages, each with an included freebie.</p><span class="price-note" id="homePackagePrice">Packages available</span><br><button class="secondary" type="button" data-action="show-packages">View Shop</button></div>
      <div class="card"><img class="service-photo" src="https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&amp;fit=crop&amp;w=1000&amp;q=85" alt="Water pond landscape"><h3>Custom Pond Design</h3><p>Set your own layers, size, and filtration. The price is calculated from your pond size.</p><span class="price-note">Price based on dimensions</span><br><button class="secondary" type="button" data-action="custom-pond">Design my pond</button></div>
      <div class="card"><img class="service-photo" src="https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&amp;fit=crop&amp;w=1000&amp;q=85" alt="Farm landscape for a visit"><h3>Farm Visitation</h3><p>Schedule a farm visit for 1–5 visitors on available weekends.</p><span class="price-note">Weekends only</span><br><button class="secondary" type="button" data-action="show-visit">Book a visitation</button></div>
    </section>
    <div class="section-head"><div><h2>How it works</h2><p>Pick what you need first. Each option has its own short process.</p></div></div>
    <section class="steps"><div class="step-card"><div class="step-num">STEP 01</div><h3>Choose what to book</h3><p>Start by selecting Book a Service or Book a Visitation.</p></div><div class="step-card"><div class="step-num">STEP 02</div><h3>Pick, schedule, pay</h3><p>Choose a package, pick your date, enter your details, then pay the 50% down payment.</p></div><div class="step-card"><div class="step-num">STEP 03</div><h3>Track every update</h3><p>Your booking is confirmed once the owner verifies your down payment.</p></div></section>
  </template>

  <main id="app"><NuxtPage /></main>
  <div id="modalHost"></div>
  <output class="toast" id="toast" aria-live="polite"></output>
  <footer class="footer"><strong>BOSSGUDO A.R.C. AQUA FARM</strong><span>Practical crayfish farming support, pond services, and farm visits.</span><small>&copy; {{ new Date().getFullYear() }} All rights reserved.</small></footer>
  <button class="chat-launch" id="chatLaunch" type="button">💬 Ask ARC Assistant</button>
  <div class="chat-box" id="chatBox">
    <div class="chat-head">ARC Inquiry Assistant <button class="small" id="chatClose" type="button" aria-label="Close assistant">✕</button></div>
    <div class="chat-body" id="chatBody"><div class="bubble">Hi! I can help with questions about packages, pond setup, training, and bookings. What would you like to know?</div></div>
    <form class="chat-input" id="chatForm"><input id="chatText" placeholder="Ask about packages..." aria-label="Ask a question" required><button class="primary" type="submit">Send</button></form>
  </div>
</template>
