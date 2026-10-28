/* 신뢰 셋 ① 구멍 고치기 — **이미 담긴 것** (2026-10-28 세중님 ⓓ · 회원 화면 사고)
 *
 *   node tools/사고_내리기_1028.mjs           마른 실행 — 내려갈 목록·보류함 갈 목록
 *   node tools/사고_내리기_1028.mjs --진짜     내립니다 (되돌림을 남깁니다)
 *
 * ── 두 갈래 ─────────────────────────────────────────────────
 *   ㉠ **지난 공고** — 긁기 출처(HS%)이고 마감이 없고
 *      `게시일(없으면 담은 날) + 30일` 이 지난 것 → `hidden`, 까닭 「게시일 30일 지남」
 *      ★ `hide_stale_posts()` 는 **담은 날**만 보고, 게다가 **정찰 면제**가 있어서
 *        이 셋이 안 내려갔습니다 (sql/기준구조_1025.sql:3610~3618 · 승인대기 ㉬)
 *   ㉡ **상세를 못 읽은 것** — 긁기 출처이고 **본문 0줄 · 첨부 0개**이면서
 *      다섯 칸 가운데 **셋 이상 빈** 것 → `hold`(보류함), 까닭 「상세 못 읽음 · 관리자 확인」
 *      ★ 본문을 **읽었는데** 칸이 빈 것은 **안 건드립니다** — 공고문에 그 값이 없는
 *        것이고, 그건 「틀린 값」이 아니라 「원문에 없는 값」입니다 (지침 15절)
 *
 * ★ 숨기는 것은 `hidden_why` 를 적고 `job_state_log` 에 남습니다. 되돌림은 ~/되돌림/.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const 뿌리 = path.join(import.meta.dirname, '..');
const 진짜 = process.argv.includes('--진짜');
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
function psql(sql, 꼴 = ['-X', '-q']) {
  const 임시 = path.join(os.tmpdir(), '사고내리기_' + process.pid + '.sql');
  fs.writeFileSync(임시, sql, 'utf8');
  const r = spawnSync('psql', [...꼴, '-v', 'ON_ERROR_STOP=1', '-f', 임시],
    { encoding: 'utf8', maxBuffer: 1 << 26, env });
  fs.unlinkSync(임시);
  if (r.status) { console.error('✗ psql\n' + (r.stderr || '').slice(0, 1200)); process.exit(1); }
  return (r.stdout || '').trimEnd();
}
const 글만 = (sql) => psql(sql, ['-X', '-A', '-t', '-q', '-F', '\t']);
const 머리 = '\\pset pager off\n';

/* 빈 칸 셈 — 사고_지난공고_1028.mjs 와 **같은 글자** (지침 6절 · 두 벌이면 어긋납니다) */
const 빈칸수SQL = `
  (case when p.headcount is null
          and coalesce(p."뽑은값"->>'모집인원','') = ''
          and coalesce(p.detail->>'모집인원','') = '' then 1 else 0 end
 + case when p.apply_to is null
          and coalesce(p."뽑은값"->>'접수마감글','') = '' then 1 else 0 end
 + case when coalesce(p.work_place,'') = '' then 1 else 0 end
 + case when coalesce(p."뽑은값"->>'지원자격','') = ''
          and coalesce(p.detail->>'지원자격','') = '' then 1 else 0 end
 + case when coalesce(p."뽑은값"->>'예상연봉','') = ''
          and coalesce(p.detail->>'연봉','') = ''
          and coalesce(p.detail->>'예상연봉','') = '' then 1 else 0 end)`;

const 오늘SQL = `(now() at time zone 'Asia/Seoul')::date`;
/* ★ 2026-10-28 — **이 첫 줄이 없어서 사고가 났습니다.** 마른 실행은 job_posts_pub 과
   이어 3건을 보여 줬는데, 실행하는 update 에는 그 이음이 없어 **보류함 공고 14건까지**
   숨겼습니다. 조건을 **한 자리**로 두고 마른·실행이 같은 글자를 쓰게 합니다 (지침 6절) */
const 지난공고조건 = `
    exists (select 1 from job_posts_pub v where v.id = p.id)
    and p.source like 'HS%' and p.apply_to is null and not p.admin_locked
    and coalesce(p.posted_at, p.first_seen, (p.collected_at at time zone 'Asia/Seoul')::date)
        < ${오늘SQL} - 30`;
const 못읽음조건 = `
    exists (select 1 from job_posts_pub v where v.id = p.id)
    and p.source like 'HS%' and not p.admin_locked
    and (select count(*) from job_body b where b.job_id = p.id) = 0
    and (select count(*) from "공고첨부" a where a."공고id" = p.id) = 0
    and ${빈칸수SQL} >= 3`;

