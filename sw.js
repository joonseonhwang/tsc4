// TSC 4급 13주 — offline cache
const VER = "tsc4-v2";
const CORE = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png", "maskable-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VER).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VER).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

async function rangeResponse(req, full) {
  const range = req.headers.get("range");
  if (!range) return full;
  const buf = await full.arrayBuffer();
  const m = /bytes=(\d*)-(\d*)/.exec(range);
  const size = buf.byteLength;
  let start = m && m[1] ? parseInt(m[1], 10) : 0;
  let end = m && m[2] ? parseInt(m[2], 10) : size - 1;
  if (start >= size) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
  end = Math.min(end, size - 1);
  return new Response(buf.slice(start, end + 1), {
    status: 206,
    headers: {
      "Content-Type": full.headers.get("Content-Type") || "audio/mpeg",
      "Content-Range": `bytes ${start}-${end}/${size}`,
      "Content-Length": String(end - start + 1),
      "Accept-Ranges": "bytes"
    }
  });
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const isAudio = url.pathname.endsWith(".mp3");
  e.respondWith((async () => {
    const cache = await caches.open(VER);
    const key = isAudio ? url.href.split("#")[0] : req;
    let hit = await cache.match(key, { ignoreVary: true });
    if (!hit) {
      try {
        const fresh = await fetch(isAudio ? new Request(url.href) : req);
        if (fresh && (fresh.ok || fresh.type === "opaque")) cache.put(key, fresh.clone());
        hit = fresh;
      } catch (err) {
        if (req.mode === "navigate") { const idx = await cache.match("index.html"); if (idx) return idx; }
        throw err;
      }
    } else if (!isAudio && url.origin === location.origin) {
      // refresh app files in the background so updates arrive next launch
      fetch(req).then(r => { if (r && r.ok) cache.put(req, r.clone()); }).catch(() => {});
    }
    return isAudio ? rangeResponse(req, hit.clone()) : hit;
  })());
});
