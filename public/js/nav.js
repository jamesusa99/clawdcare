(function () {
  function setActive() {
    var path = location.pathname.replace(/\/$/, "") || "/";
    if (path.endsWith("/index.html")) path = path.replace(/\/index\.html$/, "") || "/";
    document.querySelectorAll(".nav-main a[data-nav]").forEach(function (a) {
      var href = a.getAttribute("href") || "";
      var h = href.replace(/\/$/, "") || "/";
      if (h === "/index.html") h = "/";
      if (h === path || (h !== "/" && path.endsWith(h))) a.setAttribute("aria-current", "page");
      if (h === "/" && (path === "/" || path === "")) a.setAttribute("aria-current", "page");
    });
  }

  function updateCartBadge() {
    var el = document.getElementById("cart-badge");
    if (!el) return;
    var countEl = el.querySelector(".nav-cart-count");
    function applyCount(n) {
      if (countEl) {
        countEl.textContent = n > 0 ? String(n) : "";
      } else {
        el.textContent = n > 0 ? String(n) : "";
      }
      el.style.display = "";
      el.setAttribute(
        "aria-label",
        n > 0 ? "Shopping cart, " + n + " items" : "Shopping cart, empty — view cart"
      );
    }
    try {
      var cart = JSON.parse(localStorage.getItem("clawdcare_cart") || "[]");
      var n = Array.isArray(cart) ? cart.reduce(function (s, i) { return s + (i.qty || 0); }, 0) : 0;
      applyCount(n);
    } catch (_) {
      applyCount(0);
      el.setAttribute("aria-label", "Shopping cart");
    }
  }

  function isHomePage() {
    var path = location.pathname.replace(/\/$/, "") || "/";
    if (path.endsWith("/index.html")) path = "/";
    return path === "/" || path === "";
  }

  async function updateAuthSlot() {
    var slot = document.getElementById("nav-auth");
    if (!slot) return;
    try {
      var r = await fetch("/api/auth/me", { credentials: "same-origin" });
      if (r.ok) {
        var data = await r.json();
        var email = (data.user && data.user.email) || "Account";
        var adminLink =
          data.isAdmin
            ? '<a href="/admin.html" class="btn btn-ghost" style="padding:0.4rem 0.85rem;font-size:0.8125rem">Admin</a>'
            : "";
        slot.innerHTML =
          adminLink +
          '<a href="/account.html" class="btn btn-ghost" style="padding:0.4rem 0.85rem;font-size:0.8125rem">My account</a>' +
          '<button type="button" class="btn btn-ghost" id="nav-logout" style="padding:0.4rem 0.85rem;font-size:0.8125rem">Sign out</button>';
        var lo = document.getElementById("nav-logout");
        if (lo) {
          lo.addEventListener("click", async function () {
            await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
            location.href = "/";
          });
        }
      } else {
        if (isHomePage()) {
          slot.innerHTML =
            '<button type="button" class="btn btn-primary" id="nav-login-open" style="padding:0.4rem 0.95rem;font-size:0.8125rem">Login</button>';
        } else {
          slot.innerHTML =
            '<a href="/login.html" class="btn btn-ghost" style="padding:0.4rem 0.85rem;font-size:0.8125rem">Sign in</a>' +
            '<a href="/register.html" class="btn btn-primary" style="padding:0.4rem 0.85rem;font-size:0.8125rem">Create account</a>';
        }
      }
    } catch (_) {
      if (isHomePage()) {
        slot.innerHTML =
          '<button type="button" class="btn btn-primary" id="nav-login-open" style="padding:0.4rem 0.95rem;font-size:0.8125rem">Login</button>';
      } else {
        slot.innerHTML =
          '<a href="/login.html" class="btn btn-ghost" style="padding:0.4rem 0.85rem;font-size:0.8125rem">Sign in</a>' +
          '<a href="/register.html" class="btn btn-primary" style="padding:0.4rem 0.85rem;font-size:0.8125rem">Create account</a>';
      }
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    setActive();
    updateCartBadge();
    updateAuthSlot();
  });
  window.addEventListener("clawdcare:cart", updateCartBadge);
})();
