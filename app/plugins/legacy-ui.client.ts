import legacyScript from "../legacy/script.js?raw";

export default defineNuxtPlugin((nuxtApp) => {
  const router = useRouter();
  const route = useRoute();
  const auth = useAuth();
  const browserWindow = window as typeof window & {
    __bossGudoNavigate?: (path: string) => Promise<unknown>;
  };

  browserWindow.__bossGudoNavigate = (path) => router.push(path);

  router.afterEach((route) => {
    let start = 0;
    let end = route.path.length;

    while (route.path.charAt(start) === "/") start += 1;
    while (end > start && route.path.charAt(end - 1) === "/") end -= 1;

    const currentPage = route.path.slice(start, end) || "home";
    document.body.dataset.page = currentPage;
    window.dispatchEvent(
      new CustomEvent("app:route-change", { detail: currentPage }),
    );
  });

  nuxtApp.hook("app:mounted", () => {
    const publicPages = new Set(["/customer-login", "/admin-login", "/register", "/forgot-password", "/reset-password", "/logout"]);

    if (!publicPages.has(route.path)) {
      const script = document.createElement("script");
      script.dataset.legacyUi = "true";
      script.textContent = legacyScript;
      document.body.append(script);
      const customer = auth.user.value?.role === "customer" ? auth.user.value : null;
      window.dispatchEvent(
        new CustomEvent("app:session-change", { detail: customer }),
      );
    }
  });
});
