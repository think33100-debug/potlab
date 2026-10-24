/* 기관 표 **현황 조사** — 고치지 않고 봅니다 (2026-10-24 세중님 5번)
 *
 *   node tools/기관표현황_1024.mjs          (서버에서 · psql 읽기만)
 *
 * 보는 것 (세중님 ①~③) —
 *   ① 기관을 담는 표가 있나 — 이름·칸·건수 · 공고 표에 기관 번호 열쇠가 있나
 *   ② 회원 화면 공고가 번호로 붙나 / 이름 글자로만 / 아무 데도 안 붙나
 *   ③ 불변 칸(주소·전화·홈페이지·채용페이지·요양기관기호·알리오코드·사진)이 있나
 *
 * ★ 아무것도 바꾸지 않습니다. 표·열쇠 추가는 DB 구조라 승인 자리입니다.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const cfg = {};
for (const f of ['.env', '.env.local']) {
  if (!fs.existsSync(f)) continue;
  for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !cfg[m[1]]) cfg[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
if (!cfg.SUPABASE_DB_URL) { console.error('✗ SUPABASE_DB_URL 이 없습니다 (서버에서 돌리십시오)'); process.exit(1); }
const u = new URL(cfg.SUPABASE_DB_URL);
const env = {
  ...process.env,
  PGHOST: u.hostname, PGPORT: u.port || '5432',
  PGUSER: decodeURIComponent(u.username), PGPASSWORD: decodeURIComponent(u.password),
  PGDATABASE: decodeURIComponent(u.pathname.replace(/^\//, '')) || 'postgres',
  PGSSLMODE: u.searchParams.get('sslmode') || 'require',
};
function psql(sql) {
  const 임시 = path.join(os.tmpdir(), '기관표현황_' + process.pid + '.sql');
  fs.writeFileSync(임시, sql, 'utf8');
  const r = spawnSync('psql', ['-X', '-A', '-q', '-F', '  ', '-v', 'ON_ERROR_STOP=1', '-f', 임시],
    { encoding: 'utf8', maxBuffer: 1 << 28, env });
  fs.unlinkSync(임시);
  if (r.status) { console.error('✗ psql\n' + (r.stderr || '').slice(0, 900)); process.exit(1); }
  return (r.stdout || '').trimEnd();
}
const 보여 = (제목, sql) => { console.log('\n── ' + 제목 + ' ──'); console.log(psql(sql)); };

console.log('══ ① 기관을 담는 표 ══');
보여('기관 쪽 표·뷰와 줄 수', `
  select c.relname as 이름,
         case c.relkind when 'r' then '표' when 'v' then '뷰' when 'm' then '굳힌뷰' end as 꼴,
         (select count(*) from pg_attribute a
           where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped) as 칸수,
         coalesce(to_char(c.reltuples::bigint, 'FM999,999,999'), '-') as 줄짐작
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('r','v','m')
     and (c.relname ~ '기관|org|hira|hosp|public_hospitals|welfare|alio|site'
          or c.relname in ('기관','기관별명'))
   order by c.relkind, c.relname;`);

보여('기관 표 줄 수 (정확히)', `
  select '기관' as 표, count(*)::text as 줄, count(ykiho)::text as ykiho있음,
         count(*) filter (where 기관번호 like 'HIRA:%')::text as 심평원번호,
         count(*) filter (where 기관번호 like 'NAME:%')::text as 이름열쇠
    from 기관;`);

보여('공고 표의 기관 열쇠 칸', `
  select a.attname as 칸, format_type(a.atttypid, a.atttypmod) as 꼴
    from pg_attribute a
   where a.attrelid = 'job_posts'::regclass and a.attnum > 0 and not a.attisdropped
     and (a.attname ~ '기관|org')
   order by a.attnum;`);

console.log('\n══ ② 회원 화면 공고가 기관에 붙나 ══');
보여('연결상태별 (회원 화면)', `
  select coalesce(p."연결상태", '(빈칸)') as 연결상태,
         count(*)::text as 공고,
         count(*) filter (where p."기관번호" like 'HIRA:%')::text as 심평원번호로,
         count(*) filter (where p."기관번호" like 'NAME:%')::text as 이름글자로,
         count(*) filter (where p."기관번호" is null)::text as 번호없음
    from job_posts p join job_posts_pub v on v.id = p.id
   group by 1 order by 2 desc;`);

보여('연결근거별 (회원 화면 · 많은 것부터)', `
  select coalesce(p."연결근거", '(빈칸)') as 근거, count(*)::text as 공고
    from job_posts p join job_posts_pub v on v.id = p.id
   group by 1 order by count(*) desc limit 12;`);

보여('심평원 번호로 붙은 기관의 종별 (회원 화면)', `
  select coalesce(o."종별이름", '(빈칸)') as 종별, count(*)::text as 공고,
         count(distinct o.기관번호)::text as 기관
    from job_posts p
    join job_posts_pub v on v.id = p.id
    join 기관 o on o.기관번호 = p."기관번호"
   group by 1 order by count(*) desc;`);

console.log('\n══ ③ 기관 표의 불변 칸 ══');
보여('기관 표 칸 전부', `
  select string_agg(a.attname || ':' || format_type(a.atttypid, null), ' · ' order by a.attnum)
    from pg_attribute a
   where a.attrelid = '기관'::regclass and a.attnum > 0 and not a.attisdropped;`);

보여('찾는 칸이 어느 표에 있나 (주소·전화·홈페이지·채용·기호·알리오·사진)', `
  select c.relname as 표, a.attname as 칸, format_type(a.atttypid, null) as 꼴
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and a.attnum > 0 and not a.attisdropped
     and a.attname ~ '주소|addr|전화|tel|phone|홈페이지|home|url|채용|recruit|기호|ykiho|알리오|alio|사진|image|photo|logo'
     and c.relname ~ '기관|org|hira|hosp|public_hospitals|welfare|site'
   order by c.relname, a.attnum;`);

보여('심평원 요양기관 목록은 몇 줄인가 (1층 맞추기 밑감)', `
  select 'hira_org' as 표, count(*)::text as 줄,
         count(*) filter (where cl_cd in ('01','11'))::text as 상급종합_종합
    from hira_org;`);

보여('1층 대상 가운데 기관번호로 붙는 비율 (일층병원_구멍 기준)', `
  with 일층 as materialized (select * from jsonb_to_recordset(
         (select jsonb_agg(x) from jsonb_array_elements("일층병원_구멍"()->'목록') x))
         as t(이름 text, 갈래 text, sido text, sgg text, 사이트 text))
  select count(*)::text as 일층대상,
         count(*) filter (where exists (
           select 1 from 기관 o where o."기관번호" = "기관번호_이름으로"(일층.이름)
         ))::text as 이름키로_기관표에_있음
    from 일층;`);

console.log('\n★ 아무것도 바꾸지 않았습니다. 표·열쇠 추가는 승인 자리입니다.');
