/* cfg 목록을 `hosp_sites` 표에 **맞춥니다** (2026-10-19 세중님 ㉣ⓐ 승인)
 *
 *   node tools/기관사이트_맞춤.mjs           무엇이 바뀔지만 (기본 · 마른)
 *   node tools/기관사이트_맞춤.mjs --진짜    맞춥니다
 *
 * ── 왜 ───────────────────────────────────────────────────────────
 * ① 「안 긁는 1층 기관」 은 `일층병원_구멍()` 이 세고, 그 함수는 **`hosp_sites`
 * 표**에 이름이 있나로 「사이트있음 / 사각지대」 를 가립니다. 그런데 그 표에
 * 새 줄을 넣는 길이 없었습니다 — `cfgs → … → gas/wage.js` 는 gas 파일을 굽는
 * 길이고 DB 와 무관합니다. 그래서 **설정을 붙여도 ① 숫자가 그대로**였습니다.
 *
 * ★ 사이트 목록은 **수집기와 똑같은 자리**에서 가져옵니다 (지침 6절) —
 *   `collect-hosp.mjs` 의 `사이트들()` + `cfgs더하기()` 와 같은 규칙입니다.
 *   한쪽만 보면 「수집기는 긁는데 표에는 없는」 틈이 또 생깁니다.
 * ★ 표를 직접 쓰지 않습니다 — 창구 `기관사이트_맞추기` 만 씁니다.
 * ★ **지우지 않습니다.** 표에만 있고 cfg 에 없는 이름은 목록으로 찍고 넘깁니다.
 *
 * ★ **설정(cfg)을 더하거나 고칠 때마다 이 도구를 돌립니다** — 절차입니다.
 *   안 돌리면 수집기는 긁는데 ① 숫자가 안 줄어듭니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const 진짜 = argv.includes('--진짜');

const cfg = {};
for (const 이름 of ['../.env', '../.env.local']) {
  const p = new URL(이름, import.meta.url);
  if (!fs.existsSync(p)) continue;
  for (const l of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z_0-9]+)=(.*)$/);
    if (m && !cfg[m[1]]) cfg[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}
const U = cfg.SUPABASE_URL; const K = cfg.SUPABASE_SERVICE_KEY;
const SEC = cfg.COLLECT_KEY_HS3;
if (!U || !K || !SEC) {
  console.error('✗ SUPABASE_URL / SUPABASE_SERVICE_KEY / COLLECT_KEY_HS3 가 있어야 합니다');
  console.error('  (COLLECT_KEY_HS3 는 **서버 .env 에만** 있습니다 — 서버에서 돌리십시오)');
  process.exit(1);
}
const H = { apikey: K, Authorization: 'Bearer ' + K, 'Content-Type': 'application/json' };

/* ── 사이트 목록 — `collect-hosp.mjs` 와 같은 규칙 ───────────── */
function 사이트들() {
  const p = path.join(여기, '..', 'gas', 'wage.js');
  const 구운것 = path.join(여기, 'hosp', 'hosp-sites.json');
  if (fs.existsSync(p)) {
    const GAS = fs.readFileSync(p, 'utf8');
    const i0 = GAS.indexOf('const HOSP_SITES = [');
    if (i0 < 0) throw new Error('gas 에서 HOSP_SITES 를 못 찾았습니다');
    let d = 0; let end = -1;
    for (let k = GAS.indexOf('[', i0); k < GAS.length; k++) {
      if (GAS[k] === '[') d++; else if (GAS[k] === ']' && --d === 0) { end = k + 1; break; }
    }
    return new Function('return ' + GAS.slice(GAS.indexOf('[', i0), end))();
  }
  if (!fs.existsSync(구운것)) throw new Error('gas/wage.js 도 hosp-sites.json 도 없습니다');
  return JSON.parse(fs.readFileSync(구운것, 'utf8')).사이트;
}
function cfgs더하기(S) {
  const 터 = path.join(여기, 'hosp', 'cfgs');
  if (!fs.existsSync(터)) return S;
  const 이름 = new Set(S.map((x) => x.name));
  const 더한것 = [];
  for (const f of fs.readdirSync(터).filter((x) => x.endsWith('.json')).sort()) {
    let c;
    try { c = JSON.parse(fs.readFileSync(path.join(터, f), 'utf8')); } catch { continue; }
    if (!c || !c.name || 이름.has(c.name)) continue;
    if (!c.type) c.type = 'html';
    이름.add(c.name); S.push(c); 더한것.push(c.name);
  }
  if (더한것.length) console.log('cfgs 에서 더함 — ' + 더한것.length + '곳 · ' + 더한것.join(' · '));
  return S;
}

const 전부 = cfgs더하기(사이트들());
console.log('사이트 목록 ' + 전부.length + '곳 (수집기가 긁는 것과 같은 목록)');

/* 창구가 받는 꼴로 — 이름·주소·갈래 + 긁는규칙(그 밖 전부) */
const 줄들 = 전부
  .filter((s) => s && s.name && s.url)
  .map((s) => ({ ...s, type: s.type || 'html' }));
console.log('그중 이름·주소가 있는 것 ' + 줄들.length + '곳\n');

const 부르기 = async (마른) => {
  const r = await fetch(U + '/rest/v1/rpc/' + encodeURIComponent('기관사이트_맞추기'), {
    method: 'POST', headers: H,
    body: JSON.stringify({ p_secret: SEC, p_rows: 줄들, p_마른: 마른 }),
  });
  const t = await r.text();
  if (!r.ok) { console.error('✗ 기관사이트_맞추기 ' + r.status + ' · ' + t.slice(0, 300)); process.exit(1); }
  return JSON.parse(t);
};

const 찍기 = (x) => {
  console.log('  받은 줄        ' + x['받은 줄']);
  console.log('  새로 넣' + (x.마른 ? '을' : '은') + ' 것     ' + (x['새로 넣을 것'] ?? x['새로 넣음']));
  console.log('  고' + (x.마른 ? '칠' : '친') + ' 것        ' + (x['고칠 것'] ?? x['고침']));
  console.log('  그대로         ' + x['그대로']);
  console.log('  표에만 있는 것  ' + x['표에만 있는 것'] + '곳 — **지우지 않습니다**');
  const 목록 = x['표에만 있는 목록'] || [];
  for (const v of 목록.slice(0, 8)) console.log('     · ' + v.name);
  if (목록.length > 8) console.log('     … 그밖 ' + (목록.length - 8) + '곳');
};

console.log('── 마른 실행 ──');
찍기(await 부르기(true));

if (!진짜) {
  console.log('\n[마른] 아무것도 안 바꿉니다 — 맞추려면 --진짜');
  process.exit(0);
}

console.log('\n── 맞춥니다 ──');
찍기(await 부르기(false));

/* ① 숫자 전후 — 맞춘 뒤 바로 셉니다 */
const 구멍셈 = async () => {
  const r = await fetch(U + '/rest/v1/rpc/' + encodeURIComponent('일층병원_구멍셈'), {
    method: 'POST', headers: H, body: '{}',
  });
  if (!r.ok) return null;
  return r.json();
};
const 셈 = await 구멍셈();
if (셈) console.log('\n① 맞춘 뒤 — ' + JSON.stringify(셈).slice(0, 400));
console.log('\n★ 설정을 더하거나 고칠 때마다 이 도구를 돌립니다 (절차).');
