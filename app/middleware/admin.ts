export default defineNuxtRouteMiddleware(async () => {
  const { initialize } = useAuth();
  const shouldRevalidate =
    import.meta.client && !useNuxtApp().isHydrating;
  const user = await initialize({ force: shouldRevalidate });

  if (user?.role !== "admin") {
    return navigateTo("/admin-login", { replace: true });
  }
});
