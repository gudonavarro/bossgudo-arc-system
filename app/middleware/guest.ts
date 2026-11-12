export default defineNuxtRouteMiddleware(async (to) => {
  const { data, error } = await useFetch<{ user: unknown }>('/api/auth/session', {
    credentials: 'include',
    cache: 'no-store',
  });

  if (!error.value && data.value?.user) {
    const next = to.query.next;
    const redirectTarget = typeof next === "string" && next.startsWith("/") && !next.startsWith("//")
      ? next
      : "/";
    return navigateTo(redirectTarget, { replace: true });
  }
});
