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
  return document.getElementById(id).value.trim();
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
    const digits = value.replace(/\D/g, "");
    const allowedFormat = /^[+()\d\s-]+$/.test(value);
    if (!allowedFormat || digits.length < 7 || digits.length > 15) {
      setFieldError(id, "Enter a valid phone or contact number.");
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

fields.forEach((id) => {
  document.getElementById(id).addEventListener("input", () => {
    validateField(id);
    if (id === "password" || id === "confirmPassword") {
      validateField("confirmPassword");
    }
    if (feedback) {
      feedback.textContent = "";
      feedback.classList.remove("show", "success");
    }
  });
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (feedback) {
    feedback.textContent = "";
    feedback.classList.remove("show", "success");
  }
  if (!validateForm()) return;

  if (feedback) {
    feedback.textContent =
      "Validation successful. Account creation will be completed once backend services are online.";
    feedback.classList.add("show", "success");
  }
});
