/* sw.js — PWA 서비스 워커 (오프라인 캐시 + 설치 조건 충족)
   GitHub Pages 하위 경로에서도 동작하도록 모든 경로를 SW 위치 기준 상대경로로 처리 */
const CACHE = 'ysp-v1';

/* SW가 놓인 폴더 기준으로 앱 셸(핵심 파일) 목록을 만든다 */
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/style.css',
  './js/kpi.js',
  './js/store.js',
  './js/app.js',
].map((p) => new URL(p, self.registration.scope).toString());

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* 네트워크 우선 → 실패 시 캐시(오프라인). GET 요청만 처리 */
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match(new URL('./index.html', self.registration.scope).toString())))
  );
});
