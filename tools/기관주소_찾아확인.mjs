/* 주소 없는 기관의 **공식 홈페이지를 찾아 제목으로 확인합니다**
 *   (2026-10-19 세중님 1번 — 「실제 열어 기관 이름이 쪽 제목에 있는지로 확인」)
 *
 *   node tools/기관주소_찾아확인.mjs                 찍기만 (기본)
 *   node tools/기관주소_찾아확인.mjs --진짜          찾은 것을 기관주소 표에 적습니다
 *   node tools/기관주소_찾아확인.mjs --몇개 8
 *
 * ── 어떻게 ───────────────────────────────────────────────────────
 * ★ **제목으로 가립니다.** 후보 주소를 열어 `<title>` 에 그 병원의 **또렷한
 *   낱말**이 들어 있을 때만 받아들입니다. 안 맞으면 **아무것도 적지 않습니다.**
 *   그래서 주소를 「짐작으로 만드는」 것이 아닙니다 — 짐작은 기록되지 않습니다
 *   (지침 3절 — 「[Unverified] 는 면죄부가 아님. 확인할 수 있으면 확인부터」).
 *
 * ★ 후보는 **병원 이름에서만** 만듭니다 (법인 머리말을 떼고 남은 이름).
 *   한 곳에 최대 8개까지, 한 곳마다 1.2초 쉽니다.
 *
 * ★ 적는 자리는 우리 표 `기관주소` 이고 창구 `기관주소적기` 만 씁니다.
 *   `hira_org` 는 **절대 안 건드립니다** (세중님 지시 · 2026-10-18).
 */
import fs from 'node:fs';

const argv = process.argv.slice(2);
const 진짜 = argv.includes('--진짜');
const 몇개 = Number(argv.includes('--몇개') ? argv[argv.indexOf('--몇개') + 1] : 30) || 30;

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
if (!U || !K) { console.error('✗ SUPABASE_URL / SUPABASE_SERVICE_KEY 가 있어야 합니다'); process.exit(1); }
const H = { apikey: K, Authorization: 'Bearer ' + K, 'Content-Type': 'application/json' };
const UA = 'Mozilla/5.0 (compatible; potjob/1.0)';

/* 법인 머리말을 뗍니다 — 「의료법인 센텀의료재단 센텀종합병원」 → 「센텀종합병원」 */
const 법인말 = /(\(재\)|\(의\)|\(사\)|재단법인|의료법인|학교법인|사회복지법인|[가-힣]*의료재단|[가-힣]*복지재단|[가-힣]*재단|[가-힣]*수도회|[가-힣]*성직수도회)/g;
export function 병원이름(전체) {
  const s = String(전체 || '').replace(법인말, ' ').replace(/\s+/g, ' ').trim();
  return s || String(전체 || '').trim();
}
/* 제목에서 찾을 **또렷한 낱말** — 「종합병원」·「병원」 같은 흔한 말은 뺍니다 */
export function 또렷한말(이름) {
  const 핵 = 병원이름(이름)
    .replace(/(종합병원|대학교병원|의과대학|부속|병원|의원|센터)/g, ' ')
    .replace(/\s+/g, ' ').trim();
  return 핵.split(' ').filter((w) => w.length >= 2);
}

