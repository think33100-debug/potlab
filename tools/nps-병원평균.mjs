/* ═══════════════════════════════════════════════════════════════
 *  국민연금 가입 사업장 자료로 병원 전체 평균 연봉을 **추정**해 봅니다 (마른 실행 · 2026-11-12)
 *  세중님 「기관 평균 연봉 공시하는 거 · 국민연금 · api 로 가자」 · 멘토 1차 답변 18쪽(2.5~2.7) · 멘토-1.5-4 · 멘토-2.5-1
 * ═══════════════════════════════════════════════════════════════
 *
 *  ★ 이 도구는 **아무것도 담지 않습니다.** 병원마다 찾은 사업장과 추정값을 표로 찍고
 *    tmp/nps-병원평균_<날짜>.json 에 남길 뿐입니다. DB 표·화면은 결과를 보고 세중님이 정한 뒤에 만듭니다.
 *
 *  쓰는 법 (서버에서 · NPS_KEY 가 ~/potlab/.env 에 있어야 합니다)
 *    node tools/nps-병원평균.mjs --원문            첫 병원 하나로 세 기능의 응답 원문·칸 이름을 찍습니다 (처음 한 번 꼭)
 *    node tools/nps-병원평균.mjs                   아래 견본 20곳
 *    node tools/nps-병원평균.mjs --이름 삼성서울병원,부산광역시의료원
 *    node tools/nps-병원평균.mjs --n 5             앞 5곳만
 *
 *  어디서 받는가 — 공공데이터포털 「국민연금공단_국민연금 가입 사업장 내역」 오픈 API
 *    https://apis.data.go.kr/B552015/NpsBplcInfoInqireServiceV2
 *      getBassInfoSearchV2        사업장 기본정보 — wkplNm(사업장명 · 필수) · ldongAddrMgplDgCd(법정동 시도 2자리) 로 찾기 → seq
 *      getDetailInfoSearchV2      상세 — seq → 가입자 수 · 당월 고지금액
 *      getPdAcctoSttusInfoSearchV2 기간별 현황 — seq · dataCrtYm(yyyymm) → 신규 취득자 수 · 상실 가입자 수
 *    세 기능 이름은 2026-11-12 열쇠 없이 두드려 확인했습니다(맞는 이름 → SERVICE_KEY_IS_NULL · 틀린 이름 → NO_OPENAPI_SERVICE_ERROR).
 *    ⚠ **응답 칸 이름은 아직 원문으로 확인하지 못했습니다** (지침 2·5절). 아래 칸() 은 알려진 이름 몇 가지를 차례로 봅니다.
 *      --원문 으로 한 번 찍어 보고, 다르면 칸이름 표만 고칩니다.
 *
 *  계산 (멘토 2.6) — 당월 고지금액 ÷ 가입자 수 ÷ 보험료율(2026년 9.5%) = 1인 평균 기준소득월액, ×12 = 추정 평균 연봉
 *  한계 (화면에 꼭 밝힐 것 · 멘토 2.7)
 *    ① 의사·간호사·행정직이 다 섞인 **병원 전체 평균** — 치료사 연봉이 아님
 *    ② 기준소득월액 상한(2025.7~2026.6 월 637만 원) — 그 위는 637만 원으로 계산돼 큰 병원일수록 낮게 나옴
 *    ③ 학교법인 병원 직원은 **사학연금**, 공무원은 **공무원연금** — 국민연금 자료에서 빠질 수 있음(가입자 수가 규모보다 작으면 의심)
 *    ④ 사업자번호 앞 6자리만 공개 — 이름·주소로 잇고, 애매하면 사람이 봄
 *
 *  얼마나 드는가 — 병원 하나에 찾기 1~3번 + 상세 1번 + 기간별 12번(최근 1년). 견본 20곳이면 300번 안팎.
 *
 *  열쇠
 *    NPS_KEY   공공데이터포털 인증키. **이 도구는 값을 찍지 않습니다** — 원문을 찍을 때도 serviceKey 를 가립니다.
 *              인코딩된 값(% 가 있음)이면 그대로, 아니면 encodeURIComponent 로 감쌉니다.
 * ═══════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(여기, '..');

/* .env 는 셸에 먹이지 않고 node 로 읽습니다 (지침 8-12) */
const 읽기 = (f) => {
  const o = {};
  if (!fs.existsSync(f)) return o;
  for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) o[m[1]] = m[2].trim().replace(/^(['"])([\s\S]*)\1$/, '$2').trim();
  }
  return o;
};
const cfg = { ...읽기(path.join(ROOT, '.env.local')), ...읽기(path.join(ROOT, '.env')), ...process.env };
const 열쇠 = cfg.NPS_KEY || '';
if (!열쇠) {
  console.error('NPS_KEY 가 없습니다 — 서버 ~/potlab/.env 에 NPS_KEY=… 한 줄을 넣어 주세요 (값은 여기에 찍지 않습니다)');
  process.exit(2);
}
const 열쇠붙임 = /%[0-9A-Fa-f]{2}/.test(열쇠) ? 열쇠 : encodeURIComponent(열쇠);
const 가림 = (s) => String(s).split(열쇠).join('‹열쇠›').split(열쇠붙임).join('‹열쇠›');

const API = 'https://apis.data.go.kr/B552015/NpsBplcInfoInqireServiceV2';
const 보험료율 = 0.095;        // 2026년 (멘토 2.6)
const 상한월액 = 6_370_000;     // 2025.7~2026.6 기준소득월액 상한 (data.go.kr 3046071 안내)

/* 법정동 시도 코드 앞 2자리 — 찾기를 좁히는 데만 씁니다(없어도 찾습니다) */
const 시도코드 = {
  서울: '11', 부산: '26', 대구: '27', 인천: '28', 광주: '29', 대전: '30', 울산: '31', 세종: '36',
  경기: '41', 강원: '51', 충북: '43', 충남: '44', 전북: '52', 전남: '46', 경북: '47', 경남: '48', 제주: '50',
};

/* 견본 20곳 — 운영 형태가 다른 곳을 섞었습니다(사학연금이 빠지는지 보려고).
   찾는말: 국민연금 사업장명은 법인 이름으로 올라 있는 일이 많아 몇 가지를 차례로 찾습니다 */
const 견본 = [
  { 이름: '서울대학교병원', 시도: '서울', 찾는말: ['서울대학교병원'], 갈래: '국립대병원' },
  { 이름: '분당서울대학교병원', 시도: '경기', 찾는말: ['분당서울대학교병원', '서울대학교병원'], 갈래: '국립대병원' },
  { 이름: '경북대학교병원', 시도: '대구', 찾는말: ['경북대학교병원'], 갈래: '국립대병원' },
  { 이름: '전남대학교병원', 시도: '광주', 찾는말: ['전남대학교병원'], 갈래: '국립대병원' },
  { 이름: '충남대학교병원', 시도: '대전', 찾는말: ['충남대학교병원'], 갈래: '국립대병원' },
  { 이름: '부산광역시의료원', 시도: '부산', 찾는말: ['부산광역시의료원', '부산의료원'], 갈래: '지방의료원' },
  { 이름: '국립중앙의료원', 시도: '서울', 찾는말: ['국립중앙의료원'], 갈래: '특수법인' },
  { 이름: '국민건강보험공단 일산병원', 시도: '경기', 찾는말: ['국민건강보험공단 일산병원', '일산병원'], 갈래: '공단' },
  { 이름: '근로복지공단 인천병원', 시도: '인천', 찾는말: ['근로복지공단 인천병원', '인천병원'], 갈래: '공단' },
  { 이름: '국립재활원', 시도: '서울', 찾는말: ['국립재활원'], 갈래: '국가기관(공무원연금 섞임)' },
  { 이름: '서울특별시 보라매병원', 시도: '서울', 찾는말: ['보라매병원'], 갈래: '시립(위탁)' },
  { 이름: '삼성서울병원', 시도: '서울', 찾는말: ['삼성서울병원', '삼성생명공익재단'], 갈래: '재단' },
  { 이름: '서울아산병원', 시도: '서울', 찾는말: ['서울아산병원', '아산사회복지재단'], 갈래: '재단' },
  { 이름: '세브란스병원', 시도: '서울', 찾는말: ['세브란스병원', '연세대학교의료원', '연세대학교'], 갈래: '학교법인(사학연금?)' },
  { 이름: '강남세브란스병원', 시도: '서울', 찾는말: ['강남세브란스병원', '세브란스'], 갈래: '학교법인(사학연금?)' },
  { 이름: '고려대학교 안암병원', 시도: '서울', 찾는말: ['고려대학교안암병원', '고려대학교 안암병원', '고려대학교의료원'], 갈래: '학교법인(사학연금?)' },
  { 이름: '가톨릭대학교 서울성모병원', 시도: '서울', 찾는말: ['서울성모병원', '가톨릭대학교'], 갈래: '학교법인(사학연금?)' },
  { 이름: '한양대학교병원', 시도: '서울', 찾는말: ['한양대학교병원', '한양대학교'], 갈래: '학교법인(사학연금?)' },
  { 이름: '영남대학교병원', 시도: '대구', 찾는말: ['영남대학교병원', '영남대학교의료원'], 갈래: '학교법인(사학연금?)' },
  { 이름: '원광대학교병원', 시도: '전북', 찾는말: ['원광대학교병원', '원광대학교'], 갈래: '학교법인(사학연금?)' },
];

const argv = process.argv.slice(2);
const 원문보기 = argv.includes('--원문');
const 값 = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const n = Number(값('--n')) || null;
const 이름들 = 값('--이름');
let 대상 = 이름들
  ? 이름들.split(',').map((s) => s.trim()).filter(Boolean).map((s) => ({ 이름: s, 시도: null, 찾는말: [s], 갈래: '직접' }))
  : 견본;
if (원문보기) 대상 = 대상.slice(0, 1);
if (n) 대상 = 대상.slice(0, n);

/* XML·JSON 어느 쪽이 와도 <item> 묶음을 칸 사전으로 바꿉니다 */
function 줄들(text) {
  const t = String(text || '');
  if (t.trim().startsWith('{')) {
    try {
      const j = JSON.parse(t);
      const it = j?.response?.body?.items?.item ?? [];
      return { 줄: Array.isArray(it) ? it : [it], 헤더: j?.response?.header ?? null };
    } catch { /* 아래 XML 로 */ }
  }
  const 줄 = [...t.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) =>
    Object.fromEntries([...m[1].matchAll(/<([A-Za-z0-9_]+)>([\s\S]*?)<\/\1>/g)].map((x) => [x[1], x[2].trim()])));
  const 결과코드 = t.match(/<resultCode>([^<]*)<\/resultCode>/)?.[1] ?? t.match(/<returnReasonCode>([^<]*)</)?.[1] ?? null;
  const 결과말 = t.match(/<resultMsg>([^<]*)<\/resultMsg>/)?.[1] ?? t.match(/<errMsg>([^<]*)</)?.[1] ?? null;
  return { 줄, 헤더: { 결과코드, 결과말 } };
}
/* 칸 이름을 아직 원문으로 확인하지 못했습니다 — 알려진 이름을 차례로 봅니다(--원문 으로 확인) */
const 칸이름 = {
  seq: ['seq'],
  사업장명: ['wkplNm'],
  주소: ['wkplRoadNmDtlAddr', 'wkplRoadNmAddr', 'wkplLtnoDtlAddr'],
  사업자번호: ['bzowrRgstNo'],
  가입자수: ['jnngpCnt', 'nwJnngpCnt'],
  고지금액: ['crrmmNtcAmt', 'ntcAmt'],
  취득: ['nwAcqzrCnt', 'acqzrCnt'],
  상실: ['lssJnngpCnt', 'lssJnngpcnt'],
  업종: ['vldtVlKrnNm', 'wkplIntpCdNm'],
  상태: ['wkplJnngStcd', 'wkplJnngStcdNm'],
};
const 칸 = (o, k) => { for (const c of 칸이름[k]) if (o?.[c] != null && o[c] !== '') return o[c]; return null; };
const 수 = (v) => (v == null || v === '' ? null : Number(String(v).replace(/,/g, '')));

