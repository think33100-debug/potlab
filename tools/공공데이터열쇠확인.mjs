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
/* ── 실제로 두드립니다. **응답 원문을 찍습니다** (CLAUDE.md 2번) ───────────
 *
 * 그동안 「✗ 열쇠 안 먹음」 만 찍고 있었습니다. 그건 진단이 아닙니다.
 * 공공데이터포털은 까닭을 <returnAuthMsg> 에 적어 줍니다 —
 *   SERVICE_KEY_IS_NOT_REGISTERED_ERROR   열쇠가 그 API 에 등록 안 됨 (또는 죽음)
 *   SERVICE_ACCESS_DENIED_ERROR           활용신청이 반려/중지됨
 *   LIMITED_NUMBER_OF_SERVICE_REQUESTS…   하루 한도 (열쇠는 살아 있음)
 * 이 말이 있어야 「죽은 열쇠」 와 「인코딩 두 번」 을 가릅니다.
 */

/* 인코딩을 두 번 했나? — 포털은 열쇠를 두 꼴로 줍니다.
     Decoding 꼴  `abc+/=…`      → 주소에 넣을 때 encodeURIComponent 해야 함
     Encoding 꼴  `abc%2B%2F%3D…` → 그대로 넣어야 함. 또 감싸면 %252B 가 되어 죽음
   그래서 세 가지를 다 두드려 봅니다 */
const 꼴들 = (v) => {
  const 감싼것 = encodeURIComponent(v);
  const 푼것 = (() => { try { return decodeURIComponent(v); } catch { return v; } })();
  const 목록 = [['그대로', v]];
  if (감싼것 !== v) 목록.push(['한 번 더 감쌈', 감싼것]);
  if (푼것 !== v) 목록.push(['한 번 풂', 푼것]);
  return 목록;
};

/* 응답에 열쇠가 되비칠 수 있어 지웁니다 — 값은 한 글자도 안 찍습니다 */
const 지우기 = (t, 값들) => {
  let o = String(t);
  for (const v of 값들) {
    for (const 꼴 of [v, encodeURIComponent(v), (() => { try { return decodeURIComponent(v); } catch { return v; } })()]) {
      if (꼴 && 꼴.length > 8) o = o.split(꼴).join('‹열쇠›');
    }
  }
  return o.replace(/\s+/g, ' ').trim();
};

function 까닭(t) {
  const m = String(t).match(/<returnAuthMsg>([^<]*)<\/returnAuthMsg>|"returnAuthMsg"\s*:\s*"([^"]*)"/);
  if (m) return m[1] || m[2];
  const r = String(t).match(/<returnReasonCode>([^<]*)<\/returnReasonCode>/);
  return r ? 'reasonCode ' + r[1] : '';
}
function 어떤가(글, code) {
  const a = 까닭(글);
  if (/LIMITED_NUMBER_OF_SERVICE_REQUESTS|한도/.test(a + 글)) return '△ 하루 한도 (열쇠는 삶)';
  if (a) return '✗ ' + a;
  if (code !== 200) return '✗ HTTP ' + code;
  if (/"resultCode"\s*:\s*"?200|성공|"totalCount"/.test(글)) return '○ 살아 있음';
  return '? ' + 글.slice(0, 40);
}

console.log('\n어느 열쇠가 어디서 되나 — **응답 원문을 함께 찍습니다**\n');
const 모든값 = Object.values(열쇠).filter(Boolean);
const 표 = [];
for (const [이름, u] of 곳) {
  for (const [k, v] of Object.entries(열쇠)) {
    if (!v) continue;
    for (const [꼴이름, 값] of 꼴들(v)) {
      let code = 0, 글 = '';
      try {
        const r = await fetch(u + '&serviceKey=' + 값, { headers: { accept: 'application/json' } });
        code = r.status; 글 = 지우기(await r.text(), 모든값).slice(0, 600);
      } catch (e) { 글 = String(e.message); }
      표.push({ API: 이름, 열쇠: k, 보낸꼴: 꼴이름, 결과: 어떤가(글, code) });
      console.log('── ' + 이름 + ' · ' + k + ' · ' + 꼴이름 + '  (HTTP ' + code + ')');
      console.log('   ' + 글.slice(0, 400) + '\n');
      await new Promise((y) => setTimeout(y, 400));
    }
  }
}
console.table(표);

console.log('\n읽는 법 —');
console.log('  SERVICE_KEY_IS_NOT_REGISTERED_ERROR  열쇠가 죽었거나 그 API 에 신청이 안 됨');
console.log('  세 꼴 중 하나만 ○ 이면 → 죽은 게 아니라 **인코딩을 잘못 보내고 있던 것**');
console.log('  세 꼴 다 ✗ 이면     → 열쇠가 죽었거나 활용신청이 끊긴 것. 재발급이 답');
