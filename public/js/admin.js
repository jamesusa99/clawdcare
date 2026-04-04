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

  var state = { canManageRoles: false, email: "", allUsers: [], controlsBound: false };

  function renderUsers(users, currentEmail, canManageRoles) {
    var tb = el("admin-users-body");
    if (!tb) return;
    tb.innerHTML = "";
    users.forEach(function (u) {
      var tr = document.createElement("tr");
      var isAdmin = Array.isArray(u.roles) && u.roles.indexOf("admin") >= 0;
      var self = (u.email || "").toLowerCase() === (currentEmail || "").toLowerCase();
      var actions = "";
      if (canManageRoles) {
        if (isAdmin) {
          actions =
            '<button type="button" class="btn btn-ghost admin-remove-admin" data-id="' +
            u.id +
            '"' +
            (self ? ' disabled title="Use another admin to remove your own role"' : "") +
            ">Remove admin</button>";
        } else {
          actions = '<button type="button" class="btn btn-primary admin-make-admin" data-id="' + u.id + '">Make admin</button>';
        }
      } else {
        actions = '<span style="color:var(--muted);font-size:0.8125rem">—</span>';
      }
      tr.innerHTML =
        "<td>" +
        escapeHtml(u.email || "") +
        "</td><td>" +
        (u.name ? escapeHtml(u.name) : "—") +
        "</td><td>" +
        fmtDate(u.created_at) +
        '</td><td><span class="' +
        (isAdmin ? "admin-pill" : "admin-pill admin-pill--off") +
        '">' +
        (isAdmin ? "Admin" : "User") +
        '</span></td><td class="admin-actions">' +
        actions +
        "</td>";
      tb.appendChild(tr);
    });

    tb.querySelectorAll(".admin-make-admin").forEach(function (btn) {
      btn.addEventListener("click", async function () {
        btn.disabled = true;
        try {
          await patchJson("/api/admin/users/" + btn.getAttribute("data-id") + "/roles", { roles: ["admin"] });
          await refreshAll();
        } catch (e) {
          alert(e.message || "Failed");
        } finally {
          btn.disabled = false;
        }
      });
    });
    tb.querySelectorAll(".admin-remove-admin").forEach(function (btn) {
      btn.addEventListener("click", async function () {
        if (!confirm("Remove admin role for this user?")) return;
        btn.disabled = true;
        try {
          await patchJson("/api/admin/users/" + btn.getAttribute("data-id") + "/roles", { roles: [] });
          await refreshAll();
        } catch (e) {
          alert(e.message || "Failed");
        } finally {
          btn.disabled = false;
        }
      });
    });
  }

  function renderWarnings(warnings) {
    var box = el("admin-warnings");
    if (!box) return;
    if (!warnings || !warnings.length) {
      box.hidden = true;
      box.innerHTML = "";
      return;
    }
    box.hidden = false;
    box.innerHTML = warnings
      .map(function (w) {
        return '<div class="admin-alert admin-alert--warn" role="alert">' + escapeHtml(w) + "</div>";
      })
      .join("");
  }

  function renderConfig(config, ov) {
    var ul = el("admin-config-list");
    if (!ul || !config) return;
    var lines = [];
    lines.push(
      "ADMIN_EMAILS: " +
        (config.adminEmailsConfigured
          ? String(config.adminEmailSlotCount) + " operator address(es) configured"
          : "not set (rely on admin role or ADMIN_DEV_OPEN in dev)")
    );
    lines.push("Persistence: " + (ov && ov.dataBackend ? String(ov.dataBackend) : "—"));
    lines.push("NODE_ENV: " + (ov && ov.nodeEnv ? String(ov.nodeEnv) : "—"));
    if (config.devAdminOpen) lines.push("Local dev: any signed-in user may access admin (empty ADMIN_EMAILS or ADMIN_DEV_OPEN=1).");
    ul.innerHTML = lines
      .map(function (t) {
        return "<li>" + escapeHtml(t) + "</li>";
      })
      .join("");
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
    title.textContent = db.ok ? "数据库已连接" : "数据库连接失败";
    msg.textContent = db.message || (db.ok ? "" : "请检查 SUPABASE_URL、密钥与网络，并确认已执行 migrations。");
  }

  function applyUserFilter() {
    var input = el("admin-user-search");
    var q = ((input && input.value) || "").trim().toLowerCase();
    var users = state.allUsers;
    var filtered = !q
      ? users
      : users.filter(function (u) {
          var em = (u.email || "").toLowerCase();
          var nm = (u.name || "").toLowerCase();
          return em.indexOf(q) >= 0 || nm.indexOf(q) >= 0;
        });
    var fc = el("admin-filter-count");
    if (fc) fc.textContent = String(filtered.length) + " / " + String(users.length) + " shown";
    var emptyEl = el("admin-users-empty");
    if (emptyEl) emptyEl.hidden = filtered.length > 0 || users.length === 0;
    renderUsers(filtered, state.email, state.canManageRoles);
  }

  function exportUsersCsv() {
    var users = state.allUsers;
    var rows = [["id", "email", "name", "created_at", "roles"]];
    users.forEach(function (u) {
      rows.push([
        u.id || "",
        u.email || "",
        u.name || "",
        u.created_at || "",
        Array.isArray(u.roles) ? u.roles.join(";") : "",
      ]);
    });
    var csv = "\uFEFF" + rows.map(function (r) {
      return r.map(csvEscape).join(",");
    }).join("\n");
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

  function bindControlsOnce() {
    if (state.controlsBound) return;
    state.controlsBound = true;
    var search = el("admin-user-search");
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
  }

  async function refreshAll() {
    var ov = await getJson("/api/admin/overview");
    renderDatabaseBanner(ov.database);
    renderWarnings(ov.warnings);
    renderConfig(ov.config, ov);
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
      await refreshAll();
    } catch (e) {
      if (loading) loading.style.display = "none";
      if (shell) shell.style.display = "none";
      if (denied) {
        denied.hidden = false;
        denied.querySelector("p").textContent = e.message || "Could not load admin session.";
      }
    }
  });
})();
