<script setup lang="ts">
definePageMeta({ middleware: ["auth"] });
</script>

<template>
  <FeaturePage title="My Bookings" description="Your account is signed in, but booking records are not available in this version.">
    <p class="panel booking-notice">
      Booking requests are not currently stored by the Nuxt application, so there
      are no booking updates to display here.
    </p>
  </FeaturePage>
</template>
