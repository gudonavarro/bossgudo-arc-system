export default defineNuxtRouteMiddleware(async () => {
  const { data, error } = await useFetch<{ user: unknown }>("/api/auth/session", {
    credentials: "include",
    cache: "no-store",
  });

  if (error.value || !data.value?.user) {
    return navigateTo("/login?next=mybookings");
  }
});
