/* 1층 넓히기 — **지금 숫자를 먼저 잽니다** (작업큐 3-2 · 2026-10-28 세중님)
 *
 *   node tools/1층넓히기_1028.mjs
 *
 * 읽기만 합니다. 세중님 블록의 「HS4 180곳 · 119곳 주소 꼴 두드리기」가 어느 묶음인지
 * **짐작하지 않고**, 지금 묶음마다 몇 곳인지 세어 나란히 놓습니다 (지침 10-3).
 *
 * 길 (2026-10-24~25 에 깔린 것)
 *   사각지대 456곳 → 홈페이지 342곳 담김(열어서 확인) → `채용게시판찾기` 가 채용 게시판을
 *   찾음 → HS4 가 그 게시판을 긁음. **HS3 가 긁는 곳에서는 HS4 가 안 돕니다** (10/24 ㉩)
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const 뿌리 = path.join(import.meta.dirname, '..');
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
  const 임시 = path.join(os.tmpdir(), '일층넓히기_' + process.pid + '.sql');
  fs.writeFileSync(임시, sql, 'utf8');
  const r = spawnSync('psql', ['-X', '-q', '-v', 'ON_ERROR_STOP=1', '-f', 임시],
    { encoding: 'utf8', maxBuffer: 1 << 26, env });
  fs.unlinkSync(임시);
  if (r.status) { console.error('✗ psql\n' + (r.stderr || '').slice(0, 1200)); process.exit(1); }
  return (r.stdout || '').trimEnd();
}
const 머리 = '\\pset pager off\n';

console.log('══ ① 1층 대상 — 상태별 (일층병원_구멍() 한 자리) ══');
console.log(psql(머리 + `
  select "상태", count(*) as 곳,
         count(*) filter (where "갈래" in ('공공보건의료','보건기관')) as 공공,
         count(*) filter (where "갈래" in ('상급종합','대학병원','종합병원')) as 민간
    from "일층병원_구멍"() group by 1 order by 2 desc;`));

console.log('\n══ ② 기관 표 — 주소·홈페이지·채용페이지가 어디까지 찼나 ══');
console.log(psql(머리 + `
  select count(*) as "기관 표 전체",
         count(*) filter (where coalesce("주소",'') <> '')       as 주소,
         count(*) filter (where coalesce("홈페이지",'') <> '')   as 홈페이지,
         count(*) filter (where coalesce("채용페이지",'') <> '') as 채용페이지,
         count(*) filter (where coalesce("홈페이지",'') <> ''
                            and coalesce("채용페이지",'') = '')  as "홈은 있고 게시판은 없음",
         count(*) filter (where "확인한때" is not null)          as "관리자 확인"
    from "기관";`));
console.log('── 채용페이지는 **어디서** 왔나 (불변근거) ──');
console.log(psql(머리 + `
  select coalesce("불변근거"->>'채용페이지', '(근거 없음)') as 근거, count(*) as 곳
    from "기관" where coalesce("채용페이지",'') <> ''
   group by 1 order by 2 desc limit 8;`));

console.log('\n══ ③ 사각지대와 겹쳐 보기 — HS4 가 **갈 수 있는 곳**이 몇 곳인가 ══');
console.log(psql(머리 + `
  with 구멍 as (select * from "일층병원_구멍"()),
  이름 as materialized (
    select "견줄이름"(g."기관") as k, g."상태", g."갈래" from 구멍 g
  ), 기관붙임 as (
    select n.k, n."상태", n."갈래",
           max(case when coalesce(o."채용페이지",'') <> '' then 1 else 0 end) as 게시판,
           max(case when coalesce(o."홈페이지",'')   <> '' then 1 else 0 end) as 홈
      from 이름 n left join "기관" o on o."이름키" = n.k
     group by 1,2,3
  )
  select "상태",
         count(*) as 곳,
         sum(게시판) as "채용 게시판 있음",
         sum(case when 게시판 = 0 and 홈 = 1 then 1 else 0 end) as "홈만 있음(두드릴 후보)",
         sum(case when 게시판 = 0 and 홈 = 0 then 1 else 0 end) as "둘 다 없음"
    from 기관붙임 group by 1 order by 2 desc;`));

console.log('\n══ ④ HS4 가 지금 긁는 곳 ══');
console.log(psql(머리 + `
  select coalesce("갈래",'(빈칸)') as 사이트표갈래, count(*) as 곳,
         count(*) filter (where coalesce("채용주소",'') <> '') as 채용주소
    from hosp_sites where not "끔" group by 1 order by 2 desc;`));
console.log('── HS4 출처로 들어온 공고 ──');
console.log(psql(머리 + `
  select p.source, count(*) as 공고,
         count(*) filter (where p.hold) as 보류함,
         count(*) filter (where p.hidden) as 숨김,
         count(*) filter (where exists (select 1 from job_posts_pub v where v.id = p.id)) as 회원화면
    from job_posts p where p.source like 'HS4%' group by 1 order by 2 desc;`));

console.log('\n★ 아무것도 바꾸지 않았습니다 (읽기만).');

/* ★ ⑤ 「사각지대 ∩ 채용 게시판 있음」 21곳 — HS4 가 갈 자리의 전수 목록 */
console.log('\n══ ⑤ HS4 가 갈 21곳 (사각지대이고 채용 게시판 주소를 압니다) ══');
console.log(psql(머리 + `
  with 구멍 as (select * from "일층병원_구멍"()),
  이름 as materialized (select "견줄이름"(g."기관") as k, g."기관", g."갈래", g."상태",
                               g."시도", g."시군구" from 구멍 g where g."상태" = '사각지대')
  select n."기관", n."갈래", n."시도",
         o."채용페이지",
         coalesce(o."불변근거"->>'채용페이지','(근거 없음)') as 근거
    from 이름 n join "기관" o on o."이름키" = n.k
   where coalesce(o."채용페이지",'') <> ''
   order by n."갈래", n."기관";`));

/* ★ ⑦ 울타리 ㉡ 가 막고 있는 것 — 손확인 ①②가 들어오면 몇 건이 풀리나
     (2026-10-28 세중님 4번) */
console.log('\n══ ⑦ 울타리 ㉡ (NAME + 확인한때 없음) 가 막고 있는 것 ══');
console.log(psql(머리 + `
  select count(*) as "NAME 로 붙은 회원 화면 공고",
         count(*) filter (where o."기관번호" is not null) as "기관 표에 줄 있음",
         count(*) filter (where coalesce(o."채용페이지",'') <> '') as "채용페이지도 있음",
         count(*) filter (where coalesce(o."채용페이지",'') <> ''
                            and o."확인한때" is null) as "확인한때만 비어 막힌 것",
         count(distinct o."기관번호") filter (where coalesce(o."채용페이지",'') <> ''
                            and o."확인한때" is null) as "그 기관 수"
    from job_posts p join job_posts_pub v on v.id = p.id
    left join "기관" o on o."기관번호" = p."기관번호"
   where p."기관번호" like 'NAME:%';`));
console.log('── 확인한때가 찍힌 기관 (손확인이 들어온 것) ──');
console.log(psql(머리 + `
  select coalesce("확인한사람", '(빈칸)') as 누가, count(*) as 기관,
         count(*) filter (where coalesce("채용페이지",'') <> '') as 채용페이지있음
    from "기관" where "확인한때" is not null group by 1 order by 2 desc;`));
