(function () {
  function qs(sel) {
    return document.querySelector(sel);
  }

  function openAuth(nextPath) {
    var dlg = qs("#home-auth-dialog");
    var nextIn = qs("#home-auth-next");
    var err = qs("#home-auth-error");
    var form = qs("#home-auth-form");
    if (!dlg) return;
    if (nextIn) nextIn.value = nextPath && nextPath.startsWith("/") ? nextPath : "/console.html";
    if (err) {
      err.textContent = "";
      err.classList.remove("is-visible");
    }
    if (form) form.reset();
    if (typeof dlg.showModal === "function") dlg.showModal();
    else dlg.setAttribute("open", "");
    var em = qs("#home-auth-email");
    if (em) setTimeout(function () { em.focus(); }, 50);
    updateRegisterLink();
  }

  function closeAuth() {
    var dlg = qs("#home-auth-dialog");
    if (!dlg) return;
    if (typeof dlg.close === "function") dlg.close();
    else dlg.removeAttribute("open");
  }

  function updateRegisterLink() {
    var emailIn = qs("#home-auth-email");
    var a = qs("#home-auth-register-link");
    if (!a) return;
    var email = emailIn ? (emailIn.value || "").trim() : "";
    a.href = email ? "/register.html?email=" + encodeURIComponent(email) : "/register.html";
  }

  async function postJson(url, body) {
    var r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body),
    });
    var data = await r.json().catch(function () { return {}; });
    if (!r.ok) throw new Error(data.error || "Request failed");
    return data;
  }

  document.addEventListener("DOMContentLoaded", function () {
    var dlg = qs("#home-auth-dialog");
    var form = qs("#home-auth-form");
    var errEl = qs("#home-auth-error");
    var emailIn = qs("#home-auth-email");

    document.addEventListener("click", function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      if (t.closest("#nav-login-open")) {
        e.preventDefault();
        openAuth("/console.html");
        return;
      }
      if (t.closest("#home-open-auth-console")) {
        e.preventDefault();
        openAuth("/console.html");
        return;
      }
      if (t.closest(".home-login-trigger")) {
        e.preventDefault();
        openAuth("/console.html");
      }
    });

    if (qs("#home-auth-close")) {
      qs("#home-auth-close").addEventListener("click", closeAuth);
    }
    if (emailIn) {
      emailIn.addEventListener("input", updateRegisterLink);
      emailIn.addEventListener("blur", updateRegisterLink);
    }

    if (form) {
      form.addEventListener("submit", async function (e) {
        e.preventDefault();
        if (errEl) {
          errEl.textContent = "";
          errEl.classList.remove("is-visible");
        }
        var nextIn = qs("#home-auth-next");
        var next = nextIn && nextIn.value ? nextIn.value : "/console.html";
        var btn = qs("#home-auth-submit");
        if (btn) btn.disabled = true;
        try {
          await postJson("/api/auth/login", {
            email: (qs("#home-auth-email").value || "").trim(),
            password: (qs("#home-auth-password").value || ""),
          });
          location.href = next.startsWith("/") ? next : "/console.html";
        } catch (x) {
          var msg = x.message || "Sign in failed";
          var emailTry = (qs("#home-auth-email").value || "").trim();
          var regHref = emailTry ? "/register.html?email=" + encodeURIComponent(emailTry) : "/register.html";
          if (errEl) {
            errEl.innerHTML =
              msg +
              ' · <a href="' +
              regHref +
              '" style="color:inherit;text-decoration:underline">Create your account</a> if you have not registered yet.';
            errEl.classList.add("is-visible");
          }
        } finally {
          if (btn) btn.disabled = false;
        }
      });
    }
  });
})();
