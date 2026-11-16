import { toAuthUser } from "~/utils/customer-auth";
import type { AuthUser } from "~/utils/customer-auth";

type AuthStatus =
  | "unknown"
  | "authenticated"
  | "unauthenticated"
  | "unavailable";

interface AuthResponse {
  user?: unknown;
}

interface LogoutResult {
  ok: boolean;
  error?: string;
}

const pendingInitializations = new WeakMap<object, Promise<AuthUser | null>>();

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error !== "object" || error === null) return fallback;

  const data = (error as { data?: unknown }).data;
  if (typeof data === "object" && data !== null) {
    const message = (data as { error?: unknown }).error;
    if (typeof message === "string") return message;
  }

  const message = (error as { message?: unknown }).message;
  return typeof message === "string" ? message : fallback;
}

export function useAuth() {
  const user = useState<AuthUser | null>("auth:user", () => null);
  const status = useState<AuthStatus>("auth:status", () => "unknown");
  const isLoggingOut = useState<boolean>("auth:logoutPending", () => false);
  const isReady = computed(() => status.value !== "unknown");
  const isAuthenticated = computed(
    () => status.value === "authenticated" && user.value !== null,
  );
  const isCustomer = computed(
    () => isAuthenticated.value && user.value?.role === "customer",
  );

  function setUser(nextUser: AuthUser | null) {
    user.value = nextUser;
    status.value = nextUser ? "authenticated" : "unauthenticated";
  }

  async function initialize(options: { force?: boolean } = {}) {
    if (!options.force && status.value !== "unknown") return user.value;

    const nuxtApp = useNuxtApp();
    const pending = pendingInitializations.get(nuxtApp);
    if (pending !== undefined) return pending;

    const fetcher = import.meta.server ? useRequestFetch() : $fetch;
    let request: Promise<AuthUser | null>;
    request = fetcher<AuthResponse>("/api/auth/me", {
      credentials: "include",
      cache: "no-store",
    })
      .then(({ user: currentUser }) => {
        const safeUser = toAuthUser(currentUser);
        if (!safeUser) {
          setUser(null);
          return null;
        }

        setUser(safeUser);
        return safeUser;
      })
      .catch(() => {
        user.value = null;
        status.value = "unavailable";
        return null;
      })
      .finally(() => {
        if (pendingInitializations.get(nuxtApp) === request) {
          pendingInitializations.delete(nuxtApp);
        }
      });

    pendingInitializations.set(nuxtApp, request);
    return request;
  }

  async function login(email: string, password: string) {
    const result = await $fetch<AuthResponse>("/api/auth/login", {
      method: "POST",
      credentials: "include",
      body: { email, password },
    });

    const safeUser = toAuthUser(result.user);
    if (safeUser?.role !== "customer") {
      setUser(null);
      throw new Error("Unable to log in.");
    }

    setUser(safeUser);
    return safeUser;
  }

  async function logout(): Promise<LogoutResult> {
    if (isLoggingOut.value) {
      return { ok: false, error: "Logout already in progress." };
    }

    isLoggingOut.value = true;
    try {
      await $fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
      setUser(null);
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: getErrorMessage(error, "Unable to log out right now."),
      };
    } finally {
      isLoggingOut.value = false;
    }
  }

  return {
    user,
    status,
    isReady,
    isAuthenticated,
    isCustomer,
    isLoggingOut,
    initialize,
    login,
    logout,
  };
}
