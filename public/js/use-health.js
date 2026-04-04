(function () {
  var CATEGORIES = [
    { id: "cardiovascular", label: "Cardiovascular", icon: "♥" },
    { id: "metabolic", label: "Metabolic", icon: "⚡" },
    { id: "thyroid", label: "Thyroid", icon: "◇" },
    { id: "nutrition", label: "Nutrition", icon: "🥗" },
    { id: "inflammation", label: "Inflammation", icon: "🔥" },
    { id: "autoimmune", label: "Autoimmune", icon: "🛡" },
    { id: "hormones", label: "Hormones", icon: "◎" },
    { id: "toxins", label: "Toxins / exposure", icon: "☣" },
    { id: "aging", label: "Aging-related", icon: "⏱" },
  ];

  function hashStr(s) {
    var h = 0;
    var str = String(s || "");
    for (var i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
    return Math.abs(h);
  }

  function seeded(seed, i) {
    var x = Math.sin(seed * 9999 + i * 17) * 10000;
    return x - Math.floor(x);
  }

  function buildProfile(user, demo) {
    var seed = demo ? 424242 : hashStr((user && user.email) || "guest");
    var chrono = 28 + Math.floor(seeded(seed, 1) * 22);
    var bioOffset = (seeded(seed, 2) - 0.5) * 4;
    var bioAge = Math.round((chrono + bioOffset) * 10) / 10;
    var delta = Math.round((bioAge - chrono) * 10) / 10;

    var cats = CATEGORIES.map(function (c, idx) {
      var sc = 55 + Math.floor(seeded(seed, idx + 10) * 40);
      var st = sc >= 78 ? "In range" : sc >= 65 ? "Watch" : "Review";
      return { label: c.label, icon: c.icon, score: sc, status: st };
    });

    var alerts = [
      {
        type: "warn",
        text:
          seeded(seed, 50) > 0.55
            ? "hs-CRP trend up slightly vs. your 90-day baseline—consider repeating inflammation panel after lifestyle tweaks."
            : "Fasting glucose at upper end of your personal band—nutrition module suggests meal-timing experiments.",
      },
      {
        type: "info",
        text:
          "Thyroid panel due for refresh in 6 weeks based on your last draw and clinician cadence (wellness scheduling only).",
      },
    ];
    if (demo) {
      alerts.unshift({
        type: "info",
        text: "This is sample data. Sign in to see a personalized layout tied to your account (demo metrics until device data connects).",
      });
    }

    var spark = [];
    for (var j = 0; j < 14; j++) spark.push(0.35 + seeded(seed, j + 30) * 0.65);

    var advanced = [
      { name: "MRI (brain / body programs)", state: demo ? "Sample roadmap" : "Not linked", pill: "soon" },
      { name: "CT / low-dose screening", state: demo ? "Eligibility quiz (demo)" : "Eligibility quiz", pill: "soon" },
      { name: "Cancer screening pathways", state: "Colon · lung · skin (roadmap)", pill: "soon" },
      { name: "Environmental toxins", state: "Air · water · heavy metals (roadmap)", pill: "soon" },
    ];

    if (!demo && seeded(seed, 88) > 0.7) {
      advanced[0] = { name: "MRI (brain / body programs)", state: "1 program tracked", pill: "on" };
    }

    return {
      displayName: (user && (user.name || user.email)) || "there",
      chronoAge: chrono,
      bioAge: bioAge,
      delta: delta,
      spark: spark,
      categories: cats,
      alerts: alerts,
      diet: [
        "Prioritize protein at breakfast to stabilize morning glucose (per your metabolic band).",
        "Add oily fish 2×/week for omega-3 balance with your inflammation snapshot.",
        "Reduce late-night refined carbs while keeping total calories stable.",
      ],
      supplements: [
        "Vitamin D3 re-test in 8 weeks if staying on current dose (wellness tracking).",
        "Magnesium glycinate trial window: note sleep latency in console diary.",
        "Discuss any new stack with your clinician—this layer is organizational, not prescribing.",
      ],
      sleep: [
        "Target consistent wake time ±30 min; your recovery proxy improves with regularity.",
        "Dim screens 60 minutes before bed; link wearable sleep stages when paired.",
      ],
      actions: [
        "Book lipid panel + ApoB follow-up (suggested cadence from your cardiovascular tile).",
        "Upload latest PDF labs to vault for timeline merge.",
        "Enable screening reminders for thyroid + metabolic bundle next quarter.",
      ],
      advanced: advanced,
    };
  }

  function escapeHtml(s) {
    var d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  function renderSpark(spark) {
    var max = Math.max.apply(null, spark);
    return spark
      .map(function (v) {
        var h = Math.round((v / max) * 100);
        var cls = v >= max * 0.85 ? " use-health-spark__bar--hi" : "";
        return '<span class="use-health-spark__bar' + cls + '" style="height:' + h + '%"></span>';
      })
      .join("");
  }

  function renderBars(labels, seed) {
    return labels
      .map(function (lab, i) {
        var h = 25 + Math.floor(seeded(seed, i + 60) * 65);
        return (
          '<div class="use-health-bars__col"><div class="use-health-bars__fill" style="height:' +
          h +
          '%"></div><span class="use-health-bars__lab">' +
          escapeHtml(lab) +
          "</span></div>"
        );
      })
      .join("");
  }

  function radarPolygon(seed) {
    var n = CATEGORIES.length;
    var pts = [];
    var cx = 50;
    var cy = 50;
    var r = 38;
    for (var i = 0; i < n; i++) {
      var ang = (-Math.PI / 2 + (2 * Math.PI * i) / n) % (2 * Math.PI);
      var rr = r * (0.45 + seeded(seed, i + 70) * 0.55);
      pts.push(cx + rr * Math.cos(ang) + "," + (cy + rr * Math.sin(ang)));
    }
    return pts.join(" ");
  }

  function render(profile, demo) {
    var deltaCls =
      profile.delta <= 0 ? "use-health-bio-age__delta--good" : "use-health-bio-age__delta--warn";
    var deltaTxt =
      profile.delta === 0
        ? "On par with chronological age"
        : (profile.delta < 0 ? "" : "+") + profile.delta + " y vs. chronological";

    var alertsHtml = profile.alerts
      .map(function (a) {
        return (
          '<div class="use-health-alert use-health-alert--' +
          a.type +
          '" role="status"><span class="use-health-alert__ico" aria-hidden="true">' +
          (a.type === "warn" ? "⚠" : "ℹ") +
          "</span><span>" +
          escapeHtml(a.text) +
          "</span></div>"
        );
      })
      .join("");

    var catsHtml = profile.categories
      .map(function (c) {
        return (
          '<article class="use-health-cat"><div class="use-health-cat__head"><span class="use-health-cat__name">' +
          escapeHtml(c.label) +
          '</span><span class="use-health-cat__ico" aria-hidden="true">' +
          c.icon +
          '</span></div><div class="use-health-cat__bar"><div class="use-health-cat__fill" style="width:' +
          c.score +
          '%"></div></div><p class="use-health-cat__status">' +
          escapeHtml(c.status) +
          " · composite " +
          c.score +
          "/100</p></article>"
        );
      })
      .join("");

    var advRows = profile.advanced
      .map(function (r) {
        var pc =
          r.pill === "on"
            ? "use-health-pill use-health-pill--on"
            : "use-health-pill use-health-pill--soon";
        var pl = r.pill === "on" ? "Tracked" : "Roadmap";
        return (
          "<tr><td>" +
          escapeHtml(r.name) +
          '</td><td class="use-health-adv-table__state">' +
          escapeHtml(r.state) +
          '</td><td><span class="' +
          pc +
          '">' +
          pl +
          "</span></td></tr>"
        );
      })
      .join("");

    var seed = demo ? 424242 : hashStr(profile.displayName);

    return (
      '<div class="use-health-grid-top">' +
      '<div class="use-health-card">' +
      '<p class="use-health-card__label">Biological age (LifeClock-style composite)</p>' +
      '<div class="use-health-bio-age">' +
      '<span class="use-health-bio-age__value">' +
      profile.bioAge +
      '</span><span class="use-health-bio-age__unit">y</span>' +
      '<span class="use-health-bio-age__chrono">Chronological: ' +
      profile.chronoAge +
      " y</span>" +
      '<span class="use-health-bio-age__delta ' +
      deltaCls +
      '">' +
      escapeHtml(deltaTxt) +
      "</span></div>" +
      '<p class="use-health-card__label" style="margin-top:0.75rem">Wellness trajectory (demo sparkline)</p>' +
      '<div class="use-health-spark" aria-hidden="true">' +
      renderSpark(profile.spark) +
      "</div></div>" +
      '<div class="use-health-card"><p class="use-health-card__label">Signals &amp; anomalies</p>' +
      '<div class="use-health-alerts">' +
      alertsHtml +
      "</div></div></div>" +
      '<h2 class="use-health-section-title">Biomarker domains · overview</h2>' +
      '<div class="use-health-cats">' +
      catsHtml +
      "</div>" +
      '<h2 class="use-health-section-title">Visualization dashboard</h2>' +
      '<div class="use-health-viz">' +
      '<div class="use-health-viz-panel"><h3>Key labs · relative bands</h3><div class="use-health-bars">' +
      renderBars(["ApoB", "HbA1c", "TSH", "25-OH-D", "hs-CRP"], seed) +
      '</div></div><div class="use-health-viz-panel"><h3>Domain balance · radar (illustrative)</h3>' +
      '<div class="use-health-radar"><svg viewBox="0 0 100 100" aria-hidden="true">' +
      '<polygon fill="rgba(249,115,22,0.15)" stroke="rgba(249,115,22,0.55)" stroke-width="0.8" points="' +
      radarPolygon(seed) +
      '"/></svg></div></div></div>' +
      '<h2 class="use-health-section-title">Guidance layer</h2>' +
      '<div class="use-health-reco-grid">' +
      '<div class="use-health-reco"><h3>Diet</h3><ul>' +
      profile.diet.map(function (x) {
        return "<li>" + escapeHtml(x) + "</li>";
      }).join("") +
      "</ul></div>" +
      '<div class="use-health-reco"><h3>Supplements</h3><ul>' +
      profile.supplements.map(function (x) {
        return "<li>" + escapeHtml(x) + "</li>";
      }).join("") +
      "</ul></div>" +
      '<div class="use-health-reco"><h3>Sleep &amp; rhythm</h3><ul>' +
      profile.sleep.map(function (x) {
        return "<li>" + escapeHtml(x) + "</li>";
      }).join("") +
      "</ul></div>" +
      '<div class="use-health-reco"><h3>Next actions</h3><ul>' +
      profile.actions.map(function (x) {
        return "<li>" + escapeHtml(x) + "</li>";
      }).join("") +
      "</ul></div></div>" +
      '<section class="use-health-advanced" aria-labelledby="use-adv-heading">' +
      '<h2 id="use-adv-heading">Advanced tracking</h2>' +
      "<p>MRI, CT, structured cancer screening, and environmental toxin programs layer on top of routine labs. Status below reflects roadmap vs. linked programs—" +
      (demo ? "demo labels only." : "your account state when integrations ship.") +
      "</p>" +
      '<table class="use-health-adv-table"><thead><tr><th scope="col">Program</th><th scope="col">Status</th><th scope="col">Tier</th></tr></thead><tbody>' +
      advRows +
      "</tbody></table></section>"
    );
  }

  document.addEventListener("DOMContentLoaded", async function () {
    var root = document.getElementById("use-health-root");
    var heroBadge = document.getElementById("use-health-hero-badge");
    var heroTitle = document.getElementById("use-health-hero-title");
    var heroLead = document.getElementById("use-health-hero-lead");
    var cta = document.getElementById("use-health-cta");
    if (!root) return;

    var user = null;
    var demo = true;
    try {
      var r = await fetch("/api/auth/me", { credentials: "same-origin" });
      if (r.ok) {
        var data = await r.json();
        if (data.user) {
          user = data.user;
          demo = false;
        }
      }
    } catch (_) {}

    if (heroBadge) {
      heroBadge.textContent = demo ? "Sample preview" : "Your health center";
      heroBadge.className = "use-health-badge " + (demo ? "use-health-badge--demo" : "use-health-badge--live");
    }
    if (heroTitle) {
      var greet =
        user && user.email
          ? user.name || user.email.split("@")[0]
          : user && user.name
            ? user.name
            : "there";
      heroTitle.textContent = demo
        ? "See how your longitudinal health story could look in ClawdCare."
        : "Hi, " + greet + " — your wellness command center.";
    }
    if (heroLead) {
      heroLead.innerHTML = demo
        ? "Below is a <strong>simulated dashboard</strong> with cardiovascular, metabolic, thyroid, nutrition, inflammation, autoimmune, hormones, toxins, and aging-related tiles—plus guidance and advanced programs. <a href=\"/register.html\">Create an account</a> or <a href=\"/login.html?next=/use.html\">sign in</a> for a personalized stub tied to your login (still demo data until device and labs connect)."
        : "Central view of your <strong>tracked domains</strong>, visual summaries, biological age composite, anomaly hints, and action layers. Data shown remains <strong>illustrative</strong> until your ClawdCare vault and integrations are live—organized for wellness, not a medical diagnosis.";
    }
    if (cta) {
      cta.innerHTML = demo
        ? '<a class="btn btn-primary" href="/login.html?next=/use.html">Sign in</a><a class="btn btn-ghost" href="/register.html">Create account</a>'
        : '<a class="btn btn-ghost" href="/account.html">My account</a><a class="btn btn-ghost" href="/console.html">Open console</a>';
    }

    var profile = buildProfile(user, demo);
    root.innerHTML = render(profile, demo);

    var load = document.getElementById("use-health-loading");
    if (load) load.hidden = true;
    root.hidden = false;
  });
})();
