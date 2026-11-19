import legacyScript from "../legacy/script.js?raw";
import { iconSvg } from "~/utils/icons";

export default defineNuxtPlugin((nuxtApp) => {
  const router = useRouter();
  const route = useRoute();
  const auth = useAuth();
  let appIsMounted = false;
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
    __bossGudoIcon?: typeof iconSvg;
  };

  browserWindow.__bossGudoNavigate = (path) => router.push(path);
  // The legacy views build HTML strings, so they read icons from here.
  browserWindow.__bossGudoIcon = iconSvg;

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
    if (!appIsMounted) return;

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
    appIsMounted = true;
    ensureLegacyUi(route.path);
  });
});
