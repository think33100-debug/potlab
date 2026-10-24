/* `기관` 표에 **불변 칸 여섯**을 더하고 이미 있는 표에서 베껴 채웁니다
 * (2026-10-24 세중님 ㉯ 승인)
 *
 *   node tools/기관표_불변칸.mjs            올릴 전문만 (기본 · 마른)
 *   node tools/기관표_불변칸.mjs --진짜      올리고 채웁니다
 *
 * ── 더하는 칸 ────────────────────────────────────────────────
 *   주소 · 전화 · 홈페이지 · 채용페이지 · 알리오코드 · 사진경로   (여섯 · 전부 text)
 *   + **불변근거 jsonb** — 칸마다 「어디서 베꼈나」를 적습니다
 *     ★ 세중님 글에는 칸 여섯이었습니다. 근거를 남기라는 지시(「연결근거 남김」)를
 *       담을 자리가 없어 **일곱째로 하나 더** 뒀습니다. 빼라 하시면 한 줄입니다.
 *
 * ── 채우는 길 (짐작 금지 · 지침 10-3) ───────────────────────
 *   주소·전화·홈페이지   `hira_org` ← **ykiho 로 바로** (기관번호 'HIRA:<ykiho>')
 *   채용페이지           `hosp_sites.채용주소` ← **이름열쇠**로 (280줄)
 *   알리오코드           **비워 둡니다** — 알리오 응답에 기관 코드가 오는지 먼저
 *                        두드려 봅니다 (지침 4절 · 명세부터)
 *   사진경로             **비워 둡니다** (세중님 ㉯)
 *
 * ★ `확인한때`가 있는 줄(관리자가 손으로 고친 것)은 **안 건드립니다.**
 * ★ 이미 값이 있는 칸은 **안 덮습니다** (`is null` 일 때만 채웁니다).
 * ★ 되돌림 — `~/되돌림/기관표_불변칸_되돌리기_<날짜>.sql` (칸 일곱을 떨어뜨립니다)
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const 진짜 = process.argv.includes('--진짜');
const cfg = {};
for (const f of ['.env', '.env.local']) {
  if (!fs.existsSync(f)) continue;
  for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !cfg[m[1]]) cfg[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
if (!cfg.SUPABASE_DB_URL) { console.error('✗ SUPABASE_DB_URL 이 없습니다'); process.exit(1); }
const u = new URL(cfg.SUPABASE_DB_URL);
const env = {
  ...process.env,
  PGHOST: u.hostname, PGPORT: u.port || '5432',
  PGUSER: decodeURIComponent(u.username), PGPASSWORD: decodeURIComponent(u.password),
  PGDATABASE: decodeURIComponent(u.pathname.replace(/^\//, '')) || 'postgres',
  PGSSLMODE: u.searchParams.get('sslmode') || 'require',
};
function psql(sql) {
  const 임시 = path.join(os.tmpdir(), '기관불변칸_' + process.pid + '.sql');
  fs.writeFileSync(임시, sql, 'utf8');
  const r = spawnSync('psql', ['-X', '-A', '-q', '-F', '  ', '-v', 'ON_ERROR_STOP=1', '-f', 임시],
    { encoding: 'utf8', maxBuffer: 1 << 26, env });
  fs.unlinkSync(임시);
  if (r.status) { console.error('✗ psql\n' + (r.stderr || '').slice(0, 1200)); process.exit(1); }
  return (r.stdout || '').trimEnd();
}

export const 올릴것 = `
/* ── 기관 표 불변 칸 여섯 + 근거 (2026-10-24 세중님 ㉯ 승인) ── */
alter table 기관
  add column if not exists "주소"       text,
  add column if not exists "전화"       text,
  add column if not exists "홈페이지"   text,
  add column if not exists "채용페이지" text,
  add column if not exists "알리오코드" text,
  add column if not exists "사진경로"   text,
  add column if not exists "불변근거"   jsonb not null default '{}'::jsonb;

comment on column 기관."채용페이지" is
  '기관 채용 게시판 주소. **열어서 200 + 채용 쪽인 것만** 담습니다 (주소 짐작 금지).
   ★ 이름 글자로 붙은 기관(기관번호 NAME:…)의 채용페이지·사진은 관리자 확인(확인한때)
     전에는 **회원 화면에 쓰지 않습니다** (2026-10-24 세중님 ㉯).';
comment on column 기관."알리오코드" is
  '알리오 기관 코드. 2026-10-24 현재 **어디에도 없습니다** — 알리오 응답에 오는지
   두드려 보고 채웁니다 (지침 4절). 짐작으로 적지 않습니다.';
comment on column 기관."불변근거" is
  '칸마다 어디서 베꼈나 — {"주소":"hira_org(ykiho)","채용페이지":"hosp_sites(이름열쇠)"} 꼴.
   관리자가 손으로 고치면 「관리자」로 적습니다.';
