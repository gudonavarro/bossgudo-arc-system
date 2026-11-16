export function useLogout() {
  const { isLoggingOut, logout: endSession } = useAuth();

  async function logout() {
    const result = await endSession();
    if (result.ok) {
      await navigateTo("/", { replace: true });
    }
    return result;
  }

  return {
    isLoggingOut,
    logout,
  };
}
