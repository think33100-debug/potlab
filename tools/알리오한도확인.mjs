/* 알리오 두 열쇠의 하루 한도를 **헤더로** 봅니다 (2026-09-30).
 *
 *   node tools/알리오한도확인.mjs
 *
 * ── 왜 만드나 ────────────────────────────────────────────────
 * 9월 30일 재발급 뒤 새 열쇠가 /detail 에서만 429 를 냈습니다.
 * 「일일 한도」 인지 「초당 제한」 인지 「키 미반영」 인지 가려야 했는데,
 * 공공데이터포털은 **응답 헤더에 답을 적어 줍니다** —
 *
 *     x-ratelimit-limit       그 열쇠·그 기능의 하루 한도
 *     x-ratelimit-remaining   오늘 남은 횟수
 *     x-ratelimit-requested   이번 요청이 센 값
 *
 * 그때 찍힌 값 —
 *     새 열쇠 /detail   limit 1000    remaining 0
 *     새 열쇠 /list     limit 1000    remaining 976
 *     옛 열쇠 /detail   limit 100000  remaining 98826
 *
 * 그래서 「너무 빨리 부름」 이 아니라 **한도가 낮은 열쇠**였습니다.
 *
 * **값은 한 글자도 안 찍습니다.** 지문만 보여 줍니다.
 */
import fs from 'node:fs';
import crypto from 'node:crypto';

const 지문 = (v) => (v ? crypto.createHash('sha256').update(v).digest('hex').slice(0, 10) : '—');
const 쉼 = (ms) => new Promise((y) => setTimeout(y, ms));

const env = {};
for (const f of ['.env.server', '.env.local', '.env', 'web/.env.local']) {
  if (!fs.existsSync(f)) continue;
  fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((l) => {
    const m = l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*?)\s*$/);
    if (m && m[2] && !env[m[1]]) env[m[1]] = m[2].replace(/^'|'$/g, '');
  });
}
const gas = fs.existsSync('gas/wage.js') ? fs.readFileSync('gas/wage.js', 'utf8') : '';
const 꺼내 = (re) => (gas.match(re) || [])[1] || '';

const 열쇠들 = [
  ['.env.server 의 CLEANEYE_KEY', env.CLEANEYE_KEY || ''],
  ['gas 의 JOB2_API (옛것)', 꺼내(/const JOB2_API = \{[\s\S]*?KEY:\s*'([^']+)'/)],
].filter(([, v]) => v);

/* 값이 같으면 한 번만 */
const 본것 = new Set();
const 볼것 = 열쇠들.filter(([, v]) => (본것.has(v) ? false : (본것.add(v), true)));

const 기능 = [
  ['/list  (목록)', 'https://apis.data.go.kr/1051000/recruitment/list?numOfRows=1&pageNo=1&resultType=json'],
  ['/detail(상세)', 'https://apis.data.go.kr/1051000/recruitment/detail?resultType=json&sn=296899'],
];

console.log('알리오 하루 한도 — ' + new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) + '\n');
console.log('열쇠'.padEnd(30) + '기능'.padEnd(16) + 'HTTP'.padEnd(7)
  + '한도'.padEnd(10) + '남음'.padEnd(10) + '까닭');
console.log('─'.repeat(96));

for (const [이름, 값] of 볼것) {
  for (const [기능이름, u] of 기능) {
    let code = 0, h = {}, 까닭 = '';
    try {
      const r = await fetch(u + '&serviceKey=' + 값, { headers: { accept: 'application/json' } });
      code = r.status;
      h = {
        한도: r.headers.get('x-ratelimit-limit') || '—',
        남음: r.headers.get('x-ratelimit-remaining') || '—',
      };
      const t = await r.text();
      const m = t.match(/"returnAuthMsg"\s*:\s*"([^"]*)"|<returnAuthMsg>([^<]*)</);
      까닭 = m ? (m[1] || m[2]) : '○ 성공';
    } catch (e) { 까닭 = String(e.message).slice(0, 40); }
    console.log((이름 + ' ' + 지문(값)).padEnd(30) + 기능이름.padEnd(16)
      + String(code).padEnd(7) + String(h.한도 || '—').padEnd(10)
      + String(h.남음 || '—').padEnd(10) + 까닭);
    await 쉼(1500);          /* 천천히 — 초당 제한에 걸리지 않게 */
  }
}

console.log('\n읽는 법 —');
console.log('  한도 100000  운영계정입니다 (신청 화면의 「일일 10만」)');
console.log('  한도 1000    개발계정 수준입니다. 이 열쇠로 바꾸면 상세가 하루 1,000건에서 멈춥니다');
console.log('  남음 0       오늘 몫을 다 쓴 것입니다. 자정에 돌아옵니다 (한 시간 기다려도 안 돌아옵니다)');
