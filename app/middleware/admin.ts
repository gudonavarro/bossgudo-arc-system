export default defineNuxtRouteMiddleware(async () => {
  const { initialize } = useAuth();
  const isHydrating = import.meta.client && useNuxtApp().isHydrating;
  const user = await initialize({ force: !isHydrating });

  if (!user) {
    return navigateTo("/customer-login");
  }
  if (user.role !== "admin") {
    return navigateTo("/");
  }
});
