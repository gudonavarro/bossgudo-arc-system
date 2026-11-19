import { getLogoutRedirect } from "~/utils/logout-navigation";

export function useLogout() {
  const { user, isLoggingOut, logout: endSession } = useAuth();
  const { showToast } = useToast();

  async function logout() {
    const redirectTo = getLogoutRedirect(user.value?.role);
    const result = await endSession();
    if (result.ok) {
      showToast("You have been logged out.");
      await navigateTo(redirectTo, { replace: true });
    }
    return result;
  }

  return {
    isLoggingOut,
    logout,
  };
}
