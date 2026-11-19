<template>
  <FeaturePage title="Bookings" description="Choose the type of service you want to discuss with the farm.">
    <div class="grid gap-5 md:grid-cols-3">
      <article class="tile">
        <h2>Pond service</h2>
        <p>Review pond packages or discuss a custom pond setup.</p>
        <NuxtLink class="btn btn-sm mt-3" to="/shop">Browse packages</NuxtLink>
      </article>
      <article class="tile">
        <h2>Farm visitation</h2>
        <p>Farm visits are planned for weekends and can accommodate 1–5 visitors.</p>
        <p class="muted">Contact the farm to confirm availability before travelling.</p>
      </article>
      <p class="notice mt-5">
        Online booking submission is not currently connected. These pages provide
        service information but do not create or reserve a booking.
      </p>
    </div>
  </FeaturePage>
</template>