/* ── --지금셈 — 회원 화면이 몇이고 오늘 고친 셋이 어디 있나 ── */
if (process.argv.includes('--지금셈')) {
  console.log(psql(머리 + `select count(*) as "회원 화면" from job_posts_pub;`));
  console.log(psql(머리 + `select p.id, p.source, p.hidden, p.hold, coalesce(p.hidden_why,'') as 까닭,
      exists (select 1 from job_posts_pub v where v.id = p.id) as 회원화면,
      left(coalesce(p."보여줄제목", p.title), 40) as 제목
    from job_posts p where p.id in ('HS1830232787','HS490653413','HS1004062063',
      'HS1264216454','HS1428827340','HS1607287002') order by p.id;`));
  console.log('── 오늘 숨김이 풀린 줄 (job_state_log) ──');
  console.log(psql(머리 + `select l.job_id, l."누가", l."바뀐때" at time zone 'Asia/Seoul' as 때,
      l."옛_hidden", l."새_hidden", l."옛_hold", l."새_hold"
    from job_state_log l
   where l."바뀐때" > now() - interval '3 hours' and l."옛_hidden" and not l."새_hidden"
   order by l."바뀐때" desc limit 20;`));
  process.exit(0);
}

/* ── --보류함되살리기 — 2026-10-28 에 **잘못 숨긴 보류함 공고**를 되돌립니다 ──
 * 위 「이 첫 줄이 없어서」 사고로 보류함 공고 14건이 숨겨졌습니다 (전부 우리 직군이
 * 아닌 공고 — 재무팀·조리사·방사선사·홍보팀 …). 보류함은 **관리자 검사 줄**이라
 * 제가 건드릴 자리가 아닙니다. `job_state_log` 의 `옛_hold` 가 true 였던 줄만
 * 보류함으로 되돌립니다. */
if (process.argv.includes('--보류함되살리기')) {
  const 되살릴것 = 글만(`select distinct l.job_id from job_state_log l
    where l."누가" like '사고 고침 2026-10-28%' and l."옛_hold" order by 1;`)
    .split('\n').filter(Boolean);
  if (!되살릴것.length) { console.log('되살릴 줄이 없습니다'); process.exit(0); }
  const 목록 = 되살릴것.map((x) => "'" + x + "'").join(',');
  console.log('되살릴 줄 — ' + 되살릴것.length + '건');
  if (!진짜) {
    console.log(psql(머리 + `select p.id, p.source, p.hold, p.hidden, p.hidden_why,
        left(coalesce(p."보여줄제목", p.title), 44) as 제목
      from job_posts p where p.id in (${목록}) order by p.id;`));
    console.log('[마른] 안 되살렸습니다 — --보류함되살리기 --진짜');
    process.exit(0);
  }
  console.log(psql(머리 + `
    select set_config('app.누가', '사고 고침 되돌리기 2026-10-28 (보류함으로)', true);
    update job_posts set hidden = false, hidden_why = null, hidden_on = null, hold = true
     where id in (${목록});`));
  console.log('── 후 ──');
  console.log(psql(머리 + `select count(*) as "되살린 줄",
      count(*) filter (where hold) as "보류함",
      count(*) filter (where hidden) as "아직 숨김(0 이어야)"
    from job_posts where id in (${목록});`));
  console.log('회원 화면 — ' + 글만('select count(*) from job_posts_pub;') + '건');
  process.exit(0);
}

/* ── --살펴보기 — 오늘 이 도구가 **무엇을 바꿨나** (job_state_log 로) ── */
if (process.argv.includes('--살펴보기')) {
  console.log('══ 오늘 이 도구가 바꾼 줄 (job_state_log) ══');
  console.log(psql(머리 + `
    select l."누가", count(*) as 줄,
           count(*) filter (where l."옛_hold") as "전에 보류함이던 것",
           count(*) filter (where not coalesce(l."옛_hold", false)) as "전에 보류함이 아닌 것",
           count(*) filter (where l."새_hidden") as "숨김이 된 것"
      from job_state_log l
     where l."누가" like '사고 고침 2026-10-28%'
     group by 1 order by 1;`));
  console.log('── 전에 **보류함**이던 줄 (회원 화면이 아니었습니다 · 되살릴 자리) ──');
  console.log(psql(머리 + `
    select l.job_id, p.source, p.org_name, p.posted_at as 게시일, p.first_seen as 담은날,
           l."옛_hold", l."새_hold", l."옛_hidden", l."새_hidden",
           left(coalesce(p."보여줄제목", p.title), 40) as 제목
      from job_state_log l join job_posts p on p.id = l.job_id
     where l."누가" like '사고 고침 2026-10-28%' and l."옛_hold"
     order by l.job_id;`));
  process.exit(0);
}

console.log('══ ㉠ 내려갈 것 — 마감 없고 게시일(없으면 담은날)+30일 지난 긁기 공고 ══');
console.log(psql(머리 + `
  select p.id, p.source, p.org_name,
         p.posted_at as 게시일, p.first_seen as 담은날,
         ${오늘SQL} - coalesce(p.posted_at, p.first_seen,
            (p.collected_at at time zone 'Asia/Seoul')::date) as 며칠됐나,
         p.seen_on as 정찰본날, ${빈칸수SQL} as "빈 칸",
         left(p."보여줄제목", 42) as 보여줄제목
    from job_posts p join job_posts_pub v on v.id = p.id
   where ${지난공고조건}
   order by coalesce(p.posted_at, p.first_seen);`));

