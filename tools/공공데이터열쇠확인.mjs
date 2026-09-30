/* 공공데이터포털 인증키가 어디서 살아 있는지 두드려 봅니다 (2026-09-30).
 *
 *   node tools/공공데이터열쇠확인.mjs
 *
 * 세중님 물음 — 「인증키 쓰는 곳 전부 알려줘. 바꾸면 옛 수집기도 멈추는지.」
 *
 * 공공데이터포털은 계정마다 **일반 인증키 하나**를 주고, 그 하나를 모든
 * 활용신청에 씁니다. 그래서 재발급하면 **그 계정으로 신청한 API 가 전부** 멈춥니다.
 *
 * ── 아홉 가지를 다 두드립니다 ────────────────────────────────
 * 전에는 세 가지만 봤고, 그나마 하나는 이름표가 틀려 있었습니다
 * (「지방공공기관(클린아이)」 라고 적고 알리오 주소를 두드렸습니다).
 * 아래 주소와 인자는 **짐작이 아니라 `gas/wage.js` 에서 꺼낸 것**입니다.
 *
 * ── 응답 원문을 찍습니다 (CLAUDE.md 2번) ─────────────────────
 * 「✗ 열쇠 안 먹음」 만 찍는 것은 진단이 아닙니다.
 * 포털은 까닭을 <returnAuthMsg> 에 적어 줍니다 —
 *   SERVICE_KEY_IS_NOT_REGISTERED_ERROR   열쇠가 죽었거나 그 API 에 신청이 안 됨
 *   SERVICE_ACCESS_DENIED_ERROR           활용신청이 반려/중지됨
 *   LIMITED_NUMBER_OF_SERVICE_REQUESTS…   하루 한도 (열쇠는 살아 있음)
 *
 * **값은 한 글자도 안 찍습니다.** 지문(앞 10자리)만 보여 줍니다.
 */
import fs from 'node:fs';
import crypto from 'node:crypto';

const env = {};
for (const f of ['.env.local', '.env.server', 'web/.env.local']) {
  if (!fs.existsSync(f)) continue;
  fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((l) => {
    const m = l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*?)\s*$/);
    if (m && m[2]) env[m[1]] = m[2].replace(/^'|'$/g, '');
  });
}
const gas = fs.existsSync('gas/wage.js') ? fs.readFileSync('gas/wage.js', 'utf8') : '';
const 꺼내 = (re) => (gas.match(re) || [])[1] || '';

const 열쇠 = {
  ALIO_LIST_KEY: env.ALIO_LIST_KEY || 꺼내(/const JOB_API = \{[\s\S]*?KEY:\s*'([^']+)'/),
  ALIO_DETAIL_KEY: env.ALIO_DETAIL_KEY || 꺼내(/const JOB3_API = \{[\s\S]*?KEY:\s*'([^']+)'/),
  CLEANEYE_KEY: env.CLEANEYE_KEY || 꺼내(/const JOB2_API = \{[\s\S]*?KEY:\s*'([^']+)'/),
  HIRA_KEY_ENC: env.HIRA_KEY_ENC || '',
};
const 지문 = (v) => (v ? crypto.createHash('sha256').update(v).digest('hex').slice(0, 10) : '—');

/* 날짜 인자가 **필수**인 API 가 있습니다 (VMS 는 셋 다 없으면 「잘못된 요청 파라메터」) */
const 날 = (d) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);
const 올해 = new Date().getFullYear();

/* 아홉 가지 — 주소와 인자는 gas/wage.js 에서 꺼냈습니다 */
const 곳 = [
  ['① 알리오 목록',
    'https://apis.data.go.kr/1051000/recruitment/list?numOfRows=1&pageNo=1&resultType=json'],
  ['② 알리오 상세',
    'https://apis.data.go.kr/1051000/recruitment/detail?resultType=json&sn=296899'],
  ['③ 지방공공기관(클린아이)',
    'https://apis.data.go.kr/B551982/openApiEmployInfo/openXmlEmployInfo?type=xml&sidoCd=007001'],
  ['④ 나라일터',
    'https://apis.data.go.kr/1760000/PblJobService/getList?pageNo=1&numOfRows=1'
    + '&Begin_de=' + 날(-30) + '&End_de=' + 날(1)],
  ['⑤ 부산 채용',
    'https://apis.data.go.kr/6260000/BusanJobOpnngInfoService/getJobOpnngInfo'
    + '?pageNo=1&numOfRows=1&resultType=json'],
  ['⑤ 경남 채용',
    'http://apis.data.go.kr/6480000/gyeongnamwork/gyeongnamworkList'
    + '?pageNo=1&numOfRows=1&resultType=json'],
  ['⑥ 심평원 병원정보',
    'https://apis.data.go.kr/B551182/hospInfoServicev2/getHospBasisList'
    + '?numOfRows=1&pageNo=1&_type=json'],
  ['⑦ 자원봉사 VMS',
    'https://apis.data.go.kr/B460014/vmsdataview/getVollcolectionList'
    + '?numOfRows=1&pageNo=1&strDate=' + 날(0) + '&endDate=' + 날(60) + '&areaCode=0101'],
  ['⑧ 발달재활 제공기관',
    'https://api.data.go.kr/openapi/tn_pubr_public_developmental_rehabilitation_service_provider_api'
    + '?type=json&pageNo=1&numOfRows=1'],
  ['⑨ 자격시험 일정',
    'https://apis.data.go.kr/B490007/qualExamSchd/getQualExamSchdList'
    + '?dataFormat=json&implYy=' + 올해 + '&qualgbCd=T'],
];

