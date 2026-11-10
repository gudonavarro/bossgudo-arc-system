import legacyScript from "../legacy/script.js?raw";

interface AuthSession {
  user: {
    id: string;
    firstName: string;
  } | null;
}

export default defineNuxtPlugin((nuxtApp) => {
  const router = useRouter();
  const browserWindow = window as typeof window & {
    __bossGudoNavigate?: (path: string) => Promise<unknown>;
  };

  browserWindow.__bossGudoNavigate = (path) => router.push(path);

  router.afterEach((route) => {
    const currentPage = route.path.replace(/^\/+|\/+$/g, "") || "home";
    document.body.dataset.page = currentPage;
    window.dispatchEvent(
      new CustomEvent("app:route-change", { detail: currentPage }),
    );
  });

  nuxtApp.hook("app:mounted", () => {
    const script = document.createElement("script");
    script.dataset.legacyUi = "true";
    script.textContent = legacyScript;
    document.body.append(script);

    void $fetch<AuthSession>("/api/auth/session", {
      credentials: "include",
    })
      .then(({ user }) => {
        if (user) {
          window.dispatchEvent(
            new CustomEvent("app:session-change", { detail: user }),
          );
        }
      })
      .catch((error: unknown) => {
        console.error("Could not restore the signed-in user session:", error);
      });
  });
});
