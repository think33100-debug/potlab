/* 새 앱 알림 — 받아서 띄우는 쪽 (2026-10-02)
 *
 * 이 파일은 **받는 일만** 합니다. 누구에게 무엇을 보낼지는 DB 의 보낼알림() 이
 * 정하고, 실제로 쏘는 것은 Lightsail 의 tools/알림보내기.mjs 가 합니다.
 *
 * 옛 앱의 /sw.js (저장소 뿌리 · GitHub Pages) 와는 **다른 파일**입니다.
 * 주소가 달라서(potjob.kr/sw.js vs GitHub Pages) 서로 안 겹칩니다.
 *
 * 왜 이렇게 짧은가 — 서비스 워커는 고치기가 까다롭습니다. 브라우저가 옛 것을
 * 오래 들고 있어서, 여기에 로직을 넣으면 고쳐도 안 바뀐 것처럼 보입니다.
 * 그래서 **보여주기만** 하고 판단은 서버에 둡니다.
 */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) { d = {}; }

  const 제목 = d.제목 || '새 공고가 있어요';
  const 몸 = d.몸 || '';
  const 주소 = d.주소 || '/jobs';

  event.waitUntil(
    self.registration.showNotification(제목, {
      body: 몸,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      /* 같은 공고 알림이 쌓이지 않게 — 뒤엣것이 앞엣것을 덮습니다 */
      tag: d.태그 || 주소,
      /* ★ 2026-10-05 — tag 가 같으면 크롬이 **조용히 바꿔치기만** 하고
         띠도 소리도 안 냅니다. 앞엣것이 알림 센터에 남아 있으면 새로 온 줄을
         모릅니다. renotify 를 켜야 매번 알려줍니다 */
      renotify: true,
      /* ★ 안 치울 때까지 붙잡아 두는 것은 **시험 알림에만** 씁니다
         (2026-10-05 세중님 지시). 진짜 공고·교육 알림까지 붙잡아 두면
         화면에 알림이 쌓여 성가십니다. 보내는 쪽이 `붙잡기: true` 를
         넣을 때만 켭니다 — tools/알림보내기.mjs 의 --시험 만 넣습니다 */
      requireInteraction: d.붙잡기 === true,
      data: { 주소 },
      /* 소리·진동은 기본값에 맡깁니다. 밤에는 아예 안 보내므로(서버가 막습니다)
         여기서 조용히 할 일이 없습니다 */
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const 주소 = (event.notification.data && event.notification.data.주소) || '/jobs';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((목록) => {
      /* 이미 열린 창이 있으면 그걸 씁니다 — 창을 자꾸 새로 열면 성가십니다 */
      for (const c of 목록) {
        if ('focus' in c) { c.navigate(주소); return c.focus(); }
      }
      return self.clients.openWindow(주소);
    })
  );
});
