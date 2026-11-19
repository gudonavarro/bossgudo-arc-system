<template>
  <FeaturePage title="Shop" description="Explore the pond service options available for your farm.">
    <section class="grid gap-5 md:grid-cols-3" aria-label="Pond service options">
      <article class="tile">
        <h2>Pond packages</h2>
        <p>Predefined pond installation options for common setup needs.</p>
        <p class="muted">Package pricing and availability must be confirmed with the farm.</p>
        <NuxtLink class="btn btn-sm mt-3" to="/booking">Ask about a package</NuxtLink>
      </article>
      <article class="tile">
        <h2>Custom pond design</h2>
        <p>Discuss pond dimensions, layers, and filtration for your site.</p>
        <NuxtLink class="btn btn-sm mt-3" to="/booking">Discuss a custom setup</NuxtLink>
      </article>
    </section>
  </FeaturePage>
</template>
