/* 공공데이터포털 인증키가 어디서 살아 있는지 두드려 봅니다 (2026-09-30).
 *
 *   node tools/공공데이터열쇠확인.mjs
 *
 * 세중님 물음 — 「인증키 쓰는 곳 전부 알려줘. 바꾸면 옛 수집기도 멈추는지.」
 *
 * 공공데이터포털은 계정마다 **일반 인증키 하나**를 주고, 그 하나를 모든
 * 활용신청에 씁니다. 그래서 재발급하면 **그 계정으로 신청한 API 가 전부** 멈춥니다.
 * 다만 우리 저장소에는 서로 다른 열쇠가 섞여 있어, 짐작하지 않고 두드려 봅니다.
 *
 * **값은 한 글자도 안 찍습니다.** 지문(앞 10자리)만 보여 줍니다.
 */
import fs from 'node:fs';
import crypto from 'node:crypto';

const env = {};
for (const f of ['.env.local', '.env.server', 'web/.env.local']) {
  if (!fs.existsSync(f)) continue;
  fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((l) => {
    const m = l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*?)\s*$/); if (m && m[2]) env[m[1]] = m[2];
  });
}
const gas = fs.existsSync('gas/wage.js') ? fs.readFileSync('gas/wage.js', 'utf8') : '';
const 꺼내 = (re) => (gas.match(re) || [])[1] || '';

const 열쇠 = {
  'ALIO_LIST_KEY': env.ALIO_LIST_KEY || 꺼내(/const JOB_API = \{[\s\S]*?KEY:\s*'([^']+)'/),
  'ALIO_DETAIL_KEY': env.ALIO_DETAIL_KEY || 꺼내(/const JOB3_API = \{[\s\S]*?KEY:\s*'([^']+)'/),
  'CLEANEYE_KEY': env.CLEANEYE_KEY || '',
};
const 지문 = (v) => (v ? crypto.createHash('sha256').update(v).digest('hex').slice(0, 10) : '—');

/* 두드려 볼 곳 — 저장소에서 찾은 공공데이터 API 전부 */
const 곳 = [
  ['알리오 목록',     'https://apis.data.go.kr/1051000/recruitment/list?numOfRows=1&pageNo=1&resultType=json'],
  ['알리오 상세',     'https://apis.data.go.kr/1051000/recruitment/detail?resultType=json&sn=296899'],
  ['지방공공기관(클린아이)', 'https://apis.data.go.kr/1051000/recruitment/list?numOfRows=1&pageNo=1&resultType=json&ongoingYn=Y'],
];

/* 열쇠가 살았는지 — 「인증키가 등록되지 않았다」 류면 죽은 것입니다 */
function 어떤가(글, code) {
  const t = String(글 || '');
  if (/SERVICE_KEY_IS_NOT_REGISTERED|등록되지 않은 키|INVALID_REQUEST_PARAMETER|서비스키/.test(t)
      && !/성공/.test(t)) return '✗ 열쇠 안 먹음';
  if (/LIMITED_NUMBER_OF_SERVICE_REQUESTS|한도/.test(t)) return '△ 하루 한도 넘음 (열쇠는 살아 있음)';
  if (code !== 200) return '✗ HTTP ' + code;
  if (/"resultCode":\s*200|성공/.test(t)) return '○ 살아 있음';
  return '? ' + t.replace(/\s+/g, ' ').slice(0, 50);
}

console.log('공공데이터포털 인증키 — 값은 안 찍습니다. 지문으로만 봅니다\n');
console.log('열쇠'.padEnd(18) + '길이'.padEnd(6) + '꼴'.padEnd(12) + '지문');
console.log('─'.repeat(56));
for (const [k, v] of Object.entries(열쇠)) {
  console.log(k.padEnd(18) + String(v.length).padEnd(6)
    + (/%[0-9A-F]{2}/i.test(v) ? 'Encoding' : 'Decoding').padEnd(12) + 지문(v));
}

const 같은것 = {};
for (const [k, v] of Object.entries(열쇠)) { if (!v) continue; (같은것[지문(v)] ||= []).push(k); }
console.log('\n같은 열쇠끼리 묶으면 —');
for (const [f, ks] of Object.entries(같은것)) console.log('  ' + f + '  ' + ks.join(' = '));

console.log('\n어느 열쇠가 어디서 되나 (실제로 두드려 봅니다)\n');
const 표 = [];
for (const [이름, u] of 곳) {
  for (const [k, v] of Object.entries(열쇠)) {
    if (!v) continue;
    let code = 0, 글 = '';
    try {
      const r = await fetch(u + '&serviceKey=' + v, { headers: { accept: 'application/json' } });
      code = r.status; 글 = (await r.text()).slice(0, 400);
    } catch (e) { 글 = String(e.message); }
    표.push({ 'API': 이름, 열쇠: k, 결과: 어떤가(글, code) });
    await new Promise((y) => setTimeout(y, 400));
  }
}
console.table(표);
