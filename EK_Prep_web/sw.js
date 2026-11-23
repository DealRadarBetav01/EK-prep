/* EK Prep service worker: keeps the app shell on the iPad so it opens with no internet.
   The manual library is not here (it is in IndexedDB, loaded from Files). */
var VERSION = 'ekprep-20261123-2014';
var ASSETS = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png", "apple-touch-icon.png", "libs/d3.min.js", "libs/datamaps.world.min.js", "libs/fp_ofp.js", "libs/geo.json", "libs/marked.umd.js", "libs/pdf.js", "libs/pdf.worker.js", "libs/topojson.js"];
self.addEventListener('install', function (e) { e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(ASSETS); })); });
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); })); })
    .then(function () { return self.clients.claim(); }));
});
self.addEventListener('message', function (e) { if (e.data === 'skipWaiting') self.skipWaiting(); });
self.addEventListener('fetch', function (e) {
  var r = e.request; if (r.method !== 'GET') return;
  var u = new URL(r.url); if (u.origin !== self.location.origin) return;
  if (r.mode === 'navigate') { e.respondWith(caches.match('index.html').then(function (c) { return c || fetch(r); })); return; }
  e.respondWith(caches.match(r, { ignoreSearch: true }).then(function (c) { return c || fetch(r); }));
});
