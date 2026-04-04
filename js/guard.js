(function () {
  document.addEventListener("DOMContentLoaded", async function () {
    try {
      var r = await fetch("/api/auth/me", { credentials: "same-origin" });
      if (!r.ok) {
        var next = encodeURIComponent(location.pathname + location.search);
        location.replace("/login.html?next=" + next);
      }
    } catch (_) {
      location.replace("/login.html?next=" + encodeURIComponent(location.pathname));
    }
  });
})();
