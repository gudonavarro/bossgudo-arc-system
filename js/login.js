(() => {
  const loginMarkup =
    '<div class="panel auth-card"><div class="auth-card-header login-header"><img class="login-logo" src="../pictures/boss-gudo-logo.png" alt="BOSSGUDO A.R.C. AQUA FARM logo"><h1 class="page-title">Welcome back</h1><p class="muted">Sign in to track your booking requests.</p></div><form id="loginForm"><div class="field"><label for="loginEmail">EMAIL ADDRESS</label><input type="email" id="loginEmail" required placeholder="you@example.com" value="customer@example.com"></div><div class="field"><label for="loginPassword">PASSWORD</label><input type="password" id="loginPassword" required placeholder="Enter password"></div><button class="primary" type="submit">Log In</button></form><p class="auth-card-footer"><a href="register.html">Don\'t have an account? Create Account</a></p></div>';
  const boundLoginForms = new WeakSet();

  function renderLoginPage() {
    if (document.body.dataset.page !== "login") return;

    const app = document.getElementById("app");
    if (!app) return;

    app.innerHTML = loginMarkup;
    const loginForm = document.getElementById("loginForm");
    if (!loginForm || boundLoginForms.has(loginForm)) return;

    boundLoginForms.add(loginForm);
    loginForm.addEventListener("submit", (event) => {
      event.preventDefault();
      window.dispatchEvent(
        new CustomEvent("app:session-change", { detail: true }),
      );
      window.dispatchEvent(
        new CustomEvent("app:navigate", { detail: "mybookings" }),
      );
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    window.addEventListener("app:render", renderLoginPage);
    renderLoginPage();
  });
})();
