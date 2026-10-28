/* ㉣ `job_one` 에 **기관 칸** 붙이기 — 채용게시판·기관홈 + 기관 불변 칸(주소·전화)
 *   (2026-10-28 세중님 ㉣ 승인 · **마른 실행 먼저**)
 *
 *   node tools/job_one_기관칸_1028.mjs --자기점검   울타리가 듣는지 (되돌림 안에서)
 *   node tools/job_one_기관칸_1028.mjs             마른 실행 — 갈래 전·후 · 개인정보 검사
 *   node tools/job_one_기관칸_1028.mjs --진짜       바꿉니다
 *
 * ── 울타리 둘 (하나는 세중님 오늘 말, 하나는 10/24 ㉯ 로 이미 서 있는 것) ──
 *   ㉠ `연결상태 = '대기'`(의심)면 **네 칸 전부 null** — 어느 기관인지 아직 모릅니다
 *   ㉡ 기관번호가 `NAME:…`(이름 글자로 붙은 것)이고 **관리자 확인(확인한때)이 없으면
 *      채용페이지를 안 씁니다** — 기관 표 「채용페이지」 칸 주석에 적힌 2026-10-24
 *      세중님 ㉯ 결정입니다. 오늘 말(「대기만 null」)보다 좁아서, **좁은 쪽을 지키고
 *      그 때문에 못 쓰는 건수를 따로 셉니다.** 푸는 것은 세중님 자리입니다
 *
 * ── 안 내리는 것 ───────────────────────────────────────────
 *   담당자 **개인** 전화·메일은 어디에도 안 내립니다. 허용 목록에 `문의처`·`사업자번호`·
 *   `근거` 가 없고(2026-10-24 ㉠), 기관 표에는 메일 칸이 아예 없습니다.
 *   기관 표 `전화` 는 심평원 기관 대표번호라 **휴대전화 꼴이 있나 세어 봅니다**.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const 뿌리 = path.join(import.meta.dirname, '..');
const 진짜 = process.argv.includes('--진짜');
const 점검만 = process.argv.includes('--자기점검');

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
  const 임시 = path.join(os.tmpdir(), 'job_one_기관칸_' + process.pid + '.sql');
  fs.writeFileSync(임시, sql, 'utf8');
  const r = spawnSync('psql', [...꼴, '-v', 'ON_ERROR_STOP=1', '-f', 임시],
    { encoding: 'utf8', maxBuffer: 1 << 26, env });
  fs.unlinkSync(임시);
  if (r.status) { console.error('✗ psql\n' + (r.stderr || '').slice(0, 1500)); process.exit(1); }
  return (r.stdout || '').trimEnd();
}
const 글만 = (sql) => psql(sql, ['-X', '-A', '-t', '-q']);
const 머리 = '\\pset pager off\n';

/* ★ job_one 은 `auth.uid() is null` 로 **비회원 갈래**를 갑니다. psql 로 그냥 부르면
   비회원이라 새 칸이 안 보입니다 — 회원 갈래를 재려면 요청 claim 을 세워야 합니다.
   자료를 넣는 것이 아니라 **이 연결에서만** 쓰는 설정값입니다 (운영 자료 안 건드립니다) */
const 회원되기 = `\\o /dev/null
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', false);
\\o
`;

/* ── 전 정의·ACL (되돌림) ── */
const 몇벌 = 글만(`select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'job_one';`);
if (몇벌 !== '1') { console.error('✗ job_one 이 ' + 몇벌 + '벌입니다 (1 이어야 합니다)'); process.exit(1); }
const 전정의 = psql(머리 + `select pg_get_functiondef(p.oid) from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'job_one';`, ['-X', '-A', '-t', '-q']);
const 전acl = 글만(`select coalesce(p.proacl::text,'(기본값)') from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'job_one';`);
if (!전정의.trim()) { console.error('✗ job_one 정의를 못 읽었습니다'); process.exit(1); }
console.log('전 — job_one ' + 전정의.split('\n').length + '줄 · ACL ' + 전acl);

/* ── 새 정의 — **지금 정의를 받아 detail 자리만** 바꿉니다 (㉪ 와 같은 꼴) ──
   create or replace 를 손으로 쓰면 인수 기본값·security definer·search_path 가 빠집니다 */
