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

/* 여러 건이면 묶어서 한 줄로 만듭니다.
   누르면 바깥 공고 사이트가 아니라 우리 앱의 공고 목록이 열립니다. */
const OPEN_POSTS = '/#post';

function makeBody(posts) {
  if (posts.length === 1) {
    const p = posts[0];
    return { title: '새 채용공고 · ' + p.org,
             body: p.title.slice(0, 80) + (p.to ? '\n~' + p.to : ''),
             url: OPEN_POSTS };
  }
  const orgs = [...new Set(posts.map(p => p.org))].slice(0, 3).join(', ');
  return { title: '새 채용공고 ' + posts.length + '건',
           body: orgs + (posts.length > 3 ? ' 외' : ''),
           url: OPEN_POSTS };
}

/* 한 번에 몇 명씩 동시에 보낼지.
   너무 크게 잡으면 구글·애플 서버가 막을 수 있어 50 정도가 무난합니다. */
const BATCH = 50;

/* 한 사람에게 보냅니다. 결과만 돌려주고 여기서 멈추지 않습니다. */
async function sendOne(s, posts) {
  const payload = JSON.stringify(
    Object.assign(makeBody(posts), { tag: 'potjob-job' }));
  try {
    await webpush.sendNotification(
      { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
      payload
    );
    return { kind: 'sent' };
  } catch (e) {
    const code = e.statusCode || 0;
    if (code === 404 || code === 410) return { kind: 'gone', endpoint: s.endpoint };
    return { kind: 'fail', code: code, nick: s.nick, message: e.message };
  }
}

(async () => {
  const d = await call('pushPending', [KEY]);

  if (!d.posts.length) { console.log('보낼 공고가 없습니다'); return; }

  /* 보낸 공고에 표시를 남깁니다. 날짜로 견주지 않고 공고 번호로 세어
     같은 공고가 두 번 가지 않게 합니다. */
  const ids = d.posts.map(p => p.id).filter(Boolean);

  if (!d.subs.length) {
    console.log('등록된 기기가 없습니다 · 공고 ' + d.posts.length + '건은 보낸 것으로 표시');
    await call('pushDone', [KEY, ids]);
    return;
  }

  /* 보낼 사람만 먼저 골라둡니다 */
  const jobs = [];
  for (const s of d.subs) {
    if (!s.kinds.includes('job')) continue;                       // 공고 알림을 끈 사람
    const mine = d.posts.filter(p => p.job === '공통' || s.jobs.includes(p.job));
    if (!mine.length) continue;                                   // 내 직군 공고가 없는 사람
    jobs.push({ sub: s, posts: mine });
  }

  console.log('공고 ' + d.posts.length + '건 · 기기 ' + d.subs.length + '대 · 보낼 곳 ' + jobs.length + '곳');
  if (!jobs.length) { await call('pushDone', [KEY, ids]); console.log('받을 사람이 없습니다'); return; }

  const t0 = Date.now();
  let sent = 0, dropped = 0, failed = 0;
  const gone = [];

  /* BATCH 명씩 묶어 동시에 보냅니다 */
  for (let i = 0; i < jobs.length; i += BATCH) {
    const slice = jobs.slice(i, i + BATCH);
    const out = await Promise.all(slice.map(j => sendOne(j.sub, j.posts)));

    out.forEach(function (r) {
      if (r.kind === 'sent') sent++;
      else if (r.kind === 'gone') { dropped++; gone.push(r.endpoint); }
      else {
        failed++;
        console.warn('실패(' + r.code + ') ' + r.nick + ': ' + r.message);
      }
    });

    const done = Math.min(i + BATCH, jobs.length);
    if (jobs.length > BATCH) {
      console.log('  ' + done + '/' + jobs.length + ' 진행 · '
        + Math.round((Date.now() - t0) / 1000) + '초');
    }
  }

  /* 사라진 기기는 한 번에 정리합니다 (시트를 여러 번 두드리지 않게) */
  for (const ep of gone) {
    try { await call('pushDrop', [KEY, ep]); } catch (e) {}
  }

  const mark = await call('pushDone', [KEY, ids]);
  console.log('공고 ' + (mark.marked || 0) + '건을 보낸 것으로 표시');
  console.log('보냄 ' + sent + ' · 지움 ' + dropped + ' · 실패 ' + failed
    + ' · ' + Math.round((Date.now() - t0) / 1000) + '초');
})().catch(e => {
  console.error(e.message);
  process.exit(1);
});
