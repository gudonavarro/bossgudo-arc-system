export type AuthRole = "customer" | "admin";

export interface AuthUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: AuthRole;
  phoneNumber?: string;
}

export function toAuthUser(user: unknown): AuthUser | null {
  if (typeof user !== "object" || user === null) return null;

  const candidate = user as Record<string, unknown>;
  if (
    typeof candidate.id !== "string" ||
    typeof candidate.firstName !== "string" ||
    typeof candidate.lastName !== "string" ||
    typeof candidate.email !== "string" ||
    (candidate.role !== "customer" && candidate.role !== "admin")
  ) {
    return null;
  }

  return {
    id: candidate.id,
    firstName: candidate.firstName,
    lastName: candidate.lastName,
    email: candidate.email,
    role: candidate.role,
    ...(typeof candidate.phoneNumber === "string"
      ? { phoneNumber: candidate.phoneNumber }
      : {}),
  };
}

export function normalizeLoginEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validateLoginCredentials(
  email: string,
  password: string,
): string | null {
  const normalizedEmail = normalizeLoginEmail(email);
  if (!normalizedEmail || !password.trim()) {
    return "Enter your email address and password.";
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return "Enter a valid email address.";
  }
  return null;
}

export function getSafeRedirectPath(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    /[\u0000-\u001f]/.test(value)
  ) {
    return null;
  }

  const localOrigin = "https://bossgudo.local";
  return new URL(value, localOrigin).origin === localOrigin ? value : null;
}
