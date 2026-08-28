/* ============================================================
 * sw.js — 푸시 알림을 받는 일꾼
 * ------------------------------------------------------------
 * 브라우저가 꺼져 있어도 이 파일이 대신 깨어나 알림을 띄웁니다.
 * 저장소 맨 위(루트)에 두어야 사이트 전체를 맡을 수 있습니다.
 * ============================================================ */

/* 이 줄이 바뀌면 브라우저가 새 파일로 알아차립니다.
   sw.js 를 고칠 때마다 숫자를 올려주세요. */
const SW_VER = 'v3 · 2026-08-28';

/* 설치되면 기다리지 않고 바로 일을 시작합니다 */
self.addEventListener('install', function (e) {
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(self.clients.claim());
});

/* 알림이 도착했을 때 */
self.addEventListener('push', function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = {}; }

  var title = d.title || 'POT JOB';
  var opts = {
    body: d.body || '새 소식이 있습니다',
    /* 오른쪽 큰 그림 — 여기는 컬러 그대로 나옵니다 */
    icon: '/icon-192.png',
    /* 상태표시줄의 작은 표시.
       안드로이드가 색을 지우고 모양만 남기므로 글자 P 하나만 씁니다.
       그림을 넣으면 22픽셀에서 덩어리로 뭉개집니다. */
    badge: '/badge-96.png',
    tag: d.tag || 'potjob',          // 같은 tag 는 덮어씁니다 (알림이 쌓이지 않게)
    renotify: true,
    data: { url: d.url || '/' }
  };
  e.waitUntil(self.registration.showNotification(title, opts));
});

/* 알림을 눌렀을 때 — 이미 열린 창이 있으면 그 창으로 */
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || '/';

  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(function (list) {
        for (var i = 0; i < list.length; i++) {
          var c = list[i];
          if (c.url.indexOf(self.location.origin) === 0 && 'focus' in c) {
            /* 이미 열려 있으면 새로 고치지 않고 화면만 바꿉니다 */
            if (c.postMessage) c.postMessage({ go: url });
            return c.focus();
          }
        }
        if (self.clients.openWindow) return self.clients.openWindow(url);
      })
  );
});
