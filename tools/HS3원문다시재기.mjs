/* HS3 공고 페이지를 **다시 받아** 「브라우저가 정말 필요한 곳」을 가립니다
 * (2026-10-11 세중님 3번 · 읽기만).
 *
 *   node tools/HS3원문다시재기.mjs [몇개]
 *
 * ── 왜 ───────────────────────────────────────────────────────
 * 회원 화면 HS3 34건 중 마감일이 있는 것은 7건뿐입니다. 쌓인 본문을 보니
 * **28건(기관 11곳)이 CSS 덩어리**였습니다 — `collect-hosp.mjs` 가
 * `<script>` 만 걷고 **`<style>` 을 안 걷습니다** (줄 365).
 * (같은 일을 하는 `hosp/hs_dates.js` 의 hsText() 는 걷습니다. 기준이 두 자리입니다)
 *
 * 그래서 두 가지가 섞여 있습니다 —
 *   ㉮ `<style>` 만 걷으면 글이 보이는 곳      → **코드 한 줄**
 *   ㉯ 걷어도 글이 없는 곳 (JS 로 그리는 앱)   → **브라우저 필요**
 *
 * 이 도구가 그 둘을 갈라 셉니다. **아무것도 담지 않습니다.**
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 글받기 } from './certs/index.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 몇개 = Number(process.argv[2]) || 40;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

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

/* 지금 수집기가 하는 걷기 — <script> 만 */
const 지금걷기 = (h) => String(h || '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

/* 제대로 걷기 — hs_dates.js 의 hsText() 와 같게 (<style>·주석까지) */
const 제대로걷기 = (h) => String(h || '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<!--[\s\S]*?-->/g, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/\s+/g, ' ').trim();

const 접수말 = /(원서\s*)?접수\s*(기간|기한|일정|마감|일시|일자)|모집\s*기간|채용\s*기간|지원\s*기간|마감일/;
const 우리말 = /(물리|작업)\s*치료사/;
const 한글비율 = (s) => {
  const t = String(s || '');
  if (!t.length) return 0;
  return (t.match(/[가-힣]/g) || []).length / t.length;
};

/* 회원 화면 HS3 공고 중 마감일이 없는 것부터 봅니다 */
const 공고들 = await 전부('job_posts?select=id,org_name,title,url,apply_to'
  + '&source=eq.HS3&hidden=is.false&hold=is.false&' + encodeURIComponent('시험자료') + '=is.false'
  + '&order=apply_to.asc.nullsfirst,id.asc');
const 볼것 = 공고들.slice(0, 몇개);
console.log('회원 화면 HS3 ' + 공고들.length + '건 중 ' + 볼것.length + '건을 다시 받습니다\n');

const 셈 = { 못받음: 0, 지금도글있음: 0, style만걷으면됨: 0, 걷어도없음: 0 };
const 브라우저필요 = []; const 한줄로됨 = [];

for (const j of 볼것) {
  let g;
  try { g = await 글받기(j.url, { headers: { 'User-Agent': UA, 'Accept-Language': 'ko' } }); }
  catch (e) { 셈.못받음++; console.log('  ✗ ' + String(j.org_name).slice(0, 18) + '  못 받음 · ' + String(e.message).slice(0, 60)); continue; }
  if (g.왜 || g.code !== 200) {
    셈.못받음++;
    console.log('  ✗ ' + String(j.org_name).slice(0, 18).padEnd(20) + '  HTTP ' + g.code + ' ' + (g.왜 || ''));
    continue;
  }
  const 지금 = 지금걷기(g.html);
  const 제대로 = 제대로걷기(g.html);
  const 지금접수 = 접수말.test(지금);
  const 제대로접수 = 접수말.test(제대로);
  const 한글 = 한글비율(제대로);

  let 갈래;
  if (지금접수) { 셈.지금도글있음++; 갈래 = '지금도 됨'; }
  else if (제대로접수) { 셈.style만걷으면됨++; 갈래 = '★ style 만 걷으면 됨'; 한줄로됨.push(j); }
  else { 셈.걷어도없음++; 갈래 = '✗ 걷어도 접수말 없음'; 브라우저필요.push({ j, 제대로, 한글 }); }

  console.log('  ' + String(j.org_name).slice(0, 18).padEnd(20)
    + ' 받은 HTML ' + String(g.html.length).padStart(7)
    + ' · 지금 걷기 ' + String(지금.length).padStart(6)
    + ' · 제대로 ' + String(제대로.length).padStart(6)
    + ' · 한글비율 ' + (한글 * 100).toFixed(0).padStart(3) + '%'
    + ' · 우리직군 ' + (우리말.test(제대로) ? '○' : '-')
    + '  ' + 갈래);
}

console.log('\n── 센 것 ───────────────────────────────────────────');
console.log('  못 받음                    ' + 셈.못받음);
console.log('  지금도 접수말이 보임        ' + 셈.지금도글있음);
console.log('  **<style> 만 걷으면 됨**    ' + 셈.style만걷으면됨 + '   ← 코드 한 줄');
console.log('  걷어도 접수말이 없음        ' + 셈.걷어도없음 + '   ← 브라우저 또는 첨부');

console.log('\n── <style> 한 줄로 되는 곳 ─────────────────────');
for (const j of 한줄로됨.slice(0, 12)) console.log('   ' + String(j.org_name).slice(0, 26).padEnd(28) + j.url.slice(0, 64));

console.log('\n── 걷어도 글이 없는 곳 (브라우저 후보) ──────────');
for (const x of 브라우저필요.slice(0, 12)) {
  console.log('   ' + String(x.j.org_name).slice(0, 24).padEnd(26)
    + ' 한글 ' + (x.한글 * 100).toFixed(0) + '% · ' + x.j.url.slice(0, 58));
  console.log('      앞 140자  ' + x.제대로.slice(0, 140));
}
console.log('\n아무것도 담지 않았습니다.');
