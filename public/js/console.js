(function () {
  document.addEventListener("DOMContentLoaded", async function () {
    var guest = document.getElementById("console-guest");
    var app = document.getElementById("console-app");
    var userLine = document.getElementById("console-user-email");
    if (!guest || !app) return;

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
    } catch (_) {
      guest.hidden = false;
      app.hidden = true;
    }
  });
})();
