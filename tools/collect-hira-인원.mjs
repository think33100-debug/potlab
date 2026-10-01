/* ═══════════════════════════════════════════════════════════════
 *  심평원 물리·작업치료사 인원을 **달마다 한 번** 쌓습니다
 *  2026-10-01 준비. 표(심평원인원월별)를 올리기 전이라 아직 안 돕니다.
 * ═══════════════════════════════════════════════════════════════
 *
 *  쓰는 법
 *    node tools/collect-hira-인원.mjs            이번 달 것을 받습니다
 *    node tools/collect-hira-인원.mjs --연월 2026-10
 *    node tools/collect-hira-인원.mjs --dry      받아만 보고 안 담습니다
 *    node tools/collect-hira-인원.mjs --n 5      5곳만 (빠른 확인)
 *
 *  어디서 받는가 — 이미 붙여 둔 API 입니다 (tools/hira.js 가 쓰는 것과 같은 곳)
 *    https://apis.data.go.kr/B551182/MadmDtlInfoService2.8/getEtcHstInfo2.8
 *      ykiho 로 묻습니다. gnlNopDtlCd 100 = 물리치료사 · 110 = 작업치료사.
 *      gnlNopCnt 가 인원입니다.
 *      **값이 없으면 null 로 둡니다 — 0 과 다릅니다.** 의원급은 이 자료가
 *      원래 없습니다 (오류가 아닙니다 · hira.js 줄 215).
 *
 *  얼마나 드는가
 *    기관 하나에 **한 번**만 씁니다 (hira.js 는 세 번 씁니다 — 거기는 시설정보와
 *    전문의까지 받으니까요. 인원만 쌓는 데는 한 번으로 됩니다).
 *    1층에서 요양기호가 있는 기관 534곳 → 534번. 한도는 하루 10,000번입니다
 *    (2026-09-25·26 에 9,998·9,999 에서 멈춘 실측 · hira_quota 표).
 *
 *  끊기면 이어받습니다
 *    심평원받을곳() 이 **그 달에 아직 안 받은 곳만** 돌려줍니다.
 *    다시 돌리면 남은 것만 받습니다. 중복은 (ykiho, 연월) 열쇠가 막습니다.
 *
 *  열쇠
 *    HIRA_KEY_ENC    **이미 URL 인코딩된 값입니다.** 다시 감싸면 %2B 가 %252B 가
 *                    됩니다. 그래서 문자열로 이어 붙입니다 (hira.js 와 같게).
 *    COLLECT_KEY_HS3 담을 때 쓰는 열쇠
 * ═══════════════════════════════════════════════════════════════ */
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
    if (m) o[m[1]] = m[2].trim().replace(/^"|"$/g, '');
  }
  return o;
};
const cfg = {
  ...읽기(path.join(ROOT, '.env.local')),
  ...읽기(path.join(ROOT, 'web', '.env.local')),
  ...읽기(path.join(ROOT, '.env.server')),
  ...읽기(path.join(ROOT, '.env')),
  ...process.env,
};

const SOURCE = 'HS3';            // 담는 열쇠는 병원 게시판 것을 같이 씁니다
const API = 'https://apis.data.go.kr/B551182/MadmDtlInfoService2.8/getEtcHstInfo2.8';

const argv = process.argv.slice(2);
const dry = argv.includes('--dry');
const 몇건 = argv.includes('--n') ? Number(argv[argv.indexOf('--n') + 1]) || 0 : 0;
const 연월 = argv.includes('--연월')
  ? String(argv[argv.indexOf('--연월') + 1] || '')
  : new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 7);

if (!/^\d{4}-\d{2}$/.test(연월)) { console.error('연월은 YYYY-MM 꼴이어야 합니다 — ' + 연월); process.exit(1); }

const t0 = Date.now();
console.log('심평원 인원 쌓기 · ' + 연월 + (dry ? ' · **--dry · 담지 않습니다**' : ''));
console.log('  HIRA_KEY_ENC    ' + (cfg.HIRA_KEY_ENC ? '있음 · ' + cfg.HIRA_KEY_ENC.length + '자' : '**없음**'));
console.log('  Supabase        ' + (cfg.SUPABASE_URL ? '있음' : '**없음**'));
const 열쇠 = cfg.COLLECT_KEY_HS3 || '';
console.log('  COLLECT_KEY_HS3 ' + (열쇠 ? '있음' : '**없음**'));
if (!cfg.HIRA_KEY_ENC || !cfg.SUPABASE_URL || !열쇠) { console.error('\n열쇠가 모자랍니다 — 멈춥니다'); process.exit(1); }

