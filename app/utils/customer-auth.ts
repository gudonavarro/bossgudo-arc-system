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
