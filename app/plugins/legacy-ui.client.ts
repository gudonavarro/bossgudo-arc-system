import legacyScript from "../legacy/script.js?raw";

export default defineNuxtPlugin((nuxtApp) => {
  const router = useRouter();
  const route = useRoute();
  const auth = useAuth();
  const publicPages = new Set([
    "/customer-login",
    "/admin-login",
    "/register",
    "/forgot-password",
    "/reset-password",
    "/logout",
  ]);
  const browserWindow = window as typeof window & {
    __bossGudoNavigate?: (path: string) => Promise<unknown>;
  };

  browserWindow.__bossGudoNavigate = (path) => router.push(path);

  function ensureLegacyUi(path: string) {
    if (
      publicPages.has(path) ||
      document.querySelector("script[data-legacy-ui]")
    ) {
      return false;
    }

    const script = document.createElement("script");
    script.dataset.legacyUi = "true";
    script.textContent = legacyScript;
    document.body.append(script);
    const customer = auth.user.value?.role === "customer" ? auth.user.value : null;
    window.dispatchEvent(
      new CustomEvent("app:session-change", { detail: customer }),
    );
    return true;
  }

  router.afterEach(async (route) => {
    let start = 0;
    let end = route.path.length;

    while (route.path.charAt(start) === "/") start += 1;
    while (end > start && route.path.charAt(end - 1) === "/") end -= 1;

    const currentPage = route.path.slice(start, end) || "home";
    document.body.dataset.page = currentPage;
    await nextTick();
    const legacyUiStarted = ensureLegacyUi(route.path);
    if (legacyUiStarted) return;
    window.dispatchEvent(
      new CustomEvent("app:route-change", { detail: currentPage }),
    );
  });

  nuxtApp.hook("app:mounted", () => {
    ensureLegacyUi(route.path);
  });
});
