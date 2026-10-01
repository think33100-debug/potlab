/* 공공데이터포털 — **서비스(활용신청)마다** 옛 열쇠와 새 열쇠의 하루 한도를 잽니다.
 *
 *   node tools/서비스별한도.mjs
 *
 * ── 왜 만드나 (2026-09-30) ───────────────────────────────────
 * 재발급한 새 열쇠가 알리오 상세에서 429 를 냈습니다.
 * 세중님이 포털 화면을 보여주셨는데 그 서비스는 **운영계정 · 일일 10만**이었습니다.
 * 그러면 한도가 낮을 까닭이 없습니다. 그래서 가려야 할 것이 둘입니다 —
 *
 *   ㉮ 열쇠 자체 문제   새 열쇠는 **어느 서비스에서나** 1,000 이다
 *   ㉯ 서비스별 차이     서비스마다 한도가 다르고, 어쩌다 낮은 것을 짚었다
 *
 * 서비스마다 두 열쇠를 **한 번씩만** 부르고 응답 헤더를 견주면 갈립니다.
 *
 *     x-ratelimit-limit       그 열쇠·그 서비스의 하루 한도
 *     x-ratelimit-remaining   오늘 남은 횟수
 *
 * 대조군으로 **개발계정인 게 확실한 서비스**(행안부 신규채용현황)도 넣습니다.
 * 운영계정 셋과 견주면 한도가 어디에 붙어 있는지 바로 보입니다.
 *
 * 간격과 재시도는 공공데이터부르기.mjs 가 맡습니다.
 * **값은 한 글자도 안 찍습니다.** 지문만 보여 줍니다.
 */
import fs from 'node:fs';
import crypto from 'node:crypto';
import { 공공부르기, 포털오류, 한도알리기, 한도들 } from './공공데이터부르기.mjs';

const 지문 = (v) => (v ? crypto.createHash('sha256').update(v).digest('hex').slice(0, 10) : '—');

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

/* .env 를 **먼저** 봅니다 (2026-10-01 에 뒤집었습니다).
   전에는 gas/wage.js 를 먼저 봐서, .env 에 새 열쇠가 있어도
   죽은 옛 열쇠의 한도를 재고 있었습니다. */
const 열쇠들 = [
  ['지금 쓰는 열쇠', env.CLEANEYE_KEY || env.ALIO_DETAIL_KEY
    || 꺼내(/const JOB2_API = \{[\s\S]*?KEY:\s*'([^']+)'/) || ''],
].filter(([, v]) => v);

const 날 = (d) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);
const 올해 = new Date().getFullYear();

/* 서비스(활용신청) → 그 서비스가 주는 엔드포인트들.
   주소·인자는 gas/wage.js 와 tools/*.mjs 에서 꺼냈습니다 — 짐작하지 않았습니다 */
