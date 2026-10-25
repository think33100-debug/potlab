/* 홈페이지에서 **채용 게시판 주소**를 찾습니다 — 열어서 확인한 것만 (2026-10-25)
 *
 *   node tools/긁기/채용게시판찾기.mjs --몇개 20          봅니다 (마른)
 *   node tools/긁기/채용게시판찾기.mjs --몇개 20 --진짜    기관 표 채용페이지에 담습니다
 *
 * ── 왜 ───────────────────────────────────────────────────────
 * 10/24 밤에 사각지대 기관 **342곳**의 홈페이지를 담았습니다 (심평원 hospUrl·공공표 homepage,
 * 열어서 확인한 것만). 그 곳들의 **채용 게시판 주소**는 아직 모릅니다 — 손확인 ② 문서에
 * 「그 곳들은 제가 찾습니다」라고 적었으니 제 몫입니다.
 *
 * ── 울타리 (짐작 금지 · 우회 금지) ──────────────────────────
 *   ① robots 를 먼저 읽고 **금지면 두드리지 않습니다** · 같은 집 3.5초 (공통.mjs)
 *   ② 홈페이지에서 **「채용」 글자가 든 링크**만 봅니다 (입찰·입찰공고는 뺍니다)
 *   ③ 그 링크를 **열어 봅니다** — HTTP 200 이고 `표준읽기` 로 **줄이 하나라도** 나와야
 *      「채용 게시판」으로 봅니다. 줄이 0이면 **담지 않습니다**
 *   ④ 담을 때 근거 — `불변근거.채용페이지 = '홈페이지에서 찾음 <날짜> (링크 「…」 · 줄 N)'`
 *   ⑤ 이미 `채용페이지` 가 있는 기관은 **건드리지 않습니다**
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { 가도되나집, 받기, 자고 } from './공통.mjs';
import { 표준읽기 } from './읽기들.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 뿌리 = path.join(여기, '..', '..');
const argv = process.argv.slice(2);
const 진짜 = argv.includes('--진짜');
const 몇개 = Number(argv.includes('--몇개') ? argv[argv.indexOf('--몇개') + 1] : 20) || 20;

export const 채용말 = /(채용|구인|임용|인재\s*채용|직원\s*모집|인력\s*모집)/;
export const 빼는말 = /(입찰|낙찰|용역|물품|공사|수의계약|매각|임대)/;

if (argv.includes('--자기점검')) {
  const 잼 = [];
  const 보 = (무엇, 참) => 잼.push([무엇, !!참]);
  보('채용 글자를 잡는다', 채용말.test('채용공고') && 채용말.test('인재채용'));
  보('임용시험도 잡는다', 채용말.test('임기제공무원 임용시험'));
  보('입찰은 뺀다', 빼는말.test('입찰공고') && 빼는말.test('용역 입찰'));
  보('멀쩡한 글자는 안 뺀다', !빼는말.test('채용공고'));
  const 어긴것 = 잼.filter(([, ok]) => !ok);
  for (const [무엇, ok] of 잼) console.log((ok ? '  ○ ' : '  ✗ ') + 무엇);
  if (어긴것.length) { console.error('✗ 자기점검 ' + 어긴것.length + '가지 실패'); process.exit(1); }
  console.log('○ 자기점검 통과 — ' + 잼.length + '가지');
  process.exit(0);
}

const cfg = {};
for (const f of ['.env', '.env.local']) {
  const p = path.join(뿌리, f);
  if (!fs.existsSync(p)) continue;
  for (const l of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !cfg[m[1]]) cfg[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
if (!cfg.SUPABASE_DB_URL) { console.error('✗ SUPABASE_DB_URL 이 없습니다 (서버에서 돌리십시오)'); process.exit(1); }
const u = new URL(cfg.SUPABASE_DB_URL);
const env = { ...process.env,
  PGHOST: u.hostname, PGPORT: u.port || '5432',
  PGUSER: decodeURIComponent(u.username), PGPASSWORD: decodeURIComponent(u.password),
  PGDATABASE: decodeURIComponent(u.pathname.replace(/^\//, '')) || 'postgres',
  PGSSLMODE: u.searchParams.get('sslmode') || 'require' };
function psql(sql) {
  const 임시 = path.join(os.tmpdir(), '채용찾기_' + process.pid + '.sql');
  fs.writeFileSync(임시, sql, 'utf8');
  const r = spawnSync('psql', ['-X', '-A', '-t', '-q', '-F', '\t', '-v', 'ON_ERROR_STOP=1', '-f', 임시],
    { encoding: 'utf8', maxBuffer: 1 << 26, env });
  fs.unlinkSync(임시);
  if (r.status) { console.error('✗ psql\n' + (r.stderr || '').slice(0, 800)); process.exit(1); }
  return (r.stdout || '').trimEnd();
}
const 따옴 = (s) => String(s == null ? '' : s).replace(/'/g, "''");

/* ── 대상 — 홈페이지는 있고 채용페이지는 없는 기관 (우리가 담은 근거가 있는 것 먼저) ── */
const 줄들 = psql(`
  select o."기관번호", o.이름, o."홈페이지", coalesce(o."종별이름",''), coalesce(o."시도",'')
    from 기관 o
   where coalesce(o."홈페이지",'') <> '' and coalesce(o."채용페이지",'') = ''
     and o."불변근거"->>'홈페이지' like '%열어서 확인%'
   order by case coalesce(o."종별이름",'')
              when '상급종합' then 1 when '종합병원' then 2 when '병원' then 3 else 4 end, o.이름
   limit ${몇개};`).split('\n').filter(Boolean).map((l) => l.split('\t'));
