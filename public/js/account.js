(function () {
  var ROUTES = {
    profile: "pane-profile",
    billing: "pane-billing-overview",
    "billing-payment": "pane-billing-payment",
    "billing-address": "pane-billing-address",
    "billing-subscriptions": "pane-billing-subscriptions",
    "billing-orders": "pane-billing-orders",
  };

  var DEFAULT_ROUTE = "profile";

  function routeFromHash() {
    var h = (location.hash || "").replace(/^#/, "").trim().toLowerCase();
    if (ROUTES[h]) return h;
    return DEFAULT_ROUTE;
  }

  var TITLES = {
    profile: "Profile — My account — ClawdCare",
    billing: "Billing overview — My account — ClawdCare",
    "billing-payment": "Payment methods — My account — ClawdCare",
    "billing-address": "Billing address — My account — ClawdCare",
    "billing-subscriptions": "Subscriptions — My account — ClawdCare",
    "billing-orders": "Orders — My account — ClawdCare",
  };

  function applyRoute() {
    var route = routeFromHash();
    var paneId = ROUTES[route];
    if (!paneId) {
      route = DEFAULT_ROUTE;
      paneId = ROUTES[route];
    }

    document.querySelectorAll(".account-pane").forEach(function (el) {
      el.classList.toggle("is-active", el.id === paneId);
    });

    document.querySelectorAll(".account-nav__link").forEach(function (a) {
      var r = a.getAttribute("data-route");
      if (!r) return;
      var current = r === route;
      a.setAttribute("aria-current", current ? "page" : "false");
    });

    document.title = TITLES[route] || TITLES.profile;
  }

  window.addEventListener("hashchange", applyRoute);
  document.addEventListener("DOMContentLoaded", function () {
    var raw = (location.hash || "").replace(/^#/, "").trim().toLowerCase();
    if (!raw || !ROUTES[raw]) {
      history.replaceState(null, "", location.pathname + location.search + "#" + DEFAULT_ROUTE);
    }
    applyRoute();
  });
})();