const 옛조각 = `else (select coalesce(jsonb_object_agg(e.k, e.v), '{}'::jsonb)`;
if (!전정의.includes(옛조각)) {
  console.error('✗ 바꿀 자리를 못 찾았습니다 — job_one 이 제가 아는 꼴이 아닙니다 (멈춥니다)');
  process.exit(1);
}
const 새조각 = `else
              /* ★ 2026-10-28 세중님 ㉣ — **기관 표·사이트표의 기관 칸**을 함께 내립니다.
                 화면 지원링크() 가 ① detail.채용게시판 → ② detail.기관홈 → ③ url 차례로
                 보는데 ①②가 공고에 안 담겨 늘 ③이었습니다 (docs/표시규칙_1028.md E).
                 울타리 ㉠ 연결상태 '대기'(의심)면 **네 칸 전부 null**
                        ㉡ 기관번호가 NAME:… 이고 **확인한때가 없으면 채용페이지를 안 씁니다**
                           (기관.채용페이지 칸 주석 · 2026-10-24 세중님 ㉯)
                 ★ 공고가 준 값이 **이깁니다** — 아래에서 허용 목록을 합치기로 덮습니다.
                 ★ 담당자 개인 전화·메일은 안 내립니다 — 기관 표 전화는 기관 대표번호이고
                   허용 목록에 문의처·사업자번호·근거가 없습니다 (2026-10-24 ㉠) */
              coalesce((select jsonb_strip_nulls(jsonb_build_object(
                  '채용게시판',
                    case when p."연결상태" = '대기' then null
                         when p."기관번호" like 'NAME:%' and o."확인한때" is null then null
                         else coalesce(nullif(o."채용페이지", ''), nullif(s."채용주소", '')) end,
                  '기관홈',
                    case when p."연결상태" = '대기' then null
                         else coalesce(nullif(o."홈페이지", ''), nullif(s.url, '')) end,
                  '기관주소',
                    case when p."연결상태" = '대기' then null else nullif(o."주소", '') end,
                  '기관전화',
                    case when p."연결상태" = '대기' then null else nullif(o."전화", '') end))
                from job_posts p
                left join "기관" o on o."기관번호" = p."기관번호"
                /* 사이트표에 같은 열쇠가 여러 줄인 곳이 있어 **한 줄만** 고릅니다 */
                left join lateral (
                  select h."채용주소", h.url from hosp_sites h
                   where not h."끔"
                     and ((p."기관번호" like 'HIRA:%' and h.ykiho = substr(p."기관번호", 6))
                          or h."이름열쇠" = o."이름키")
                   order by (nullif(h."채용주소",'') is null), (nullif(h.url,'') is null), h.name
                   limit 1) s on true
               where p.id = j.id), '{}'::jsonb)
              || (select coalesce(jsonb_object_agg(e.k, e.v), '{}'::jsonb)`;
const 바꾸기SQL = 전정의.replace(옛조각, 새조각) + ';';

/* ── 갈래를 세는 질의 (전·후 같은 셈을 씁니다) ── */
const 갈래SQL = `
  with x as (
    select j.id, (job_one(j.id)).detail as d, j.url
      from job_posts_pub j
  )
  select case when coalesce(x.d->>'채용게시판','') <> '' then '① 채용게시판'
              when coalesce(x.d->>'기관홈','') <> ''
                or coalesce(x.d->>'기관홈페이지','') <> '' then '② 기관홈'
              when coalesce(x.url,'') <> ''              then '③ 원문'
              else '없음' end as 갈래,
         count(*) as 공고
    from x group by 1 order by 1;`;

if (점검만) {
  /* 울타리가 듣는지 — 되돌림 안에서 **의심 줄**과 **NAME 줄**을 세어 봅니다 */
  console.log('\n══ 자기점검 — 울타리가 듣나 (되돌림 안) ══');
  console.log(psql(머리 + 회원되기 + `
begin;
${바꾸기SQL}
  with x as (
    select p.id, p."기관번호", p."연결상태", o."확인한때",
           (job_one(p.id)).detail as d
      from job_posts p join job_posts_pub v on v.id = p.id
      left join "기관" o on o."기관번호" = p."기관번호"
  )
  select '㉠ 의심(대기)' as 울타리, count(*) as 공고,
         count(*) filter (where coalesce(d->>'채용게시판','') <> ''
                             or coalesce(d->>'기관주소','') <> ''
                             or coalesce(d->>'기관전화','') <> '') as "칸이 나간 것(0 이어야)"
    from x where "연결상태" = '대기'
  union all
  select '㉡ NAME + 확인한때 없음', count(*),
         count(*) filter (where coalesce(d->>'채용게시판','') <> '')
    from x where "기관번호" like 'NAME:%' and "확인한때" is null
  union all
  select '○ HIRA (쓸 수 있는 줄)', count(*),
         count(*) filter (where coalesce(d->>'채용게시판','') <> '')
    from x where "기관번호" like 'HIRA:%' and coalesce("연결상태",'') <> '대기';
rollback;`));
  process.exit(0);
}

