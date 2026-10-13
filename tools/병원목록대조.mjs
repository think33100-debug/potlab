/* 병원 목록이 **둘**인 것을 곳마다 대조합니다 (2026-10-12 · 조사만).
 *
 *   node tools/병원목록대조.mjs
 *   → docs/시험_playwright_1012/C_목록대조.json  ·  화면에 표
 *
 * ── 왜 ───────────────────────────────────────────────────────
 * 수집기가 쓰는 목록과 DB 표가 **다릅니다.**
 *   수집기   gas/wage.js 의 HOSP_SITES  (서버에서는 구워 둔
 *            tools/hosp/hosp-sites.json) ← collect-hosp.mjs:118 사이트들()
 *   DB       hosp_sites 표              ← **읽는 코드가 없습니다**
 * 어제 센 「288곳 · 꺼짐 47 · 주소 없음 17」 은 **DB 쪽** 숫자였습니다.
 * 수집기가 실제로 쓰는 쪽으로 다시 셉니다.
 *
 * `gas/wage.js` 는 옛 앱(심사 중) 파일이라 **읽기만** 합니다.
 *
 * **DB 를 안 건드립니다.**
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 낼곳 = path.join(여기, '..', 'docs', '시험_playwright_1012', 'C_목록대조.json');

function env() {
  const out = {};
  for (const f of [path.join(여기, '..', '.env'), path.join(여기, '..', '.env.local')]) {
    if (!fs.existsSync(f)) continue;
    for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
      const m = l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*?)\s*$/);
      if (m && !out[m[1]]) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  }
  for (const k of Object.keys(process.env)) if (process.env[k]) out[k] = process.env[k];
  out.SUPABASE_URL = out.SUPABASE_URL || out.NEXT_PUBLIC_SUPABASE_URL;
  return out;
}
const cfg = env();
for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY']) {
  if (!cfg[k]) { console.error(k + ' 가 없습니다'); process.exit(1); }
}
const H = { apikey: cfg.SUPABASE_SERVICE_KEY, Authorization: 'Bearer ' + cfg.SUPABASE_SERVICE_KEY };

async function 전부(길) {
  const 모두 = [];
  for (let 처음 = 0; ; 처음 += 100) {
    const r = await fetch(cfg.SUPABASE_URL + '/rest/v1/' + 길,
      { headers: { ...H, Range: `${처음}-${처음 + 99}`, 'Range-Unit': 'items' } });
    if (!r.ok) throw new Error(길.slice(0, 50) + ' HTTP ' + r.status);
    const 한쪽 = await r.json();
    모두.push(...한쪽);
    if (한쪽.length < 100) return 모두;
  }
}

/* ── 수집기가 쓰는 목록 ── */
function 수집기목록() {
  const gas = path.join(여기, '..', 'gas', 'wage.js');
  const 구운것 = path.join(여기, 'hosp', 'hosp-sites.json');
  if (fs.existsSync(gas)) {
    const G = fs.readFileSync(gas, 'utf8');
    const i0 = G.indexOf('const HOSP_SITES = [');
    if (i0 < 0) throw new Error('gas 에서 HOSP_SITES 를 못 찾았습니다');
    let d = 0; let end = -1;
    for (let k = G.indexOf('[', i0); k < G.length; k++) {
      if (G[k] === '[') d++; else if (G[k] === ']' && --d === 0) { end = k + 1; break; }
    }
    /* 읽기만 합니다 — gas 파일을 고치거나 다시 굽지 않습니다 */
    return { 어디: 'gas/wage.js', 사이트: new Function('return ' + G.slice(G.indexOf('[', i0), end))() };
  }
  const j = JSON.parse(fs.readFileSync(구운것, 'utf8'));
  return { 어디: 'tools/hosp/hosp-sites.json (구운 날 ' + j.구운날 + ')', 사이트: j.사이트 };
}

const S = 수집기목록();
const DB = await 전부('hosp_sites?select=name,url,base,kind,off_why,note,loaded_on&order=name.asc');

