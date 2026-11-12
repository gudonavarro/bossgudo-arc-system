export default defineNuxtRouteMiddleware(async (to) => {
  const { data, error } = await useFetch<{ user: unknown }>("/api/auth/session", {
    credentials: "include",
    cache: "no-store",
  });

  if (error.value || !data.value?.user) {
    const redirectPath = to.path === "/" ? "/login" : "/login";
    return navigateTo({
      path: redirectPath,
      query: to.path !== "/" ? { next: to.fullPath } : undefined,
    }, { replace: true });
  }
});
