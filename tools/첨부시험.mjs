/* 첨부시험 — 공고 첨부가 **진짜로** 되는지 HTTP 로 확인합니다.
 *
 *   node tools/첨부시험.mjs
 *
 * 왜 SQL 로 안 하나 — 지침 12 절입니다. 브라우저는 PostgREST·Storage API 를
 * 거쳐 갑니다. SQL 로 `insert into storage.objects` 를 해 보는 것은
 * **버킷의 형식·크기 제한을 건너뜁니다.** 그래서 보내는 쪽과 같은 길
 * (anon 열쇠 + 회원 토큰 → /storage/v1 · /rest/v1/rpc)로 확인합니다.
 *
 * 비번은 환경변수로만 받습니다 (MASTER_EMAIL · MASTER_PW).
 * 서버 .env 에서 프로세스 안으로만 넘기는 법 —
 *   MASTER_EMAIL=$(ssh potjob 'grep -m1 ^MASTER_EMAIL ~/potlab/.env | cut -d= -f2-') \
 *   MASTER_PW=$(ssh potjob 'grep -m1 ^MASTER_PW ~/potlab/.env | cut -d= -f2-') \
 *   node tools/첨부시험.mjs
 * 값은 찍지 않습니다.
 *
 * 끝나면 넣은 첨부를 **같은 작업 안에서** 치웁니다 (지침 8-9).
 * 줄은 `지운때` 만 찍히고 파일은 남습니다 — 파일 치우기는 승인대기 ⑦ 몫입니다.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 뿌리 = path.join(여기, '..');

function env() {
  const out = {};
  /* anon 열쇠는 web/.env.local 에 있습니다 (화면이 쓰는 그 열쇠) */
  for (const f of [path.join(뿌리, '.env'), path.join(뿌리, '.env.local'),
                   path.join(뿌리, 'web', '.env.local')]) {
    if (!fs.existsSync(f)) continue;
    fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((l) => {
      const m = l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*?)\s*$/);
      if (m && !out[m[1]]) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    });
  }
  for (const k of Object.keys(process.env)) if (process.env[k]) out[k] = process.env[k];
  return out;
}

const cfg = env();
const URL_ = (cfg.NEXT_PUBLIC_SUPABASE_URL || cfg.SUPABASE_URL || '').replace(/\/+$/, '');
const ANON = cfg.NEXT_PUBLIC_SUPABASE_ANON_KEY || cfg.SUPABASE_ANON_KEY;
const 공고 = cfg.CAPTURE_JOB || 'BIZ000005';

if (!URL_ || !ANON) { console.error('SUPABASE URL · ANON 열쇠가 없습니다 (.env).'); process.exit(1); }
if (!cfg.MASTER_EMAIL || !cfg.MASTER_PW) {
  console.error('MASTER_EMAIL · MASTER_PW 가 없습니다. 위 주석의 ssh 한 줄로 넘기십시오.');
  process.exit(1);
}

const 탈 = [];
const 적기 = (됐나, 말) => { console.log((됐나 ? '  ○ ' : '  ✗ ') + 말); if (!됐나) 탈.push(말); };

/* ── 길 ──────────────────────────────────────────── */
let 토큰 = null;
const 머리 = () => ({ apikey: ANON, Authorization: 'Bearer ' + (토큰 ?? ANON) });

async function rpc(이름, 몸, 손님 = false) {
  const t = 손님 ? null : 토큰;
  const r = await fetch(`${URL_}/rest/v1/rpc/${encodeURIComponent(이름)}`, {
    method: 'POST',
    headers: { apikey: ANON, Authorization: 'Bearer ' + (t ?? ANON), 'Content-Type': 'application/json' },
    body: JSON.stringify(몸 ?? {}),
  });
  const 글 = await r.text();
  let 값 = null; try { 값 = 글 ? JSON.parse(글) : null; } catch { 값 = 글; }
  return { ok: r.ok, status: r.status, 값 };
}