console.log('홈페이지는 있고 채용 게시판을 모르는 기관 ' + 줄들.length + '곳 — 열어 봅니다\n');

const 찾음 = []; const 못찾음 = [];
for (const [번호, 이름, 홈, 종별, 시도] of 줄들) {
  const 됨 = await 가도되나집(홈);
  if (!됨.됨) { 못찾음.push({ 이름, 왜: 'robots 금지' }); console.log('  ✗ ' + 이름.slice(0, 20).padEnd(21) + 'robots 금지 — 두드리지 않습니다'); continue; }
  const r = await 받기(홈);
  await 자고(1500);
  if (!r.됨) { 못찾음.push({ 이름, 왜: r.왜 }); console.log('  ✗ ' + 이름.slice(0, 20).padEnd(21) + r.왜); continue; }
  /* 홈페이지에서 채용 링크 후보 */
  const 후보 = [];
  for (const m of r.html.matchAll(/<a[^>]+href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]{0,80}?)<\/a>/gi)) {
    const 글자 = m[2].replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    if (!채용말.test(글자) || 빼는말.test(글자)) continue;
    let 주소 = '';
    try { 주소 = new URL(m[1].replace(/&amp;/g, '&'), r.주소 || 홈).toString(); } catch { continue; }
    if (후보.some((x) => x.주소 === 주소)) continue;
    후보.push({ 글자: 글자.slice(0, 20), 주소 });
    if (후보.length >= 4) break;
  }
  if (!후보.length) { 못찾음.push({ 이름, 왜: '홈페이지에 채용 링크 없음' }); console.log('  · ' + 이름.slice(0, 20).padEnd(21) + '채용 링크 없음'); continue; }
  /* 후보를 열어 목록인지 봅니다 */
  let 정한것 = null;
  for (const c of 후보) {
    const 됨2 = await 가도되나집(c.주소);
    if (!됨2.됨) continue;
    const r2 = await 받기(c.주소);
    await 자고(3500);
    if (!r2.됨) continue;
    const 줄 = 표준읽기(r2.html, c.주소) || [];
    if (줄.length) { 정한것 = { ...c, 줄: 줄.length, 끝주소: r2.주소 || c.주소 }; break; }
  }
  if (!정한것) { 못찾음.push({ 이름, 왜: '링크를 열었지만 목록 줄 0' }); console.log('  · ' + 이름.slice(0, 20).padEnd(21) + '링크 ' + 후보.length + '개 — 목록 줄 0'); continue; }
  찾음.push({ 번호, 이름, 종별, 시도, ...정한것 });
  console.log('  ○ ' + 이름.slice(0, 20).padEnd(21) + '「' + 정한것.글자.padEnd(12) + '」 줄 '
    + String(정한것.줄).padStart(3) + '  ' + 정한것.끝주소.slice(0, 50));
}

console.log('\n찾음 ' + 찾음.length + '곳 · 못 찾음 ' + 못찾음.length + '곳');
const 왜셈 = {};
for (const x of 못찾음) 왜셈[x.왜] = (왜셈[x.왜] || 0) + 1;
console.log('  못 찾은 까닭 — ' + Object.entries(왜셈).map(([k, v]) => k + ' ' + v).join(' · '));

if (!진짜) { console.log('\n[마른] 기관 표에 안 담았습니다 — --진짜 로 담습니다'); process.exit(0); }
if (!찾음.length) process.exit(0);

const 되돌림터 = path.join(os.homedir(), '되돌림');
fs.mkdirSync(되돌림터, { recursive: true });
const d = new Date(); const 두 = (n) => String(n).padStart(2, '0');
const 때 = String(d.getFullYear()) + 두(d.getMonth() + 1) + 두(d.getDate()) + '_'
  + 두(d.getHours()) + 두(d.getMinutes()) + 두(d.getSeconds());
const 오늘 = String(d.getFullYear()) + '-' + 두(d.getMonth() + 1) + '-' + 두(d.getDate());
const 되돌림 = path.join(되돌림터, '채용게시판찾기_되돌리기_' + 때 + '.sql');
const 줄 = ['/* 되돌리기 — 홈페이지에서 찾은 채용페이지를 비웁니다 */'];
for (const x of 찾음) {
  줄.push(`update 기관 set "채용페이지" = null where "기관번호" = '${따옴(x.번호)}';`);
  psql(`update 기관
          set "채용페이지" = '${따옴(x.끝주소)}',
              "불변근거" = coalesce("불변근거",'{}'::jsonb)
                || jsonb_build_object('채용페이지',
                   '홈페이지에서 찾음 ${오늘} (링크 「${따옴(x.글자)}」 · 목록 줄 ${x.줄})'),
              "고친때" = now()
        where "기관번호" = '${따옴(x.번호)}' and coalesce("채용페이지",'') = '';`);
}
fs.writeFileSync(되돌림, 줄.join('\n') + '\n', 'utf8');
console.log('\n○ ' + 찾음.length + '곳에 담았습니다 · 되돌림 ' + 되돌림);
console.log('\n── 후 · 기관 표 ──\n' + psql(`
  select count(*) || '줄 · 홈페이지 ' || count("홈페이지") || ' · 채용페이지 ' || count("채용페이지")
      || ' · 그 가운데 홈페이지에서 찾음 '
      || count(*) filter (where "불변근거"->>'채용페이지' like '홈페이지에서 찾음%')
    from 기관;`));
