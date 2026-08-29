/* Serveur de développement : sert les fichiers statiques et route /api/*
   vers les vraies fonctions Netlify, pour vérifier le site en local.
   La production, elle, utilise netlify.toml.                              */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const RACINE = normalize(join(fileURLToPath(import.meta.url), "..", ".."));
const PORT = Number(process.argv[2] || 8150);
const TYPES = {
  ".html":"text/html; charset=utf-8", ".css":"text/css; charset=utf-8",
  ".js":"text/javascript; charset=utf-8", ".mjs":"text/javascript; charset=utf-8",
  ".json":"application/json; charset=utf-8", ".avif":"image/avif",
  ".webp":"image/webp", ".jpg":"image/jpeg", ".png":"image/png",
  ".svg":"image/svg+xml", ".mp4":"video/mp4", ".ico":"image/x-icon"
};

// Chemins résolus depuis la racine du projet, pas depuis src/.
const ROUTES = {
  "/api/disponibilites": "netlify/functions/disponibilites.mjs",
  "/api/avis":           "netlify/functions/avis.mjs",
  "/api/acompte":        "netlify/functions/acompte.mjs",
  "/api/demande":        "netlify/functions/demande.mjs"
};

createServer(async (req, res) => {
  const u = new URL(req.url, `http://localhost:${PORT}`);
  const t0 = Date.now();

  // ---- fonctions --------------------------------------------------------
  if (ROUTES[u.pathname]) {
    try {
      const mod = await import(pathToFileURL(join(RACINE, ROUTES[u.pathname])).href
                               + "?t=" + Date.now());     // rechargé à chaud
      const corps = ["GET", "HEAD"].includes(req.method)
        ? undefined
        : await new Promise(ok => { let d = ""; req.on("data", c => d += c); req.on("end", () => ok(d)); });
      const r = await mod.default(new Request(u.href, {
        method: req.method, headers: req.headers, body: corps
      }));
      res.writeHead(r.status, Object.fromEntries(r.headers));
      res.end(Buffer.from(await r.arrayBuffer()));
      console.log(`${req.method} ${u.pathname} → ${r.status} (${Date.now() - t0} ms)`);
    } catch (e) {
      console.error(`ERREUR ${u.pathname} :`, e);
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ message: String(e && e.stack || e) }));
    }
    return;
  }

  // ---- fichiers ---------------------------------------------------------
  let chemin = decodeURIComponent(u.pathname);
  if (chemin.endsWith("/")) chemin += "index.html";
  const abs = normalize(join(RACINE, chemin));
  if (!abs.startsWith(RACINE)) { res.writeHead(403).end("Interdit"); return; }
  try {
    const s = await stat(abs);
    if (s.isDirectory()) throw new Error("dossier");
    res.writeHead(200, {
      "content-type": TYPES[extname(abs)] || "application/octet-stream",
      "content-length": s.size,
      "cache-control": "no-cache"
    });
    res.end(await readFile(abs));
  } catch {
    res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
    res.end("<h1>404</h1><p>" + chemin + "</p>");
  }
}).listen(PORT, () => console.log(`Villa Alizéa — http://localhost:${PORT}`));
