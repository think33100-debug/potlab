/* 나라일터에서 **안 쓰고 있던 기능 셋**의 응답 원문과 항목 이름을 찍습니다
 * (2026-10-11 세중님 지시 · 지침 2절 · 4절).
 *
 *   node tools/나라일터_안쓰는기능.mjs [공고idx]
 *
 * 지침 4절에 2026-09-08 에 적어 둔 그대로입니다 —
 *
 *   쓰던 것     getList · getItem · getItemFile
 *   안 쓰던 것   getItemPosition · getClsfList · getInsttList
 *
 * `getItemPosition` = 「검색 고유값에 해당하는 채용직급을 조회」.
 * 알리오의 `steps` 와 같은 것인데 한 달 넘게 안 보고 있었습니다.
 *
 * **아무것도 담지 않습니다.** 찍기만 합니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'https://apis.data.go.kr/1760000/PblJobService';

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
  return out;
}
const cfg = env();
const 열쇠 = cfg.ALIO_DETAIL_KEY;
if (!열쇠) { console.error('ALIO_DETAIL_KEY 가 없습니다'); process.exit(1); }

/* 주소를 찍을 때 열쇠는 가립니다 (지침 8-11) */
const 가린주소 = (u) => u.replace(열쇠, '<열쇠>');

async function 두드리기(이름, 길, 인자) {
  const u = BASE + 길 + '?serviceKey=' + 열쇠
    + Object.entries(인자).map(([k, v]) => '&' + k + '=' + encodeURIComponent(v)).join('');
  console.log('\n' + '═'.repeat(70));
  console.log('■ ' + 이름 + '   ' + 가린주소(BASE + 길 + '?' + Object.entries(인자).map(([k, v]) => k + '=' + v).join('&')));
  let r;
  try {
    r = await fetch(u, { headers: { accept: 'application/xml' } });
  } catch (e) { console.log('  ✗ 못 받음 — ' + e.message); return null; }
  const t = await r.text();
  console.log('  HTTP ' + r.status + ' · ' + t.length + '자 · content-type ' + (r.headers.get('content-type') || '-'));

  /* ── 응답 원문 (지침 2절 — 500~1200자) ── */
  console.log('  ── 원문 앞 1100자 ──');
  console.log('  ' + t.replace(열쇠, '<열쇠>').slice(0, 1100).split('\n').join('\n  '));

  /* ── 항목 이름 목록 (지침 2절) ── */
  const 태그 = [...t.matchAll(/<([A-Za-z_][A-Za-z0-9_]*)>/g)].map((m) => m[1]);
  const 셈 = new Map();
  for (const x of 태그) 셈.set(x, (셈.get(x) ?? 0) + 1);
  console.log('\n  ── 항목 이름 (나온 횟수) ──');
  console.log('  ' + [...셈].map(([k, n]) => k + '×' + n).join(' · '));
  return t;
}

const idx = process.argv[2] || null;

/* ① getItemPosition — 「검색 고유값에 해당하는 채용직급을 조회」 */
if (idx) {
  await 두드리기('getItemPosition  (채용직급 조회)', '/getItemPosition', { idx });
} else {
  console.log('공고 idx 를 안 주셨습니다 — getItemPosition 은 건너뜁니다');
}

/* ② getClsfList — 분류 목록으로 보입니다 */
await 두드리기('getClsfList  (분류 목록?)', '/getClsfList', { numOfRows: 50, pageNo: 1 });

/* ③ getInsttList — 기관 목록으로 보입니다 */
await 두드리기('getInsttList  (기관 목록?)', '/getInsttList', { numOfRows: 20, pageNo: 1 });

console.log('\n아무것도 담지 않았습니다.');
