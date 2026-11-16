export default defineNuxtPlugin(async () => {
  const auth = useAuth();
  await auth.initialize();

  watch(
    auth.user,
    (user) => {
      const customer = user?.role === "customer" ? user : null;
      window.dispatchEvent(
        new CustomEvent("app:session-change", { detail: customer }),
      );
    },
    { immediate: true },
  );
});
