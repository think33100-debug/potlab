/* 새 열쇠에 운영계정 한도가 붙었는지 **서비스마다 따로** 지켜봅니다 (2026-09-30).
 *
 *   node tools/새열쇠한도지킴.mjs          재고, 바뀌었으면 알립니다
 *   node tools/새열쇠한도지킴.mjs --보기    메일 안 보내고 화면에만
 *
 * ── 지금까지 확인한 것 ───────────────────────────────────────
 * · 포털 운영계정 신청 세 건은 **이미 새 열쇠로 바뀌어 있습니다** (세중님 확인)
 * · 그런데 응답 헤더의 한도는 새 열쇠에서만 개발계정 수준입니다
 * · **옛 열쇠에는 오늘(9/30) 운영으로 올린 두 곳도 이미 붙어 있습니다**
 *   → 운영 승인은 당일 바로 반영됩니다. **재발급된 열쇠에만 안 붙은 것**입니다
 *
 *     서비스                  승인      바라는 것    옛 열쇠     새 열쇠
 *     알리오 /list·/detail   9/8 운영    100,000    100,000 ○   1,000 ✗
 *     행안부 채용정보         9/30 운영  1,000,000  1,000,000 ○  10,000 ✗
 *     인사혁신처 공공취업      9/30 운영    100,000    100,000 ○  10,000 ✗
 *
 * ── 왜 서비스마다 따로 보나 ──────────────────────────────────
 * 알리오는 9월 8일부터 운영이고, 나머지 둘은 9월 30일에 올렸습니다.
 * **붙는 시점이 다를 수 있습니다.** 그래서 서비스마다 따로 적고,
 * 일부만 올라오면 「아직 바꾸지 마세요」 라고 알립니다.
 *
 * ── 한 번만 알립니다 ─────────────────────────────────────────
 * 마지막으로 본 값을 `~/.potjob-새열쇠한도.json` 에 둡니다.
 * 같은 값이면 조용히 지나갑니다 — 한 시간마다 같은 메일이 오면 안 봅니다.
 * 48시간이 지나도 안 붙으면 그때 한 번 「문의할 때입니다」 라고 알립니다.
 *
 * **값은 한 글자도 안 찍습니다.**
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { 공공부르기 } from './공공데이터부르기.mjs';

const 보기만 = process.argv.includes('--보기');
const 기억파일 = path.join(os.homedir(), '.potjob-새열쇠한도.json');
const 셈 = (n) => Number(n).toLocaleString('ko-KR');

const env = {};
for (const f of ['.env', '.env.server', '.env.local', 'web/.env.local']) {
  if (!fs.existsSync(f)) continue;
  fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((l) => {
    const m = l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*?)\s*$/);
    if (m && m[2] && !env[m[1]]) env[m[1]] = m[2].replace(/^'|'$/g, '');
  });
}
Object.keys(process.env).forEach((k) => { if (process.env[k]) env[k] = process.env[k]; });

const 새열쇠 = env.WATCH_KEY || '';
if (!새열쇠) { console.log('WATCH_KEY 가 없습니다 — 지킬 것이 없습니다'); process.exit(0); }

const 날 = (d) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);

/* 운영계정으로 승인된 것들. 바라는 한도는 포털 신청 화면의 값입니다 */
const 볼것 = [
  ['알리오 목록', '9/8 운영', 100000,
    'https://apis.data.go.kr/1051000/recruitment/list?numOfRows=1&pageNo=1&resultType=json'],
  ['알리오 상세', '9/8 운영', 100000,
    'https://apis.data.go.kr/1051000/recruitment/detail?resultType=json&sn=296899'],
  ['행안부 채용정보', '9/30 운영', 1000000,
    'https://apis.data.go.kr/B551982/openApiEmployInfo/openXmlEmployInfo?type=xml&sidoCd=007001&numOfRows=1'],
  ['인사혁신처 공공취업', '9/30 운영', 100000,
    'https://apis.data.go.kr/1760000/PblJobService/getList?pageNo=1&numOfRows=1'
    + '&Begin_de=' + 날(-30) + '&End_de=' + 날(1)],
];

const 잰것 = [];
for (const [이름, 승인, 바라는것, u] of 볼것) {
  /* 기록안함 — 한도가 다른 열쇠라 관리자 화면 숫자에 섞이면 안 됩니다 */
  const r = await 공공부르기(u + '&serviceKey=' + 새열쇠,
    { 간격: 1500, 최대다시: 0, 떠들기: false, 기록안함: true });
  const 한도 = Number(r.한도) || 0;
  잰것.push({ 이름, 승인, 한도, 바라는것, 붙었나: 한도 >= 바라는것 });
}

const 다붙었나 = 잰것.every((x) => x.붙었나);
const 몇개붙음 = 잰것.filter((x) => x.붙었나).length;
/* 서비스마다 따로 적습니다 — 붙는 시점이 다를 수 있습니다 */
const 서비스별 = Object.fromEntries(잰것.map((x) => [x.이름, x.한도]));

console.log('새 열쇠 한도 — ' + new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }));
잰것.forEach((x) => console.log('  ' + x.이름.padEnd(20) + x.승인.padEnd(11)
  + 셈(x.한도).padStart(11) + ' / 바라는 것 ' + 셈(x.바라는것).padStart(11)
  + '   ' + (x.붙었나 ? '○ 붙었습니다' : '아직')));
console.log(다붙었나 ? '\n★ 네 가지 모두 운영 한도가 붙었습니다'
  : '\n' + 몇개붙음 + ' / ' + 잰것.length + ' 붙었습니다');