let 부른수 = 0;
async function 부르기(기능, 변수) {
  const q = new URLSearchParams({ pageNo: '1', numOfRows: '50', ...변수 });
  const url = `${API}/${기능}?serviceKey=${열쇠붙임}&${q.toString()}`;
  부른수 += 1;
  const r = await fetch(url, { headers: { 'User-Agent': 'RAPO-collector (rapojob.co.kr)' } });
  const text = await r.text();
  if (원문보기) {
    console.log(`\n── ${기능} 원문 (HTTP ${r.status} · 앞 1,200자) ──\n${가림(text.slice(0, 1200))}`);
    const { 줄 } = 줄들(text);
    console.log(`── 칸 이름: ${줄[0] ? Object.keys(줄[0]).join(', ') : '(item 없음)'}`);
  }
  return { status: r.status, ...줄들(text) };
}

const 지난달들 = (k) => {
  const out = []; const d = new Date();
  for (let i = 1; i <= k; i++) { const x = new Date(d.getFullYear(), d.getMonth() - i, 1); out.push(`${x.getFullYear()}${String(x.getMonth() + 1).padStart(2, '0')}`); }
  return out;
};

const 결과 = [];
for (const h of 대상) {
  /* ① 찾기 — 찾는말을 차례로, 시도 코드가 있으면 좁혀서. 등록(1) 상태만 후보로 */
  let 후보 = [];
  for (const 말 of h.찾는말) {
    const v = { wkplNm: 말 };
    if (h.시도 && 시도코드[h.시도]) v.ldongAddrMgplDgCd = 시도코드[h.시도];
    const r = await 부르기('getBassInfoSearchV2', v);
    if (r.status !== 200) { console.error(`  ${h.이름}: 찾기 HTTP ${r.status} · ${JSON.stringify(r.헤더)}`); continue; }
    후보 = r.줄.filter((x) => String(칸(x, '상태') ?? '1') === '1');
    if (후보.length) break;
  }
  if (!후보.length) { 결과.push({ 이름: h.이름, 갈래: h.갈래, 찾음: false }); console.log(`✗ ${h.이름} — 국민연금 사업장에서 못 찾음 (${h.갈래})`); continue; }

  /* ② 후보마다 상세 — 가입자 수가 가장 큰 곳을 그 병원으로 봅니다(같은 이름의 작은 부속 사업장이 섞임). 후보 목록은 다 남깁니다 */
  const 상세들 = [];
  for (const c of 후보.slice(0, 5)) {
    const seq = 칸(c, 'seq');
    if (!seq) continue;
    const d = await 부르기('getDetailInfoSearchV2', { seq: String(seq) });
    const x = d.줄[0] ?? {};
    상세들.push({ seq, 사업장명: 칸(x, '사업장명') ?? 칸(c, '사업장명'), 주소: 칸(x, '주소') ?? 칸(c, '주소'),
      업종: 칸(x, '업종'), 가입자수: 수(칸(x, '가입자수')), 고지금액: 수(칸(x, '고지금액')) });
  }
  상세들.sort((a, b) => (b.가입자수 ?? -1) - (a.가입자수 ?? -1));
  const 고른 = 상세들[0];
  if (!고른 || !고른.가입자수 || !고른.고지금액) { 결과.push({ 이름: h.이름, 갈래: h.갈래, 찾음: true, 후보: 상세들, 값없음: true }); console.log(`△ ${h.이름} — 찾았지만 가입자 수·고지금액이 비어 있음`); continue; }

  /* ③ 최근 12개월 입사·퇴사 */
  let 취득 = 0; let 상실 = 0; let 달수 = 0;
  for (const ym of 지난달들(12)) {
    const p = await 부르기('getPdAcctoSttusInfoSearchV2', { seq: String(고른.seq), dataCrtYm: ym });
    const x = p.줄[0];
    if (!x) continue;
    const a = 수(칸(x, '취득')); const b = 수(칸(x, '상실'));
    if (a != null) 취득 += a; if (b != null) 상실 += b; if (a != null || b != null) 달수 += 1;
  }

  const 월평균 = 고른.고지금액 / 고른.가입자수 / 보험료율;
  const 연봉 = 월평균 * 12;
  const 상한근처 = 월평균 >= 상한월액 * 0.85;
  결과.push({ 이름: h.이름, 갈래: h.갈래, 찾음: true, ...고른, 월평균: Math.round(월평균), 추정연봉: Math.round(연봉), 상한근처, 입사12개월: 취득, 퇴사12개월: 상실, 기간별달수: 달수, 후보수: 상세들.length, 후보: 상세들 });
  console.log(`○ ${h.이름} (${h.갈래}) — ${고른.사업장명} · 가입자 ${고른.가입자수.toLocaleString('ko-KR')}명 · 추정 연봉 ${(연봉 / 1e4).toFixed(0)}만 원${상한근처 ? ' (상한 근처 · 실제보다 낮을 수 있음)' : ''} · 최근 ${달수}개월 입사 ${취득} · 퇴사 ${상실} · 후보 ${상세들.length}곳`);
}

const 날 = new Date().toISOString().slice(0, 10);
const 남길곳 = path.join(ROOT, 'tmp', `nps-병원평균_${날}.json`);
fs.mkdirSync(path.dirname(남길곳), { recursive: true });
fs.writeFileSync(남길곳, JSON.stringify({ 만든때: new Date().toISOString(), 보험료율, 상한월액, 부른수, 결과 }, null, 1));
console.log(`\n부른 수 ${부른수}번 · 결과 ${결과.length}곳 → ${path.relative(ROOT, 남길곳)}`);
