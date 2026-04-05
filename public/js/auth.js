(function () {
  function qs(name) {
    return new URLSearchParams(location.search).get(name);
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
    var formLogin = document.getElementById("form-login");
    if (formLogin) {
      formLogin.addEventListener("submit", async function (e) {
        e.preventDefault();
        var err = document.getElementById("auth-error");
        if (err) {
          err.classList.remove("visible");
          err.textContent = "";
        }
        var btn = formLogin.querySelector('button[type="submit"]');
        if (btn) btn.disabled = true;
        try {
          await postJson("/api/auth/login", {
            email: (formLogin.email.value || "").trim(),
            password: formLogin.password.value || "",
          });
          var next = qs("next");
          location.href = next && next.startsWith("/") ? next : "/console.html";
        } catch (x) {
          if (err) {
            err.textContent = x.message || "Login failed";
            err.classList.add("visible");
          }
        } finally {
          if (btn) btn.disabled = false;
        }
      });
    }

    var formReg = document.getElementById("form-register");
    if (formReg) {
      var preEmail = qs("email");
      if (preEmail && formReg.email) {
        try {
          formReg.email.value = decodeURIComponent(preEmail);
        } catch (_) {
          formReg.email.value = preEmail;
        }
      }
      formReg.addEventListener("submit", async function (e) {
        e.preventDefault();
        var err = document.getElementById("auth-error");
        if (err) {
          err.classList.remove("visible");
          err.textContent = "";
        }
        var btn = formReg.querySelector('button[type="submit"]');
        if (btn) btn.disabled = true;
        try {
          await postJson("/api/auth/register", {
            email: (formReg.email.value || "").trim(),
            password: formReg.password.value || "",
            name: (formReg.name && formReg.name.value) || "",
          });
          location.href = "/console.html";
        } catch (x) {
          if (err) {
            err.textContent = x.message || "Registration failed";
            err.classList.add("visible");
          }
        } finally {
          if (btn) btn.disabled = false;
        }
      });
    }
  });
})();
