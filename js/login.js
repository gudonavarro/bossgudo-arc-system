(() => {
  const loginMarkup =
    '<div class="panel auth-card"><div class="auth-card-header login-header"><img class="login-logo" src="../pictures/boss-gudo-logo.png" alt="BOSSGUDO A.R.C. AQUA FARM logo"><h1 class="page-title">Welcome back</h1><p class="muted">Sign in to track your booking requests.</p></div><form id="loginForm"><div class="field"><label for="loginEmail">EMAIL ADDRESS</label><input type="email" id="loginEmail" required placeholder="you@example.com" value="customer@example.com"></div><div class="field"><label for="loginPassword">PASSWORD</label><div class="password-input-wrapper"><input type="password" id="loginPassword" required placeholder="Enter password"><button class="password-toggle-btn" type="button" aria-label="Show password" aria-pressed="false"><svg class="password-toggle-icon is-slashed" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"></path><circle cx="12" cy="12" r="3"></circle><path class="password-toggle-slash" d="M4 4 20 20"></path></svg></button></div><a class="login-forgot-password" href="#forgot-password">Forgot Password?</a></div><button class="primary" type="submit">Log In</button></form><p class="auth-card-footer"><a href="register.html">Don\'t have an account? Create Account</a></p></div>';
  const boundLoginForms = new WeakSet();

  function preventForgotPasswordNavigation(event) {
    event.preventDefault();
  }

  function handleLoginSubmit(event) {
    event.preventDefault();
    window.dispatchEvent(
      new CustomEvent("app:session-change", { detail: true }),
    );
    window.dispatchEvent(
      new CustomEvent("app:navigate", { detail: "mybookings" }),
    );
  }

  function togglePasswordVisibility(event) {
    const toggleBtn = event.currentTarget;
    const wrapper = toggleBtn.closest(".password-input-wrapper");
    const passwordInput = wrapper?.querySelector("#loginPassword");
    if (!passwordInput) return;

    const icon = toggleBtn.querySelector(".password-toggle-icon");
    const isVisible = passwordInput.type === "password";
    passwordInput.type = isVisible ? "text" : "password";
    toggleBtn.setAttribute(
      "aria-label",
      isVisible ? "Hide password" : "Show password",
    );
    toggleBtn.setAttribute("aria-pressed", String(isVisible));
    if (icon) icon.classList.toggle("is-slashed", !isVisible);
  }

  function bindPasswordToggle() {
    if (document.body.dataset.page !== "login") return;

    const passwordInput = document.getElementById("loginPassword");
    const toggleBtn = document.querySelector(".password-toggle-btn");
    if (passwordInput && toggleBtn) {
      toggleBtn.addEventListener("click", togglePasswordVisibility);
    }
  }

  function renderLoginPage() {
    if (document.body.dataset.page !== "login") return;

    const app = document.getElementById("app");
    if (!app) return;

    app.innerHTML = loginMarkup;
    const forgotPasswordLink = app.querySelector(".login-forgot-password");
    if (forgotPasswordLink) {
      forgotPasswordLink.addEventListener(
        "click",
        preventForgotPasswordNavigation,
      );
    }

    const loginForm = document.getElementById("loginForm");
    if (!loginForm || boundLoginForms.has(loginForm)) return;

    boundLoginForms.add(loginForm);
    loginForm.addEventListener("submit", handleLoginSubmit);
  }

  function initializeLoginModule() {
    window.addEventListener("app:render", renderLoginPage);
    renderLoginPage();
    bindPasswordToggle();
    window.addEventListener("app:render", bindPasswordToggle);
  }

  document.addEventListener("DOMContentLoaded", initializeLoginModule);
})();