async function 올리기(자리, 바이트, 형식, 손님 = false) {
  const t = 손님 ? null : 토큰;
  const r = await fetch(`${URL_}/storage/v1/object/notices/${자리}`, {
    method: 'POST',
    headers: { apikey: ANON, Authorization: 'Bearer ' + (t ?? ANON), 'Content-Type': 형식 },
    body: 바이트,
  });
  return { ok: r.ok, status: r.status, 글: await r.text() };
}

/* ── 시험용 파일 — **진짜 형식**으로 만듭니다 ───────────────
   PDF 는 앞 5글자가 %PDF- 여야 합니다 (지침 5절). */
function 시험pdf() {
  const s = '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n'
    + '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n'
    + '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\n'
    + 'trailer<</Root 1 0 R>>\n%%EOF\n';
  return Buffer.from(s, 'latin1');
}
/* 1x1 PNG */
const 시험png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
  'base64');

/* ── 돌리기 ──────────────────────────────────────── */
console.log('\n공고 첨부 시험 —', 공고, '\n');

/* 1. 로그인 */
{
  const r = await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: cfg.MASTER_EMAIL, password: cfg.MASTER_PW }),
  });
  const j = await r.json();
  토큰 = j.access_token ?? null;
  적기(!!토큰, '마스터 로그인' + (토큰 ? '' : ' — ' + (j.error_description ?? j.msg ?? r.status)));
  if (!토큰) process.exit(1);
}

/* 2. 페르소나를 「채용담당자」로 */
{
  const r = await rpc('페르소나바꾸기', { 'p_역할': '채용담당자' });
  적기(r.ok, '페르소나 → 채용담당자' + (r.ok ? '' : ' — ' + JSON.stringify(r.값)));
}

const 넣은것 = [];

/* 3. PDF·PNG 올리기 (담당자) */
for (const [이름, 바이트, 형식] of [
  ['시험-공고문.pdf', 시험pdf(), 'application/pdf'],
  ['시험-공고그림.png', 시험png, 'image/png'],
]) {
  /* ★ 저장소 열쇠는 ASCII 만 — 화면(notice-files.tsx)과 같은 규칙입니다 */
  const 확장자 = 이름.match(/\.[A-Za-z0-9]{1,8}$/)[0].toLowerCase();
  const 자리 = `${공고}/${crypto.randomUUID()}${확장자}`;
  const u = await 올리기(자리, 바이트, 형식);
  적기(u.ok, `담당자가 ${이름} 올리기` + (u.ok ? '' : ' — ' + u.status + ' ' + u.글.slice(0, 160)));
  if (!u.ok) continue;
  const g = await rpc('첨부올리기', {
    'p_갈래': '채용', 'p_경로': 자리, 'p_이름': 이름,
    'p_크기': 바이트.length, 'p_형식': 형식, 'p_공고': 공고,
  });
  적기(g.ok, `  첨부올리기 줄 남기기` + (g.ok ? ` (id ${g.값?.id})` : ' — ' + JSON.stringify(g.값)));
  if (g.ok && g.값?.id) 넣은것.push({ id: g.값.id, 자리, 형식, 바이트 });
}

/* 4. 남의 공고 폴더에는 못 올립니다 */
{
  const 진짜 = cfg.CAPTURE_REAL_JOB || 'WNK150012610080045';
  const u = await 올리기(`${진짜}/${crypto.randomUUID()}.pdf`, 시험pdf(), 'application/pdf');
  적기(!u.ok, `남의 공고(${진짜}) 폴더에는 못 올림` + (u.ok ? ' — **올라갔습니다**' : ` (${u.status})`));
}

/* 5. 버킷이 형식을 거릅니다 — .exe 를 pdf 라고 해도 */
{
  const u = await 올리기(`${공고}/${crypto.randomUUID()}.txt`, Buffer.from('MZ not a pdf'), 'text/plain');
  적기(!u.ok, '허용 안 한 형식(text/plain)은 버킷이 거름' + (u.ok ? ' — **올라갔습니다**' : ` (${u.status})`));
}

