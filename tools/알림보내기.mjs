/* ═══════════════════════════════════════════════════════════════
 *  알림 ② 보내는 부분 — 웹 푸시로 쏩니다
 *  2026-10-02. **크론은 아직 안 걸었습니다** (세중님 승인 뒤에 겁니다).
 * ═══════════════════════════════════════════════════════════════
 *
 *  고르는 쪽과 떼어져 있습니다
 *    누구에게 무엇을 보낼지는 **DB 의 보낼알림() 이 정합니다.** 이 파일은
 *    그 목록을 받아 쏘기만 합니다. 나중에 앱스토어 앱이 나오면
 *    `어떻게` 칸을 보고 다른 길(FCM·APNs)로 보내게 **여기만** 고치면 됩니다.
 *
 *  쓰는 법
 *    node tools/알림보내기.mjs --dry            고를 것만 보고 안 보냅니다
 *    node tools/알림보내기.mjs --나만 <기기id>   고른 것 중 그 기기 몫만
 *    node tools/알림보내기.mjs --시험 <기기id>   그 기기에 **시험 한 건**을 쏩니다
 *                                              (보낼알림 을 안 거칩니다. 아래 설명)
 *    node tools/알림보내기.mjs                  진짜로 보냅니다
 *    node tools/알림보내기.mjs --자가시험        주소 만드는 규칙만 시험 (열쇠 없이)
 *
 *  갈래 셋
 *    새공고     찜한 병원에 새 공고        → /jobs/<공고id>
 *    마감임박   찜한 공고 마감 3일 전       → /jobs/<공고id>
 *    새교육     알림 켠 교육기관의 새 교육   → /edu/org/<기관>  (2026-10-04 보탬)
 *
 *  열쇠 (.env.server)
 *    SUPABASE_URL · SUPABASE_SERVICE_KEY   보낼알림·알림보낸것남기기 는
 *                                          service_role 만 부를 수 있습니다
 *    COLLECT_KEY_HS3                       함수 안 열쇠 검사 (두 겹입니다)
 *    VAPID_PUBLIC · VAPID_PRIVATE · VAPID_MAIL
 *
 *  안전장치는 **DB 가 겁니다** — 이 파일이 아닙니다
 *    구독 시각 이후만 · 중복 방지 · 하루 상한 · 조용한 시간 22~7 ·
 *    탈퇴 회원 제외 · 꺼진 기기 제외
 *    여기서 하는 일은 「받은 목록을 쏘고 결과를 되돌려 주는 것」뿐입니다.
 *
 *  **먼저 남기고 보냅니다**
 *    고유 제약 (기기id, 갈래, 공고id) 이 중복을 막습니다. 보내고 나서 남기면
 *    중간에 죽었을 때 두 번 갑니다. 그래서 남기기를 먼저 하고, 결과는 뒤에 고칩니다.
 * ═══════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import webpush from 'web-push';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(여기, '..');
const 읽기 = (f) => {
  const o = {};
  if (!fs.existsSync(f)) return o;
  for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) o[m[1]] = m[2].trim().replace(/^(['"])([\s\S]*)\1$/, '$2').trim();
  }
  return o;
};
const cfg = {
  ...읽기(path.join(ROOT, '.env.local')),
  ...읽기(path.join(ROOT, 'web', '.env.local')),
  ...읽기(path.join(ROOT, '.env.server')),
  ...읽기(path.join(ROOT, '.env')),
  ...process.env,
};
cfg.SUPABASE_URL = cfg.SUPABASE_URL || cfg.NEXT_PUBLIC_SUPABASE_URL;

const argv = process.argv.slice(2);
const dry = argv.includes('--dry');
const 나만 = argv.includes('--나만') ? String(argv[argv.indexOf('--나만') + 1] || '') : '';
const 시험 = argv.includes('--시험') ? String(argv[argv.indexOf('--시험') + 1] || '') : '';
const 시험공고 = argv.includes('--시험') ? String(argv[argv.indexOf('--시험') + 2] || '') : '';
const 하루상한 = argv.includes('--상한') ? Number(argv[argv.indexOf('--상한') + 1]) || 3 : 3;

/* 눌렀을 때 갈 곳. 갈래마다 다릅니다 (2026-10-04) —
   공고는 /jobs/<공고id> 로 가지만, **교육 하나만 보는 화면이 없습니다.**
   그래서 교육은 그 기관 화면으로 보냅니다. 거기 열린 교육이 위에 있습니다.

   왜 보낼알림() 이 주소를 안 돌려주나 — 돌려주는 칸을 늘리면 함수를 drop
   하고 다시 만들어야 합니다. 갈래를 보고 여기서 만드는 쪽이 쌉니다 */
