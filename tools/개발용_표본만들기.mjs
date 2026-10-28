/* 개발용 환경에 넣을 **공고 표본 SQL** 을 만듭니다 (2026-10-28 ㉤ 추천안)
 *
 *   node tools/개발용_표본만들기.mjs              표본 60건 → sql/개발용_표본_<날짜>.sql
 *   node tools/개발용_표본만들기.mjs --몇개 120
 *
 * ── 왜 파일로 만드나 ────────────────────────────────────────
 * 개발용 Supabase 는 **세중님이 만드신 뒤에** 생깁니다. 그 전에 할 수 있는 것은
 * **넣을 글을 준비해 두는 것**뿐입니다. 프로젝트가 서면 그 파일 하나를 올리면 끝입니다.
 *
 * ── 넣지 않는 것 (개인정보) ─────────────────────────────────
 *   profiles · 글 · 댓글 · 신고 · 재직인증 · 인증자료 · 알림기기 · 채팅 — **하나도 안 담습니다**
 *   담는 것은 **공고와 기관**뿐이고, 둘 다 기관이 공개한 자료입니다
 * ★ `뽑은값`·`detail` 안의 `근거` 는 우리가 쓴 글이라 **빼고** 담습니다 (가벼워집니다)
 * ★ 운영 DB 는 **읽기만** 합니다.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const 뿌리 = path.join(import.meta.dirname, '..');
const 몇개 = Number(process.argv.includes('--몇개')
  ? process.argv[process.argv.indexOf('--몇개') + 1] : 60) || 60;

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
function psql(sql, 꼴 = ['-X', '-A', '-t', '-q']) {
  const 임시 = path.join(os.tmpdir(), '개발용표본_' + process.pid + '.sql');
  fs.writeFileSync(임시, sql, 'utf8');
  const r = spawnSync('psql', [...꼴, '-v', 'ON_ERROR_STOP=1', '-f', 임시],
    { encoding: 'utf8', maxBuffer: 1 << 28, env });
  fs.unlinkSync(임시);
  if (r.status) { console.error('✗ psql\n' + (r.stderr || '').slice(0, 900)); process.exit(1); }
  return (r.stdout || '').trimEnd();
}

/* 회원 화면 공고에서 **출처마다 골고루** 뽑습니다 (한 출처만 뽑으면 화면 한쪽만 봅니다) */
const 넣을글 = psql(`
  with 뽑기 as (
    select p.*, row_number() over (partition by p.source order by p.id desc) as 차례
      from job_posts p join job_posts_pub v on v.id = p.id
  ), 고른것 as (
    select * from 뽑기 where 차례 <= greatest(1, ${몇개} / 8) limit ${몇개}
  )
  select string_agg(
    'insert into job_posts(id, source, org_name, title, url, job_group, employ_type, '
    || 'headcount, apply_from, apply_to, apply_to_time, sido, sgg, work_place, '
    || '"기관번호", "연결상태", "뽑은값", detail, hold, hidden, first_seen_at) values ('
    || quote_literal(id) || ', ' || quote_literal(source) || ', ' || quote_nullable(org_name) || ', '
    || quote_nullable(title) || ', ' || quote_nullable(url) || ', ' || quote_nullable(job_group) || ', '
    || quote_nullable(employ_type) || ', ' || coalesce(headcount::text, 'null') || ', '
    || quote_nullable(apply_from::text) || '::date, ' || quote_nullable(apply_to::text) || '::date, '
    || quote_nullable(apply_to_time::text) || '::time, '
    || quote_nullable(sido) || ', ' || quote_nullable(sgg) || ', ' || quote_nullable(work_place) || ', '
    || quote_nullable("기관번호") || ', ' || quote_nullable("연결상태") || ', '
    || quote_literal(coalesce("뽑은값", '{}'::jsonb) - '근거') || '::jsonb, '
    || quote_literal(coalesce(detail, '{}'::jsonb) - '근거') || '::jsonb, '
    || hold::text || ', ' || hidden::text || ', '
    || quote_nullable(first_seen_at::text) || '::timestamptz);', E'\\n')
    from 고른것;`);
const 글수 = psql(`
  with 뽑기 as (
    select p.id, p.source, row_number() over (partition by p.source order by p.id desc) as 차례
      from job_posts p join job_posts_pub v on v.id = p.id
  ) select count(*) from 뽑기 where 차례 <= greatest(1, ${몇개} / 8);`);

/* 그 공고가 가리키는 기관만 */
const 넣을기관 = psql(`
  select coalesce(string_agg(
    'insert into "기관"("기관번호", "이름", "이름키") values ('
    || quote_literal(o."기관번호") || ', ' || quote_nullable(o."이름") || ', '
    || quote_nullable(o."이름키") || ') on conflict do nothing;', E'\\n'), '')
    from "기관" o
   where o."기관번호" in (
     select distinct p."기관번호" from job_posts p join job_posts_pub v on v.id = p.id
      where p."기관번호" is not null);`);

const d = new Date();
const 두 = (n) => String(n).padStart(2, '0');
const 날 = String(d.getFullYear()) + 두(d.getMonth() + 1) + 두(d.getDate());
const 낼곳 = path.join(뿌리, 'sql', '개발용_표본_' + 날 + '.sql');
fs.writeFileSync(낼곳, [
  '/* 개발용 환경에 넣을 **공고 표본** (' + 날 + ' · tools/개발용_표본만들기.mjs)',
  ' *',
  ' * 쓰는 법 — 개발용 Supabase 가 선 뒤에 **그 프로젝트에만** 올립니다.',
  ' *   ① sql/기준구조_1025.sql        (구조)',
  ' *   ② 버킷 7개 + sql/기준구조_storage정책_1025.sql',
  ' *   ③ **이 파일**                  (공고 표본)',
  ' *',
  ' * ★ 개인정보는 **한 줄도 없습니다** — 회원·글·댓글·신고·재직인증·채팅을 안 담습니다.',
  ' *   담은 것은 기관이 공개한 공고와 기관 이름뿐이고, 우리가 쓴 `근거` 는 뺐습니다.',
  ' * ★ 운영 DB 에 올리지 마십시오. 이 파일은 **개발용 프로젝트 전용**입니다.',
  ' */',
  'begin;',
  넣을기관,
  넣을글,
  'commit;',
].join('\n') + '\n', 'utf8');
console.log('○ ' + path.relative(뿌리, 낼곳) + ' — 공고 ' + 글수 + '건 · 기관 '
  + (넣을기관 ? 넣을기관.split('\n').length : 0) + '줄');
console.log('★ 운영 DB 는 읽기만 했습니다. 이 파일은 개발용 프로젝트에만 올립니다.');
