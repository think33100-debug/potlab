/* 이미 담긴 **채용페이지**를 좁힌 울타리로 다시 걸러 봅니다 (2026-10-28 세중님 1번)
 *
 *   node tools/긁기/채용게시판_다시걸러.mjs --자기점검   울타리 견본
 *   node tools/긁기/채용게시판_다시걸러.mjs             사각지대 곳들을 열어 봅니다 (마른)
 *   node tools/긁기/채용게시판_다시걸러.mjs --진짜      걸러진 것을 **비웁니다** (되돌림 남깁니다)
 *
 * ── 왜 ───────────────────────────────────────────────────────
 * 10/25 에 담은 채용페이지가 「목록 줄이 **하나라도** 나오면 게시판」이라는 느슨한
 * 울타리로 들어왔습니다. 사각지대 21곳을 눈으로 보니 **일곱**이 게시판이 아니었습니다 —
 * 첫 화면 다섯(bohun main.do 셋 · comwel index.jsp 둘) · 글 하나 하나(mode=view&idx=62) ·
 * 같은 주소를 쓰는 분원 하나 (docs/1층넓히기_1028.md ⑥).
 *
 * ── 울타리 넷 ───────────────────────────────────────────────
 *   ㉠㉡㉢ 은 `읽기들.mjs` 의 `게시판인가()` 한 자리입니다 (글 하나 꼴 · 첫 화면 ·
 *          줄 둘 이상 + 글 번호 둘 이상)
 *   ㉣ 같은 주소를 **다른 기관**이 쓰면 둘 다 **의심**으로 둡니다 (분원이 본원 주소를 받습니다)
 *
 * ★ 비우는 것은 기관 표 `채용페이지` 칸뿐입니다. 공고·회원 화면은 안 건드립니다.
 *   (이 21곳은 사각지대라 지금 ① 18건에 섞여 있지 않습니다)
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { 표준읽기, 게시판인가 } from './읽기들.mjs';
import { 가도되나집, 받기, 자고 } from './공통.mjs';

const argv = process.argv.slice(2);
const 진짜 = argv.includes('--진짜');
const 몇개 = Number(argv.includes('--몇개') ? argv[argv.indexOf('--몇개') + 1] : 40) || 40;

if (argv.includes('--자기점검')) {
  const 잼 = []; const 보 = (무엇, 참) => 잼.push([무엇, !!참]);
  const 줄둘 = [{ 번호: '11', 제목: 'ㄱ' }, { 번호: '12', 제목: 'ㄴ' }];
  보('㉠ 글 하나 — mode=view&idx=62',
    !게시판인가('https://a.kr/sub.php?boardid=notice&mode=view&idx=62', 줄둘).됨);
  보('㉠ 글 하나 — ?seq=5821',
    !게시판인가('https://a.kr/board/view.do?seq=5821', 줄둘).됨);
  보('㉢ 첫 화면 — main.do', !게시판인가('https://www.bohun.or.kr/busancare/main.do', 줄둘).됨);
  보('㉢ 첫 화면 — index.jsp', !게시판인가('https://www.comwel.or.kr/seoulclinic/index.jsp', 줄둘).됨);
  보('㉢ 첫 화면 — 집 주소만', !게시판인가('https://a.kr/', 줄둘).됨);
  보('㉡ 줄 하나는 안 됨', !게시판인가('https://a.kr/bbs/board.php?bo_table=recruit',
    [{ 번호: '11', 제목: 'ㄱ' }]).됨);
  보('㉡ 같은 번호만 둘이면 안 됨', !게시판인가('https://a.kr/bbs/board.php?bo_table=recruit',
    [{ 번호: '11' }, { 번호: '11' }]).됨);
  보('㉡ 번호 없는 줄만이면 안 됨', !게시판인가('https://a.kr/bbs/board.php?bo_table=recruit',
    [{ 제목: 'ㄱ' }, { 제목: 'ㄴ' }]).됨);
  보('○ 그누보드 목록은 통과', 게시판인가('https://muansh.co.kr/bbs/board.php?bo_table=careers', 줄둘).됨);
  보('○ board.es 목록은 통과', 게시판인가('https://www.knmh.go.kr/board.es?mid=a10503000000&bid=0011', 줄둘).됨);
  보('○ list.do 목록은 통과', 게시판인가('https://a.kr/recruit/recruit/list.do?mId=32', 줄둘).됨);
  보('○ /person 같은 쪽도 통과', 게시판인가('http://www.hp8119.co.kr/person', 줄둘).됨);
  const 어긴것 = 잼.filter(([, ok]) => !ok);
  for (const [무엇, ok] of 잼) console.log((ok ? '  ○ ' : '  ✗ ') + 무엇);
  if (어긴것.length) { console.error('✗ 자기점검 ' + 어긴것.length + '가지 실패'); process.exit(1); }
  console.log('○ 자기점검 통과 — ' + 잼.length + '가지');
  process.exit(0);
}

const 뿌리 = path.join(import.meta.dirname, '..', '..');
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
  const 임시 = path.join(os.tmpdir(), '다시걸러_' + process.pid + '.sql');
  fs.writeFileSync(임시, sql, 'utf8');
  const r = spawnSync('psql', ['-X', '-A', '-t', '-q', '-F', '\t', '-v', 'ON_ERROR_STOP=1', '-f', 임시],
    { encoding: 'utf8', maxBuffer: 1 << 26, env });
  fs.unlinkSync(임시);
  if (r.status) { console.error('✗ psql\n' + (r.stderr || '').slice(0, 800)); process.exit(1); }
  return (r.stdout || '').trimEnd();
}
const 따옴 = (s) => String(s == null ? '' : s).replace(/'/g, "''");

/* ── 대상 — **사각지대이고 채용페이지가 있는 곳** (= HS4 가 갈 자리) ── */
const 줄들 = psql(`
  with 구멍 as (select * from "일층병원_구멍"()),
  이름 as materialized (
    select "견줄이름"(g."기관") as k, g."기관" as 기관, g."갈래" as 갈래
      from 구멍 g where g."상태" = '사각지대')
  select o."기관번호", n.기관, n.갈래, o."채용페이지"
    from 이름 n join 기관 o on o."이름키" = n.k
   where coalesce(o."채용페이지",'') <> ''
   order by n.갈래, n.기관
   limit ${몇개};`).split('\n').filter(Boolean).map((l) => l.split('\t'));
