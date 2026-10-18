// Le gardien de la page : tout ce qui est demandé sous app/ est lu chiffré dans d/, puis déchiffré ici avec la clé
// tirée du mot de passe (gardée dans la base locale du navigateur, jamais envoyée nulle part).
const DB = "scene3d", STORE = "k";
let KEY = null, MAN = null;
const idb = () => new Promise((ok, ko) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(STORE); r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error); });
async function getKey() {
  if (KEY) return KEY; const db = await idb();
  KEY = await new Promise(ok => { const t = db.transaction(STORE).objectStore(STORE).get("key"); t.onsuccess = () => ok(t.result || null); t.onerror = () => ok(null); });
  return KEY;
}
async function open(buf) { const b = new Uint8Array(buf); return crypto.subtle.decrypt({ name: "AES-GCM", iv: b.slice(0, 12) }, await getKey(), b.slice(12)); }
async function manifest(base) {
  if (MAN) return MAN; const r = await fetch(base + "d/manifest.bin", { cache: "no-cache" }); if (!r.ok) throw new Error("manifest");
  MAN = JSON.parse(new TextDecoder().decode(await open(await r.arrayBuffer()))); return MAN;
}
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
self.addEventListener("message", e => { if (e.data === "reset") { KEY = null; MAN = null; } });
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url), base = self.registration.scope, appBase = base + "app/";
  if (!url.href.startsWith(appBase)) return;
  e.respondWith((async () => {
    let path = decodeURIComponent(url.pathname.slice(new URL(appBase).pathname.length)) || "index.html";
    if (path.endsWith("/")) path += "index.html";
    try {
      if (!(await getKey())) throw new Error("clé");
      const M = await manifest(base), it = M[path];
      if (!it) return new Response("Introuvable", { status: 404 });
      const r = await fetch(base + "d/" + it.f); if (!r.ok) return new Response("Introuvable", { status: 404 });
      const body = await open(await r.arrayBuffer());
      return new Response(body, { headers: { "Content-Type": it.t, "Cache-Control": "no-store" } });
    } catch (err) {
      KEY = null; MAN = null;
      if (e.request.mode === "navigate") return Response.redirect(base + "index.html", 302);
      return new Response("Verrouillé", { status: 403 });
    }
  })());
});
