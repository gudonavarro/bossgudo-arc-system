export interface RegistrationFormValues {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  password: string;
  confirmPassword: string;
}

export type RegistrationField = keyof RegistrationFormValues;
export type RegistrationFieldErrors = Partial<
  Record<RegistrationField, string>
>;

const EMAIL_PATTERN = /^[^@\s]+@[^@\s.]+\.[^@\s.]+$/;
const PHONE_PATTERN = /^(?:09|\+639)\d{9}$/;
const PASSWORD_ERROR =
  "Password must be at least 8 characters and include uppercase, lowercase, a number, and a symbol.";

export function normalizeRegistrationPhoneNumber(value: string): string {
  const compact = value.replace(/[\s()-]/g, "");
  return /^09\d{9}$/.test(compact) ? `+63${compact.slice(1)}` : compact;
}

export function validateRegistration(
  form: RegistrationFormValues,
): RegistrationFieldErrors {
  const errors: RegistrationFieldErrors = {};
  const firstName = form.firstName.trim();
  const lastName = form.lastName.trim();
  const email = form.email.trim().toLowerCase();
  const phoneNumber = normalizeRegistrationPhoneNumber(form.phoneNumber.trim());

  if (!firstName || firstName.length > 80) {
    errors.firstName = "Enter a first name of at most 80 characters.";
  }
  if (!lastName || lastName.length > 80) {
    errors.lastName = "Enter a last name of at most 80 characters.";
  }
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    errors.email = "Enter a valid email address.";
  }
  if (!PHONE_PATTERN.test(phoneNumber)) {
    errors.phoneNumber = "Enter a valid PH number starting with 09 or +63.";
  }

  const passwordBytes = new TextEncoder().encode(form.password).length;
  const validPassword =
    form.password.length >= 8 &&
    passwordBytes <= 72 &&
    /[A-Z]/.test(form.password) &&
    /[a-z]/.test(form.password) &&
    /\d/.test(form.password) &&
    /[^A-Za-z0-9\s]/.test(form.password);
  if (!validPassword) {
    errors.password = PASSWORD_ERROR;
  }
  if (form.password !== form.confirmPassword) {
    errors.confirmPassword = "Passwords do not match.";
  }

  return errors;
}
