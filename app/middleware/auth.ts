export default defineNuxtRouteMiddleware(async (to) => {
  const { initialize } = useAuth();
  const shouldRevalidate =
    import.meta.client && !useNuxtApp().isHydrating;
  const user = await initialize({ force: shouldRevalidate });

  if (!user) {
    return navigateTo(
      {
        path: "/customer-login",
        query: to.path !== "/" ? { next: to.fullPath } : undefined,
      },
      { replace: true },
    );
  }

  if (user.role !== "customer") {
    return navigateTo("/", { replace: true });
  }
});