async function 열기(u) {
  const r = await fetch(u, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'ko' },
    redirect: 'follow', signal: AbortSignal.timeout(12000),
  });
  const buf = Buffer.from(await r.arrayBuffer());
  const ct = r.headers.get('content-type') || '';
  const cs = (ct.match(/charset=["']?([\w-]+)/i) || [])[1]
    || (buf.subarray(0, 2048).toString('latin1').match(/charset=["']?([\w-]+)/i) || [])[1] || 'utf-8';
  let 글; try { 글 = new TextDecoder(cs.toLowerCase()).decode(buf); } catch { 글 = buf.toString('utf8'); }
  const 제목 = (글.match(/<title[^>]*>([\s\S]{0,200}?)<\/title>/i) || [])[1] || '';
  return { code: r.status, 끝주소: r.url || u, 제목: 제목.replace(/\s+/g, ' ').trim(), 글 };
}

const 아이디 = argv.filter((a) => !a.startsWith('--') && !/^\d+$/.test(a));
const 볼것 = 아이디.length ? 아이디 : [
  '(재)미리내천주성삼성직수도회천주성삼병원', '강남베드로병원', '광주수완병원', '광주한국병원',
  '광주희망병원', '구로성심병원', '나사렛종합병원', '드림종합병원', '부안성모병원', '비에스종합병원',
  '빛가람종합병원', '삼일병원', '서울현대병원', '의료법인 센텀의료재단 센텀종합병원',
  '의료법인 영제 의료재단 엔케이세종병원', '의료법인 우범의료재단 장흥종합병원',
  '의료법인 원광의료재단 원광종합병원', '의료법인 인당의료재단 해운대부민병원',
  '의료법인 힐링의료재단 옥천성모병원', '재단법인베스티안재단베스티안병원', '참조은병원',
  '해남우리종합병원', '현대유비스병원',
].slice(0, 몇개);

/* ── 후보 주소 — **이름에서만** 만듭니다 ────────────────────────
 * 로마자 바꾸기는 안 합니다(틀리기 쉽습니다). 대신 세중님이 이미 찾아 둔
 * 꼴에서 배운 것만 씁니다 — 우리 cfgs 288곳의 도메인을 보면 거의 다
 *   www.<영문이름>.co.kr | .or.kr | .com | .kr
 * 꼴입니다. 영문 이름은 **쪽 제목으로 확인될 때만** 쓰입니다. */
const 로마자 = JSON.parse(fs.existsSync(new URL('./기관주소_후보.json', import.meta.url))
  ? fs.readFileSync(new URL('./기관주소_후보.json', import.meta.url), 'utf8') : '{}');

const 찾음 = []; const 못찾음 = [];
const 자고 = (ms) => new Promise((r) => setTimeout(r, ms));

for (const [i, 전체이름] of 볼것.entries()) {
  const 말들 = 또렷한말(전체이름);
  const 후보 = (로마자[전체이름] || 로마자[병원이름(전체이름)] || []);
  process.stderr.write('\r  ' + (i + 1) + '/' + 볼것.length + ' ' + 병원이름(전체이름).slice(0, 16) + '      ');
  if (!후보.length) {
    못찾음.push({ 이름: 전체이름, 왜: '후보 주소가 없습니다 — tools/기관주소_후보.json 에 적어 주십시오' });
    continue;
  }
  let 된것 = null;
  for (const u of 후보.slice(0, 8)) {
    try {
      const r = await 열기(u.startsWith('http') ? u : 'https://' + u);
      if (r.code >= 400) { await 자고(500); continue; }
      /* ★ 제목에 또렷한 낱말이 하나라도 있어야 받아들입니다 */
      const 맞은말 = 말들.filter((w) => r.제목.includes(w));
      if (맞은말.length) { 된것 = { ...r, 후보: u, 맞은말 }; break; }
      await 자고(500);
    } catch { await 자고(500); }
  }
  if (된것) 찾음.push({ 이름: 전체이름, ...된것 });
  else 못찾음.push({ 이름: 전체이름, 왜: '후보 ' + 후보.length + '개 중 제목이 맞는 것이 없습니다' });
  await 자고(1200);
}
process.stderr.write('\n');

console.log('\n── 찾은 것 ' + 찾음.length + '곳 (제목으로 확인) ──');
for (const v of 찾음) {
  console.log('  ★ ' + 병원이름(v.이름).slice(0, 24).padEnd(26) + v.끝주소.slice(0, 44));
  console.log('      제목 「' + v.제목.slice(0, 60) + '」   맞은 낱말 ' + v.맞은말.join('·'));
}
console.log('\n── 못 찾은 것 ' + 못찾음.length + '곳 ──');
for (const v of 못찾음) console.log('  ' + 병원이름(v.이름).slice(0, 24).padEnd(26) + v.왜);

if (!찾음.length) { console.log('\n적을 것이 없습니다'); process.exit(0); }
if (!진짜) { console.log('\n[마른] 아무것도 안 적습니다 — 적으려면 --진짜'); process.exit(0); }

/* 우리 표에만 적습니다 — hira_org 는 안 건드립니다 */
let 적음 = 0;
for (const v of 찾음) {
  const r = await fetch(U + '/rest/v1/rpc/' + encodeURIComponent('기관주소적기'), {
    method: 'POST', headers: H,
    body: JSON.stringify({
      p_이름: v.이름,
      p_주소: v.끝주소,
      p_근거: '쪽을 열어 제목으로 확인했습니다 — 제목 「' + v.제목.slice(0, 80)
        + '」 · 맞은 낱말 ' + v.맞은말.join('·') + ' · 후보 ' + v.후보
        + ' · ' + new Date().toISOString().slice(0, 10),
    }),
  });
  const t = await r.text();
  if (!r.ok) { console.error('✗ 기관주소적기 ' + r.status + ' · ' + t.slice(0, 200)); continue; }
  적음++;
}
console.log('\n기관주소 표에 ' + 적음 + '곳 적었습니다 (hira_org 는 안 건드렸습니다).');
