/* ═══════════════════════════════════════════════════════════════
 *  클린아이(지방공공기관 통합공시) 보수 API 에 「의료원」이 들어 있는지 두드려 봅니다 (마른 실행 · 2026-11-12 밤)
 *  세중님 「의료원은 클린아이나 나라에서 공시하는 자료 없나 · 공공병원은 다 들어가야」 · 네 API 활용신청 완료
 * ═══════════════════════════════════════════════════════════════
 *
 *  ★ 아무것도 담지 않습니다. 응답 원문·칸 이름·전체 줄 수를 찍고, 기관명에 「의료원|병원」이 든 줄만 골라 보여 줍니다.
 *    결과 → tmp/cleaneye-보수_<날짜>.json
 *  ★ 클린아이 사이트(cleaneye.go.kr)는 robots.txt 가 전부 막아(2026-11-12 확인) 화면은 긁지 않습니다 — 공공데이터포털 API 만.
 *
 *  쓰는 법 (서버 · 공공데이터 열쇠가 .env 에 있어야 — 나라일터·알리오와 같은 열쇠)
 *    node tools/cleaneye-보수.mjs                         ③ 출자출연기관 성별근로공시 (주소·칸 확인됨)
 *    node tools/cleaneye-보수.mjs --주소 <요청주소>         다른 API (신입사원·일반정규직·상용정규직 평균임금)
 *    node tools/cleaneye-보수.mjs --해 2024                연도 (기본: 작년)
 *    node tools/cleaneye-보수.mjs --변수 ent_name=부산     요청 변수 더하기 (여러 번 가능)
 *
 *  확인된 것 (2026-11-12 · 명세 15156858 · 열쇠 없이 두드려 SERVICE_KEY_IS_NULL)
 *    ③ https://apis.data.go.kr/B551982/openApiGenderStatus/openXmlGenderStatus
 *       요청 serviceKey · pageNo · numOfRows · ac_year · type(xml 만)   응답 No · AC_YEAR · ENT_NAME · M_AVG · W_AVG
 *  아직 모르는 것
 *    ① 신입사원 ② 일반정규직 ④ 상용정규직 평균임금 — 요청주소를 못 찾았습니다(짐작으로 만들지 않습니다 · 지침 3절).
 *    공공데이터포털 마이페이지 → 활용신청 현황 → 그 API 의 「요청주소」를 --주소 로 주세요.
 *    그 셋은 「지방공기업」 자료라 의료원(지방출연기관)이 없을 수 있습니다 — 그걸 이 도구로 가립니다.
 * ═══════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

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
const 열쇠 = cfg.CLEANEYE_PAY_KEY || cfg.NPS_KEY || cfg.ALIO_DETAIL_KEY || '';
if (!열쇠) {
  console.error('공공데이터 열쇠(ALIO_DETAIL_KEY)가 없습니다 — 서버 ~/potlab 에서 돌려 주세요 (값은 여기에 찍지 않습니다)');
  process.exit(2);
}
const 열쇠붙임 = /%[0-9A-Fa-f]{2}/.test(열쇠) ? 열쇠 : encodeURIComponent(열쇠);
const 가림 = (s) => String(s).split(열쇠).join('‹열쇠›').split(열쇠붙임).join('‹열쇠›');

const argv = process.argv.slice(2);
const 값 = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const 주소 = 값('--주소') || 'https://apis.data.go.kr/B551982/openApiGenderStatus/openXmlGenderStatus';
const 해 = 값('--해') || String(new Date().getFullYear() - 1);
const 더할변수 = Object.fromEntries(argv.flatMap((a, i) => (a === '--변수' && argv[i + 1]?.includes('=')
  ? [[argv[i + 1].slice(0, argv[i + 1].indexOf('=')), argv[i + 1].slice(argv[i + 1].indexOf('=') + 1)]] : [])));
const 찾기 = new RegExp(값('--찾기') || '의료원|병원');

const 줄들 = (t) => [...String(t).matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) =>
  Object.fromEntries([...m[1].matchAll(/<([A-Za-z0-9_]+)>([\s\S]*?)<\/\1>/g)].map((x) => [x[1], x[2].replace(/&amp;/g, '&').trim()])));

async function 쪽(n) {
  const q = new URLSearchParams({ pageNo: String(n), numOfRows: '300', ac_year: 해, type: 'xml', ...더할변수 });
  const r = await fetch(`${주소}?serviceKey=${열쇠붙임}&${q}`, { headers: { 'User-Agent': 'RAPO-collector (rapojob.co.kr)' } });
  return { status: r.status, text: await r.text() };
}

console.log(`주소 ${주소}\n해   ${해}${Object.keys(더할변수).length ? ' · 더한 변수 ' + JSON.stringify(더할변수) : ''}`);
const 첫 = await 쪽(1);
console.log(`\n── 원문 (HTTP ${첫.status} · 앞 1,200자) ──\n${가림(첫.text.slice(0, 1200))}`);
const 전체 = Number(첫.text.match(/<totalCount>(\d+)<\/totalCount>/)?.[1] ?? 0);
let 모음 = 줄들(첫.text);
console.log(`\n── 칸 이름: ${모음[0] ? Object.keys(모음[0]).join(', ') : '(item 없음)'}\n── 전체 ${전체}줄`);
if (!모음.length) { console.log('\n줄이 없습니다 — 원문의 오류 글(resultMsg · returnAuthMsg)을 봐 주세요. 승인 직후면 1~2시간 뒤에 다시.'); process.exit(1); }

for (let n = 2; 모음.length < 전체 && n <= 40; n++) {
  await new Promise((r) => setTimeout(r, 300));
  const 다음 = 줄들((await 쪽(n)).text);
  if (!다음.length) break;
  모음 = 모음.concat(다음);
}
const 맞는 = 모음.filter((x) => Object.values(x).some((v) => 찾기.test(String(v))));
console.log(`\n받은 줄 ${모음.length} / ${전체} · 「${찾기.source}」 든 줄 ${맞는.length}`);
for (const x of 맞는.slice(0, 80)) console.log('  ' + Object.entries(x).map(([k, v]) => `${k}=${v}`).join(' · '));
if (!맞는.length) console.log('  (없음) — 앞 5줄: ' + 모음.slice(0, 5).map((x) => Object.values(x).join('|')).join('  /  '));

const 남길곳 = path.join(ROOT, 'tmp', `cleaneye-보수_${new Date().toISOString().slice(0, 10)}.json`);
fs.mkdirSync(path.dirname(남길곳), { recursive: true });
fs.writeFileSync(남길곳, JSON.stringify({ 만든때: new Date().toISOString(), 주소, 해, 전체, 받은줄: 모음.length, 맞는 }, null, 1));
console.log(`\n→ ${path.relative(ROOT, 남길곳)}`);
