<script setup lang="ts">
const route = useRoute();
const authUser = useState<{ id?: string; firstName?: string } | null>("auth:user", () => null);
const authReady = useState<boolean>("auth:ready", () => false);

const currentPage = computed(() => route.path.replace(/^\/+|\/+$/g, "") || "home");
const legacyPages = new Set([
  "home",
  "about",
  "shop",
  "booking",
  "mybookings",
  "admin",
]);
const legacyPageVisible = computed(() => legacyPages.has(currentPage.value));
const isAuthenticated = computed(() => Boolean(authUser.value));
const customerNavVisible = computed(() => authReady.value && isAuthenticated.value);

const navItems = [
  { label: "Home", to: "/" },
  { label: "About", to: "/about" },
  { label: "Shop", to: "/shop" },
  { label: "Bookings", to: "/booking" },
  { label: "My Bookings", to: "/mybookings" },
];

useHead(() => ({
  bodyAttrs: { "data-page": currentPage.value },
}));
</script>

<template>
  <div v-if="!authReady" class="app-shell app-shell--loading">
    <div class="loading-panel">Preparing your account…</div>
  </div>

  <template v-else>
    <header v-if="customerNavVisible" class="topbar inner-navbar">
      <NuxtLink to="/" class="brand">
        <img src="/images/boss-gudo-logo.png" alt="BOSSGUDO A.R.C. AQUA FARM logo" class="brand-logo">
        <span class="brand-name">BOSSGUDO<small>A.R.C. AQUA FARM</small></span>
      </NuxtLink>
      <nav id="mainNav" class="nav" aria-label="Main navigation">
        <NuxtLink v-for="item in navItems" :key="item.to" :to="item.to" :data-page="item.to.replace(/^\//, '') || 'home'">
          {{ item.label }}
        </NuxtLink>
        <NuxtLink to="/logout" data-page="logout">Log Out</NuxtLink>
      </nav>
    </header>

    <main id="app" v-show="legacyPageVisible" />
    <main v-show="!legacyPageVisible">
      <NuxtPage />
    </main>

    <div id="modalHost" />
    <output class="toast" id="toast" aria-live="polite" />

    <footer class="footer">
      <div class="footer-social">
        <h3>SOCIAL</h3>
        <div class="social-links">
          <a href="https://www.facebook.com/profile.php?id=61575088857931" target="_blank" rel="noopener noreferrer" aria-label="Visit our Facebook page" title="Facebook">
            <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073c0 6.019 4.388 11.015 10.125 11.927v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.514c-1.491 0-1.956.93-1.956 1.885v2.269h3.328l-.532 3.49h-2.796V24C19.612 23.088 24 18.092 24 12.073Z" />
            </svg>
          </a>
          <a href="https://www.tiktok.com/@jedd.angelo?is_from_webapp=1&amp;sender_device=pc" target="_blank" rel="noopener noreferrer" aria-label="Visit our TikTok page" title="TikTok">
            <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 3 15.68a6.33 6.33 0 0 0 10.81 4.48 6.37 6.37 0 0 0 1.86-4.57v-6.2a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.34z" />
            </svg>
          </a>
        </div>
      </div>
      <aside class="footer-bottom">
        &copy; <span id="footerYear" /> BOSSGUDO A.R.C. AQUA FARM. All rights reserved.
      </aside>
    </footer>

    <button class="chat-launch" id="chatLaunch" type="button">💬 Ask ARC Assistant</button>
    <div class="chat-box" id="chatBox">
      <div class="chat-head">
        ARC Inquiry Assistant
        <button class="small" id="chatClose" type="button" aria-label="Close assistant">✕</button>
      </div>
      <div class="chat-body" id="chatBody">
        <div class="bubble">Hi! I can help with questions about packages, pond setup, training, and bookings. What would you like to know?</div>
      </div>
      <form class="chat-input" id="chatForm">
        <input id="chatText" placeholder="Ask about packages..." aria-label="Ask a question" required>
        <button class="primary" type="submit">Send</button>
      </form>
    </div>
  </template>
</template>