console.log('사각지대 가운데 채용페이지가 담긴 기관 ' + 줄들.length + '곳 — 좁힌 울타리로 다시 봅니다\n');

/* ㉣ 같은 주소를 두 기관이 쓰나 — 표 전체에서 미리 셉니다 */
const 겹친주소 = new Set(psql(`
  select "채용페이지" from 기관 where coalesce("채용페이지",'') <> ''
   group by 1 having count(*) > 1;`).split('\n').filter(Boolean));

const 통과 = []; const 걸림 = [];
for (const [번호, 기관, 갈래, 주소] of 줄들) {
  if (겹친주소.has(주소)) {
    걸림.push({ 번호, 기관, 주소, 왜: '같은 주소를 다른 기관도 씀' });
    console.log('  ✗ ' + 기관.slice(0, 24).padEnd(26) + '같은 주소를 다른 기관도 씁니다'); continue;
  }
  const 먼저 = 게시판인가(주소, [{ 번호: 'a' }, { 번호: 'b' }]);   /* 주소만 보는 ㉠㉢ 먼저 */
  if (!먼저.됨) {
    걸림.push({ 번호, 기관, 주소, 왜: 먼저.왜 });
    console.log('  ✗ ' + 기관.slice(0, 24).padEnd(26) + 먼저.왜); continue;
  }
  const 됨 = await 가도되나집(주소);
  if (!됨.됨) {
    걸림.push({ 번호, 기관, 주소, 왜: 'robots 금지' });
    console.log('  ✗ ' + 기관.slice(0, 24).padEnd(26) + 'robots 금지 — 두드리지 않습니다'); continue;
  }
  const r = await 받기(주소);
  await 자고(3500);
  if (!r.됨) {
    걸림.push({ 번호, 기관, 주소, 왜: '못 받음 (' + r.왜 + ')' });
    console.log('  ✗ ' + 기관.slice(0, 24).padEnd(26) + '못 받음 — ' + r.왜); continue;
  }
  const 줄 = 표준읽기(r.html, 주소) || [];
  const 본 = 게시판인가(r.주소 || 주소, 줄);
  if (!본.됨) {
    걸림.push({ 번호, 기관, 주소, 왜: 본.왜 });
    console.log('  ✗ ' + 기관.slice(0, 24).padEnd(26) + 본.왜); continue;
  }
  통과.push({ 번호, 기관, 갈래, 주소, 줄: 줄.length });
  console.log('  ○ ' + 기관.slice(0, 24).padEnd(26) + 본.왜 + '  ' + 주소.slice(0, 48));
}

