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
    try {
      var cart = JSON.parse(localStorage.getItem("clawdcare_cart") || "[]");
      var n = Array.isArray(cart) ? cart.reduce(function (s, i) { return s + (i.qty || 0); }, 0) : 0;
      el.textContent = n > 0 ? String(n) : "";
      el.style.display = n > 0 ? "inline-block" : "none";
    } catch (_) {
      el.style.display = "none";
    }
  }

  async function updateAuthSlot() {
    var slot = document.getElementById("nav-auth");
    if (!slot) return;
    try {
      var r = await fetch("/api/auth/me", { credentials: "same-origin" });
      if (r.ok) {
        var data = await r.json();
        var email = (data.user && data.user.email) || "Account";
        slot.innerHTML =
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
        slot.innerHTML =
          '<a href="/login.html" class="btn btn-ghost" style="padding:0.4rem 0.85rem;font-size:0.8125rem">Sign in</a>' +
          '<a href="/register.html" class="btn btn-primary" style="padding:0.4rem 0.85rem;font-size:0.8125rem">Create account</a>';
      }
    } catch (_) {
      slot.innerHTML =
        '<a href="/login.html" class="btn btn-ghost" style="padding:0.4rem 0.85rem;font-size:0.8125rem">Sign in</a>' +
        '<a href="/register.html" class="btn btn-primary" style="padding:0.4rem 0.85rem;font-size:0.8125rem">Create account</a>';
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    setActive();
    updateCartBadge();
    updateAuthSlot();
  });
  window.addEventListener("clawdcare:cart", updateCartBadge);
})();