const 키 = (s) => String(s || '').replace(/[\s()·]/g, '').toLowerCase();
const 주소키 = (u) => String(u || '').replace(/^https?:\/\//, '').replace(/\/+$/, '').toLowerCase();

const S맵 = new Map(S.사이트.map((x) => [키(x.name), x]));
const D맵 = new Map(DB.map((x) => [키(x.name), x]));

const 결과 = { 어디: S.어디, 수집기곳수: S.사이트.length, DB곳수: DB.length, 줄: [] };
const 모든키 = new Set([...S맵.keys(), ...D맵.keys()]);
for (const k of 모든키) {
  const s = S맵.get(k); const d = D맵.get(k);
  const 줄 = { 곳: (s?.name) || (d?.name) };
  if (s && !d) 줄.다름 = '수집기에만 있음';
  else if (!s && d) 줄.다름 = 'DB 에만 있음';
  else {
    const 다른것 = [];
    if (주소키(s.url) !== 주소키(d.url)) 다른것.push('주소');
    const s꺼짐 = !!s.off; const d꺼짐 = !!(d.off_why && String(d.off_why).trim());
    if (s꺼짐 !== d꺼짐) 다른것.push('켜짐/꺼짐 (수집기 ' + (s꺼짐 ? '꺼짐' : '켜짐') + ' · DB ' + (d꺼짐 ? '꺼짐' : '켜짐') + ')');
    줄.다름 = 다른것.length ? 다른것.join(' · ') : '같음';
  }
  줄.수집기_주소 = s?.url ?? null;
  줄.DB_주소 = d?.url ?? null;
  줄.수집기_꺼짐 = s ? !!s.off : null;
  줄.DB_꺼짐 = d ? !!(d.off_why && String(d.off_why).trim()) : null;
  줄.수집기_type = s?.type ?? null;
  결과.줄.push(줄);
}

/* ── 수집기 기준으로 다시 셉니다 ── */
const 수 = {
  곳수: S.사이트.length,
  켜짐: S.사이트.filter((x) => !x.off).length,
  꺼짐: S.사이트.filter((x) => !!x.off).length,
  주소없음: S.사이트.filter((x) => !x.url || !String(x.url).trim()).length,
  athome: S.사이트.filter((x) => !!x.athome).length,
};
결과.수집기기준 = 수;
결과.DB기준 = {
  곳수: DB.length,
  꺼짐: DB.filter((x) => x.off_why && String(x.off_why).trim()).length,
  주소없음: DB.filter((x) => !x.url || !String(x.url).trim()).length,
};
/* 강동경희대 */
const 경희 = {
  수집기: S.사이트.filter((x) => /경희/.test(x.name)).map((x) => ({ 곳: x.name, 주소: x.url, 꺼짐: !!x.off })),
  DB: DB.filter((x) => /경희/.test(x.name)).map((x) => ({ 곳: x.name, 주소: x.url })),
};
결과.경희 = 경희;

fs.mkdirSync(path.dirname(낼곳), { recursive: true });
fs.writeFileSync(낼곳, JSON.stringify(결과, null, 1));

/* ── 화면 ── */
console.log('수집기가 쓰는 목록 — ' + S.어디);
console.log('');
console.log('── 수집기 기준으로 다시 센 것 ──');
console.log('  곳수        ' + 수.곳수);
console.log('  켜짐        ' + 수.켜짐);
console.log('  **꺼짐**     ' + 수.꺼짐 + '   (어제 DB 로 센 값 ' + 결과.DB기준.꺼짐 + ')');
console.log('  **주소 없음** ' + 수.주소없음 + '   (어제 DB 로 센 값 ' + 결과.DB기준.주소없음 + ')');
console.log('  athome 표시  ' + 수.athome);
console.log('  DB 표 곳수   ' + 결과.DB기준.곳수);
console.log('');
const 갈래 = {};
for (const r of 결과.줄) 갈래[r.다름] = (갈래[r.다름] ?? 0) + 1;
console.log('── 두 목록의 차이 ──');
for (const [k, n] of Object.entries(갈래).sort((a, b) => b[1] - a[1])) {
  console.log('  ' + String(n).padStart(4) + '곳  ' + k);
}
console.log('');
for (const 말 of ['수집기에만 있음', 'DB 에만 있음']) {
  const 것 = 결과.줄.filter((r) => r.다름 === 말);
  if (!것.length) continue;
  console.log('── ' + 말 + ' (' + 것.length + '곳) ──');
  for (const r of 것.slice(0, 20)) console.log('   · ' + String(r.곳).slice(0, 34));
  if (것.length > 20) console.log('   … 그밖 ' + (것.length - 20) + '곳');
  console.log('');
}
const 켜짐다름 = 결과.줄.filter((r) => String(r.다름).includes('켜짐/꺼짐'));
console.log('── 켜짐·꺼짐이 다른 곳 (' + 켜짐다름.length + '곳) ──');
for (const r of 켜짐다름.slice(0, 24)) {
  console.log('   · ' + String(r.곳).slice(0, 30).padEnd(32)
    + '수집기 ' + (r.수집기_꺼짐 ? '꺼짐' : '켜짐') + ' · DB ' + (r.DB_꺼짐 ? '꺼짐' : '켜짐'));
}
if (켜짐다름.length > 24) console.log('   … 그밖 ' + (켜짐다름.length - 24) + '곳');
console.log('');
const 주소다름 = 결과.줄.filter((r) => String(r.다름).includes('주소'));
console.log('── 주소가 다른 곳 (' + 주소다름.length + '곳) ── 앞 10');
for (const r of 주소다름.slice(0, 10)) {
  console.log('   · ' + String(r.곳).slice(0, 26).padEnd(28));
  console.log('       수집기 ' + String(r.수집기_주소 || '(없음)').slice(0, 62));
  console.log('       DB    ' + String(r.DB_주소 || '(없음)').slice(0, 62));
}
console.log('');
console.log('── 경희 계열 ──');
console.log('  수집기 — ' + (경희.수집기.length ? 경희.수집기.map((x) => x.곳 + (x.꺼짐 ? '(꺼짐)' : '')).join(' · ') : '**없음**'));
console.log('  DB    — ' + (경희.DB.length ? 경희.DB.map((x) => x.곳).join(' · ') : '없음'));
console.log('');
console.log('→ ' + path.relative(path.join(여기, '..'), 낼곳));
console.log('DB 를 안 건드렸습니다. gas/wage.js 도 읽기만 했습니다.');
