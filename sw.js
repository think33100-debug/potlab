/* ═══════════════════════════════════════════════════════════════
 *  POT JOB 서비스 워커
 *
 *  이 파일의 유일한 일은 「푸시 알림 받기」입니다.
 *  화면(HTML·JS)은 절대 캐시하지 않습니다.
 *
 *  예전 sw.js 가 index.html 을 캐시하는 바람에, 새 코드를 올려도
 *  옛 화면이 계속 떴습니다. 이 버전은 아무것도 캐시하지 않아서
 *  항상 최신 화면이 뜹니다.
 *
 *  ── 올리는 법 ──
 *  이 파일을 GitHub 저장소 맨 위(index.html 옆)에 sw.js 로 올리세요.
 *  기존 sw.js 를 덮어씁니다.
 * ═══════════════════════════════════════════════════════════════ */

const SW_VERSION = 'potjob-2026-09-03';

/* 새 워커가 뜨면 기다리지 않고 바로 활성화합니다 */
self.addEventListener('install', function () {
  self.skipWaiting();
});

/* 활성화되면 예전 캐시를 통째로 지웁니다.
   과거 sw.js 가 만들어둔 화면 캐시를 여기서 청소합니다. */
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(names.map(function (n) { return caches.delete(n); }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

/* fetch 는 건드리지 않습니다.
   여기에 캐시 로직이 있으면 옛 화면이 뜹니다. 그래서 아무것도 안 합니다.
   모든 요청은 네트워크로 그대로 나갑니다 = 항상 최신. */

/* ── 푸시 알림 ── */
self.addEventListener('push', function (event) {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = {}; }

  const title = data.title || 'POT JOB';
  const options = {
    body: data.body || '새 소식이 있습니다',
    icon: data.icon || '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: data.url || 'https://potjob.co.kr/' },
    tag: data.tag || 'potjob'
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

/* 알림을 누르면 앱을 엽니다 */
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || 'https://potjob.co.kr/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      for (let i = 0; i < list.length; i++) {
        if (list[i].url.indexOf('potjob.co.kr') > -1 && 'focus' in list[i]) {
          return list[i].focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