console.log('\n══ ㉡ 보류함으로 — 상세를 **못 읽고**(본문 0·첨부 0) 다섯 칸 중 셋 이상 빈 것 ══');
console.log(psql(머리 + `
  select p.id, p.source, p.org_name, ${빈칸수SQL} as "빈 칸",
         p.apply_to as 마감, left(p."보여줄제목", 46) as 보여줄제목
    from job_posts p join job_posts_pub v on v.id = p.id
   where ${못읽음조건}
   order by p.id;`));
console.log('── 견주기: 상세를 **읽었는데** 셋 이상 빈 것 (안 건드립니다) ──');
console.log(psql(머리 + `
  select count(*) as "건드리지 않는 것",
         string_agg(p.id, ' ' order by p.id) as 목록
    from job_posts p join job_posts_pub v on v.id = p.id
   where p.source like 'HS%' and ${빈칸수SQL} >= 3
     and ((select count(*) from job_body b where b.job_id = p.id) > 0
          or (select count(*) from "공고첨부" a where a."공고id" = p.id) > 0);`));

const 전셈 = 글만(`select count(*) from job_posts_pub;`);
console.log('\n회원 화면 지금 — ' + 전셈 + '건');

if (!진짜) {
  console.log('\n[마른] 아무것도 안 바꿨습니다 — --진짜 로 내립니다');
  process.exit(0);
}

/* ── 되돌림 ── */
const d = new Date(); const 두 = (n) => String(n).padStart(2, '0');
const 때 = String(d.getFullYear()) + 두(d.getMonth() + 1) + 두(d.getDate())
  + '_' + 두(d.getHours()) + 두(d.getMinutes()) + 두(d.getSeconds());
const 되돌림터 = path.join(os.homedir(), '되돌림');
fs.mkdirSync(되돌림터, { recursive: true });
const 되돌림 = path.join(되돌림터, '사고_내리기_되돌리기_' + 때 + '.sql');
const 내릴것 = 글만(`select p.id from job_posts p join job_posts_pub v on v.id = p.id
  where ${지난공고조건} order by p.id;`).split('\n').filter(Boolean);
const 보류할것 = 글만(`select p.id from job_posts p join job_posts_pub v on v.id = p.id
  where ${못읽음조건} order by p.id;`).split('\n').filter(Boolean);
fs.writeFileSync(되돌림, [
  '/* 되돌리기 — 2026-10-28 사고 고침 (긁기 지난 공고 · 상세 못 읽음) */',
  ...내릴것.map((id) => `update job_posts set hidden = false, hidden_why = null, hidden_on = null`
    + ` where id = '${id}';`),
  ...보류할것.map((id) => `update job_posts set hold = false where id = '${id}';`),
].join('\n') + '\n', 'utf8');
console.log('\n○ 되돌릴 글 — ' + 되돌림 + ' (내림 ' + 내릴것.length + ' · 보류 ' + 보류할것.length + ')');

console.log(psql(머리 + `
begin;
select set_config('app.누가', '사고 고침 2026-10-28 (긁기 지난 공고)', true);
update job_posts p set hidden = true, hold = false,
       hidden_why = '게시일 30일 지남 (긁기)', hidden_on = ${오늘SQL}
 where ${지난공고조건} and not p.hidden;
select set_config('app.누가', '사고 고침 2026-10-28 (상세 못 읽음)', true);
update job_posts p set hold = true
 where ${못읽음조건} and not p.hold and not p.hidden;
commit;`));

console.log('\n══ 후 ══');
console.log(psql(머리 + `
  select count(*) as "회원 화면",
         count(*) filter (where p.source like 'HS%') as "그중 긁기",
         count(*) filter (where p.source like 'HS%' and p.apply_to is null
            and coalesce(p.posted_at, p.first_seen, (p.collected_at at time zone 'Asia/Seoul')::date)
                < ${오늘SQL} - 30) as "아직 30일 지난 것(0 이어야)",
         count(*) filter (where p.source like 'HS%'
            and (select count(*) from job_body b where b.job_id = p.id) = 0
            and (select count(*) from "공고첨부" a where a."공고id" = p.id) = 0
            and ${빈칸수SQL} >= 3) as "아직 상세 못 읽고 셋 이상 빈 것(0 이어야)"
    from job_posts p join job_posts_pub v on v.id = p.id;`));
console.log('── 내려간 것·보류함 간 것 ──');
console.log(psql(머리 + `
  select hidden_why, count(*) from job_posts
   where hidden_on = ${오늘SQL} and hidden_why like '%긁기%' group by 1;`));
console.log(psql(머리 + `
  select count(*) as "보류함 전체", count(*) filter (where hold) as hold
    from job_posts where hold;`));
