<template>
  <FeaturePage
    title="Booking"
    description="Choose what you would like to arrange with the farm."
  >
    <section class="choice-grid" aria-label="Booking types">
      <article class="choice">
        <div class="service-icon" aria-hidden="true">🌊</div>
        <h3>Book a Service</h3>
        <p>
          Choose a pond package or discuss manufacturing, installation, and
          custom pond design.
        </p>
        <NuxtLink class="primary action-link" to="/servicebooking">
          Select Service <span aria-hidden="true">→</span>
        </NuxtLink>
      </article>

      <article class="choice">
        <div class="service-icon" aria-hidden="true">🏡</div>
        <h3>Book a Visitation</h3>
        <p>
          Schedule a farm visit for 1–5 visitors on an available weekend.
        </p>
        <NuxtLink class="primary action-link" to="/visitationbooking">
          Select Visitation <span aria-hidden="true">→</span>
        </NuxtLink>
      </article>
    </section>
  </FeaturePage>
</template>
