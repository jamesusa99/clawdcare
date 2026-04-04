(function () {
  var ROUTES = {
    dashboard: { panel: "console-panel-dashboard", title: "Dashboard" },
    devices: { panel: "console-panel-devices", title: "My devices" },
    "health-data": { panel: "console-panel-health-data", title: "Health data" },
    programs: { panel: "console-panel-programs", title: "Programs" },
    skills: { panel: "console-panel-skills", title: "Skills / automations" },
    alerts: { panel: "console-panel-alerts", title: "Alerts" },
    settings: { panel: "console-panel-settings", title: "Settings" },
  };

  function normalizeHash() {
    var h = (location.hash || "").replace(/^#/, "").trim();
    if (!h || !ROUTES[h]) return "dashboard";
    return h;
  }

  function applyConsoleRoute() {
    var key = normalizeHash();
    var cfg = ROUTES[key];
    if (!cfg) return;

    Object.keys(ROUTES).forEach(function (k) {
      var el = document.getElementById(ROUTES[k].panel);
      if (el) el.hidden = k !== key;
    });

    document.querySelectorAll("[data-console-nav]").forEach(function (a) {
      var nav = a.getAttribute("data-console-nav");
      var on = nav === key;
      a.classList.toggle("is-active", on);
      if (on) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });

    var titleEl = document.getElementById("console-topbar-title");
    if (titleEl) titleEl.textContent = cfg.title;
  }

  document.addEventListener("DOMContentLoaded", async function () {
    var guest = document.getElementById("console-guest");
    var app = document.getElementById("console-app");
    var userLine = document.getElementById("console-user-email");
    if (!guest || !app) return;

    window.addEventListener("hashchange", function () {
      if (!app.hidden) applyConsoleRoute();
    });

    try {
      var r = await fetch("/api/auth/me", { credentials: "same-origin" });
      if (!r.ok) {
        guest.hidden = false;
        app.hidden = true;
        return;
      }
      var data = await r.json();
      if (!data.user) {
        guest.hidden = false;
        app.hidden = true;
        return;
      }
      guest.hidden = true;
      app.hidden = false;
      if (userLine) userLine.textContent = data.user.email || "Account";
      applyConsoleRoute();
    } catch (_) {
      guest.hidden = false;
      app.hidden = true;
    }
  });
})();
