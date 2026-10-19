/* 워크넷 상세 API 에 **온전한 제목**이 있나 (2026-10-19 세중님 1번)
 *
 *   node tools/워크넷_상세제목있나.mjs
 *
 * ── 왜 ───────────────────────────────────────────────────────────
 * 워크넷 목록 API 는 제목을 **30자로 자릅니다** — 회원 화면 96건의
 * 「기관 원문 제목」 칸이 「...」 로 끝납니다. 상세 API(정찰이 이미 부르는 것)에
 * 온전한 제목이 있으면 받아서 채울 수 있습니다.
 *
 * ★ 응답 **원문을 찍습니다** (지침 2절 — 「몇 건 왔다」만 찍는 진단은 쓸모없음).
 */
import fs from 'node:fs';

const cfg = {};
for (const 이름 of ['../.env', '../.env.local']) {
  const p = new URL(이름, import.meta.url);
  if (!fs.existsSync(p)) continue;
  for (const l of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z_0-9]+)=(.*)$/);
    if (m && !cfg[m[1]]) cfg[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}
const U = cfg.SUPABASE_URL;
const K = cfg.SUPABASE_SERVICE_KEY;
const WK = cfg.WORK_KEY;
if (!U || !K || !WK) { console.error('✗ SUPABASE_URL / SUPABASE_SERVICE_KEY / WORK_KEY 가 있어야 합니다'); process.exit(1); }
const H = { apikey: K, Authorization: 'Bearer ' + K };
const WURL = 'https://www.work24.go.kr/cm/openApi/call/wk/callOpenApiSvcInfo210L01.do';

/* 제목이 잘린 워크넷 공고 셋을 고릅니다 */
const r0 = await fetch(U + '/rest/v1/job_posts?select=id,title,url'
  + '&source=eq.WN2&title=like.*...&limit=3', { headers: H });
let 줄 = await r0.json();
if (!Array.isArray(줄) || !줄.length) {
  /* like 로 안 잡히면 전체에서 걸러 냅니다 */
  const r1 = await fetch(U + '/rest/v1/job_posts?select=id,title,url&source=eq.WN2&limit=300', { headers: H });
  줄 = (await r1.json()).filter((x) => /(\.\.\.|…)\s*$/.test(x.title || '')).slice(0, 3);
}
console.log('잘린 제목 공고 ' + 줄.length + '건으로 상세 API 를 두드립니다\n');

const 자고 = (ms) => new Promise((r) => setTimeout(r, ms));
for (const x of 줄) {
  const no = (String(x.url).match(/wantedAuthNo=([A-Z0-9]+)/) || [])[1];
  console.log('════ ' + x.id);
  console.log('  목록 제목 (' + String(x.title).length + '자) 「' + x.title + '」');
  if (!no) { console.log('  ✗ wantedAuthNo 를 못 집었습니다'); continue; }
  const u = WURL + '?authKey=' + encodeURIComponent(WK) + '&returnType=XML&callTp=D'
    + '&wantedAuthNo=' + encodeURIComponent(no) + '&infoSvc=VALIDATION';
  let t;
  try {
    const r = await fetch(u, { signal: AbortSignal.timeout(20000) });
    t = await r.text();
    console.log('  HTTP ' + r.status + ' · ' + t.length + '바이트');
  } catch (e) { console.log('  ✗ ' + String(e.message).slice(0, 60)); await 자고(1200); continue; }

  /* 제목이 들었을 만한 항목을 **이름으로 찾지 않고 전부 찍습니다** —
     이름을 짐작하면 또 헛짚습니다 (지침 3·5절) */
  const 항목 = [...t.matchAll(/<([A-Za-z0-9_]+)>([^<]{2,200})<\/\1>/g)]
    .map((m) => [m[1], m[2].trim()]);
  const 제목비슷 = 항목.filter(([k, v]) =>
    /t(i)?tl|title|nm$|name/i.test(k) && v.length > 10 && /[가-힣]/.test(v));
  console.log('  ── 제목 비슷한 항목 ' + 제목비슷.length + '개 ──');
  for (const [k, v] of 제목비슷.slice(0, 8)) {
    console.log('     <' + k + '> (' + v.length + '자) 「' + v.slice(0, 120) + '」');
  }
  /* 목록 제목의 앞 20자가 든 항목을 찾습니다 — 그것이 온전한 제목입니다 */
  const 앞 = String(x.title).replace(/(\.\.\.|…)\s*$/, '').slice(0, 18).trim();
  const 맞는것 = 항목.filter(([, v]) => v.includes(앞) && v.length > String(x.title).length);
  console.log('  ── 목록 제목보다 **긴** 항목 ' + 맞는것.length + '개 ──');
  for (const [k, v] of 맞는것.slice(0, 4)) {
    console.log('     ★ <' + k + '> (' + v.length + '자) 「' + v.slice(0, 160) + '」');
  }
  if (!맞는것.length) console.log('     (없습니다 — 상세 API 도 같은 제목을 줍니다)');
  console.log('  ── 항목 이름 전부 (' + [...new Set(항목.map((a) => a[0]))].length + '개) ──');
  console.log('     ' + [...new Set(항목.map((a) => a[0]))].join(' · ').slice(0, 400));
  await 자고(1200);
}