async function rpc(이름, body) {
  const r = await fetch(cfg.SUPABASE_URL + '/rest/v1/rpc/' + encodeURIComponent(이름), {
    method: 'POST',
    headers: { apikey: cfg.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + cfg.SUPABASE_ANON_KEY,
               'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const 글 = await r.text();
  if (!r.ok) throw new Error('HTTP ' + r.status + ' · 응답 원문 — ' + 글.slice(0, 500));
  return 글 ? JSON.parse(글) : null;
}

/* ① 받을 곳 */
console.log('\n── 받을 곳 물어보기 ──');
let 할것 = await rpc('심평원받을곳', { p_secret: 열쇠, p_source: SOURCE, p_연월: 연월 });
console.log('  ' + 할것.length + '곳 (' + 연월 + ' 에 아직 안 받은 곳)');
if (몇건) { 할것 = 할것.slice(0, 몇건); console.log('  --n ' + 몇건 + ' 이라 ' + 할것.length + '곳만 봅니다'); }
if (!할것.length) { console.log('\n받을 것이 없습니다. ' + Math.round((Date.now() - t0) / 1000) + '초'); process.exit(0); }

/* ② 하나씩 묻기 */
const 셈 = { 물음: 0, 받음: 0, 빈곳: 0, 실패: 0 };
const 담을것 = [];
const 처음오류 = [];

for (const o of 할것) {
  const u = API + '?serviceKey=' + cfg.HIRA_KEY_ENC
    + '&ykiho=' + encodeURIComponent(o.ykiho) + '&numOfRows=50&pageNo=1&_type=json';
  셈.물음++;
  try {
    const r = await fetch(u);
    const 글 = await r.text();
    let j = null;
    try { j = JSON.parse(글); } catch { /* 아래에서 처리 */ }
    /* 공공데이터포털은 열쇠·서비스 오류를 **JSON 이든 XML 이든** 200 으로도 보냅니다.
       그래서 코드만 보지 않고 응답 속을 봅니다 */
    if (!j || j.OpenAPI_ServiceResponse || j?.response?.header?.resultCode !== '00') {
      셈.실패++;
      if (처음오류.length < 3) 처음오류.push({ 기관: o.기관명, 원문: 글.slice(0, 600) });
      continue;
    }
    const it = j.response.body?.items?.item;
    const 줄들 = Array.isArray(it) ? it : it ? [it] : [];
    const 찾기 = (cd) => {
      const h = 줄들.find((x) => String(x.gnlNopDtlCd).padStart(3, '0') === cd);
      return h == null ? null : Number(h.gnlNopCnt);
    };
    담을것.push({
      ykiho: o.ykiho, 연월, 기관명: o.기관명, 종별: o.종별,
      물리: 찾기('100'), 작업: 찾기('110'),
    });
    셈.받음++;
    if (!줄들.length) 셈.빈곳++;
  } catch (e) {
    셈.실패++;
    if (처음오류.length < 3) 처음오류.push({ 기관: o.기관명, 원문: String(e.message).slice(0, 400) });
  }
  await new Promise((f) => setTimeout(f, 120));
  if (셈.물음 % 100 === 0) console.log('  ' + 셈.물음 + ' / ' + 할것.length + '곳');
}

console.log('\n── 받은 것 ──');
console.log('  물음 ' + 셈.물음 + '번 · 받음 ' + 셈.받음 + '곳 · 인원 자료가 빈 곳 ' + 셈.빈곳
  + '곳 (의원급은 원래 비어 있습니다) · 실패 ' + 셈.실패 + '곳');
if (처음오류.length) {
  console.log('\n  ★ 실패한 곳의 응답 원문 (앞 세 곳) —');
  for (const x of 처음오류) { console.log('    ' + x.기관); console.log('      ' + x.원문.replace(/\n/g, ' ')); }
}

const 있는것 = 담을것.filter((x) => x.물리 != null || x.작업 != null);
console.log('\n  물리나 작업 숫자가 있는 곳 ' + 있는것.length + '곳');
for (const x of 있는것.slice().sort((a, b) => (b.물리 ?? 0) - (a.물리 ?? 0)).slice(0, 8)) {
  console.log('    ' + String(x.물리 ?? '-').padStart(4) + '명 물리 · '
    + String(x.작업 ?? '-').padStart(4) + '명 작업   ' + x.기관명 + ' (' + x.종별 + ')');
}

/* ③ 담기 */
if (dry) {
  console.log('\n--dry 라 담지 않았습니다. ' + Math.round((Date.now() - t0) / 1000) + '초');
  process.exit(0);
}
let 담은수 = 0;
for (let i = 0; i < 담을것.length; i += 300) {
  담은수 += Number(await rpc('심평원인원담기',
    { p_secret: 열쇠, p_source: SOURCE, p_rows: 담을것.slice(i, i + 300) })) || 0;
}
console.log('\n담았습니다  ' + 담은수 + '줄 · ' + Math.round((Date.now() - t0) / 1000) + '초');
if (셈.실패) {
  console.error('실패 ' + 셈.실패 + '곳이 있습니다 — 다시 돌리면 그곳만 받습니다');
  process.exitCode = 1;
}