console.log('\n══ 전 — 지금 갈래 ══');
const 전갈래 = psql(머리 + 회원되기 + 갈래SQL);
console.log(전갈래);

console.log('\n══ 마른 실행 — 바꾼 뒤 갈래 (되돌림 안에서 돌렸습니다) ══');
console.log(psql(머리 + 회원되기 + 'begin;\n' + 바꾸기SQL + '\n' + 갈래SQL + '\nrollback;'));

console.log('\n══ 개인정보 검사 — 내려보낼 네 칸에 **담당자 개인** 것이 섞였나 ══');
console.log(psql(머리 + `
  select count(*) as "기관 표 줄",
         count(*) filter (where "전화" ~ '^0(1[0-9])') as "휴대전화꼴_전화",
         count(*) filter (where "전화" ~ '@')           as "전화칸에_메일",
         count(*) filter (where "주소" ~ '@')           as "주소칸에_메일",
         count(*) filter (where "채용페이지" ~ '@' and "채용페이지" !~ '^https?://[^/]*@') as "채용페이지에_메일",
         count(*) filter (where "홈페이지" ~ '@')       as "홈페이지에_메일"
    from "기관";`));
console.log('── job_one 이 내리는 열쇠 전부 (허용 목록 + 새 네 칸) ──');
console.log(psql(머리 + 회원되기 + `
  with x as (select jsonb_object_keys((job_one(j.id)).detail) as k from job_posts_pub j)
  select k as 열쇠, count(*) as 공고 from x group by 1 order by 2 desc;`));
console.log('── 이미 내려가는 접수방법에 메일·전화가 있나 (제 변경 밖이지만 함께 셉니다) ──');
console.log(psql(머리 + `
  select count(*) as "접수방법 있는 공고",
         count(*) filter (where p.detail->>'접수방법' ~ '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+') as "메일꼴",
         count(*) filter (where p.detail->>'접수방법' ~ '0(1[0-9])[-. ]?[0-9]{3,4}[-. ]?[0-9]{4}') as "휴대전화꼴"
    from job_posts p join job_posts_pub v on v.id = p.id
   where coalesce(p.detail->>'접수방법','') <> '';`));

if (!진짜) {
  console.log('\n[마른] 아무것도 안 바꿨습니다 (rollback) — --진짜 로 바꿉니다');
  process.exit(0);
}

/* ── 되돌림 ── */
const d = new Date(); const 두 = (n) => String(n).padStart(2, '0');
const 때 = String(d.getFullYear()) + 두(d.getMonth() + 1) + 두(d.getDate())
  + '_' + 두(d.getHours()) + 두(d.getMinutes()) + 두(d.getSeconds());
const 되돌림터 = path.join(os.homedir(), '되돌림');
fs.mkdirSync(되돌림터, { recursive: true });
const 되돌림 = path.join(되돌림터, 'job_one_되돌리기_' + 때 + '.sql');
fs.writeFileSync(되돌림,
  '/* ㉣ 되돌리기 — 2026-10-28 전 정의 그대로 (pg_get_functiondef 로 받은 것) */\n'
  + 전정의.trimEnd() + ';\n', 'utf8');
console.log('\n○ 되돌릴 글 — ' + 되돌림);

console.log(psql(바꾸기SQL));
const 후acl = 글만(`select coalesce(p.proacl::text,'(기본값)') from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'job_one';`);
console.log('후 ACL — job_one ' + 후acl + (후acl === 전acl ? '  (전과 같습니다)' : '  ⚠ 전과 다릅니다'));
console.log('\n══ 후 — 갈래 ══');
console.log(psql(머리 + 회원되기 + 갈래SQL));
