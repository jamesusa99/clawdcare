(function () {
  var ROUTES = {
    settings: "pane-settings",
    preferences: "pane-preferences",
    billing: "pane-billing-hub",
  };

  /** Old sidebar hashes → new routes (underscore style). */
  var LEGACY_HASH = {
    profile: "settings",
    subscriptions: "billing-subscriptions",
    credits: "billing-subscriptions",
    "token-plan": "billing-subscriptions",
    "billing-subscriptions": "billing-subscriptions",
    orders: "billing-orders",
    "billing-orders": "billing-orders",
    billing: "billing-payment",
    "billing-payment": "billing-payment",
    "billing-address": "billing-payment",
    "billing-overview": "billing",
  };

  var DEFAULT_HASH = "settings";

  var TITLES = {
    settings: "Account — Settings — BingoHealth",
    preferences: "Account — Preferences — BingoHealth",
    billing: "Account — Billing & subscriptions — BingoHealth",
  };

  function normalizedHashKey() {
    var h = (location.hash || "").replace(/^#/, "").trim().toLowerCase();
    if (LEGACY_HASH[h]) {
      var n = LEGACY_HASH[h];
      history.replaceState(null, "", location.pathname + location.search + "#" + n);
      return n;
    }
    return h;
  }

  function primaryFromKey(h) {
    if (h === "settings" || h === "preferences") return h;
    if (h === "billing" || h.indexOf("billing-") === 0) return "billing";
    return "settings";
  }

  function billingSubFromKey(h) {
    if (h === "billing" || h === "billing-overview") return "overview";
    if (h === "billing-subscriptions") return "subscriptions";
    if (h === "billing-payment") return "payment";
    if (h === "billing-orders") return "orders";
    return "overview";
  }

  function applyRoute() {
    var h = normalizedHashKey();
    if (!h) {
      history.replaceState(null, "", location.pathname + location.search + "#" + DEFAULT_HASH);
      h = DEFAULT_HASH;
    }

    var primary = primaryFromKey(h);
    if (!ROUTES[primary]) primary = "settings";

    var billingSub = primary === "billing" ? billingSubFromKey(h) : null;

    document.querySelectorAll(".account-pane").forEach(function (el) {
      el.classList.toggle("is-active", el.id === ROUTES[primary]);
    });

    document.querySelectorAll(".account-primary-tab").forEach(function (a) {
      var r = a.getAttribute("data-route");
      a.setAttribute("aria-current", r === primary ? "page" : "false");
    });

    document.querySelectorAll(".account-billing-subpane").forEach(function (el) {
      var id = el.id || "";
      var match =
        primary === "billing" &&
        ((billingSub === "overview" && id === "billing-sub-overview") ||
          (billingSub === "subscriptions" && id === "billing-sub-subscriptions") ||
          (billingSub === "payment" && id === "billing-sub-payment") ||
          (billingSub === "orders" && id === "billing-sub-orders"));
      el.classList.toggle("is-active", !!match);
    });

    document.querySelectorAll(".account-secondary-tab").forEach(function (a) {
      var s = a.getAttribute("data-billing-sub");
      var cur = primary === "billing" && s === billingSub;
      a.setAttribute("aria-current", cur ? "page" : "false");
    });

    document.title = TITLES[primary] || TITLES.settings;
  }

  window.addEventListener("hashchange", applyRoute);

  document.addEventListener("DOMContentLoaded", function () {
    var raw = (location.hash || "").replace(/^#/, "").trim();
    if (!raw) {
      history.replaceState(null, "", location.pathname + location.search + "#" + DEFAULT_HASH);
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
    var creditsBody = document.getElementById("acct-sub-credits-tbody");
    var emptyProg = document.getElementById("acct-sub-programs-empty");
    var emptyCredits = document.getElementById("acct-sub-credits-empty");
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

    if (!programsBody || !creditsBody) return;

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
      creditsBody.querySelectorAll("tr:not(#acct-sub-credits-empty)").forEach(function (r) {
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
        if (emptyCredits) emptyCredits.style.display = "";
      } else {
        if (emptyCredits) emptyCredits.style.display = "none";
        tok.forEach(function (s) {
          creditsBody.appendChild(rowTemplate(s));
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
    creditsBody.addEventListener("click", onTableClick);

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
      meta.textContent = sub.kind === "token" ? "Credit Plan subscription" : "Program subscription";
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
          showBanner("Sample Program + Credit Plan added. Use Edit or Cancel to try the flow.", false);
        } catch (_) {
          showBanner("Network error. Try again.", true);
        } finally {
          demoBtn.disabled = false;
        }
      });
    }

    load();

    window.addEventListener("hashchange", function () {
      var h = (location.hash || "").replace(/^#/, "").trim().toLowerCase();
      if (h === "billing-subscriptions") load();
    });
  }
})();
