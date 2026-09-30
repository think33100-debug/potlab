/* 경쟁사 관찰 — 땡큐오티 구인정보 목록 **첫 쪽만** (2026-09-30).
 *
 *   node tools/collect-rival.mjs --dry   담지 않고 보기만
 *   node tools/collect-rival.mjs         담습니다
 *
 * ── 지키는 선 ────────────────────────────────────────────────
 * · **목록 첫 쪽만** 봅니다. 상세 글은 열지 않고 본문도 안 가져옵니다
 * · robots.txt 를 지킵니다 (2026-09-30 확인 — User-agent: * / Allow: /)
 * · 1시간에 한 번, 아침 7시 ~ 밤 10시
 * · **관리자만** 봅니다. 회원 화면에 절대 안 씁니다
 * · 경쟁사 공고를 우리 공고로 옮겨 싣지 않습니다 (rival_post 는 job_posts 와 따로입니다)
 * · 쓰는 것은 「이 기관을 우리도 봐야겠다」 는 신호뿐입니다
 *
 * ── 이용약관 ─────────────────────────────────────────────────
 * 세중님이 2026-09-30 에 브라우저로 직접 확인 — 크롤링·복제·상업적 이용 금지 문구 없음.
 * **굿잡피티는 약관에 금지 조항이 있어 자동으로 안 봅니다** (손으로만 넣습니다).
 *
 * ── 첫 실행은 「기존」 입니다 ─────────────────────────────────
 * 땡큐오티는 게시 날짜를 안 줍니다. 켠 시점에 이미 목록에 있던 것은 **언제 올라왔는지
 * 모릅니다.** 그래서 「기존」 으로 표시하고 빠름·늦음 셈에서 뺍니다.
 * 「우리에게 없음」 여부만 봅니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 목록읽기, 볼분류, 목록주소 } from './rival-ty.mjs';
import { robots읽기, 가도되나 } from './robots.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const SOURCE = 'HS3';                 /* 열쇠는 서버 전용 값을 씁니다 */
const 경쟁사 = '땡큐오티';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
  + '(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

const dry = process.argv.includes('--dry');

function env() {
  const out = {};
  for (const f of [path.join(여기, '..', '.env.local'), path.join(여기, '..', '.env'),
    path.join(여기, '..', 'web', '.env.local')]) {
    if (!fs.existsSync(f)) continue;
    fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((l) => {
      const m = l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*?)\s*$/);
      if (m && !out[m[1]]) out[m[1]] = m[2].replace(/^'|'$/g, '');
    });
  }
  Object.keys(process.env).forEach((k) => { if (process.env[k]) out[k] = process.env[k]; });
  out.SUPABASE_ANON_KEY = out.SUPABASE_ANON_KEY || out.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  out.SUPABASE_URL = out.SUPABASE_URL || out.NEXT_PUBLIC_SUPABASE_URL;
  return out;
}
const cfg = env();

async function rpc(fn, body) {
  const k = cfg.SUPABASE_ANON_KEY;
  const r = await fetch(cfg.SUPABASE_URL + '/rest/v1/rpc/' + fn, {
    method: 'POST',
    headers: { apikey: k, Authorization: 'Bearer ' + k, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(fn + ' HTTP ' + r.status + ' · ' + t.slice(0, 250));
  try { return JSON.parse(t); } catch { return t; }
}

/* 제목에서 기관 이름을 어림합니다. 틀릴 수 있어 화면에 「어림」 이라고 밝힙니다 */
function 기관어림(제목) {
  const t = String(제목 || '');
  const m = t.match(/([가-힣A-Za-z0-9()·\s]{2,24}?(?:대학교병원|대학병원|의료원|병원|의원|센터|공단|재단|개발원|보건소))/);
  return m ? m[1].trim() : '';
}

const t0 = Date.now();
console.log('경쟁사 관찰 (' + 경쟁사 + ') · '
  + new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) + (dry ? ' · --dry' : ''));
console.log('  목록 첫 쪽만 봅니다. 상세는 열지 않습니다');
console.log('  견줄 분류 — ' + 볼분류.map((x) => '[' + x + ']').join(' '));

/* ── ① robots.txt ─────────────────────────────────────────── */
const 집 = new URL(목록주소).origin;
const rb = await fetch(집 + '/robots.txt', { headers: { 'User-Agent': UA } });
const 판 = 가도되나(robots읽기(rb.ok ? await rb.text() : ''), new URL(목록주소).pathname);
console.log('\n① robots.txt — ' + (판.됨 ? '가도 됩니다' : '★ 막혔습니다') + ' · ' + 판.왜);
if (!판.됨) { console.error('robots.txt 가 막았습니다. 아무것도 안 했습니다'); process.exit(0); }

/* ── ② 목록 한 번 ─────────────────────────────────────────── */
const r = await fetch(목록주소, { headers: { 'User-Agent': UA } });
if (!r.ok) {
  console.error('② 목록 HTTP ' + r.status + ' · 응답 앞 500자 — '
    + (await r.text()).replace(/\s+/g, ' ').slice(0, 500));
  process.exit(1);
}
const 전부 = 목록읽기(await r.text());
const 볼것 = 전부.filter((x) => 볼분류.includes(x.분류));
console.log('\n② 목록 ' + 전부.length + '건 · 번호 '
  + (전부.length ? 전부[전부.length - 1].번호 + '~' + 전부[0].번호 : '-'));
const 갈래 = {};
전부.forEach((x) => { 갈래[x.분류] = (갈래[x.분류] || 0) + 1; });
console.log('   분류 — ' + Object.entries(갈래).map(([k, v]) => '[' + k + '] ' + v).join(' · '));
console.log('   견줄 것 ' + 볼것.length + '건 (나머지는 저장하지 않습니다)');

if (dry) {
  볼것.forEach((x) => console.log('     ' + String(x.번호).padEnd(6)
    + ('[' + x.분류 + ']').padEnd(18) + 기관어림(x.제목).slice(0, 18).padEnd(20) + x.제목.slice(0, 40)));
  console.log('\n--dry 라 담지 않았습니다. ' + Math.round((Date.now() - t0) / 1000) + '초');
  process.exit(0);
}

/* ── ③ 담기 ───────────────────────────────────────────────── */
/* 「처음 켜는 것인가」 는 **DB 가 정합니다.**
   여기서 세려다 anon 권한이 없어 조용히 false 가 됐습니다 (2026-09-30).
   그 바람에 켤 때 이미 있던 6건이 「새로 올라온 것」 으로 잡혔습니다. */

const 줄 = 볼것.map((x) => ({
  경쟁사, 글번호: String(x.번호), 제목: x.제목, 기관분류: x.분류,
  기관명: 기관어림(x.제목), 지역: x.지역, 고용형태: x.고용형태, 링크: x.링크,
}));
const 담음 = await rpc('rival_put', {
  p_secret: cfg.COLLECT_KEY_HS3, p_source: SOURCE, p_rows: 줄, p_첫판: 첫판,
});
console.log('\n③ 담음 — 새것 ' + 담음['새것'] + ' · 이미 있던 것 ' + 담음['이미 있던 것']);

/* ── ④ 견주기 ─────────────────────────────────────────────── */
const 견줌 = await rpc('rival_match_go', { p_secret: cfg.COLLECT_KEY_HS3, p_source: SOURCE });
console.log('④ 견줌 — ' + Object.entries(견줌).map(([k, v]) => k + ' ' + v).join(' · '));
console.log('\n' + Math.round((Date.now() - t0) / 1000) + '초');
