export default defineNuxtRouteMiddleware(async () => {
  const { initialize } = useAuth();
  const shouldRevalidate =
    import.meta.client && !useNuxtApp().isHydrating;
  const user = await initialize({ force: shouldRevalidate });

  if (!user) {
    return navigateTo("/customer-login");
  }
  if (user.role !== "admin") {
    return navigateTo("/");
  }
});
