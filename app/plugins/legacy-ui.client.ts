import legacyScript from "../legacy/script.js?raw";

interface AuthSession {
  user: {
    id: string;
    firstName: string;
    lastName?: string;
    email?: string;
    role?: string;
  } | null;
}

export default defineNuxtPlugin((nuxtApp) => {
  const router = useRouter();
  const authUser = useState<AuthSession["user"]>("auth:user", () => null);
  const authReady = useState<boolean>("auth:ready", () => false);
  const browserWindow = window as typeof window & {
    __bossGudoNavigate?: (path: string) => Promise<unknown>;
  };

  const syncSession = (user: AuthSession["user"]) => {
    authUser.value = user ?? null;
    authReady.value = true;
  };

  browserWindow.__bossGudoNavigate = (path) => router.push(path);

  window.addEventListener("app:session-change", ((event: Event) => {
    const detail = (event as CustomEvent<AuthSession["user"]>).detail;
    syncSession(detail ?? null);
  }) as EventListener);

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
        syncSession(user ?? null);
        if (user) {
          window.dispatchEvent(
            new CustomEvent("app:session-change", { detail: user }),
          );
        }
      })
      .catch((error: unknown) => {
        syncSession(null);
        console.error("Could not restore the signed-in user session:", error);
      });
  });
});
