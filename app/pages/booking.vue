<script setup lang="ts">
definePageMeta({ middleware: ["auth"] });
</script>

<template>
  <FeaturePage title="Bookings" description="Choose the type of service you want to discuss with the farm.">
    <div class="grid3 page-content">
      <article class="card">
        <h2>Pond service</h2>
        <p>Review pond packages or discuss a custom pond setup.</p>
        <NuxtLink class="secondary action-link" to="/shop">Browse packages</NuxtLink>
      </article>
      <article class="card">
        <h2>Farm visitation</h2>
        <p>Farm visits are planned for weekends and can accommodate 1–5 visitors.</p>
        <p class="muted">Contact the farm to confirm availability before travelling.</p>
      </article>
      <p class="panel booking-notice">
        Online booking submission is not currently connected. These pages provide
        service information but do not create or reserve a booking.
      </p>
    </div>
  </FeaturePage>
</template>