const 갈곳 = (x) => (x.갈래 === '새교육'
  ? '/edu/org/' + encodeURIComponent(x.기관 || '')
  : '/jobs/' + x.공고id);

/* 자가시험 — 열쇠 없이 돕니다. node tools/알림보내기.mjs --자가시험 */
if (argv.includes('--자가시험')) {
  const 같나 = (a, b, 말) => {
    if (a !== b) { console.error('✗ ' + 말 + '\n   받음 ' + a + '\n   바람 ' + b); process.exit(1); }
    console.log('○ ' + 말);
  };
  같나(갈곳({ 갈래: '새공고', 공고id: 'WNK1', 기관: '어느병원' }), '/jobs/WNK1', '새공고는 /jobs 로');
  같나(갈곳({ 갈래: '마감임박', 공고id: 'WNK2', 기관: '어느병원' }), '/jobs/WNK2', '마감임박도 /jobs 로');
  같나(갈곳({ 갈래: '새교육', 공고id: 'EDU-1', 기관: '대한연하재활학회' }),
    '/edu/org/' + encodeURIComponent('대한연하재활학회'), '새교육은 기관 화면으로 (한글 주소는 감쌉니다)');
  같나(갈곳({ 갈래: '새교육', 공고id: 'EDU-2', 기관: '' }), '/edu/org/', '기관이 비어도 안 터집니다');
  console.log('\n자가시험 4개 다 통과');
  process.exit(0);
}

const t0 = Date.now();
console.log('알림 보내기 · ' + new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
  + (dry ? ' · **--dry · 보내지 않습니다**' : '')
  + (나만 ? ' · **--나만 ' + 나만 + ' (그 기기에만)**' : ''));

const 없는것 = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'COLLECT_KEY_HS3',
  'VAPID_PUBLIC', 'VAPID_PRIVATE', 'VAPID_MAIL'].filter((k) => !cfg[k]);
for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'COLLECT_KEY_HS3', 'VAPID_PUBLIC', 'VAPID_PRIVATE', 'VAPID_MAIL']) {
  console.log('  ' + k.padEnd(22) + (cfg[k] ? '있음' : '**없음**'));
}
if (없는것.length) { console.error('\n열쇠가 모자랍니다 — ' + 없는것.join(' · ')); process.exit(1); }

webpush.setVapidDetails(cfg.VAPID_MAIL, cfg.VAPID_PUBLIC, cfg.VAPID_PRIVATE);