/* 인코딩을 두 번 했나? — 포털은 열쇠를 두 꼴로 줍니다.
     Decoding 꼴  `abc+/=…`       → 주소에 넣을 때 encodeURIComponent 해야 함
     Encoding 꼴  `abc%2B%2F%3D…` → 그대로 넣어야 함. 또 감싸면 %252B 가 되어 죽음 */
const 꼴들 = (v) => {
  const 감싼것 = encodeURIComponent(v);
  let 푼것 = v; try { 푼것 = decodeURIComponent(v); } catch { /* 못 풀면 그대로 */ }
  const 목록 = [['그대로', v]];
  if (감싼것 !== v) 목록.push(['한 번 더 감쌈', 감싼것]);
  if (푼것 !== v) 목록.push(['한 번 풂', 푼것]);
  return 목록;
};

/* 응답에 열쇠가 되비칠 수 있어 지웁니다 — 값은 한 글자도 안 찍습니다 */
const 지우기 = (t, 값들) => {
  let o = String(t);
  for (const v of 값들) {
    let 푼 = v; try { 푼 = decodeURIComponent(v); } catch { /* 그대로 */ }
    for (const 꼴 of [v, encodeURIComponent(v), 푼]) {
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
  /* 성공 표시는 API 마다 다릅니다 — 하나라도 보이면 열쇠는 통과한 것입니다 */
  if (/"resultCode"\s*:\s*"?0*200|<resultCode>0*<|성공|정상|"totalCount"|<totalCount>|NORMAL[_ ]SERVICE/i.test(글)) {
    return '○ 살아 있음';
  }
  return '? ' + 글.slice(0, 40);
}

console.log('공공데이터포털 인증키 — 값은 안 찍습니다. 지문으로만 봅니다\n');
console.log('열쇠'.padEnd(18) + '길이'.padEnd(6) + '꼴'.padEnd(12) + '지문');
console.log('─'.repeat(56));
for (const [k, v] of Object.entries(열쇠)) {
  if (!v) { console.log(k.padEnd(18) + '—'); continue; }
  console.log(k.padEnd(18) + String(v.length).padEnd(6)
    + (/%[0-9A-F]{2}/i.test(v) ? 'Encoding' : 'Decoding').padEnd(12) + 지문(v));
}

const 같은것 = {};
for (const [k, v] of Object.entries(열쇠)) { if (!v) continue; (같은것[지문(v)] ||= []).push(k); }
console.log('\n같은 열쇠끼리 묶으면 —');
for (const [f, ks] of Object.entries(같은것)) console.log('  ' + f + '  ' + ks.join(' = '));

/* 값이 같은 열쇠는 한 번만 두드립니다 — 재발급 뒤엔 넷이 다 같은 값입니다 */
const 두드릴것 = Object.entries(같은것).map(([f, ks]) => [ks.join('='), 열쇠[ks[0]], f]);

console.log('\n어느 열쇠가 어디서 되나 — **응답 원문을 함께 찍습니다**\n');
const 모든값 = Object.values(열쇠).filter(Boolean);
const 표 = [];
const 된곳 = new Set();
for (const [이름, u] of 곳) {
  for (const [별명, 값, 핑거] of 두드릴것) {
    for (const [꼴이름, 쏠것] of 꼴들(값)) {
      let code = 0, 글 = '';
      try {
        const r = await fetch(u + '&serviceKey=' + 쏠것, { headers: { accept: 'application/json' } });
        code = r.status; 글 = 지우기(await r.text(), 모든값).slice(0, 600);
      } catch (e) { 글 = String(e.message); }
      const 판정 = 어떤가(글, code);
      if (판정.startsWith('○') || 판정.startsWith('△')) 된곳.add(이름);
      표.push({ API: 이름, 열쇠: 핑거, 보낸꼴: 꼴이름, 결과: 판정 });
      console.log('── ' + 이름 + ' · ' + 별명.slice(0, 28) + ' · ' + 꼴이름 + '  (HTTP ' + code + ')');
      console.log('   ' + 글.slice(0, 300) + '\n');
      await new Promise((y) => setTimeout(y, 350));
      /* 「그대로」 가 되면 나머지 꼴은 안 두드립니다 — 부질없는 호출을 아낍니다 */
      if (꼴이름 === '그대로' && 판정.startsWith('○')) break;
    }
  }
}
console.table(표);

console.log('\n' + 된곳.size + ' / ' + 곳.length + '가지에서 열쇠가 통했습니다'
  + (된곳.size === 곳.length ? '  ○ 빠진 곳 없습니다 (부산·경남을 따로 세어 10줄입니다)' : '  ★ 안 되는 곳이 있습니다 — '
    + 곳.map((x) => x[0]).filter((n) => !된곳.has(n)).join(' · ')));
console.log('\n읽는 법 —');
console.log('  SERVICE_KEY_IS_NOT_REGISTERED_ERROR  열쇠가 죽었거나 그 API 에 신청이 안 됨');
console.log('  「그대로」 만 ○ 이면    → Encoding 꼴이 맞습니다. 그대로 붙여야 합니다');
console.log('  세 꼴 다 ✗ 이면       → 열쇠가 죽었거나 활용신청이 끊긴 것. 재발급이 답');