`;

export const 채울것 = `
/* ① 주소·전화·홈페이지 ← hira_org (ykiho 로 바로 · 이미 찬 칸은 안 덮습니다) */
with 베낌 as (
  select o.기관번호,
         nullif(h.addr, '')     as 주소,
         nullif(h.tel, '')      as 전화,
         nullif(h.hosp_url, '') as 홈페이지
    from 기관 o
    join hira_org h on h.ykiho = o.ykiho
   where o.ykiho is not null and o."확인한때" is null
)
update 기관 o
   set "주소"     = coalesce(o."주소", b.주소),
       "전화"     = coalesce(o."전화", b.전화),
       "홈페이지" = coalesce(o."홈페이지", b.홈페이지),
       "불변근거" = o."불변근거"
         || case when o."주소" is null and b.주소 is not null
                 then jsonb_build_object('주소', 'hira_org(ykiho)') else '{}'::jsonb end
         || case when o."전화" is null and b.전화 is not null
                 then jsonb_build_object('전화', 'hira_org(ykiho)') else '{}'::jsonb end
         || case when o."홈페이지" is null and b.홈페이지 is not null
                 then jsonb_build_object('홈페이지', 'hira_org(ykiho)') else '{}'::jsonb end,
       "고친때"   = now()
  from 베낌 b
 where b.기관번호 = o.기관번호
   and (o."주소" is null and b.주소 is not null
     or o."전화" is null and b.전화 is not null
     or o."홈페이지" is null and b.홈페이지 is not null);

/* ② 채용페이지 ← hosp_sites.채용주소 (이름열쇠로 · **딱 하나로 풀리는 것만**) */
with 짝 as (
  select o.기관번호, min(s."채용주소") as 채용페이지, count(*) as 몇
    from 기관 o
    /* ★ 2026-10-24 세중님 2번 — 사이트표를 **번호(ykiho)로** 잇습니다. 이름열쇠로 이으면
       같은 이름 다른 병원의 채용 주소가 붙습니다 (한일병원: 진주 ↔ 서울 한전).
       사이트표 ykiho 는 266/297줄 채워져 있고, 빈 줄은 **전처럼 이름열쇠로** 잇습니다 */
    join hosp_sites s on ((s.ykiho is not null and s.ykiho = o.ykiho)
                       or (s.ykiho is null and s."이름열쇠" = o.이름키))
   where coalesce(s."채용주소", '') <> '' and o."확인한때" is null
   group by o.기관번호
)
update 기관 o
   set "채용페이지" = 짝.채용페이지,
       "불변근거"   = o."불변근거" || jsonb_build_object('채용페이지', 'hosp_sites(ykiho)'),
       "고친때"     = now()
  from 짝
 where 짝.기관번호 = o.기관번호 and 짝.몇 = 1 and o."채용페이지" is null;
`;

const 권한보기 = `
  select coalesce(c.relacl::text, '(없음)') as acl, c.relrowsecurity::text as rls,
         (select count(*) from pg_policy p where p.polrelid = c.oid)::text as 정책수,
         (select count(*) from pg_attribute a
           where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped)::text as 칸수
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = '기관';`;

console.log('── 올리기 전 ──\n' + psql(권한보기));
console.log('\n════════ 올릴 전문 ════════' + 올릴것 + '════════ 채울 전문 ════════' + 채울것
  + '════════ 끝 ════════');

if (!진짜) { console.log('\n[마른] 아무것도 안 올립니다 — --진짜 로 올립니다'); process.exit(0); }

const 전 = psql(권한보기);
const 되돌림터 = path.join(os.homedir(), '되돌림');
fs.mkdirSync(되돌림터, { recursive: true });
const d = new Date();
const 두 = (n) => String(n).padStart(2, '0');
const 때 = String(d.getFullYear()) + 두(d.getMonth() + 1) + 두(d.getDate())
  + '_' + 두(d.getHours()) + 두(d.getMinutes()) + 두(d.getSeconds());
const 되돌림 = path.join(되돌림터, '기관표_불변칸_되돌리기_' + 때 + '.sql');
fs.writeFileSync(되돌림,
  '/* 되돌리기 — 2026-10-24 에 더한 칸 일곱을 떨어뜨립니다 (자료도 함께 사라집니다) */\n'
  + 'alter table 기관\n'
  + '  drop column if exists "주소",\n  drop column if exists "전화",\n'
  + '  drop column if exists "홈페이지",\n  drop column if exists "채용페이지",\n'
  + '  drop column if exists "알리오코드",\n  drop column if exists "사진경로",\n'
  + '  drop column if exists "불변근거";\n', 'utf8');
console.log('\n○ 되돌릴 글을 남겼습니다 — ' + 되돌림);

psql(올릴것);
console.log('○ 칸을 더했습니다');
psql(채울것);
console.log('○ 채웠습니다');

console.log('\n── 올린 뒤 ──\n' + psql(권한보기));
console.log(전.split('  ').slice(0, 3).join('  ') === psql(권한보기).split('  ').slice(0, 3).join('  ')
  ? '○ ACL·RLS·정책 수가 **그대로입니다** (칸 수만 늘었습니다)'
  : '✗ 권한이 달라졌습니다 — 되돌리십시오');

console.log('\n── 채움 셈 ──\n' + psql(`
  select count(*) as 기관,
         count("주소") as 주소, count("전화") as 전화, count("홈페이지") as 홈페이지,
         count("채용페이지") as 채용페이지, count("알리오코드") as 알리오코드,
         count("사진경로") as 사진경로
    from 기관;`));
console.log('\n── 심평원 번호가 있는 기관만 ──\n' + psql(`
  select count(*) as 기관, count("주소") as 주소, count("전화") as 전화,
         count("홈페이지") as 홈페이지, count("채용페이지") as 채용페이지
    from 기관 where ykiho is not null;`));
console.log('\n── 견본 셋 ──\n' + psql(`
  select 이름, coalesce("주소",'-') as 주소, coalesce("전화",'-') as 전화,
         coalesce("홈페이지",'-') as 홈페이지, coalesce("채용페이지",'-') as 채용페이지,
         "불변근거"::text as 근거
    from 기관 where "주소" is not null order by 이름 limit 3;`));
