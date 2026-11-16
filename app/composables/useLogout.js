import { getLogoutRedirect } from "~/utils/logout-navigation";

export function useLogout() {
  const { user, isLoggingOut, logout: endSession } = useAuth();

  async function logout() {
    const redirectTo = getLogoutRedirect(user.value?.role);
    const result = await endSession();
    if (result.ok) {
      if (import.meta.client) {
        const toast = document.getElementById("toast");
        if (toast) {
          toast.textContent = "You have been logged out.";
          toast.classList.add("show");
          window.clearTimeout(window._tt);
          window._tt = window.setTimeout(
            () => toast.classList.remove("show"),
            3400,
          );
        }
      }
      await navigateTo(redirectTo, { replace: true });
    }
    return result;
  }

  return {
    isLoggingOut,
    logout,
  };
}