/* 보낼알림·알림보낸것남기기 는 service_role 만 부를 수 있습니다 */
async function rpc(이름, body) {
  const k = cfg.SUPABASE_SERVICE_KEY;
  const r = await fetch(cfg.SUPABASE_URL + '/rest/v1/rpc/' + encodeURIComponent(이름), {
    method: 'POST',
    headers: { apikey: k, Authorization: 'Bearer ' + k, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const 글 = await r.text();
  if (!r.ok) throw new Error('HTTP ' + r.status + ' · 응답 원문 — ' + 글.slice(0, 500));
  return 글 ? JSON.parse(글) : null;
}

/* ── 시험 발송 (--시험 <기기id> [공고id]) ──────────────────────────
 *
 * 왜 따로 있나 — `보낼알림()` 은 **구독 시각 이후 새 공고만** 고릅니다.
 * 갓 구독한 기기에는 보낼 것이 없어서(맞는 동작입니다) 화면을 못 봅니다.
 * 그래서 **진짜와 똑같은 모양으로** 한 건만 쏩니다.
 *
 * 안전하게 두는 것
 *   · 기기id 를 손으로 적어야만 돕니다. 회원 전체로는 갈 수 없습니다
 *   · `알림보낸것` 에 **안 남깁니다** — 시험은 짝이 되는 공고 판정이 없습니다.
 *     남기면 나중에 그 공고의 진짜 알림이 「이미 보냄」으로 막힙니다
 *   · 꺼진 기기에는 안 보냅니다
 */
if (시험) {
  const 길 = cfg.SUPABASE_URL + '/rest/v1/' + encodeURIComponent('알림기기')
    + '?id=eq.' + encodeURIComponent(시험) + '&select=id,주소,열쇠1,열쇠2,켜짐';
  const k = cfg.SUPABASE_SERVICE_KEY;
  const r = await fetch(길, { headers: { apikey: k, Authorization: 'Bearer ' + k } });
  const 글 = await r.text();
  if (!r.ok) { console.error('기기를 못 읽었습니다 — HTTP ' + r.status + ' · ' + 글.slice(0, 400)); process.exit(1); }
  const [기기] = JSON.parse(글);
  if (!기기) { console.error('기기 ' + 시험 + ' 가 없습니다'); process.exit(1); }
  if (!기기.켜짐) { console.error('기기 ' + 시험 + ' 는 꺼져 있습니다'); process.exit(1); }
  console.log('\n기기 ' + 기기.id + ' · ' + new URL(기기.주소).host + ' (주소 값은 안 찍습니다)');

  /* 눌렀을 때 진짜 열리는 공고로 보냅니다 — 빈 화면이 뜨면 시험이 안 됩니다 */
  const 공고 = 시험공고 && !시험공고.startsWith('--') ? 시험공고 : 'WNK152412610020006';
  const 몸 = JSON.stringify({
    제목: '연세메디하임병원',
    몸: '원주 연세메디하임병원 작업치료사 구인합니다 · 알림 시험',
    주소: '/jobs/' + 공고,
    /* ★ 2026-10-05 — 시험 태그에 **시각을 붙입니다.**
       전에는 늘 같은 태그라, 앞 시험 알림이 알림 센터에 남아 있으면
       크롬이 조용히 바꿔치기만 하고 새 띠를 안 띄웠습니다 */
    // eslint-disable-next-line no-restricted-syntax
    태그: '시험:' + 공고 + ':' + Date.now(),
  });
  console.log('보낼 것 —\n' + 몸.replace(/","/g, '"\n  "') + '\n');

  /* ★ 2026-10-05 — **FCM 이 돌려준 것을 그대로 찍습니다.**
     전에는 「보냈습니다」만 찍어서, 세중님이 못 받았을 때 FCM 이 받기나 했는지
     알 길이 없었습니다 (작업지침 2번 — 진단은 응답 원문을 찍을 것).
       201  받았습니다 (그 뒤는 브라우저·기기 쪽 문제)
       403  VAPID 열쇠가 구독 때와 다릅니다  ← 가장 흔한 원인
       404·410  구독이 사라졌습니다 — 다시 켜야 합니다
       413  몸이 너무 깁니다 */
  console.log('보내는 쪽 VAPID 공개키 — 앞 8글자 ' + cfg.VAPID_PUBLIC.slice(0, 8)
    + ' · 뒤 6글자 ' + cfg.VAPID_PUBLIC.slice(-6) + ' · ' + cfg.VAPID_PUBLIC.length + '글자');
  console.log('  (화면이 쓰는 NEXT_PUBLIC_VAPID_PUBLIC 과 **같아야** 합니다.\n'
    + '   다르면 FCM 이 403 을 줍니다)\n');

  if (dry) { console.log('--dry 라 안 보냈습니다'); process.exit(0); }
  try {
    const res = await webpush.sendNotification(
      { endpoint: 기기.주소, keys: { p256dh: 기기.열쇠1, auth: 기기.열쇠2 } }, 몸);
    console.log('── FCM 응답 원문 ──');
    console.log('  HTTP ' + res.statusCode);
    console.log('  본문 ' + (String(res.body || '').trim() || '(비어 있음 — 201 은 보통 빕니다)'));
    console.log('  머리글 ' + JSON.stringify(res.headers || {}).slice(0, 400));
    console.log('\n' + (res.statusCode === 201
      ? '★ FCM 이 받았습니다. 여기서 안 뜨면 **브라우저·윈도우 쪽**입니다 —\n'
        + '   크롬이 켜져 있는지 · 윈도우 알림 허용 · 집중 모드 꺼짐 ·\n'
        + '   주소창 자물쇠 → 알림 「허용」'
      : '★ HTTP ' + res.statusCode + ' 입니다. 위 본문을 보십시오'));
    console.log('※ 알림보낸것 에는 안 남겼습니다 (시험이라서)');
  } catch (e) {
    console.error('── FCM 이 거절했습니다 ──');
    console.error('  HTTP ' + (e && e.statusCode));
    console.error('  본문 ' + String((e && e.body) || (e && e.message) || e).slice(0, 800));
    console.error('  머리글 ' + JSON.stringify((e && e.headers) || {}).slice(0, 400));
    if (e && (e.statusCode === 403 || e.statusCode === 400)) {
      console.error('\n★ 403·400 은 거의 **VAPID 열쇠가 안 맞는 것**입니다 —\n'
        + '   화면(Vercel 의 NEXT_PUBLIC_VAPID_PUBLIC)과 서버(.env 의 VAPID_PUBLIC)가\n'
        + '   다르면 구독은 되는데 보낼 때 막힙니다. 그러면 **다시 켜야** 합니다');
    }
    if (e && (e.statusCode === 404 || e.statusCode === 410)) {
      console.error('\n★ 404·410 은 **구독이 사라진 것**입니다. /me 에서 다시 켜야 합니다');
    }
    process.exit(1);
  }
  process.exit(0);
}

/* ① 보낼 것 받기 — 고르는 일은 DB 가 다 했습니다 */
let 할것 = await rpc('보낼알림', { p_secret: cfg.COLLECT_KEY_HS3, p_하루상한: 하루상한, p_몇개: 200 });
할것 = 할것 || [];
console.log('\n── 고른 것 ' + 할것.length + '건 ──');
if (나만) {
  const 전 = 할것.length;
  할것 = 할것.filter((x) => String(x.기기id) === 나만);
  console.log('  --나만 이라 ' + 할것.length + '건만 (' + 전 + '건 중)');
}
if (!할것.length) {
  console.log('  보낼 것이 없습니다 (조용한 시간이거나, 새 공고가 없거나, 기기가 없습니다)');
  console.log('\n' + Math.round((Date.now() - t0) / 1000) + '초');
  process.exit(0);
}

const 셈 = { 보냄: 0, 사라짐: 0, 실패: 0 };
const 보기 = [];
for (const x of 할것.slice(0, 12)) {
  보기.push('  ' + x.갈래.padEnd(6) + String(x.기관 || '').slice(0, 18).padEnd(20)
    + String(x.제목 || '').slice(0, 40));
}
console.log(보기.join('\n'));
if (할것.length > 12) console.log('  … 그 밖에 ' + (할것.length - 12) + '건');

if (dry) {
  console.log('\n--dry 라 보내지 않았습니다. ' + Math.round((Date.now() - t0) / 1000) + '초');
  process.exit(0);
}

/* ② **먼저 남깁니다.** 고유 제약이 중복을 막습니다 —
   보내고 나서 남기면 중간에 죽었을 때 두 번 갑니다 */
const 미리 = 할것.map((x) => ({ 기기id: x.기기id, 갈래: x.갈래, 공고id: x.공고id, 결과: '보내는 중' }));
const 새로남긴수 = Number(await rpc('알림보낸것남기기', { p_secret: cfg.COLLECT_KEY_HS3, p_rows: 미리 })) || 0;
console.log('\n먼저 남김   ' + 새로남긴수 + '건 (이미 있던 것은 안 보냅니다)');

/* ③ 쏘기 */
const 결과들 = [];
for (const x of 할것) {
  const 몸 = JSON.stringify({
    제목: x.갈래 === '마감임박' ? '마감이 다가와요'
      : x.갈래 === '새교육' ? (x.기관 || '새 교육')
      : (x.기관 || '새 공고'),
    몸: x.갈래 === '마감임박'
      ? String(x.제목 || '').slice(0, 60) + (x.마감 ? ' · ' + x.마감 + ' 마감' : '')
      : String(x.제목 || '').slice(0, 60),
    주소: 갈곳(x),
    태그: x.갈래 + ':' + x.공고id,
  });
  try {
    await webpush.sendNotification(
      { endpoint: x.주소, keys: { p256dh: x.열쇠1, auth: x.열쇠2 } }, 몸);
    셈.보냄++;
    결과들.push({ 기기id: x.기기id, 갈래: x.갈래, 공고id: x.공고id, 결과: 'ok' });
  } catch (e) {
    const code = e && e.statusCode;
    /* 404·410 = 기기가 사라졌습니다. DB 가 그 기기를 끕니다 */
    if (code === 404 || code === 410) {
      셈.사라짐++;
      결과들.push({ 기기id: x.기기id, 갈래: x.갈래, 공고id: x.공고id, 결과: 'gone' });
    } else {
      셈.실패++;
      결과들.push({ 기기id: x.기기id, 갈래: x.갈래, 공고id: x.공고id,
        결과: 'HTTP ' + (code || '?') + ' ' + String(e && e.message || e).slice(0, 80) });
    }
  }
  await new Promise((f) => setTimeout(f, 80));
}

/* ④ 결과 되돌려 주기 — 사라진 기기 끄기·연속 실패 세기는 DB 가 합니다 */
for (let i = 0; i < 결과들.length; i += 500) {
  await rpc('알림보낸것남기기', { p_secret: cfg.COLLECT_KEY_HS3, p_rows: 결과들.slice(i, i + 500) });
}

console.log('\n보냄 ' + 셈.보냄 + ' · 사라진 기기 ' + 셈.사라짐 + ' · 실패 ' + 셈.실패);
const 나쁜것 = 결과들.filter((x) => x.결과 !== 'ok' && x.결과 !== 'gone').slice(0, 3);
if (나쁜것.length) {
  console.error('\n★ 실패한 것 (앞 세 건) —');
  for (const x of 나쁜것) console.error('   기기 ' + x.기기id + ' · ' + x.결과);
}
console.log('\n' + Math.round((Date.now() - t0) / 1000) + '초');
if (셈.실패) process.exitCode = 1;
