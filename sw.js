const CACHE_NAME = 'poopbuddy-v5';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/index.css',
    '/index.js',
    '/manifest.json',
    '/favicon.svg',
    '/firebase-config.js',
    '/health-db.json',
];

// 설치 — 핵심 정적 자산 사전 캐시
self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(STATIC_ASSETS))
            .then(() => self.skipWaiting())
    );
});

// 활성화 — 이전 캐시 정리, 즉시 컨트롤
self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

// Fetch 전략: API는 네트워크 전용, 정적 자산은 네트워크 우선 + 캐시 폴백
self.addEventListener('fetch', e => {
    const url = new URL(e.request.url);

    // API 요청: 항상 네트워크 (캐시 안 함)
    if (url.pathname.startsWith('/api/')) {
        e.respondWith(
            fetch(e.request).catch(() => {
                return new Response(JSON.stringify({ error: 'Offline', simulated: true }), {
                    headers: { 'Content-Type': 'application/json' },
                    status: 503
                });
            })
        );
        return;
    }

    // 외부 리소스 (Google Fonts, Kakao SDK 등): 네트워크 우선 + 캐시
    if (url.origin !== location.origin) {
        e.respondWith(
            fetch(e.request).then(resp => {
                if (resp.ok && e.request.method === 'GET') {
                    const clone = resp.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
                }
                return resp;
            }).catch(() => caches.match(e.request))
        );
        return;
    }

    // 정적 자산: 네트워크 우선, 실패 시 캐시 폴백
    e.respondWith(
        fetch(e.request).then(resp => {
            if (resp.ok && e.request.method === 'GET') {
                const clone = resp.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
            }
            return resp;
        }).catch(() => {
            return caches.match(e.request).then(cached => {
                if (cached) return cached;
                // HTML 요청은 index.html로 폴백 (SPA)
                if (e.request.destination === 'document') {
                    return caches.match('/index.html');
                }
                // 이미지 요청은 빈 SVG 폴백
                if (e.request.destination === 'image') {
                    return new Response(
                        '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>',
                        { headers: { 'Content-Type': 'image/svg+xml' } }
                    );
                }
            });
        })
    );
});

// 푸시 알림 이벤트 (Service Worker에서 처리)
self.addEventListener('push', e => {
    const data = e.data ? e.data.json() : {};
    const title = data.title || '🐾 PoopBuddy';
    const options = {
        body: data.body || '오늘의 대변 기록을 남겨보세요!',
        icon: '/favicon.svg',
        badge: '/favicon.svg',
        tag: 'poopbuddy-notification',
        renotify: true,
        data: { url: data.url || '/' }
    };
    e.waitUntil(self.registration.showNotification(title, options));
});

// 알림 클릭 — 앱 열기
self.addEventListener('notificationclick', e => {
    e.notification.close();
    const url = e.notification.data?.url || '/';
    e.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
            // 이미 열린 창이 있으면 포커스
            for (const client of windowClients) {
                if (client.url.includes(location.origin)) {
                    return client.focus();
                }
            }
            // 없으면 새 창 열기
            return clients.openWindow(url);
        })
    );
});
