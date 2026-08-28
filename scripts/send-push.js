/* ============================================================
 * send-push.js — 새 공고를 등록된 기기로 보냅니다
 * ------------------------------------------------------------
 * GitHub Actions 가 하루 세 번 실행합니다.
 *   ① Apps Script 에 "보낼 것 있냐"고 묻고
 *   ② 기기마다 직군을 맞춰 알림을 보내고
 *   ③ 죽은 기기는 지우고, 보낸 시점을 기록합니다
 *
 * 열쇠는 코드에 적지 않습니다. GitHub Secrets 에서 읽어옵니다.
 * ============================================================ */
const webpush = require('web-push');

const API = process.env.APPS_SCRIPT_URL;   // .../exec
const KEY = process.env.PUSH_KEY;          // Wage.gs 의 PUSH.KEY
const PUB = process.env.VAPID_PUBLIC;
const PRV = process.env.VAPID_PRIVATE;
const MAIL = process.env.VAPID_MAIL || 'mailto:think33100@gmail.com';

if (!API || !KEY || !PUB || !PRV) {
  console.error('설정이 빠졌습니다. GitHub Secrets 를 확인해주세요.');
  console.error('  APPS_SCRIPT_URL / PUSH_KEY / VAPID_PUBLIC / VAPID_PRIVATE');
  process.exit(1);
}

webpush.setVapidDetails(MAIL, PUB, PRV);

/* Apps Script 는 JSONP 로 답합니다. 감싼 껍데기를 벗겨냅니다. */
async function call(action, args) {
  const cb = '__potlab_cb_1_' + Date.now();
  const url = API
    + (API.includes('?') ? '&' : '?')
    + 'callback=' + cb
    + '&action=' + encodeURIComponent(action)
    + '&args=' + encodeURIComponent(JSON.stringify(args || []));

  const res = await fetch(url, { redirect: 'follow' });
  const txt = await res.text();
  const m = txt.match(/^__potlab_cb_[0-9]+_[0-9]+\((.*)\);?\s*$/s);
  if (!m) throw new Error('응답을 읽을 수 없습니다: ' + txt.slice(0, 200));
  const out = JSON.parse(m[1]);
  if (!out.ok) throw new Error(out.error || '서버가 거절했습니다');
  return out.data;
}

/* 여러 건이면 묶어서 한 줄로 만듭니다 */
function makeBody(posts) {
  if (posts.length === 1) {
    const p = posts[0];
    return { title: '새 채용공고 · ' + p.org,
             body: p.title.slice(0, 80) + (p.to ? '\n~' + p.to : ''),
             url: p.url || '/' };
  }
  const orgs = [...new Set(posts.map(p => p.org))].slice(0, 3).join(', ');
  return { title: '새 채용공고 ' + posts.length + '건',
           body: orgs + (posts.length > 3 ? ' 외' : ''),
           url: '/' };
}

(async () => {
  const d = await call('pushPending', [KEY]);

  if (!d.posts.length) { console.log('보낼 공고가 없습니다'); return; }
  if (!d.subs.length) { console.log('등록된 기기가 없습니다'); await call('pushDone', [KEY, d.stamp]); return; }

  console.log('공고 ' + d.posts.length + '건 · 기기 ' + d.subs.length + '대');

  let sent = 0, dropped = 0, failed = 0;

  for (const s of d.subs) {
    /* 이 사람이 새 공고 알림을 받기로 했는지 */
    if (!s.kinds.includes('job')) continue;

    /* 고른 직군에 맞는 공고만 (공통 공고는 모두에게) */
    const mine = d.posts.filter(p => p.job === '공통' || s.jobs.includes(p.job));
    if (!mine.length) continue;

    const payload = JSON.stringify(
      Object.assign(makeBody(mine), { tag: 'potjob-job' }));

    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload
      );
      sent++;
    } catch (e) {
      const code = e.statusCode || 0;
      if (code === 404 || code === 410) {
        /* 기기가 사라졌습니다 — 목록에서 지웁니다 */
        await call('pushDrop', [KEY, s.endpoint]);
        dropped++;
      } else {
        failed++;
        console.warn('실패(' + code + ') ' + s.nick + ': ' + e.message);
      }
    }
  }

  await call('pushDone', [KEY, d.stamp]);
  console.log('보냄 ' + sent + ' · 지움 ' + dropped + ' · 실패 ' + failed);
})().catch(e => {
  console.error(e.message);
  process.exit(1);
});
