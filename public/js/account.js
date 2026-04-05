(function () {
  var ROUTES = {
    profile: "pane-profile",
    subscriptions: "pane-subscriptions",
    orders: "pane-orders",
    billing: "pane-billing",
  };

  var LEGACY_HASH = {
    credits: "subscriptions",
    "token-plan": "subscriptions",
    "billing-subscriptions": "subscriptions",
    "billing-orders": "orders",
    "billing-payment": "billing",
    "billing-address": "billing",
    "billing-overview": "billing",
  };

  var DEFAULT_ROUTE = "profile";

  function normalizedHashKey() {
    var h = (location.hash || "").replace(/^#/, "").trim().toLowerCase();
    if (LEGACY_HASH[h]) {
      history.replaceState(null, "", location.pathname + location.search + "#" + LEGACY_HASH[h]);
      return LEGACY_HASH[h];
    }
    return h;
  }

  function routeFromHash() {
    var h = normalizedHashKey();
    if (ROUTES[h]) return h;
    return DEFAULT_ROUTE;
  }

  var TITLES = {
    profile: "Profile — ClawdCare",
    subscriptions: "Subscriptions — ClawdCare",
    orders: "Orders — ClawdCare",
    billing: "Billing — ClawdCare",
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
    var raw = normalizedHashKey();
    if (!raw || !ROUTES[raw]) {
      history.replaceState(null, "", location.pathname + location.search + "#" + DEFAULT_ROUTE);
    }
    applyRoute();
    initAccountSubscriptions();
  });

  function formatUsd(cents) {
    var n = typeof cents === "number" && !isNaN(cents) ? cents : 0;
    return "$" + (n / 100).toFixed(2);
  }

  function initAccountSubscriptions() {
    var programsBody = document.getElementById("acct-sub-programs-tbody");
    var tokensBody = document.getElementById("acct-sub-tokens-tbody");
    var emptyProg = document.getElementById("acct-sub-programs-empty");
    var emptyTok = document.getElementById("acct-sub-tokens-empty");
    var demoBtn = document.getElementById("acct-sub-load-demo");
    var banner = document.getElementById("acct-sub-banner");
    var dialog = document.getElementById("acct-sub-edit-dialog");
    var form = document.getElementById("acct-sub-edit-form");
    var inpId = document.getElementById("acct-sub-edit-id");
    var inpName = document.getElementById("acct-sub-edit-name");
    var inpRenew = document.getElementById("acct-sub-edit-renewal");
    var meta = document.getElementById("acct-sub-edit-meta");
    var errEl = document.getElementById("acct-sub-edit-err");
    var dismiss = document.getElementById("acct-sub-edit-dismiss");

    if (!programsBody || !tokensBody) return;

    function showBanner(text, isErr) {
      if (!banner) return;
      banner.style.display = text ? "block" : "none";
      banner.textContent = text || "";
      banner.style.color = isErr ? "#f87171" : "var(--muted)";
    }

    function showFormErr(msg) {
      if (!errEl) return;
      errEl.style.display = msg ? "block" : "none";
      errEl.textContent = msg || "";
    }

    function rowTemplate(sub) {
      var tr = document.createElement("tr");
      tr.dataset.subId = sub.id;
      var status = (sub.status || "active") === "canceled" ? "Canceled" : "Active";
      var statusClass = status === "Active" ? "account-pill" : "account-pill";
      tr.innerHTML =
        "<td>" +
        escapeHtml(sub.name) +
        "</td><td>" +
        escapeHtml(sub.cycle || "Monthly") +
        "</td><td>" +
        formatUsd(sub.price_cents) +
        '<span style="color:var(--dim)">/mo</span></td><td><time datetime="' +
        escapeHtml(sub.next_renewal || "") +
        '">' +
        escapeHtml(formatDateDisplay(sub.next_renewal)) +
        "</time></td><td><span class=\"" +
        statusClass +
        "\">" +
        status +
        "</span></td><td class=\"account-pay-table__actions account-pay-table__actions--subs\"><div class=\"account-sub-actions\"><button type=\"button\" class=\"btn btn-ghost account-pay-btn-sm acct-sub-edit\" data-id=\"" +
        escapeAttr(sub.id) +
        "\">Edit</button><button type=\"button\" class=\"btn btn-ghost account-pay-btn-sm acct-sub-cancel\" data-id=\"" +
        escapeAttr(sub.id) +
        "\">Cancel</button></div></td>";
      return tr;
    }

    function escapeHtml(s) {
      var d = document.createElement("div");
      d.textContent = s == null ? "" : String(s);
      return d.innerHTML;
    }

    function escapeAttr(s) {
      return String(s == null ? "" : s)
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;");
    }

    function formatDateDisplay(iso) {
      if (!iso || typeof iso !== "string") return "—";
      var p = iso.slice(0, 10).split("-");
      if (p.length !== 3) return iso;
      var mo = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      var m = parseInt(p[1], 10) - 1;
      if (m < 0 || m > 11) return iso;
      return mo[m] + " " + parseInt(p[2], 10) + ", " + p[0];
    }

    function render(subscriptions) {
      var prog = (subscriptions || []).filter(function (s) {
        return s.kind === "program";
      });
      var tok = (subscriptions || []).filter(function (s) {
        return s.kind === "token";
      });

      programsBody.querySelectorAll("tr:not(#acct-sub-programs-empty)").forEach(function (r) {
        r.remove();
      });
      tokensBody.querySelectorAll("tr:not(#acct-sub-tokens-empty)").forEach(function (r) {
        r.remove();
      });

      if (prog.length === 0) {
        if (emptyProg) emptyProg.style.display = "";
      } else {
        if (emptyProg) emptyProg.style.display = "none";
        prog.forEach(function (s) {
          programsBody.appendChild(rowTemplate(s));
        });
      }

      if (tok.length === 0) {
        if (emptyTok) emptyTok.style.display = "";
      } else {
        if (emptyTok) emptyTok.style.display = "none";
        tok.forEach(function (s) {
          tokensBody.appendChild(rowTemplate(s));
        });
      }

      if (demoBtn) {
        demoBtn.style.display = prog.length === 0 && tok.length === 0 ? "" : "none";
      }
    }

    var cache = [];

    async function load() {
      showBanner("", false);
      try {
        var r = await fetch("/api/me/subscriptions", { credentials: "same-origin" });
        if (!r.ok) return;
        var data = await r.json();
        cache = Array.isArray(data.subscriptions) ? data.subscriptions : [];
        render(cache);
      } catch (_) {}
    }

    programsBody.addEventListener("click", onTableClick);
    tokensBody.addEventListener("click", onTableClick);

    function onTableClick(ev) {
      var t = ev.target;
      if (!t || !t.closest) return;
      var edit = t.closest(".acct-sub-edit");
      var cancel = t.closest(".acct-sub-cancel");
      if (edit) {
        openEdit(edit.getAttribute("data-id"));
        return;
      }
      if (cancel) {
        doCancel(cancel.getAttribute("data-id"));
      }
    }

    function openEdit(id) {
      var sub = cache.find(function (s) {
        return s.id === id;
      });
      if (!sub || !dialog || !inpId || !inpName || !inpRenew || !meta) return;
      inpId.value = sub.id;
      inpName.value = sub.name || "";
      inpRenew.value = (sub.next_renewal || "").slice(0, 10);
      meta.textContent = sub.kind === "token" ? "Token Plan subscription" : "Program subscription";
      showFormErr("");
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
      setTimeout(function () {
        inpName.focus();
      }, 50);
    }

    function closeDialog() {
      if (!dialog) return;
      if (typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
    }

    if (dismiss) dismiss.addEventListener("click", closeDialog);

    if (form) {
      form.addEventListener("submit", async function (ev) {
        ev.preventDefault();
        showFormErr("");
        var id = inpId && inpId.value;
        var name = inpName && inpName.value.trim();
        var next_renewal = inpRenew && inpRenew.value;
        if (!id || !name) {
          showFormErr("Name is required.");
          return;
        }
        var saveBtn = document.getElementById("acct-sub-edit-save");
        if (saveBtn) saveBtn.disabled = true;
        try {
          var r = await fetch("/api/me/subscriptions/" + encodeURIComponent(id), {
            method: "PATCH",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: name, next_renewal: next_renewal }),
          });
          var data = await r.json().catch(function () {
            return {};
          });
          if (!r.ok) {
            showFormErr(data.error || "Could not save.");
            return;
          }
          closeDialog();
          await load();
          showBanner("Subscription updated.", false);
        } catch (e) {
          showFormErr("Network error. Try again.");
        } finally {
          if (saveBtn) saveBtn.disabled = false;
        }
      });
    }

    async function doCancel(id) {
      if (!id) return;
      if (
        !confirm(
          "Cancel this subscription? Future monthly charges will stop once billing is connected. You can subscribe again from the Shop anytime."
        )
      ) {
        return;
      }
      try {
        var r = await fetch("/api/me/subscriptions/" + encodeURIComponent(id), {
          method: "DELETE",
          credentials: "same-origin",
        });
        var data = await r.json().catch(function () {
          return {};
        });
        if (!r.ok) {
          showBanner(data.error || "Could not cancel.", true);
          return;
        }
        await load();
        showBanner("Subscription removed from your account.", false);
      } catch (_) {
        showBanner("Network error. Try again.", true);
      }
    }

    if (demoBtn) {
      demoBtn.addEventListener("click", async function () {
        demoBtn.disabled = true;
        showBanner("", false);
        try {
          var r = await fetch("/api/me/subscriptions/demo", {
            method: "POST",
            credentials: "same-origin",
          });
          var data = await r.json().catch(function () {
            return {};
          });
          if (!r.ok) {
            showBanner(data.error || "Could not add samples.", true);
            return;
          }
          await load();
          showBanner("Sample Program + Token Plan added. Use Edit or Cancel to try the flow.", false);
        } catch (_) {
          showBanner("Network error. Try again.", true);
        } finally {
          demoBtn.disabled = false;
        }
      });
    }

    load();

    window.addEventListener("hashchange", function () {
      if (routeFromHash() === "subscriptions") load();
    });
  }
})();
