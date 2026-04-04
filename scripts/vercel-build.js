/**
 * Merge repo-root *.html + sitemap.xml with public/ into dist/ for Vercel static output.
 * Local dev still uses Express (public/ + root HTML); Vercel CDN must see one flat tree at /css, /shop.html, etc.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const dist = path.join(root, "dist");
const pub = path.join(root, "public");

if (fs.existsSync(dist)) fs.rmSync(dist, { recursive: true });
fs.mkdirSync(dist, { recursive: true });

if (!fs.existsSync(pub)) {
  console.error("[vercel-build] missing public/");
  process.exit(1);
}
fs.cpSync(pub, dist, { recursive: true });

for (const name of fs.readdirSync(root)) {
  if (name === "dist" || name === "node_modules" || name === ".git") continue;
  const p = path.join(root, name);
  if (!fs.statSync(p).isFile()) continue;
  if (name.endsWith(".html") || name === "sitemap.xml") {
    fs.copyFileSync(p, path.join(dist, name));
  }
}

console.log("[vercel-build] wrote dist/ (html + public/)");