const 서비스 = [
  {
    이름: '재정경제부_공공기관 채용정보 조회서비스', 계정: '운영(10만)',
    곳: [
      ['/list  (알리오 목록)', 'https://apis.data.go.kr/1051000/recruitment/list?numOfRows=1&pageNo=1&resultType=json'],
      ['/detail(알리오 상세)', 'https://apis.data.go.kr/1051000/recruitment/detail?resultType=json&sn=296899'],
    ],
    쓰는곳: 'gas JOB_API·ALIO_D · tools/collect-alio.mjs · alio-compete · alio-post-file · alio-web-check',
  },
  {
    이름: '행안부 한국지역정보개발원_채용정보 조회 서비스', 계정: '운영',
    곳: [
      ['openXmlEmployInfo', 'https://apis.data.go.kr/B551982/openApiEmployInfo/openXmlEmployInfo?type=xml&sidoCd=007001&numOfRows=1'],
    ],
    쓰는곳: 'gas JOB2_API · tools/collect-cleaneye.mjs  ← 클린아이 수집기가 부르는 곳',
  },
  {
    이름: '행안부 …_신규채용현황 조회 서비스', 계정: '개발(대조군)',
    곳: [
      ['openXmlNewHire2', 'https://apis.data.go.kr/B551982/openApiNewHire2/openXmlNewHire2?numOfRows=1&pageNo=1&year=' + 올해],
    ],
    쓰는곳: '안 씁니다 (gas 의 probeNewHire_ 는 손으로 한 번 두드려 본 진단 함수)',
  },
  {
    이름: '인사혁신처_공공취업정보 조회 서비스', 계정: '운영',
    곳: [
      ['PblJobService/getList', 'https://apis.data.go.kr/1760000/PblJobService/getList?pageNo=1&numOfRows=1&Begin_de=' + 날(-30) + '&End_de=' + 날(1)],
    ],
    쓰는곳: 'gas JOB3_API (나라일터)',
  },
  {
    이름: '그 밖 — 개발계정으로 보이는 것들', 계정: '개발?',
    곳: [
      ['심평원 병원정보', 'https://apis.data.go.kr/B551182/hospInfoServicev2/getHospBasisList?numOfRows=1&pageNo=1&_type=json'],
      ['부산 채용', 'https://apis.data.go.kr/6260000/BusanJobOpnngInfoService/getJobOpnngInfo?pageNo=1&numOfRows=1&resultType=json'],
      ['경남 채용', 'http://apis.data.go.kr/6480000/gyeongnamwork/gyeongnamworkList?pageNo=1&numOfRows=1&resultType=json'],
      ['자원봉사 VMS', 'https://apis.data.go.kr/B460014/vmsdataview/getVollcolectionList?numOfRows=1&pageNo=1&strDate=' + 날(0) + '&endDate=' + 날(60) + '&areaCode=0101'],
      ['발달재활', 'https://api.data.go.kr/openapi/tn_pubr_public_developmental_rehabilitation_service_provider_api?type=json&pageNo=1&numOfRows=1'],
      ['자격시험 일정', 'https://apis.data.go.kr/B490007/qualExamSchd/getQualExamSchdList?dataFormat=json&implYy=' + 올해 + '&qualgbCd=T'],
    ],
    쓰는곳: 'gas VOL_API · DRS_API · EXAM_API · RG(부산·경남) · tools/hira.js',
  },
];

console.log('서비스별 하루 한도 — ' + new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }));
console.log('값은 안 찍습니다. ' + 열쇠들.map(([n, v]) => n + ' ' + 지문(v)).join(' · ') + '\n');

const 표 = [];
for (const s of 서비스) {
  console.log('━━ ' + s.이름 + '  [' + s.계정 + ']');
  console.log('   쓰는 곳 — ' + s.쓰는곳);
  for (const [기능, u] of s.곳) {
    const 줄 = { 서비스: s.계정, 기능 };
    for (const [이름, 값] of 열쇠들) {
      const r = await 공공부르기(u + '&serviceKey=' + 값, { 간격: 1500, 최대다시: 1, 떠들기: false });
      const 오류 = 포털오류(r.글);
      줄[이름 + ' 한도'] = r.한도;
      줄[이름 + ' 남음'] = r.남음;
      줄[이름] = r.code === 200 ? '○' : ('✗ ' + (오류 || r.code));
      console.log('   ' + 기능.padEnd(22) + 이름 + '  HTTP ' + String(r.code).padEnd(5)
        + '한도 ' + String(r.한도).padEnd(9) + '남음 ' + String(r.남음).padEnd(9)
        + (오류 || ''));
    }
    표.push(줄);
  }
  console.log();
}

console.table(표);

const 갈래 = (이름) => [...new Set(표.map((x) => x[이름 + ' 한도']).filter((v) => v && v !== '—'))];
console.log('\n갈라 읽기 —');
for (const [이름] of 열쇠들) console.log('  ' + 이름.padEnd(16) + '한도 갈래 : ' + 갈래(이름).join(' · '));
const 새한도 = 갈래('새 열쇠'), 옛한도 = 갈래('지금 쓰는 열쇠');
if (새한도.length === 1 && 옛한도.length > 1) {
  console.log('  → 새 열쇠는 **어느 서비스에서나 같은 한도**입니다. 서비스 탓이 아니라 **열쇠 탓**입니다');
} else if (새한도.length > 1) {
  console.log('  → 새 열쇠도 서비스마다 한도가 다릅니다. **서비스별 차이**입니다');
} else {
  console.log('  → 갈래가 하나씩뿐이라 아직 못 가릅니다');
}

/* 잰 값을 그대로 남깁니다 — 관리자 화면과 요약 메일이 이걸 봅니다.
   COLLECT_KEY 가 있는 곳(서버)에서 돌릴 때만 올라갑니다 */
const 남김 = await 한도알리기(process.env.POTJOB_경로 || "CE2");
console.log('');
console.log(남김.왜 ? '남기지 못했습니다 · ' + 남김.왜 : 'DB 에 ' + 남김.올림 + '줄 남겼습니다');
