/* 한국천문연구원 특일 정보 — 우리 열쇠로 되는지 두드려 봅니다 (2026-10-05).
 *
 *  왜 — 수집기 박동이 주말·공휴일에 빨간 줄을 띄웁니다. 요일은 날짜로 알지만
 *  공휴일은 자료가 있어야 합니다. 손으로 표를 채우기 전에 **API 가 되는지**
 *  먼저 봅니다 (세중님 지시).
 *
 *  공식 명세 (data.go.kr publicDataPk=15012690) —
 *    서비스명  한국천문연구원_특일 정보
 *    상세기능  기념일 · **공휴일** · 국경일 · 24절기 · 잡절  (다섯)
 *    한도      개발계정 10,000/일 · 운영계정은 신청 시 상향
 *    승인      개발·운영 **둘 다 자동승인** (심의 없음)
 *    주소      https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo
 *    필수변수  ServiceKey · pageNo · numOfRows · solYear
 *
 *  ⚷ 열쇠 값은 안 찍습니다. 읽기만 하고 DB 에 안 씁니다.
 *
 *  쓰는 법   node tools/공휴일_열쇠확인.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
const cfg = { ...읽기(path.join(ROOT, '.env')),
  ...읽기(path.join(ROOT, '.env.local')),
  ...읽기(path.join(ROOT, '.env.server')), ...process.env };

const URL_ = 'https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo';
/* 우리가 가진 공공데이터 열쇠들. data.go.kr 열쇠는 **계정 것**이라
   한 서비스에 활용신청이 되어 있으면 다른 열쇠로도 될 수 있습니다 */
const 열쇠들 = ['ALIO_LIST_KEY', 'ALIO_DETAIL_KEY', 'YOUTH_KEY', 'WORK_KEY',
  'CLEANEYE_KEY', 'WATCH_KEY'];

console.log('특일 정보(공휴일) 열쇠 확인 · '
  + new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }));
console.log('주소 ' + URL_ + '\n');

for (const 이름 of 열쇠들) {
  const k = cfg[이름];
  if (!k) { console.log('  ' + 이름.padEnd(18) + '없음'); continue; }
  const u = URL_ + '?serviceKey=' + encodeURIComponent(k)
    + '&solYear=2026&numOfRows=100&pageNo=1';
  let code = 0, 글 = '';
  try {
    const r = await fetch(u, { headers: { Accept: 'application/xml' } });
    code = r.status; 글 = await r.text();
  } catch (e) { 글 = String(e.message); }
  /* 열쇠가 응답에 되비쳐 나올 수 있어 가립니다 */
  const 가린 = 글.split(k).join('‹열쇠›').split(encodeURIComponent(k)).join('‹열쇠›');
  const 결과 = (가린.match(/<resultCode>([^<]*)<\/resultCode>/) || [])[1]
    || (가린.match(/<returnReasonCode>([^<]*)<\/returnReasonCode>/) || [])[1] || '?';
  const 말 = (가린.match(/<resultMsg>([^<]*)<\/resultMsg>/) || [])[1]
    || (가린.match(/<returnAuthMsg>([^<]*)<\/returnAuthMsg>/) || [])[1] || '';
  const 건수 = (가린.match(/<totalCount>(\d+)<\/totalCount>/) || [])[1] || '-';
  console.log('  ' + 이름.padEnd(18) + '(' + k.length + '자) HTTP ' + code
    + ' · resultCode ' + 결과 + ' · ' + 말 + ' · totalCount ' + 건수);
  if (결과 === '00' || 결과 === '0') {
    console.log('\n   ★ 됩니다. 응답 원문 앞 1,000자 —');
    console.log(가린.slice(0, 1000));
    const 날들 = [...가린.matchAll(/<locdate>(\d{8})<\/locdate>\s*(?:<[^>]*>[^<]*<\/[^>]*>\s*)*/g)];
    const 이름들 = [...가린.matchAll(/<dateName>([^<]*)<\/dateName>/g)].map((m) => m[1]);
    console.log('\n   2026년 공휴일 ' + 건수 + '건 · 이름 — ' + [...new Set(이름들)].join(' · '));
    process.exit(0);
  }
  console.log('     응답 앞 300자 — ' + 가린.replace(/\s+/g, ' ').slice(0, 300));
  await new Promise((f) => setTimeout(f, 500));
}

console.log('\n★ 가진 열쇠로는 안 됩니다. 활용신청이 필요합니다 (자동승인).');
