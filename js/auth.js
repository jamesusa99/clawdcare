(function () {
  function showError(el, msg) {
    if (!el) return;
    el.textContent = msg || "";
    el.classList.toggle("visible", !!msg);
  }

  async function getConfig() {
    const r = await fetch("/api/auth/config", { credentials: "same-origin" });
    if (!r.ok) return { googleEnabled: false };
    return r.json();
  }

  window.initGoogleButton = async function (containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const cfg = await getConfig();
    if (!cfg.googleEnabled) {
      container.innerHTML =
        '<p style="font-size:0.8125rem;color:var(--auth-muted);text-align:center;margin:0">Social sign-in (Google) can be enabled by the operator in server configuration.</p>';
      return;
    }
    container.innerHTML = `
      <button type="button" class="auth-btn-social" id="btn-google" aria-label="Continue with Google">
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/><path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.348 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z"/></svg>
        Continue with Google
      </button>`;
    document.getElementById("btn-google").addEventListener("click", () => {
      window.location.href = "/api/auth/google";
    });
  };

  window.bindAuthForm = function (formId, endpoint, extraFn) {
    const form = document.getElementById(formId);
    if (!form) return;
    const err = document.getElementById("auth-error");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      showError(err, "");
      const btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      const fd = new FormData(form);
      const body = { email: (fd.get("email") || "").trim(), password: fd.get("password") || "" };
      if (typeof extraFn === "function") Object.assign(body, extraFn(fd));
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          showError(err, data.error || "Something went wrong.");
          return;
        }
        window.location.href = "/dashboard.html";
      } catch {
        showError(err, "Network error. Try again.");
      } finally {
        btn.disabled = false;
      }
    });
  };
})();
