/* 원문이 살아 있는지 확인합니다 — 주 1회 ([C] · 2026-09-28).
 *
 *   node tools/alive.mjs --dry     확인만 하고 기록하지 않습니다
 *   node tools/alive.mjs           확인하고 기록합니다
 *   node tools/alive.mjs --n 20    앞 20건만
 *
 * ── 왜 있나 ────────────────────────────────────────────────
 * 마감일이 없는 공고(「수시모집」 「상시」)는 날짜로 끝을 알 수 없습니다.
 * 지금은 처음 본 날부터 45일로 끊고 있는데, 그건 어림입니다.
 * **원문이 살아 있는지 직접 보는 것**이 정확합니다.
 *
 * ── 세 갈래로만 답합니다 ────────────────────────────────────
 *   alive    글이 있습니다
 *   gone     404 · 「존재하지 않는 글」 · 목록으로 튕김 → 두 번 연속이면 감춤
 *   unknown  타임아웃 · 5xx · 못 붙음 → **아무것도 안 바꿉니다**
 *
 * unknown 을 따로 두는 까닭 — 사이트가 잠깐 아픈 것을 「없어졌다」 로 세면
 * 멀쩡한 공고가 사라집니다. 사이트 장애는 우리 잘못이 아니고 공고 잘못도 아닙니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 붙여받기 } from './certs/index.mjs';
import { 목록상태, 목록상태셈, 본문상태, 알림상태, 없어짐말, 제목속살 } from './hosp/hs_목록상태.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

function env() {
  const out = {};
  for (const f of [path.join(여기, '..', '.env.local'), path.join(여기, '..', 'web', '.env.local')]) {
    if (!fs.existsSync(f)) continue;
    fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((l) => {
      const m = l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*?)\s*$/);
      if (m && !out[m[1]]) out[m[1]] = m[2];
    });
  }
  Object.keys(process.env).forEach((k) => { if (process.env[k]) out[k] = process.env[k]; });
  out.SUPABASE_ANON_KEY = out.SUPABASE_ANON_KEY || out.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  out.SUPABASE_URL = out.SUPABASE_URL || out.NEXT_PUBLIC_SUPABASE_URL;
  return out;
}

/* ⚠ **anon 열쇠만 씁니다** (2026-09-28).
   전에는 SUPABASE_SERVICE_KEY 를 먼저 집었습니다. 그래서 집 컴퓨터에서는 통하고
   GitHub 에서는 401 permission denied for function alive_targets 로 죽었습니다 —
   **GitHub 과 다른 열쇠로 시험한 것**이 잘못이었습니다.
   service_role 열쇠는 GitHub 에 넣지 않습니다. 권한은 함수 안의 ALIVE_KEY 검사로 봅니다. */
