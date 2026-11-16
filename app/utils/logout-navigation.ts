import { getSafeRedirectPath, type AuthRole } from "./customer-auth";

export function getLogoutRedirect(role: AuthRole | null | undefined): string {
  return role === "admin" ? "/admin-login" : "/customer-login";
}

export function getLogoutCancelRedirect(
  returnTo: unknown,
  role: AuthRole | null | undefined,
): string {
  return (
    getSafeRedirectPath(returnTo) ??
    (role === "admin" ? "/admin" : "/")
  );
}
