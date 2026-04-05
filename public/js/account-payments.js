(function () {
  var COUNTRIES = [
    ["US", "United States"],
    ["CA", "Canada"],
    ["GB", "United Kingdom"],
    ["AU", "Australia"],
    ["DE", "Germany"],
    ["FR", "France"],
    ["JP", "Japan"],
    ["CN", "China"],
  ];

  function fillCountrySelect(sel) {
    if (!sel) return;
    sel.innerHTML = "";
    COUNTRIES.forEach(function (pair) {
      var o = document.createElement("option");
      o.value = pair[0];
      o.textContent = pair[1];
      sel.appendChild(o);
    });
  }

  function fillExpMonth(sel) {
    if (!sel) return;
    sel.innerHTML = '<option value="">Month</option>';
    for (var m = 1; m <= 12; m++) {
      var o = document.createElement("option");
      var v = m < 10 ? "0" + m : String(m);
      o.value = String(m);
      o.textContent = v;
      sel.appendChild(o);
    }
  }

  function fillExpYear(sel) {
    if (!sel) return;
    sel.innerHTML = '<option value="">Year</option>';
    var y = new Date().getFullYear();
    for (var i = 0; i < 16; i++) {
      var yy = y + i;
      var o = document.createElement("option");
      o.value = String(yy);
      o.textContent = String(yy);
      sel.appendChild(o);
    }
  }

  function digitsOnly(s) {
    return String(s || "").replace(/\D/g, "");
  }

  function formatPanInput(raw) {
    var d = digitsOnly(raw).slice(0, 19);
    var parts = [];
    for (var i = 0; i < d.length; i += 4) {
      parts.push(d.slice(i, i + 4));
    }
    return parts.join(" ");
  }

  function luhnCheck(numStr) {
    var d = digitsOnly(numStr);
    if (d.length < 13 || d.length > 19) return false;
    var sum = 0;
    var alt = false;
    for (var i = d.length - 1; i >= 0; i--) {
      var n = parseInt(d.charAt(i), 10);
      if (alt) {
        n *= 2;
        if (n > 9) n -= 9;
      }
      sum += n;
      alt = !alt;
    }
    return sum % 10 === 0;
  }

  function detectBrand(pan) {
    var d = digitsOnly(pan);
    if (/^4/.test(d)) return "visa";
    if (/^5[1-5]/.test(d)) return "mastercard";
    if (/^3[47]/.test(d)) return "amex";
    if (/^6(?:011|5)/.test(d)) return "discover";
    return "other";
  }

  function brandLabel(b) {
    var map = { visa: "Visa", mastercard: "Mastercard", amex: "Amex", discover: "Discover", other: "Card" };
    return map[b] || "Card";
  }

  function pad2(n) {
    var s = String(n);
    return s.length < 2 ? "0" + s : s;
  }

  function showErr(el, msg) {
    if (!el) return;
    el.style.display = msg ? "block" : "none";
    el.textContent = msg || "";
  }

  document.addEventListener("DOMContentLoaded", function () {
    var dialog = document.getElementById("acct-pay-add-dialog");
    var form = document.getElementById("acct-pay-add-form");
    var openBtn = document.getElementById("acct-pay-open-add");
    var cancelBtn = document.getElementById("acct-pay-add-cancel");
    var submitBtn = document.getElementById("acct-pay-add-submit");
    var errEl = document.getElementById("acct-pay-add-err");
    var listErr = document.getElementById("acct-pay-list-err");
    var tbody = document.getElementById("acct-pay-tbody");
    var emptyRow = document.getElementById("acct-pay-empty");
    var defaultPanel = document.getElementById("acct-pay-default-panel");

    var panIn = document.getElementById("acct-pay-pan");
    var cvcIn = document.getElementById("acct-pay-cvc");
    var expM = document.getElementById("acct-pay-exp-m");
    var expY = document.getElementById("acct-pay-exp-y");
    var cardCountry = document.getElementById("acct-pay-card-country");
    var cardZip = document.getElementById("acct-pay-card-zip");
    var billFirst = document.getElementById("acct-pay-bill-first");
    var billLast = document.getElementById("acct-pay-bill-last");
    var billLine1 = document.getElementById("acct-pay-bill-line1");
    var billLine2 = document.getElementById("acct-pay-bill-line2");
    var billCity = document.getElementById("acct-pay-bill-city");
    var billState = document.getElementById("acct-pay-bill-state");
    var billCountry = document.getElementById("acct-pay-bill-country");
    var billZip = document.getElementById("acct-pay-bill-zip");
    var setDefaultCb = document.getElementById("acct-pay-set-default");

    fillCountrySelect(cardCountry);
    fillCountrySelect(billCountry);
    fillExpMonth(expM);
    fillExpYear(expY);
    if (cardCountry) cardCountry.value = "US";
    if (billCountry) billCountry.value = "US";

    function openDialog() {
      if (!dialog) return;
      showErr(errEl, "");
      if (form) form.reset();
      fillExpMonth(expM);
      fillExpYear(expY);
      if (cardCountry) cardCountry.value = "US";
      if (billCountry) billCountry.value = "US";
      if (setDefaultCb) setDefaultCb.checked = true;
      if (panIn) panIn.value = "";
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
      if (panIn) setTimeout(function () { panIn.focus(); }, 80);
    }

    function closeDialog() {
      if (typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
      if (cvcIn) cvcIn.value = "";
    }

    if (panIn) {
      panIn.addEventListener("input", function () {
        var cur = panIn.value;
        var pos = panIn.selectionStart;
        var d0 = digitsOnly(cur).length;
        panIn.value = formatPanInput(cur);
        var d1 = digitsOnly(panIn.value).length;
        try {
          panIn.setSelectionRange(pos + (d1 - d0), pos + (d1 - d0));
        } catch (_) {}
      });
    }

    if (openBtn) openBtn.addEventListener("click", openDialog);
    if (cancelBtn) cancelBtn.addEventListener("click", closeDialog);

    function syncBillingReadonly(methods) {
      var def = (methods || []).find(function (p) { return p.is_default; });
      var ids = ["bill-name", "bill-line1", "bill-line2", "bill-city", "bill-state", "bill-zip", "bill-country"];
      ids.forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.value = "";
      });
      if (!def || !def.billing) return;
      var b = def.billing;
      var nm = document.getElementById("bill-name");
      if (nm) nm.value = ((b.first_name || "") + " " + (b.last_name || "")).trim();
      var l1 = document.getElementById("bill-line1");
      if (l1) l1.value = b.line1 || "";
      var l2 = document.getElementById("bill-line2");
      if (l2) l2.value = b.line2 || "";
      var c = document.getElementById("bill-city");
      if (c) c.value = b.city || "";
      var st = document.getElementById("bill-state");
      if (st) st.value = b.state || "";
      var z = document.getElementById("bill-zip");
      if (z) z.value = b.zip || "";
      var co = document.getElementById("bill-country");
      if (co) {
        var code = (b.country || "").toUpperCase();
        var found = COUNTRIES.find(function (x) { return x[0] === code; });
        co.value = found ? found[1] + " (" + code + ")" : code || "";
      }
    }

    function renderDefaultPanel(methods) {
      if (!defaultPanel) return;
      var def = (methods || []).find(function (p) { return p.is_default; });
      if (!def) {
        defaultPanel.className = "account-pay-panel account-pay-panel--empty";
        defaultPanel.innerHTML =
          '<p class="account-pay-panel__text">No default payment method on file.</p>' +
          '<p class="account-pay-panel__sub">Add a card below, then set it as default.</p>';
        return;
      }
      defaultPanel.className = "account-pay-panel";
      defaultPanel.innerHTML =
        '<p class="account-pay-panel__text"><strong>' +
        brandLabel(def.brand) +
        "</strong> ending in <strong>" +
        def.last4 +
        "</strong></p>" +
        '<p class="account-pay-panel__sub">Expires ' +
        pad2(def.exp_month) +
        "/" +
        def.exp_year +
        " · Used for monthly subscriptions and renewals.</p>";
    }

    function renderTable(methods) {
      if (!tbody) return;
      showErr(listErr, "");
      tbody.querySelectorAll("tr:not(#acct-pay-empty)").forEach(function (r) { r.remove(); });
      if (!methods || methods.length === 0) {
        if (emptyRow) emptyRow.style.display = "";
        return;
      }
      if (emptyRow) emptyRow.style.display = "none";
      methods.forEach(function (p) {
        var tr = document.createElement("tr");
        var exp = pad2(p.exp_month) + "/" + p.exp_year;
        var defBadge = p.is_default ? ' <span class="account-pill">Default</span>' : "";
        tr.innerHTML =
          "<td>" +
          brandLabel(p.brand) +
          " ·••• " +
          p.last4 +
          defBadge +
          "</td><td>" +
          exp +
          '</td><td class="account-pay-table__actions account-pay-table__actions--subs"><div class="account-sub-actions">' +
          (p.is_default
            ? ""
            : '<button type="button" class="btn btn-ghost account-pay-btn-sm acct-pay-default" data-id="' +
              encodeURIComponent(p.id) +
              '">Set default</button>') +
          '<button type="button" class="btn btn-ghost account-pay-btn-sm acct-pay-remove" data-id="' +
          encodeURIComponent(p.id) +
          '">Remove</button></div></td>';
        tbody.appendChild(tr);
      });
    }

    async function load() {
      try {
        var r = await fetch("/api/me/payment-methods", { credentials: "same-origin" });
        if (!r.ok) return;
        var data = await r.json();
        var list = Array.isArray(data.payment_methods) ? data.payment_methods : [];
        renderDefaultPanel(list);
        renderTable(list);
        syncBillingReadonly(list);
      } catch (_) {}
    }

    if (tbody) tbody.addEventListener("click", async function (ev) {
      var t = ev.target;
      if (!t || !t.closest) return;
      var defB = t.closest(".acct-pay-default");
      var rm = t.closest(".acct-pay-remove");
      var id = defB ? defB.getAttribute("data-id") : rm ? rm.getAttribute("data-id") : null;
      if (!id) return;
      showErr(listErr, "");
      try {
        if (defB) {
          var r = await fetch("/api/me/payment-methods/" + encodeURIComponent(id) + "/default", {
            method: "PATCH",
            credentials: "same-origin",
          });
          var data = await r.json().catch(function () { return {}; });
          if (!r.ok) {
            showErr(listErr, data.error || "Could not update default.");
            return;
          }
          renderDefaultPanel(data.payment_methods);
          renderTable(data.payment_methods);
          syncBillingReadonly(data.payment_methods);
          return;
        }
        if (rm) {
          if (!confirm("Remove this card from your account?")) return;
          var r2 = await fetch("/api/me/payment-methods/" + encodeURIComponent(id), {
            method: "DELETE",
            credentials: "same-origin",
          });
          var data2 = await r2.json().catch(function () { return {}; });
          if (!r2.ok) {
            showErr(listErr, data2.error || "Could not remove.");
            return;
          }
          renderDefaultPanel(data2.payment_methods);
          renderTable(data2.payment_methods);
          syncBillingReadonly(data2.payment_methods);
        }
      } catch (e) {
        showErr(listErr, "Network error.");
      }
    });

    if (form) {
      form.addEventListener("submit", async function (ev) {
        ev.preventDefault();
        showErr(errEl, "");
        var pan = digitsOnly(panIn && panIn.value);
        var cvc = digitsOnly(cvcIn && cvcIn.value);
        if (!luhnCheck(pan)) {
          showErr(errEl, "Please enter a valid card number.");
          return;
        }
        if (cvc.length < 3 || cvc.length > 4) {
          showErr(errEl, "Please enter a valid security code (3–4 digits).");
          return;
        }
        var brand = detectBrand(pan);
        var last4 = pan.slice(-4);
        var m = expM && expM.value ? parseInt(expM.value, 10) : NaN;
        var y = expY && expY.value ? parseInt(expY.value, 10) : NaN;
        if (!m || !y) {
          showErr(errEl, "Choose expiration month and year.");
          return;
        }
        var now = new Date();
        if (y < now.getFullYear() || (y === now.getFullYear() && m < now.getMonth() + 1)) {
          showErr(errEl, "Card appears expired.");
          return;
        }
        var body = {
          brand: brand,
          last4: last4,
          exp_month: m,
          exp_year: y,
          card_country: cardCountry && cardCountry.value ? cardCountry.value : "US",
          card_postal_code: cardZip && cardZip.value ? cardZip.value.trim() : "",
          set_default: !!(setDefaultCb && setDefaultCb.checked),
          billing: {
            first_name: billFirst ? billFirst.value.trim() : "",
            last_name: billLast ? billLast.value.trim() : "",
            line1: billLine1 ? billLine1.value.trim() : "",
            line2: billLine2 ? billLine2.value.trim() : "",
            city: billCity ? billCity.value.trim() : "",
            state: billState ? billState.value.trim() : "",
            country: billCountry ? billCountry.value : "US",
            zip: billZip ? billZip.value.trim() : "",
          },
        };
        if (submitBtn) submitBtn.disabled = true;
        try {
          var r = await fetch("/api/me/payment-methods", {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          var data = await r.json().catch(function () { return {}; });
          if (!r.ok) {
            showErr(errEl, data.error || "Could not save.");
            return;
          }
          cvcIn.value = "";
          panIn.value = "";
          closeDialog();
          await load();
        } catch (e) {
          showErr(errEl, "Network error. Try again.");
        } finally {
          if (submitBtn) submitBtn.disabled = false;
        }
      });
    }

    load();
    window.addEventListener("hashchange", function () {
      if ((location.hash || "").replace(/^#/, "").toLowerCase() === "billing") load();
    });
  });
})();
