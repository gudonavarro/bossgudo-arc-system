import { getSafeRedirectPath } from "~/utils/customer-auth";

export default defineNuxtRouteMiddleware(async (to) => {
  const { initialize } = useAuth();
  const user = await initialize();

  if (user) {
    const redirectTarget =
      user.role === "customer"
        ? getSafeRedirectPath(to.query.next) ?? "/"
        : "/";
    return navigateTo(redirectTarget, { replace: true });
  }
});