/* 6. 회원은 목록·경로·파일을 받습니다 */
{
  const l = await rpc('첨부목록', { 'p_갈래': '채용', 'p_공고': 공고 });
  적기(l.ok && Array.isArray(l.값) && l.값.length >= 넣은것.length,
    `회원이 보는 첨부 ${Array.isArray(l.값) ? l.값.length : '?'}개`);

  for (const a of 넣은것) {
    const h = await rpc('첨부하나', { p_id: a.id });
    적기(h.ok && h.값?.경로 === a.자리, `  첨부하나 ${a.id} 가 경로를 줌`);
    if (!h.값?.경로) continue;
    const s = await fetch(`${URL_}/storage/v1/object/sign/notices/${h.값.경로}`, {
      method: 'POST', headers: { ...머리(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresIn: 60 }),
    });
    const sj = await s.json().catch(() => null);
    적기(s.ok && !!sj?.signedURL, `  서명 주소 받기`);
    if (!sj?.signedURL) continue;
    const f = await fetch(URL_ + '/storage/v1' + sj.signedURL.replace(/^\/?/, '/'));
    const b = Buffer.from(await f.arrayBuffer());
    const 같나 = b.length === a.바이트.length && b.subarray(0, 5).equals(a.바이트.subarray(0, 5));
    적기(f.ok && 같나,
      `  내려받은 파일이 올린 것과 같음 (${b.length}바이트, 앞 5글자 `
      + JSON.stringify(b.subarray(0, 5).toString('latin1')) + ')');
  }
}

/* 7. 비회원은 아무 길도 없습니다 */
{
  const l = await rpc('첨부목록', { 'p_갈래': '채용', 'p_공고': 공고 }, true);
  적기(!l.ok || (Array.isArray(l.값) && l.값.length === 0),
    `비회원 첨부목록 = ${l.ok ? (Array.isArray(l.값) ? l.값.length + '개' : '?') : l.status}`);

  for (const a of 넣은것.slice(0, 1)) {
    const h = await rpc('첨부하나', { p_id: a.id }, true);
    적기(!h.ok || h.값 === null, `비회원 첨부하나 = ${h.ok ? JSON.stringify(h.값) : h.status}`);

    const d = await fetch(`${URL_}/storage/v1/object/notices/${a.자리}`,
      { headers: { apikey: ANON, Authorization: 'Bearer ' + ANON } });
    적기(!d.ok, `비회원이 경로를 알아도 파일을 못 엶 (${d.status})`);

    const s = await fetch(`${URL_}/storage/v1/object/sign/notices/${a.자리}`, {
      method: 'POST',
      headers: { apikey: ANON, Authorization: 'Bearer ' + ANON, 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresIn: 60 }),
    });
    적기(!s.ok, `비회원이 서명 주소를 못 만듦 (${s.status})`);
  }
}

/* 8. 치우기 — 넣은 줄은 같은 작업 안에서 (지침 8-9).
   --남겨두기 를 주면 둡니다. 인계 캡처에 첨부 칸이 **차 있는 모습**이
   있어야 해서입니다. 남긴 줄은 `시험자료 = true` 라 회원에게 안 보이고
   승인대기 ⑥⑦⑩ 에서 함께 치웁니다 */
const 남길까 = process.argv.includes('--남겨두기');
for (const a of (남길까 ? [] : 넣은것)) {
  const r = await rpc('첨부치우기', { p_id: a.id });
  적기(r.ok, `첨부 ${a.id} 치우기` + (r.ok ? '' : ' — ' + JSON.stringify(r.값)));
}

if (남길까 && 넣은것.length) {
  console.log(`  · 첨부 ${넣은것.map((a) => a.id).join(' · ')} 는 **남겨 뒀습니다** (캡처용 · 시험자료)`);
}

/* 9. 페르소나 되돌리기 */
{
  const r = await rpc('페르소나바꾸기', { 'p_역할': '관리자' });
  적기(r.ok, '페르소나 → 관리자 되돌림');
}

console.log(탈.length ? `\n✗ 안 된 것 ${탈.length}개\n` : '\n○ 전부 됐습니다\n');
process.exit(탈.length ? 1 : 0);
