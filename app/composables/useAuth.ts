export type AuthRole = "customer" | "admin";

export interface AuthUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: AuthRole;
  phoneNumber?: string;
}

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

function isAuthUser(user: unknown): user is AuthUser {
  if (typeof user !== "object" || user === null) return false;

  const candidate = user as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.firstName === "string" &&
    typeof candidate.lastName === "string" &&
    typeof candidate.email === "string" &&
    (candidate.role === "customer" || candidate.role === "admin")
  );
}

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
    if (pending) return pending;

    const fetcher = import.meta.server ? useRequestFetch() : $fetch;
    let request: Promise<AuthUser | null>;
    request = fetcher<AuthResponse>("/api/auth/me", {
      credentials: "include",
      cache: "no-store",
    })
      .then(({ user: currentUser }) => {
        if (!isAuthUser(currentUser)) {
          setUser(null);
          return null;
        }

        setUser(currentUser);
        return currentUser;
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

    if (!isAuthUser(result.user) || result.user.role !== "customer") {
      setUser(null);
      throw new Error("Unable to log in.");
    }

    setUser(result.user);
    return result.user;
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