async function rpc(cfg, fn, body) {
  const k = cfg.SUPABASE_SERVICE_KEY || cfg.SUPABASE_ANON_KEY;   /* 창구는 service_role 로 (2026-10-11) */
  if (!k) throw new Error('SUPABASE_ANON_KEY 가 없습니다');
  const r = await fetch(cfg.SUPABASE_URL + '/rest/v1/rpc/' + fn, {
    method: 'POST',
    headers: { apikey: k, Authorization: 'Bearer ' + k, 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(r.status + ' ' + t.slice(0, 300));
  return t ? JSON.parse(t) : null;
}

/* 「글이 없어졌다」 고 사이트가 말하는 방식들 —
   ★ 2026-10-18 에 `hosp/hs_목록상태.mjs` **한 자리로 옮겼습니다** (지침 6절).
   여기 있던 것을 제가 원문링크점검.mjs 에 베껴 두 벌이 됐고, 워크넷의
   「구인정보를 확인할 수 없습니다」 를 한쪽에만 넣을 뻔했습니다. */

async function 하나(x) {
  /* 중간 인증서가 빠진 병원 10곳은 받아둔 것을 붙여 받습니다 (검증은 켠 채로).
     안 그러면 동래봉생병원처럼 늘 「판단 못 함」 으로 남습니다 */
  const g = await 붙여받기(x.url, { headers: { 'User-Agent': UA, 'Accept-Language': 'ko' }, timeout: 20000 });
  if (g.왜) return { 결과: 'unknown', 왜: g.왜.slice(0, 40) };
  const r = { status: g.code, headers: g.headers };
  const buf = g.buf;
  if (r.status === 404 || r.status === 410) return { 결과: 'gone', 왜: 'HTTP ' + r.status };
  if (r.status >= 500) return { 결과: 'unknown', 왜: 'HTTP ' + r.status + ' (사이트 장애)' };
  if (r.status === 403 || r.status === 401) return { 결과: 'unknown', 왜: 'HTTP ' + r.status + ' (막힘)' };
  if (r.status >= 400) return { 결과: 'unknown', 왜: 'HTTP ' + r.status };

  /* 인코딩을 보고 글자로 (EUC-KR 쪽이 아직 많습니다) */
  const ct = r.headers.get('content-type') || '';
  let cs = (ct.match(/charset=["']?([\w-]+)/i) || [])[1]
    || (buf.subarray(0, 2048).toString('latin1').match(/charset=["']?([\w-]+)/i) || [])[1] || 'utf-8';
  let html;
  try { html = new TextDecoder(cs.toLowerCase()).decode(buf); } catch { html = buf.toString('utf8'); }

  if (없어짐말.test(html)) return { 결과: 'gone', 왜: '「' + (html.match(없어짐말) || [''])[0] + '」' };
  /* ── ⑦ 알림창으로만 마감을 알리는 곳 (2026-10-17) ───────────
     태그를 **걷기 전에** 봅니다 — alert 은 <script> 안이라 걷으면 사라지고,
     쪽이 메뉴뿐이어도 200자를 넘어 아래 「판단 못 함」 에도 안 걸립니다.
     고신대 마감 공고 2건이 그래서 회원 화면에 남아 있었습니다.
     규칙은 hosp/hs_목록상태.mjs 의 알림상태() 한 곳입니다 (지침 6절) */
  const A = 알림상태(html);
  if (A.결과 === 'closed') return { 결과: 'closed', 까닭: '알림창이 마감', 왜: A.왜 };

  /* 알맹이가 거의 없으면 판단을 미룹니다 — 「없다」 고 단정하지 않습니다 */
  const 글 = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (글.length < 200) return { 결과: 'unknown', 왜: '본문이 ' + 글.length + '자뿐 (판단 못 함)' };

  /* ── ② 제목에 마감 표시 (2026-10-07) ────────────────────────
     글을 지우지 않고 **제목만** 「[모집]」 → 「[마감]」 으로 고치는 곳이 있습니다.
     인화재단 한국병원·백제병원이 그렇습니다. 원문이 살아 있나만 보면 영영 안 걸립니다.
     ★ 우리가 담은 제목 앞 토막이 그 줄에 같이 있어야 **이 공고의** 마감입니다.
       옆 글 목록의 「(마감)○○ 채용공고」 를 보고 엉뚱한 판정을 하면 안 됩니다
       (포항세명기독병원에서 실제로 그럴 뻔했습니다) */
  /* ★ 2026-10-20 — **우리 제목의 말머리를 먼저 뗍니다** (세중님 4번).
     바뀌는 것이 바로 그 말머리입니다. 「[모집]재활치료센터 물」 로 찾으면
     쪽에는 「[마감]재활치료센터 …」 라 **한 번도 못 찾습니다** — 인화재단
     한국병원 HS2056094273 이 그래서 36일째 회원 화면에 남아 있었습니다.
     떼는 규칙은 `hosp/hs_목록상태.mjs` 의 `제목속살()` 한 자리입니다 (지침 6절). */
  const 열쇠말 = 제목속살(x.title).replace(/\s+/g, ' ').slice(0, 12).trim();
  const 붙 = (s) => String(s || '').replace(/\s/g, '');
  const 글붙 = 붙(글);
  const 제목있나 = 열쇠말.length >= 6 && 글붙.includes(붙(열쇠말));
  if (제목있나) {
    const i = 글붙.indexOf(붙(열쇠말));
    const 둘레 = 글붙.slice(Math.max(0, i - 20), i + 붙(열쇠말).length + 20);
    const m = 둘레.match(/\[?\(?\s*(마감|채용완료|모집종료|접수마감|채용종료)\s*\)?\]?/);
    if (m) return { 결과: 'closed', 왜: '제목에 「' + m[1] + '」 가 붙었습니다' };
  }

  /* ── ③ 본문에 「접수기간 : <마감>」 (2026-10-07) ─────────────
     굿모닝병원이 이 꼴입니다 — 기간 자리에 날짜 대신 「<마감>」 을 적습니다 */
  if (/(접수|모집|원서)\s*기간[^가-힣0-9]{0,8}(＜|<|&lt;|\[|\()?\s*마감/.test(글)) {
    return { 결과: 'closed', 왜: '본문 접수기간 자리에 「마감」' };
  }

  /* ── ⑥ **목록 줄**의 상태 칸 (2026-10-12) ──────────────────
     ②는 상세 쪽의 제목을 봅니다. 그런데 병원 게시판은 상태를 **목록 쪽의
     칸**에 적는 곳이 많아, 상세를 열면 그 표시가 없습니다.

       울산엘리야병원   목록 줄 「[채용완료] 물리치료팀 물리치료사」
       청주성모병원     목록 줄 「… 물리치료사 채용  모집완료  09-18」
       부산광역시의료원  목록 줄 「1181  완료  직원 모집 공고(물리치료사 - 기간제)」

     2026-10-12 에 세어 보니 회원에게 보이는 병원 공고 46건 중 **11건이 그
     줄에서 이미 마감**이었습니다. 상세만 봐서는 영영 안 걸립니다.

     규칙은 `hosp/hs_목록상태.mjs` 한 곳에 둡니다 — 조사 도구
     (`마감표시_줄마다.mjs`)와 같은 자리를 씁니다 (지침 6절).
     목록은 **기관마다 한 번만** 받아 돌려 씁니다.

     ★ ④보다 **먼저** 봅니다. 목록이 「마감」이라고 적었으면 접수기간을
       채우는 것보다 그 말이 셉니다. */
  try {
    const L = await 목록상태(x.org_name, x.title);
    if (L.결과 === 'closed') {
      /* 까닭 글귀를 **같이 보냅니다** — alive_mark 가 그대로 적습니다 (2026-10-12).
         안 보내면 「제목·본문에 마감」 으로 적혀, 관리자가 상세를 열어
         「마감이라는 말이 어디 있지」 하고 찾게 됩니다 */
      return { 결과: 'closed', 까닭: '목록 줄에 마감',
        왜: L.왜 + ' — ' + String(L.줄글 || '').slice(0, 60) };
    }
  } catch (e) {
    /* 목록을 못 받아도 상세 판정은 그대로 씁니다 — 판단을 미루지 않습니다 */
    console.error('    (목록 줄을 못 봤습니다 · ' + String(e && e.message || e).slice(0, 60) + ')');
  }

  /* ── ③-2 본문의 **상태 칸** (2026-10-12) ──────────────────
     ③은 「접수기간 자리의 마감」만 봅니다. 그런데 상태를 **딴 자리**에 적는
     곳이 있습니다 — 동래봉생병원이 그렇습니다.
       「접수기간 ~ 채용시 … 채용형태 정규직 **진행상황 마감** 1.모집인원 : 1명」
     목록 줄 쪽(⑥)은 같은 제목이 두 줄이라 「모름」으로 비켰고, 그래서
     **마감인데 회원에게 보이는 공고 1건**이 남아 있었습니다.
     규칙은 `hosp/hs_목록상태.mjs` 의 `본문상태()` 한 곳입니다 (지침 6절). */
  const B = 본문상태(글);
  if (B.결과 === 'closed') {
    return { 결과: 'closed', 까닭: '본문 상태가 마감', 왜: B.왜 + ' — ' + String(B.줄글 || '').slice(0, 60) };
  }

  /* ── ④ 본문 「접수기간」 앞뒤만 잘라 마감일 읽기 (2026-10-07) ─
     ★ **글 전체를 넣으면 안 됩니다.** 임용일·면접일·발표일이 섞여
       엉뚱한 날짜가 마감일이 됩니다. 「접수기간」 뒤 60자만 봅니다.
     날짜 읽기는 DB 의 deadline_from_title() 한 벌을 씁니다 —
     여기서 또 쓰면 규칙이 두 벌로 갈립니다 (작업지침 6절).
     그래서 **자른 글만** 돌려주고 날짜는 DB 가 읽습니다 */
  const 기 = 글.match(/(?:접수|모집|원서)\s*기간[^가-힣0-9]{0,8}([\s\S]{0,60})/);
  if (기) return { 결과: 'alive', 왜: '쪽이 열립니다', 접수기간: 기[1].trim().slice(0, 60) };

  /* ── ⑤ 목록으로 튕김 (2026-10-07) ───────────────────────────
     서산중앙병원이 이 꼴입니다 — 글을 지우면 307 로 **목록 쪽**으로 보냅니다.
     목록 쪽은 200 이고 81KB 라 「살아 있음」 으로 세어졌습니다.
     alive.yml 머리글에는 처음부터 「목록으로 튕김 → gone」 이라 적혀 있었는데
     코드에 그 판정이 없었습니다.
     ★ **제목을 못 찾았을 때만** 봅니다. 주소가 바뀌어도 그 글이 거기 있으면
       살아 있는 것입니다 (게시판이 주소를 다듬는 곳이 있습니다) */
  const 끝주소 = String(g.url || x.url);
  if (!제목있나 && 끝주소 !== x.url) {
    const 전길 = new URL(x.url).pathname;
    const 끝길 = new URL(끝주소).pathname;
    if (전길 !== 끝길) {
      return { 결과: 'gone', 왜: '목록으로 튕김 — ' + 끝길.slice(0, 50) };
    }
  }

  return { 결과: 'alive', 왜: 제목있나 ? '제목이 쪽에 있습니다' : '쪽은 열립니다(제목은 못 찾음)' };
}

/* ── 본체 ── */
const t0 = Date.now();          /* 박동의 took_ms 가 씁니다 (2026-10-07) */
const argv = process.argv.slice(2);

/* 어디서 터져도 박동을 남기고 나갑니다.
   ★ **둘 다 걸어야 합니다** — 맨 위 await 가 깨지면 Node 는
     `unhandledRejection` 이 아니라 **`uncaughtException`** 으로 올립니다.
     2026-10-07 에 경쟁사 수집기에서 실제로 겪었습니다 (한쪽만 걸어 박동이 안 남음).
   ★ 박동 자체가 실패해도 던지지 않습니다 — 진짜 까닭을 덮으면 안 됩니다 */
let 박동남겼나 = false;
async function 박동(ok, 왜, 셈) {
  if (박동남겼나) return;
  박동남겼나 = true;
  try {
    await rpc(env(), 'collect_beat', {
      p_secret: env().ALIVE_KEY, p_source: 'ALIVE',
      p_beat: { took_ms: Date.now() - t0, ok, 왜: 왜 || '', ...(셈 || {}) },
    });
    console.log('박동 — ALIVE · ' + (ok ? '정상' : '탈남'));
  } catch (e) {
    console.error('박동을 못 남겼습니다 — ' + String(e && e.message || e).slice(0, 120));
  }
}
for (const 언제 of ['uncaughtException', 'unhandledRejection']) {
  process.on(언제, async (e) => {
    const 왜 = String(e && (e.message || e)).slice(0, 500);
    console.error('\n★ 탈났습니다 (' + 언제 + ') — ' + 왜);
    if (!argv.includes('--dry')) await 박동(false, 왜);
    process.exit(1);
  });
}
const dry = argv.includes('--dry');
const 몇 = argv.includes('--n') ? Number(argv[argv.indexOf('--n') + 1]) || 0 : 0;
const cfg = env();
if (!cfg.SUPABASE_URL) { console.error('SUPABASE_URL 이 없습니다'); process.exit(1); }

if (!cfg.ALIVE_KEY) { console.error('ALIVE_KEY 가 없습니다 — 함수 권한을 이 열쇠로 봅니다'); process.exit(1); }
/* ★ Supabase 는 줄을 돌려주는 함수의 응답을 **100줄로 자릅니다** (2026-10-02 확인).
   `p_n: 300` 으로 물어도 100줄만 옵니다. 지금 대상이 84건이라 안 걸리지만,
   100을 넘으면 조용히 잘려 뒷부분을 **그 주에 못 봅니다.**
   되묻는 것으로는 못 풉니다 — 표시(alive_mark)를 하기 전에는 같은 100건이 또 옵니다.
   그래서 100이 꽉 차면 **소리를 냅니다.** 그때 이 도구를 나눠 도는 꼴로 고쳐야 합니다.
   (나라일터 순찰이 376건을 기억했는데 100건만 건너뛴 것이 같은 한도였습니다) */
/* --내린것 — 날수로 **이미 내려간** 공고까지 돌아봅니다 (2026-10-07).
   「확인 필요」 칸에 쌓인 것을 사람이 하나씩 보지 않게 하려는 길입니다.
   접수기간을 찾아 아직 안 지났으면 되살립니다 (DB 의 alive_mark 가 합니다).
   평소 정찰은 이 깃발 없이 돌립니다 — 보이는 공고만 봅니다 */
const 내린것 = argv.includes('--내린것');
const 볼것0 = await rpc(cfg, 'alive_targets',
  { p_secret: cfg.ALIVE_KEY, p_n: 100, p_내린것: 내린것 });
if ((볼것0 || []).length >= 100) {
  console.error('★ 대상이 100건으로 꽉 찼습니다 — Supabase 가 거기서 자릅니다.');
  console.error('  더 있을 수 있습니다. 이번 주에 못 본 것은 다음 주로 밀립니다.');
  console.error('  100을 계속 넘으면 alive.mjs 를 「100건씩 보고 표시하고 또 받기」 꼴로 고쳐야 합니다.');
}
const 볼것 = 몇 ? (볼것0 || []).slice(0, 몇) : (볼것0 || []);
console.log('원문 확인 — 마감일 없는 공고 ' + 볼것.length + '건'
  + (dry ? ' (--dry · 기록하지 않습니다)' : ''));
if (!볼것.length) {
  console.log('확인할 것이 없습니다 (최근 6일 안에 다 봤습니다)');
  /* ★ 볼 것이 없어도 박동은 남깁니다 — 안 남기면 「멈춘 것」 과 구별이 안 됩니다 */
  if (!dry) await 박동(true, '', { 본곳: 0, 메모: { 왜: '볼 것이 없었습니다' } });
  process.exit(0);
}

const 결과 = [];
for (const x of 볼것) {
  const r = await 하나(x);
  /* 접수기간은 **자른 글 그대로** 보냅니다. 날짜 읽기는 DB 의
     deadline_from_title() 한 벌이 합니다 (작업지침 6절) */
  결과.push({ id: x.id, 결과: r.결과,
    ...(r.접수기간 ? { 접수기간: r.접수기간 } : {}),
    ...(r.까닭 ? { 까닭: r.까닭 } : {}) });
  const 표 = r.결과 === 'alive' ? '○' : r.결과 === 'gone' ? '✗' : r.결과 === 'closed' ? '■' : '?';
  console.log(표 + ' ' + String(x.org_name).slice(0, 16).padEnd(18)
    + String(x.title).slice(0, 40).padEnd(42)
    + (x.gone_streak ? '연속 ' + x.gone_streak + ' ' : '      ')
    + r.왜 + (r.접수기간 ? '  【접수기간 ' + r.접수기간.slice(0, 40) + '】' : ''));
  await new Promise((y) => setTimeout(y, 1200));
}

const 셈 = 결과.reduce((a, x) => (a[x.결과] = (a[x.결과] || 0) + 1, a), {});
console.log('\n── 살아 있음 ' + (셈.alive || 0) + ' · 사라짐 ' + (셈.gone || 0)
  + ' · 마감됨 ' + (셈.closed || 0) + ' · 판단 못 함 ' + (셈.unknown || 0)
  + ' · 접수기간 찾음 ' + 결과.filter((x) => x.접수기간).length);
/* ⑥ 이 무슨 일을 했는지 **숫자로** 적습니다 — 안 적으면 돌았는지 모릅니다 */
const 목셈 = 목록상태셈();
console.log('   목록 줄 — 받은 기관 ' + 목셈.받은곳 + ' · 못 받은 기관 ' + 목셈.못받은곳
  + ' · 판정 ' + (Object.entries(목셈.판정).map(([k, v]) => k + ' ' + v).join(' · ') || '없음'));

if (dry) { console.log('--dry 라 기록하지 않았습니다.'); process.exit(0); }
const 답 = await rpc(cfg, 'alive_mark', { p_secret: cfg.ALIVE_KEY, p_rows: 결과 });
console.log('기록 — ' + Object.entries(답 || {}).map(([k, v]) => k + ' ' + v).join(' · '));

/* 박동 — 경로 ALIVE. 늦음 기준 36시간 (매일 02:15 에 도니 24시간이 평소 간격) (2026-10-07).
   탈이 났을 때는 위의 손잡이가 ok=false 로 남깁니다 */
await 박동(true, '', {
  본곳: 볼것.length,
  메모: { ...셈, 접수기간찾음: 결과.filter((x) => x.접수기간).length,
    내린것까지: 내린것, 기록: 답 },
});
