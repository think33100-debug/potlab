/* 심평원 명세 확인 — 응답 원문과 항목 이름을 찍습니다 (쓰기 없음).
 *
 *   node tools/심평원_명세확인.mjs
 *
 * 왜 — 기관표의 「공공·대학·종별」 판정을 심평원 공식 값으로만 하기로 했습니다
 * (작업지침 10-3). 어느 operation 이 어느 칸을 주는지 **원문으로** 확인합니다.
 * 작업지침 2절 — 진단 함수는 응답 원문 500~1,200자와 Object.keys 를 함께 찍습니다.
 *
 * 열쇠는 web/.env.local 의 HIRA_KEY_ENC 에서 읽고 **화면에 찍지 않습니다.**
 * 주소도 찍지 않습니다 (주소에 열쇠가 붙습니다).
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.join(import.meta.dirname, '..');
const env = (f) => {
  const o = {};
  if (!fs.existsSync(f)) return o;
  for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) o[m[1]] = m[2].trim().replace(/^"|"$/g, '');
  }
  return o;
};
const cfg = { ...env(path.join(ROOT, '.env.local')), ...env(path.join(ROOT, 'web', '.env.local')) };
const KEY = cfg.HIRA_KEY_ENC;
if (!KEY) { console.error('web/.env.local 에 HIRA_KEY_ENC 가 없습니다.'); process.exit(1); }

/* 심평원 열쇠는 이미 URL 인코딩돼 있습니다 — 다시 인코딩하면 %2B 가 %252B 가 됩니다 */
const ORG = 'https://apis.data.go.kr/B551182/hospInfoServicev2/getHospBasisList';
const DTL = 'https://apis.data.go.kr/B551182/MadmDtlInfoService2.8';

async function 두드리기(이름, url) {
  console.log('\n' + '━'.repeat(70));
  console.log('■ ' + 이름);
  console.log('━'.repeat(70));
  let t = '';
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'potjob/1.0' } });
    t = await r.text();
    console.log('HTTP ' + r.status);
  } catch (e) {
    console.log('못 불렀습니다 — ' + e.message);
    return null;
  }
  console.log('── 응답 원문 (앞 1,200자) ──');
  console.log(t.slice(0, 1200));

  let j = null;
  try { j = JSON.parse(t); } catch { console.log('\n(JSON 이 아닙니다 — XML 이나 오류)'); return null; }
  const hd = j?.response?.header ?? {};
  console.log('\nresultCode ' + hd.resultCode + ' · resultMsg ' + hd.resultMsg
    + ' · totalCount ' + (j?.response?.body?.totalCount ?? '(없음)'));
  const it = j?.response?.body?.items?.item;
  const rows = it == null || it === '' ? [] : (Array.isArray(it) ? it : [it]);
  console.log('줄 수 ' + rows.length);
  if (rows.length) {
    console.log('── 항목 이름 (Object.keys) ──');
    console.log(Object.keys(rows[0]).join(' · '));
  }
  return rows;
}

const 목록 = await 두드리기('① 병원정보서비스 getHospBasisList (1건)',
  `${ORG}?serviceKey=${KEY}&numOfRows=1&pageNo=1&_type=json`);

/* 상세는 ykiho 가 있어야 돕니다. 목록이 준 첫 기관으로 그대로 이어 봅니다 */
const ykiho = 목록?.[0]?.ykiho;
if (!ykiho) { console.log('\nykiho 를 못 받아 상세는 건너뜁니다.'); process.exit(0); }
console.log('\n이어서 쓸 기관 — ' + (목록[0].yadmNm ?? '(이름 없음)')
  + ' · 종별 ' + 목록[0].clCdNm + '(' + 목록[0].clCd + ')');

const q = (op) => `${DTL}/${op}?serviceKey=${KEY}&ykiho=${encodeURIComponent(ykiho)}`
  + '&numOfRows=50&pageNo=1&_type=json';

for (const op of ['getEqpInfo2.8', 'getEtcHstInfo2.8', 'getSpcSbjtSdrInfo2.8']) {
  await 두드리기('② 의료기관별상세정보 ' + op, q(op));
  await new Promise((r) => setTimeout(r, 400));
}
