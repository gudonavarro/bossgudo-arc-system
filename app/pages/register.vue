<script setup lang="ts">
const form = reactive({ firstName: "", lastName: "", email: "", phoneNumber: "", password: "", confirmPassword: "" });
const feedback = ref("");
const pending = ref(false);

async function submit() {
  pending.value = true;
  feedback.value = "";
  try {
    await $fetch("/api/auth/register", { method: "POST", body: form });
    await navigateTo("/login");
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : "Unable to create your account.";
  } finally {
    pending.value = false;
  }
}
</script>

<template>
  <section class="panel auth-card">
    <h1 class="page-title">Create your account</h1>
    <form @submit.prevent="submit">
      <div class="field"><label for="firstName">FIRST NAME</label><input id="firstName" v-model="form.firstName" required></div>
      <div class="field"><label for="lastName">LAST NAME</label><input id="lastName" v-model="form.lastName" required></div>
      <div class="field"><label for="email">EMAIL ADDRESS</label><input id="email" v-model="form.email" type="email" required></div>
      <div class="field"><label for="phoneNumber">PHONE NUMBER</label><input id="phoneNumber" v-model="form.phoneNumber" required></div>
      <div class="field"><label for="password">PASSWORD</label><input id="password" v-model="form.password" type="password" required></div>
      <div class="field"><label for="confirmPassword">CONFIRM PASSWORD</label><input id="confirmPassword" v-model="form.confirmPassword" type="password" required></div>
      <button class="primary" type="submit" :disabled="pending">{{ pending ? "Creating..." : "Create Account" }}</button>
      <output class="form-feedback show" aria-live="polite">{{ feedback }}</output>
    </form>
  </section>
</template>
