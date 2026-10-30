const form = document.getElementById("registerForm");
const feedback = document.getElementById("formFeedback");
const fields = [
  "firstName",
  "lastName",
  "email",
  "phone",
  "password",
  "confirmPassword",
];
const passwordStrengthMessage =
  "Use at least 8 characters with an uppercase letter, a lowercase letter, a number, and a symbol.";
const submitButton = form?.querySelector('button[type="submit"]');
let submitting = false;
function setFieldError(id, message) {
  const field = document.getElementById(id);
  const error = document.getElementById(`${id}Error`);
  if (!field || !error) return;

  error.textContent = message;
  error.classList.toggle("show", Boolean(message));
  field.classList.toggle("input-error", Boolean(message));
  field.setAttribute("aria-invalid", message ? "true" : "false");
  if (message) field.setAttribute("aria-describedby", `${id}Error`);
  else field.removeAttribute("aria-describedby");
}

function clearFieldError(id) {
  setFieldError(id, "");
}

function valueOf(id) {
  const field = document.getElementById(id);
  if (!field) return "";
  return id === "password" || id === "confirmPassword"
    ? field.value
    : field.value.trim();
}

function validateField(id) {
  const field = document.getElementById(id);
  const value = valueOf(id);

  if (!value) {
    setFieldError(id, "This field is required.");
    return false;
  }

  if (id === "email" && !field.validity.valid) {
    setFieldError(id, "Enter a valid email address.");
    return false;
  }

  if (id === "phone") {
    const normalizedPhone = value.replace(/[\s()-]/g, "");
    const allowedCharacters = /^[+()\d\s-]+$/.test(value);
    const validPhilippinePhone =
      /^09\d{9}$/.test(normalizedPhone) ||
      /^\+639\d{9}$/.test(normalizedPhone);
    if (!allowedCharacters || !validPhilippinePhone) {
      setFieldError(id, "Enter a valid PH number starting with 09 or +63.");
      return false;
    }
  }

  if (id === "password") {
    const strongPassword =
      value.length >= 8 &&
      /[A-Z]/.test(value) &&
      /[a-z]/.test(value) &&
      /\d/.test(value) &&
      /[^A-Za-z0-9\s]/.test(value);
    if (!strongPassword) {
      setFieldError(id, passwordStrengthMessage);
      return false;
    }
  }

  if (id === "confirmPassword" && value !== valueOf("password")) {
    setFieldError(id, "Passwords do not match.");
    return false;
  }

  clearFieldError(id);
  return true;
}

function validateForm() {
  const valid = fields.map(validateField).every(Boolean);
  if (!valid) {
    const firstInvalid = fields
      .map((id) => document.getElementById(id))
      .find((field) => field.getAttribute("aria-invalid") === "true");
    firstInvalid?.focus();
  }
  return valid;
}

function handleFieldInput(event) {
  const id = event.currentTarget.id;
  validateField(id);
  if (id === "password" || id === "confirmPassword") {
    validateField("confirmPassword");
  }
  if (submitting) {
    submitting = false;
    if (submitButton) submitButton.disabled = false;
    form?.removeAttribute("aria-busy");
  }
  if (feedback) {
    feedback.textContent = "";
    feedback.classList.remove("show", "success");
  }
}

function handleFormSubmit(event) {
  event.preventDefault();
  if (submitting) return;
  if (feedback) {
    feedback.textContent = "";
    feedback.classList.remove("show", "success");
  }
  if (!validateForm()) return;

  submitting = true;
  if (submitButton) submitButton.disabled = true;
  form?.setAttribute("aria-busy", "true");
  if (feedback) {
    feedback.textContent =
      "Validation successful. Account creation will be completed once backend services are online.";
    feedback.classList.add("show", "success");
  }
}

fields.forEach((id) => {
  document.getElementById(id).addEventListener("input", handleFieldInput);
});

form.addEventListener("submit", handleFormSubmit);