console.log('\n**등록 가능 ' + 통과.length + '곳** · 걸림 ' + 걸림.length + '곳');
const 왜셈 = {};
for (const x of 걸림) 왜셈[x.왜] = (왜셈[x.왜] || 0) + 1;
if (걸림.length) console.log('  걸린 까닭 — ' + Object.entries(왜셈).map(([k, v]) => k + ' ' + v).join(' · '));
console.log('\n── 등록 가능한 곳 (갈래별) ──');
const 갈래셈 = {};
for (const x of 통과) 갈래셈[x.갈래] = (갈래셈[x.갈래] || 0) + 1;
console.log('  ' + Object.entries(갈래셈).map(([k, v]) => k + ' ' + v).join(' · '));

/* ★ 걸린 것을 둘로 가릅니다 (2026-10-28) — **다 비우면 멀쩡한 주소를 잃습니다.**
     ㉠ 비움 — 주소 **꼴**이 게시판이 아닌 것 (글 하나 · 첫 화면 · 같은 주소 두 기관).
              이것은 쪽이 비었는지와 무관하게 **틀린 주소**입니다
     ㉡ 둠   — robots 금지 · 못 받음 · 줄이 모자람. 주소는 맞는데 **우리가 못 본 것**이거나
              **그 게시판에 글이 아직 적은 것**일 수 있습니다. 비우면 다시 찾아야 합니다 —
              대신 HS4 에 **등록하지 않습니다** (「등록 보류」) */
const 꼴틀림 = /글 하나 꼴 주소|첫 화면|같은 주소를 다른 기관도 씀/;
const 비울것 = 걸림.filter((x) => 꼴틀림.test(x.왜));
const 둘것 = 걸림.filter((x) => !꼴틀림.test(x.왜));
console.log('\n걸린 것을 가르면 — **비울 것 ' + 비울것.length + '곳**(주소 꼴이 게시판이 아님) · '
  + '**둘 것 ' + 둘것.length + '곳**(주소는 맞을 수 있음 · 등록만 보류)');
for (const x of 둘것) console.log('  · 둠  ' + x.기관.slice(0, 24).padEnd(26) + x.왜);

if (!진짜) { console.log('\n[마른] 아무것도 안 비웠습니다 — --진짜 로 **비울 것만** 비웁니다'); process.exit(0); }
if (!비울것.length) { console.log('\n비울 것이 없습니다'); process.exit(0); }

const 되돌림터 = path.join(os.homedir(), '되돌림');
fs.mkdirSync(되돌림터, { recursive: true });
const d = new Date(); const 두 = (n) => String(n).padStart(2, '0');
const 때 = String(d.getFullYear()) + 두(d.getMonth() + 1) + 두(d.getDate()) + '_'
  + 두(d.getHours()) + 두(d.getMinutes()) + 두(d.getSeconds());
const 되돌림 = path.join(되돌림터, '채용게시판_다시걸러_되돌리기_' + 때 + '.sql');
const 글 = ['/* 되돌리기 — 비운 채용페이지를 전 값으로 (2026-10-28 울타리 넷) */'];
for (const x of 비울것) {
  글.push(`update 기관 set "채용페이지" = '${따옴(x.주소)}' where "기관번호" = '${따옴(x.번호)}';`);
  psql(`update 기관
          set "채용페이지" = null,
              "불변근거" = coalesce("불변근거",'{}'::jsonb)
                || jsonb_build_object('채용페이지비운까닭',
                   '2026-10-28 울타리 넷으로 다시 걸러 비움 — ${따옴(x.왜)} (전 ${따옴(x.주소)})'),
              "고친때" = now()
        where "기관번호" = '${따옴(x.번호)}';`);
}
fs.writeFileSync(되돌림, 글.join('\n') + '\n', 'utf8');
console.log('\n○ ' + 비울것.length + '곳을 비웠습니다 (둔 것 ' + 둘것.length + '곳) · 되돌림 ' + 되돌림);
console.log('\n── 후 · 기관 표 ──\n' + psql(`
  select count(*) || '줄 · 채용페이지 ' || count("채용페이지")
      || ' · 비운 까닭이 적힌 줄 '
      || count(*) filter (where "불변근거" ? '채용페이지비운까닭') from 기관;`));
