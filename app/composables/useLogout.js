export function useLogout() {
  const authUser = useState("auth:user", () => null);
  const authReady = useState("auth:ready", () => false);
  const isLoggingOut = useState("auth:logoutPending", () => false);

  async function logout() {
    if (isLoggingOut.value) {
      return { ok: false, error: "Logout already in progress." };
    }

    isLoggingOut.value = true;

    try {
      await $fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });

      authUser.value = null;
      authReady.value = true;
      window.dispatchEvent(
        new CustomEvent("app:session-change", { detail: null }),
      );

      await navigateTo("/login", { replace: true });
      return { ok: true };
    } catch (error) {
      const message = error?.data?.error || error?.message || "Unable to log out right now.";
      console.error("Logout failed:", message);
      return { ok: false, error: message };
    } finally {
      isLoggingOut.value = false;
    }
  }

  return {
    isLoggingOut,
    logout,
  };
}