/* ── 지난번과 견주기 ─────────────────────────────────────── */
let 기억 = {};
try { 기억 = JSON.parse(fs.readFileSync(기억파일, 'utf8')) || {}; } catch { /* 처음 */ }
const 지난서비스별 = 기억.서비스별 || {};
const 처음본때 = 기억.처음본때 || new Date().toISOString();
const 몇시간째 = Math.round((Date.now() - new Date(처음본때).getTime()) / 3600000);

const 바뀐것 = 잰것
  .filter((x) => 지난서비스별[x.이름] !== undefined && 지난서비스별[x.이름] !== x.한도)
  .map((x) => ({ ...x, 전: 지난서비스별[x.이름] }));
const 처음인가 = !Object.keys(지난서비스별).length;

const 적기 = (더) => {
  const 낼것 = { ...기억, ...더, 서비스별, 처음본때, 때: new Date().toISOString() };
  try { fs.writeFileSync(기억파일, JSON.stringify(낼것), { mode: 0o600 }); }
  catch { /* 못 써도 계속 */ }
};

/* 48시간이 지나도 안 붙으면 한 번만 알립니다 — 그때는 포털에 문의할 때입니다 */
const 마흔여덟넘음 = !다붙었나 && 몇시간째 >= 48 && !기억.마흔여덟알림;

if (처음인가 && !다붙었나 && !보기만) {
  적기({});
  console.log('(처음 재는 것입니다 — 적어만 두고 알리지 않습니다)');
  process.exit(0);
}
if (!바뀐것.length && !마흔여덟넘음 && !(다붙었나 && !기억.다붙음알림)) {
  적기({});
  console.log('(지난번과 같습니다 · ' + 몇시간째 + '시간째 — 알리지 않습니다)');
  process.exit(0);
}
적기({
  ...(마흔여덟넘음 ? { 마흔여덟알림: true } : {}),
  ...(다붙었나 ? { 다붙음알림: true } : {}),
});

/* ── 알리기 ─────────────────────────────────────────────── */
const 제목 = 다붙었나
  ? '[피오티잡] ★ 새 공공데이터 열쇠에 운영 한도가 다 붙었습니다 — 이제 갈아끼웁니다'
  : 마흔여덟넘음
    ? '[피오티잡] 새 공공데이터 열쇠 한도가 ' + 몇시간째 + '시간째 그대로입니다 — 포털에 문의할 때입니다'
    : '[피오티잡] 새 공공데이터 열쇠 한도가 바뀌었습니다 (' + 몇개붙음 + '/' + 잰것.length + ') — 아직 안 바꿉니다';

const 첫머리 = 다붙었나
  ? '네 가지 모두 운영계정 한도가 붙었습니다. 이제 열쇠를 갈아끼울 수 있습니다.'
  : 마흔여덟넘음
    ? [몇시간째 + '시간째 운영계정 한도가 안 붙습니다.',
      '포털에 문의할 때입니다 — 저장소의 포털문의_초안.md 의 ㉮ 를 쓰시면 됩니다.',
      '  메일 opendata_help@nia.or.kr · 전화 1566-0025 (평일 09~18시)'].join('\n')
    : ['일부만 올라왔습니다 (' + 몇개붙음 + '/' + 잰것.length + ').',
      '**아직 열쇠를 바꾸지 않습니다.** 네 가지가 다 올라와야 한 번에 바꿉니다.',
      '한 곳만 바꾸면 나머지가 하루 한도에서 멈춥니다.'].join('\n');

const 본문 = [
  첫머리, '',
  ...(바뀐것.length ? ['바뀐 것 —',
    ...바뀐것.map((x) => '  ' + x.이름.padEnd(20) + 셈(x.전) + ' → ' + 셈(x.한도)
      + (x.붙었나 ? '   ○ 붙었습니다' : '   아직')), ''] : []),
  '지금 값 —',
  ...잰것.map((x) => '  ' + x.이름.padEnd(20) + x.승인.padEnd(11)
    + 셈(x.한도).padStart(11) + ' / 바라는 것 ' + 셈(x.바라는것).padStart(11)
    + (x.붙었나 ? '   ○' : '   아직')),
  '',
  다붙었나 ? '갈아끼우는 순서 —' : '다 올라오면 이 순서로 갈아끼웁니다 —',
  '  1. node tools/공공데이터열쇠바꾸기.mjs           먼저 보여만 봅니다',
  '  2. node tools/공공데이터열쇠바꾸기.mjs --바꾼다   열두 곳을 한 번에',
  '  3. node tools/공공데이터열쇠확인.mjs             아홉 가지가 다 되는지',
  '  4. GitHub Secret 세 개 · gas 배포 · 서버 반영',
  '',
  '자세한 것은 저장소의 공공데이터_재발급_순서.md 에 있습니다.',
].join('\n');

if (보기만 || !env.RESEND_KEY || !env.NOTIFY_EMAIL) {
  console.log('\n제목: ' + 제목 + '\n');
  console.log(본문);
  process.exit(0);
}

const r = await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: { Authorization: 'Bearer ' + env.RESEND_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    from: env.MAIL_FROM || 'potjob <onboarding@resend.dev>',
    to: [env.NOTIFY_EMAIL], subject: 제목, text: 본문,
  }),
});
console.log(r.ok ? '\n메일 보냈습니다 — ' + 제목
  : '\n메일 못 보냄 · HTTP ' + r.status + ' · ' + (await r.text()).slice(0, 200));
