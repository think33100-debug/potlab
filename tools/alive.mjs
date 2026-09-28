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
  const k = cfg.SUPABASE_ANON_KEY;
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

/* 「글이 없어졌다」 고 사이트가 말하는 방식들 — 200 으로 답하면서 글만 없는 곳이 많습니다 */
const 없어짐말 = /존재하지\s*않는\s*(글|게시물|페이지)|삭제된\s*(글|게시물)|없는\s*게시물|잘못된\s*접근|접근할\s*수\s*없|페이지를\s*찾을\s*수\s*없|Not\s*Found|해당\s*게시물이\s*없|게시물이\s*존재하지/i;

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
  /* 알맹이가 거의 없으면 판단을 미룹니다 — 「없다」 고 단정하지 않습니다 */
  const 글 = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (글.length < 200) return { 결과: 'unknown', 왜: '본문이 ' + 글.length + '자뿐 (판단 못 함)' };

  /* 제목의 앞 토막이 쪽에 있으면 확실히 살아 있습니다 */
  const 열쇠말 = String(x.title || '').replace(/\s+/g, ' ').slice(0, 12).trim();
  const 있나 = 열쇠말.length >= 6 && 글.replace(/\s/g, '').includes(열쇠말.replace(/\s/g, ''));
  return { 결과: 'alive', 왜: 있나 ? '제목이 쪽에 있습니다' : '쪽은 열립니다(제목은 못 찾음)' };
}

/* ── 본체 ── */
const argv = process.argv.slice(2);
const dry = argv.includes('--dry');
const 몇 = argv.includes('--n') ? Number(argv[argv.indexOf('--n') + 1]) || 0 : 0;
const cfg = env();
if (!cfg.SUPABASE_URL) { console.error('SUPABASE_URL 이 없습니다'); process.exit(1); }

if (!cfg.ALIVE_KEY) { console.error('ALIVE_KEY 가 없습니다 — 함수 권한을 이 열쇠로 봅니다'); process.exit(1); }
const 볼것0 = await rpc(cfg, 'alive_targets', { p_secret: cfg.ALIVE_KEY, p_n: 300 });
const 볼것 = 몇 ? (볼것0 || []).slice(0, 몇) : (볼것0 || []);
console.log('원문 확인 — 마감일 없는 공고 ' + 볼것.length + '건'
  + (dry ? ' (--dry · 기록하지 않습니다)' : ''));
if (!볼것.length) { console.log('확인할 것이 없습니다 (최근 6일 안에 다 봤습니다)'); process.exit(0); }

const 결과 = [];
for (const x of 볼것) {
  const r = await 하나(x);
  결과.push({ id: x.id, 결과: r.결과 });
  const 표 = r.결과 === 'alive' ? '○' : r.결과 === 'gone' ? '✗' : '?';
  console.log(표 + ' ' + String(x.org_name).slice(0, 16).padEnd(18)
    + String(x.title).slice(0, 40).padEnd(42)
    + (x.gone_streak ? '연속 ' + x.gone_streak + ' ' : '      ')
    + r.왜);
  await new Promise((y) => setTimeout(y, 1200));
}

const 셈 = 결과.reduce((a, x) => (a[x.결과] = (a[x.결과] || 0) + 1, a), {});
console.log('\n── 살아 있음 ' + (셈.alive || 0) + ' · 사라짐 ' + (셈.gone || 0)
  + ' · 판단 못 함 ' + (셈.unknown || 0));

if (dry) { console.log('--dry 라 기록하지 않았습니다.'); process.exit(0); }
const 답 = await rpc(cfg, 'alive_mark', { p_secret: cfg.ALIVE_KEY, p_rows: 결과 });
console.log('기록 — ' + Object.entries(답 || {}).map(([k, v]) => k + ' ' + v).join(' · '));
