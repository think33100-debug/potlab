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
/* 박동의 took_ms 가 이걸 씁니다 — 맨 위 await 가 깨져도 값이 있어야 합니다 */
const t0 = Date.now();

/* ⚠ **service 열쇠를 먼저 집습니다** (2026-10-07).
 *
 * 까닭 — `rival_match_go` 가 `57014 statement timeout` 으로 **매회** 죽고
 * 있었습니다. 2026-10-01 부터 93회, 하루 16번 도는 모든 회차입니다.
 * anon 역할 한도가 3초인데(pg_roles), 이 함수는 공고 전체에 `견줄이름()` 을
 * 걸고 유사도로 정렬합니다. 던지고 죽으니 박동도 안 남아 아무 표시가
 * 없었습니다 (알리오묶기_시간초과_조사_2026-10-07.md 2절).
 * service_role 에는 statement_timeout 이 없습니다.
 *
 * ★ 이 도구는 **서버 크론에서만** 돕니다 (`15 7-22 * * *`).
 *   GitHub Actions 에 없습니다 — service 열쇠를 GitHub Secrets 에 넣지 않습니다.
 *   브라우저 코드(web/)에도 넣지 않습니다.
 * ★ 열쇠가 없으면 anon 으로 내려갑니다 — 돌기는 하되 3초 한도를 받습니다.
 */
async function rpc(fn, body) {
  const k = cfg.SUPABASE_SERVICE_KEY || cfg.SUPABASE_ANON_KEY;
  const r = await fetch(cfg.SUPABASE_URL + '/rest/v1/rpc/' + fn, {
    method: 'POST',
    headers: { apikey: k, Authorization: 'Bearer ' + k, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(fn + ' HTTP ' + r.status + ' · ' + t.slice(0, 250));
  try { return JSON.parse(t); } catch { return t; }
}

/* ── 박동 ───────────────────────────────────────────────────────
 * 경로는 **RIVAL** 입니다. 병원 홈페이지 HS3 와 **따로** 둡니다 —
 * 열쇠만 HS3 것을 함께 씁니다. 한 경로로 묶으면 beat_health 의
 * 간격 가운데값이 뒤섞입니다 (~/경쟁률크론.sh 의 AL2C 와 같은 까닭).
 *
 * ★ **탈이 나도 반드시 남깁니다.** 안 남기면 멈춘 것과 구별이 안 됩니다.
 *   2026-10-01 부터 93회 죽는 동안 이게 없어 박동이 조용했습니다.
 * ★ 박동 자체가 실패해도 **던지지 않습니다.** 진짜 까닭을 덮으면 안 됩니다.
 * ★ --dry 에서는 남기지 않습니다.
 */
const BEAT_SOURCE = 'RIVAL';
let 박동남겼나 = false;
async function 박동(ok, 왜, 셈) {
  if (dry || 박동남겼나) return;
  박동남겼나 = true;
  try {
    await rpc('collect_beat', {
      p_secret: cfg.COLLECT_KEY_HS3, p_source: BEAT_SOURCE,
      p_beat: { took_ms: Date.now() - t0, ok, 왜: 왜 || '', ...(셈 || {}) },
    });
    console.log('박동 — ' + BEAT_SOURCE + ' · ' + (ok ? '정상' : '탈남'));
  } catch (e) {
    console.error('박동을 못 남겼습니다 — ' + String(e && e.message || e).slice(0, 120));
  }
}

/* 어디서 터져도 박동을 남기고 나갑니다.
 * ★ **둘 다 걸어야 합니다** (2026-10-07 에 실제로 겪었습니다).
 *   맨 위 await 가 깨지면 Node 는 `unhandledRejection` 이 아니라
 *   **`uncaughtException`** 으로 올립니다. 처음에 unhandledRejection 만
 *   걸어 두고 돌렸는데 박동이 안 남고 그냥 죽었습니다. */
for (const 언제 of ['uncaughtException', 'unhandledRejection']) {
  process.on(언제, async (e) => {
    const 왜 = String(e && (e.message || e)).slice(0, 500);
    console.error('\n★ 탈났습니다 (' + 언제 + ') — ' + 왜);
    await 박동(false, 왜);
    process.exit(1);
  });
}

/* 제목에서 기관 이름을 어림합니다. 틀릴 수 있어 화면에 「어림」 이라고 밝힙니다 */
function 기관어림(제목) {
  const t = String(제목 || '');
  const m = t.match(/([가-힣A-Za-z0-9()·\s]{2,24}?(?:대학교병원|대학병원|의료원|병원|의원|센터|공단|재단|개발원|보건소))/);
  return m ? m[1].trim() : '';
}

console.log('경쟁사 관찰 (' + 경쟁사 + ') · '
  + new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) + (dry ? ' · --dry' : ''));
console.log('  목록 첫 쪽만 봅니다. 상세는 열지 않습니다');
console.log('  견줄 분류 — ' + 볼분류.map((x) => '[' + x + ']').join(' '));

/* ── ① robots.txt ─────────────────────────────────────────── */
const 집 = new URL(목록주소).origin;
const rb = await fetch(집 + '/robots.txt', { headers: { 'User-Agent': UA } });
const 판 = 가도되나(robots읽기(rb.ok ? await rb.text() : ''), new URL(목록주소).pathname);
console.log('\n① robots.txt — ' + (판.됨 ? '가도 됩니다' : '★ 막혔습니다') + ' · ' + 판.왜);
if (!판.됨) {
  console.error('robots.txt 가 막았습니다. 아무것도 안 했습니다');
  await 박동(false, 'robots.txt 가 막았습니다 — ' + 판.왜);
  process.exit(0);
}

/* ── ② 목록 한 번 ─────────────────────────────────────────── */
const r = await fetch(목록주소, { headers: { 'User-Agent': UA } });
if (!r.ok) {
  console.error('② 목록 HTTP ' + r.status + ' · 응답 앞 500자 — '
    + (await r.text()).replace(/\s+/g, ' ').slice(0, 500));
  await 박동(false, '목록 HTTP ' + r.status);
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
  p_secret: cfg.COLLECT_KEY_HS3, p_source: SOURCE, p_rows: 줄,
});
if (담음['첫판']) console.log('\n③ 처음 켭니다 — 지금 목록에 있는 것은 모두 「기존」 으로 둡니다');
console.log('③ 담음 — 새것 ' + 담음['새것'] + ' · 이미 있던 것 ' + 담음['이미 있던 것']);

/* ── ④ 견주기 ─────────────────────────────────────────────── */
const 견줌 = await rpc('rival_match_go', { p_secret: cfg.COLLECT_KEY_HS3, p_source: SOURCE });
console.log('④ 견줌 — ' + Object.entries(견줌).map(([k, v]) => k + ' ' + v).join(' · '));

/* ── ⑤ 박동 ───────────────────────────────────────────────── */
await 박동(true, '', {
  본곳: 전부.length,
  담음: Number(담음['새것']) || 0,
  버림: 전부.length - 볼것.length,
  메모: { 견줄것: 볼것.length, 이미있던것: Number(담음['이미 있던 것']) || 0, 견줌 },
});
console.log('\n' + Math.round((Date.now() - t0) / 1000) + '초');
