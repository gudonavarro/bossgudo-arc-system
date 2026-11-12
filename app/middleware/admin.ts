interface SessionResponse {
  user: {
    role?: string;
  } | null;
}

export default defineNuxtRouteMiddleware(async () => {
  const { data, error } = await useFetch<SessionResponse>("/api/auth/session", {
    credentials: "include",
    cache: "no-store",
  });

  if (error.value || !data.value?.user) {
    return navigateTo("/login");
  }
  if (data.value.user.role !== "admin") {
    return navigateTo("/");
  }
});
