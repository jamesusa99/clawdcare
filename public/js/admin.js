(function () {
  function el(id) {
    return document.getElementById(id);
  }

  async function getJson(url) {
    var r = await fetch(url, { credentials: "same-origin" });
    var data = await r.json().catch(function () {
      return {};
    });
    if (!r.ok) throw new Error(data.error || "Request failed");
    return data;
  }

  async function patchJson(url, body) {
    var r = await fetch(url, {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    var data = await r.json().catch(function () {
      return {};
    });
    if (!r.ok) throw new Error(data.error || "Request failed");
    return data;
  }

  function fmtDate(iso) {
    if (!iso) return "—";
    try {
      var d = new Date(iso);
      if (Number.isNaN(d.getTime())) return "—";
      return d.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (_) {
      return "—";
    }
  }

  function escapeHtml(s) {
    var d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  function csvEscape(cell) {
    var s = String(cell);
    if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function parseHashRoute() {
    var h = (location.hash || "").replace(/^#/, "").trim();
    if (!h || h === "admin-overview") return { kind: "overview" };
    if (h.indexOf("admin-user-") === 0) {
      var id = decodeURIComponent(h.slice("admin-user-".length));
      if (id) return { kind: "user", id: id };
    }
    return { kind: "overview" };
  }

  function normalizeHash() {
    var h = (location.hash || "").replace(/^#/, "").trim();
    if (!h) {
      history.replaceState(null, "", location.pathname + location.search + "#admin-overview");
      return;
    }
    if (h !== "admin-overview" && h.indexOf("admin-user-") !== 0) {
      history.replaceState(null, "", location.pathname + location.search + "#admin-overview");
    }
  }

  var state = {
    canManageRoles: false,
    email: "",
    allUsers: [],
    controlsBound: false,
    selectedUserId: null,
  };

  function setPane(kind) {
    var ov = el("pane-admin-overview");
    var us = el("pane-admin-user");
    if (ov) ov.hidden = kind !== "overview";
    if (us) us.hidden = kind !== "user";
  }

  function updateNavCurrent(routeKind, userId) {
    document.querySelectorAll(".admin-side-link").forEach(function (a) {
      var rk = a.getAttribute("data-admin-route");
      var uid = a.getAttribute("data-user-id");
      var cur = false;
      if (routeKind === "overview" && rk === "overview") cur = true;
      if (routeKind === "user" && uid && uid === userId) cur = true;
      a.setAttribute("aria-current", cur ? "page" : "false");
    });
  }

  function applyRoute() {
    var r = parseHashRoute();
    if (r.kind === "user") {
      var u = state.allUsers.find(function (x) {
        return x.id === r.id;
      });
      if (!u) {
        history.replaceState(null, "", location.pathname + location.search + "#admin-overview");
        r = { kind: "overview" };
      } else {
        state.selectedUserId = r.id;
        renderUserDetail(u);
        setPane("user");
        updateNavCurrent("user", r.id);
        document.title = (u.email || "User") + " — Admin — ClawdCare";
        return;
      }
    }
    state.selectedUserId = null;
    setPane("overview");
    updateNavCurrent("overview", null);
    document.title = "Admin — ClawdCare";
  }

  function renderSidebarUsers(users) {
    var box = el("admin-sidebar-user-list");
    if (!box) return;
    box.innerHTML = "";
    if (!users.length) {
      var p = document.createElement("p");
      p.className = "admin-detail-card__body";
      p.style.margin = "0.35rem 0";
      p.textContent = "No users match your filter.";
      box.appendChild(p);
      return;
    }
    users.forEach(function (u) {
      var a = document.createElement("a");
      a.className = "admin-side-link admin-side-link--user";
      a.href = "#admin-user-" + encodeURIComponent(u.id);
      a.setAttribute("data-admin-route", "user");
      a.setAttribute("data-user-id", u.id);
      var cr = typeof u.credits === "number" ? u.credits : 0;
      a.innerHTML =
        '<span class="admin-side-link__email">' +
        escapeHtml(u.email || "—") +
        "</span>" +
        '<span class="admin-side-link__meta">' +
        String(cr) +
        " tokens</span>";
      box.appendChild(a);
    });
  }

  function renderUserDetail(u) {
    var title = el("admin-user-title");
    var sum = el("admin-user-summary");
    var credits = el("admin-user-credits");
    var rolePill = el("admin-user-role-pill");
    var actions = el("admin-user-actions");
    if (title) title.textContent = u.email || "User";
    if (sum) {
      sum.innerHTML =
        (u.name ? "<strong>Name:</strong> " + escapeHtml(u.name) + " · " : "") +
        "<strong>Joined:</strong> " +
        escapeHtml(fmtDate(u.created_at));
    }
    var cr = typeof u.credits === "number" ? u.credits : 0;
    if (credits) credits.textContent = String(cr);
    var isAdmin = Array.isArray(u.roles) && u.roles.indexOf("admin") >= 0;
    if (rolePill) rolePill.textContent = isAdmin ? "Admin" : "User";

    if (actions) {
      var self = (u.email || "").toLowerCase() === (state.email || "").toLowerCase();
      actions.innerHTML = "";
      if (state.canManageRoles) {
        if (isAdmin) {
          var rm = document.createElement("button");
          rm.type = "button";
          rm.className = "btn btn-ghost";
          rm.textContent = "Remove admin role";
          rm.disabled = self;
          if (self) rm.title = "Use another admin account to remove your own admin role.";
          rm.addEventListener("click", async function () {
            if (!confirm("Remove admin role for this user?")) return;
            rm.disabled = true;
            try {
              await patchJson("/api/admin/users/" + u.id + "/roles", { roles: [] });
              await refreshAll();
              applyRoute();
            } catch (e) {
              alert(e.message || "Failed");
            } finally {
              rm.disabled = self;
            }
          });
          actions.appendChild(rm);
        } else {
          var mk = document.createElement("button");
          mk.type = "button";
          mk.className = "btn btn-primary";
          mk.textContent = "Make admin";
          mk.addEventListener("click", async function () {
            mk.disabled = true;
            try {
              await patchJson("/api/admin/users/" + u.id + "/roles", { roles: ["admin"] });
              await refreshAll();
              applyRoute();
            } catch (e) {
              alert(e.message || "Failed");
            } finally {
              mk.disabled = false;
            }
          });
          actions.appendChild(mk);
        }
      } else {
        actions.innerHTML = '<span style="color:var(--muted);font-size:0.875rem">No role actions available.</span>';
      }
    }
  }

  function applyUserFilter() {
    var input = el("admin-sidebar-search");
    var q = ((input && input.value) || "").trim().toLowerCase();
    var users = state.allUsers;
    var filtered = !q
      ? users
      : users.filter(function (u) {
          var em = (u.email || "").toLowerCase();
          var nm = (u.name || "").toLowerCase();
          return em.indexOf(q) >= 0 || nm.indexOf(q) >= 0;
        });
    renderSidebarUsers(filtered);
    var route = parseHashRoute();
    if (route.kind === "user" && route.id) {
      var still = filtered.some(function (u) {
        return u.id === route.id;
      });
      if (!still) {
        history.replaceState(null, "", location.pathname + location.search + "#admin-overview");
        applyRoute();
      } else {
        updateNavCurrent("user", route.id);
      }
    }
  }

  function exportUsersCsv() {
    var users = state.allUsers;
    var rows = [["id", "email", "name", "created_at", "credits", "roles"]];
    users.forEach(function (u) {
      rows.push([
        u.id || "",
        u.email || "",
        u.name || "",
        u.created_at || "",
        typeof u.credits === "number" ? u.credits : 0,
        Array.isArray(u.roles) ? u.roles.join(";") : "",
      ]);
    });
    var csv =
      "\uFEFF" +
      rows
        .map(function (r) {
          return r.map(csvEscape).join(",");
        })
        .join("\n");
    var blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "clawdcare-users-" + new Date().toISOString().slice(0, 10) + ".csv";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  }

  function setUpdatedAt(iso) {
    var n = el("admin-updated-at");
    if (!n) return;
    if (!iso) {
      n.textContent = "";
      return;
    }
    try {
      n.textContent = "Updated " + new Date(iso).toLocaleString();
    } catch (_) {
      n.textContent = "";
    }
  }

  function renderDatabaseBanner(db) {
    var banner = el("admin-db-banner");
    var title = el("admin-db-title");
    var msg = el("admin-db-msg");
    if (!banner || !title || !msg || !db) return;
    banner.hidden = false;
    banner.classList.toggle("admin-db-banner--ok", !!db.ok);
    banner.classList.toggle("admin-db-banner--fail", !db.ok);
    title.textContent = db.ok ? "Database connected" : "Database error";
    msg.textContent =
      db.message ||
      (db.ok ? "" : "Check your database configuration and network, and ensure migrations have been applied.");
  }

  function bindControlsOnce() {
    if (state.controlsBound) return;
    state.controlsBound = true;
    var search = el("admin-sidebar-search");
    if (search) search.addEventListener("input", applyUserFilter);
    var ex = el("admin-export-csv");
    if (ex) ex.addEventListener("click", exportUsersCsv);
    var ref = el("admin-refresh");
    if (ref)
      ref.addEventListener("click", async function () {
        ref.disabled = true;
        try {
          await refreshAll();
        } catch (e) {
          alert(e.message || "Refresh failed");
        } finally {
          ref.disabled = false;
        }
      });
    window.addEventListener("hashchange", function () {
      applyRoute();
    });
  }

  async function refreshAll() {
    var ov = await getJson("/api/admin/overview");
    renderDatabaseBanner(ov.database);
    setUpdatedAt(ov.generatedAt);
    el("admin-stat-users").textContent = String(ov.totalUsers);
    el("admin-stat-week").textContent = String(ov.signupsLast7Days);
    var ac = el("admin-stat-admins");
    if (ac) ac.textContent = String(ov.adminRoleCount != null ? ov.adminRoleCount : "—");
    el("admin-stat-env").textContent =
      (ov.nodeEnv || "—") + (ov.dataBackend ? " · " + String(ov.dataBackend) : "");
    var data = await getJson("/api/admin/users");
    state.allUsers = data.users || [];
    applyUserFilter();
    applyRoute();
  }

  document.addEventListener("DOMContentLoaded", async function () {
    var shell = el("admin-shell");
    var denied = el("admin-denied");
    var loading = el("admin-loading");
    try {
      var me = await getJson("/api/auth/me");
      if (!me.isAdmin) {
        if (loading) loading.style.display = "none";
        if (shell) shell.style.display = "none";
        if (denied) {
          denied.hidden = false;
          var errP = el("admin-denied-error");
          if (errP) {
            errP.hidden = true;
            errP.textContent = "";
          }
          var em = el("admin-denied-email");
          if (em && me.user && me.user.email) {
            em.innerHTML = "Signed in as <strong>" + escapeHtml(me.user.email) + "</strong>";
          }
        }
        return;
      }
      state.canManageRoles = !!me.canManageRoles;
      state.email = (me.user && me.user.email) || "";
      if (loading) loading.style.display = "none";
      if (shell) shell.hidden = false;
      bindControlsOnce();
      normalizeHash();
      await refreshAll();
    } catch (e) {
      if (loading) loading.style.display = "none";
      if (shell) shell.style.display = "none";
      if (denied) {
        denied.hidden = false;
        var lead = el("admin-denied-lead");
        if (lead) lead.hidden = true;
        var em = el("admin-denied-email");
        if (em) em.innerHTML = "";
        var er = el("admin-denied-error");
        if (er) {
          er.hidden = false;
          er.textContent = e.message || "Could not load session.";
        }
      }
    }
  });
})();
