/* 새 열쇠에 운영계정 한도가 붙었는지 지켜보다가 **붙는 순간 알립니다** (2026-09-30).
 *
 *   node tools/새열쇠한도지킴.mjs          재고, 바뀌었으면 알립니다
 *   node tools/새열쇠한도지킴.mjs --보기    메일 안 보내고 화면에만
 *
 * ── 왜 만드나 ────────────────────────────────────────────────
 * 포털 운영계정 신청 세 건은 **이미 새 열쇠로 바뀌어 있습니다** (세중님 확인).
 * 그런데 응답 헤더의 한도는 아직 개발계정 수준입니다 — 반영이 늦는 것입니다.
 *
 *     서비스                    지금 쓰는 열쇠   새 열쇠      붙어야 할 값
 *     알리오 /list · /detail       100,000        1,000        100,000
 *     클린아이                   1,000,000       10,000      1,000,000
 *     나라일터                     100,000       10,000        100,000
 *
 * 한 시간마다 크론이 이걸 돌립니다. 올라가는 순간 메일이 오고,
 * 그때 열쇠 열두 곳을 한 번에 갈아끼우면 됩니다.
 *
 * ── 한 번만 알립니다 ─────────────────────────────────────────
 * 마지막으로 본 값을 `~/.potjob-새열쇠한도.json` 에 둡니다.
 * 같은 값이면 조용히 지나갑니다 — 한 시간마다 같은 메일이 오면 안 봅니다.
 *
 * **값은 한 글자도 안 찍습니다.**
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { 공공부르기 } from './공공데이터부르기.mjs';

const 보기만 = process.argv.includes('--보기');
const 기억파일 = path.join(os.homedir(), '.potjob-새열쇠한도.json');

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

/* 운영계정으로 승인된 세 건. 붙어야 할 한도는 포털 신청 화면의 값입니다 */
const 볼것 = [
  ['알리오 목록', 'https://apis.data.go.kr/1051000/recruitment/list?numOfRows=1&pageNo=1&resultType=json', 100000],
  ['알리오 상세', 'https://apis.data.go.kr/1051000/recruitment/detail?resultType=json&sn=296899', 100000],
  ['클린아이', 'https://apis.data.go.kr/B551982/openApiEmployInfo/openXmlEmployInfo?type=xml&sidoCd=007001&numOfRows=1', 1000000],
  ['나라일터', 'https://apis.data.go.kr/1760000/PblJobService/getList?pageNo=1&numOfRows=1'
    + '&Begin_de=' + new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
    + '&End_de=' + new Date(Date.now() + 86400000).toISOString().slice(0, 10), 100000],
];

const 잰것 = [];
for (const [이름, u, 바라는것] of 볼것) {
  /* 기록안함 — 한도가 다른 열쇠라 관리자 화면 숫자에 섞이면 안 됩니다 */
  const r = await 공공부르기(u + '&serviceKey=' + 새열쇠,
    { 간격: 1500, 최대다시: 0, 떠들기: false, 기록안함: true });
  const 한도 = Number(r.한도) || 0;
  잰것.push({ 이름, 한도, 바라는것, 붙었나: 한도 >= 바라는것 });
}

const 다붙었나 = 잰것.every((x) => x.붙었나);
const 지금 = 잰것.map((x) => x.이름 + '=' + x.한도).join(',');

console.log('새 열쇠 한도 — ' + new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }));
잰것.forEach((x) => console.log('  ' + x.이름.padEnd(12)
  + String(x.한도).padStart(9) + ' / 바라는 것 ' + String(x.바라는것).padStart(9)
  + '   ' + (x.붙었나 ? '○ 붙었습니다' : '아직')));
console.log(다붙었나 ? '\n★ 네 가지 모두 운영 한도가 붙었습니다' : '\n아직 반영 중입니다');

/* 지난번과 같으면 조용히 */
let 기억 = {};
try { 기억 = JSON.parse(fs.readFileSync(기억파일, 'utf8')) || {}; } catch { /* 처음 */ }
const 지난번 = 기억.지금 || '';
const 처음본때 = 기억.처음본때 || new Date().toISOString();
const 몇시간째 = Math.round((Date.now() - new Date(처음본때).getTime()) / 3600000);

const 적기 = (더) => {
  try {
    fs.writeFileSync(기억파일,
      JSON.stringify({ 지금, 처음본때, 때: new Date().toISOString(), ...기억, ...더, 지금, 처음본때 }),
      { mode: 0o600 });
  } catch { /* 못 써도 계속 */ }
};

/* 48시간이 지나도 안 붙으면 한 번만 알립니다 — 그때는 포털에 문의할 때입니다 */
const 마흔여덟넘음 = !다붙었나 && 몇시간째 >= 48 && !기억.마흔여덟알림;
if (지금 === 지난번 && !마흔여덟넘음) {
  console.log('(지난번과 같습니다 · ' + 몇시간째 + '시간째 — 알리지 않습니다)');
  적기({});
  process.exit(0);
}

/* 첫 실행은 견줄 것이 없습니다. 아직 안 붙었으면 적어만 두고 조용히 지나갑니다 —
   크론을 걸자마자 「바뀌었습니다」 메일이 오면 안 봅니다 */
if (!지난번 && !다붙었나 && !보기만) {
  적기({});
  console.log('(처음 재는 것입니다 — 적어만 두고 알리지 않습니다)');
  process.exit(0);
}
적기(마흔여덟넘음 ? { 마흔여덟알림: true } : {});

const 제목 = 다붙었나
  ? '[피오티잡] ★ 새 공공데이터 열쇠에 운영 한도가 붙었습니다 — 이제 갈아끼우면 됩니다'
  : 마흔여덟넘음
    ? '[피오티잡] 새 공공데이터 열쇠 한도가 ' + 몇시간째 + '시간째 그대로입니다 — 포털에 문의할 때입니다'
    : '[피오티잡] 새 공공데이터 열쇠 한도가 바뀌었습니다';
const 본문 = [
  다붙었나
    ? '네 가지 모두 운영계정 한도가 붙었습니다. 이제 열쇠를 갈아끼울 수 있습니다.'
    : 마흔여덟넘음
      ? 몇시간째 + '시간째 운영계정 한도가 안 붙습니다.\n'
        + '포털에 문의할 때입니다 — 저장소의 포털문의_초안.md 의 ㉮ 를 쓰시면 됩니다.\n'
        + '  메일 opendata_help@nia.or.kr · 전화 1566-0025 (평일 09~18시)'
      : '아직 다 붙지는 않았지만 값이 바뀌었습니다.',
  '',
  ...잰것.map((x) => '  ' + x.이름.padEnd(12) + String(x.한도).padStart(9)
    + ' / 바라는 것 ' + String(x.바라는것).padStart(9) + (x.붙었나 ? '   ○' : '   아직')),
  '',
  다붙었나 ? '갈아끼우는 순서 —' : '한도가 붙으면 이 순서로 갈아끼웁니다 —',
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
