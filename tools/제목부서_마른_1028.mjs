/* 제목에 **남의 진료과**가 붙는 것을 고치는 안 — **마른 실행** (2026-10-28 세중님 4번ⓐ)
 *
 *   node tools/제목부서_마른_1028.mjs        바뀌는 제목을 전수로 찍습니다 (읽기만)
 *
 * ── 찾은 까닭 ────────────────────────────────────────────────
 * 「경기도의료원 수원병원 **마취통증의학과** 작업치료사 계약직」 —
 * 우리가 부서를 **지어 붙인 것이 아니라** `제목부서(p_title)` 가 **원문 제목에서**
 * 뽑은 것입니다. 그 함수의 낱말 목록에 **`의학과` 가 통째로** 들어 있습니다 —
 *
 *   '([가-힣A-Za-z0-9]*(?:치료실|치료팀|치료센터|재활팀|재활실|**의학과**|의학팀|파트|지원팀))'
 *
 * 통합공고(한 공고에 여러 직군)의 원문 제목은 **맨 앞 자리**부터 적습니다. 그래서
 * 마취통증의학과·직업환경의학과처럼 **우리 직군과 무관한 진료과**가 제목에 올라옵니다.
 *
 * ── 고치는 안 ───────────────────────────────────────────────
 *   `의학과` → `재활의학과` 로 좁힙니다 (재활의학과는 우리 자리입니다).
 *   **DB 함수 변경이라 승인 자리입니다** (CLAUDE.md 지휘 절 ⓑ) — 전문은
 *   docs/승인대기_1025.md ㉦ 에 있습니다. 이 도구는 **바뀌는 줄만** 세어 봅니다.
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
function psql(sql, 꼴 = ['-X', '-q']) {
  const 임시 = path.join(os.tmpdir(), '제목부서마른_' + process.pid + '.sql');
  fs.writeFileSync(임시, sql, 'utf8');
  const r = spawnSync('psql', [...꼴, '-v', 'ON_ERROR_STOP=1', '-f', 임시],
    { encoding: 'utf8', maxBuffer: 1 << 26, env });
  fs.unlinkSync(임시);
  if (r.status) { console.error('✗ psql\n' + (r.stderr || '').slice(0, 900)); process.exit(1); }
  return (r.stdout || '').trimEnd();
}

/* 지금 꼴과 고친 꼴을 **나란히** 뽑습니다 — 함수는 건드리지 않고 식을 inline 합니다 */
const 지금식 = "'([가-힣A-Za-z0-9]*(?:치료실|치료팀|치료센터|재활팀|재활실|의학과|의학팀|파트|지원팀))'";
const 새식 = "'([가-힣A-Za-z0-9]*(?:치료실|치료팀|치료센터|재활팀|재활실|재활의학과|의학팀|파트|지원팀))'";
const 뽑기 = (식) => `nullif(btrim((select m[1] from regexp_matches(coalesce(p.title,''), ${식}) m limit 1)), '')`;

console.log('══ ⓐ 제목 부서 — 지금 ↔ 고친 뒤 (회원 화면 전수) ══');
console.log(psql(`
  \\pset pager off
  with x as (
    select p.id, p.source, p.job_group, p.title as 원문제목,
           ${뽑기(지금식)} as 지금부서, ${뽑기(새식)} as 새부서,
           p.detail->>'부서' as 사람이넣은부서
      from job_posts p join job_posts_pub v on v.id = p.id
  )
  select count(*) as 회원화면,
         count(*) filter (where 지금부서 is not null) as 부서가_붙는것,
         count(*) filter (where 지금부서 is distinct from 새부서) as 바뀌는것,
         count(*) filter (where 지금부서 is distinct from 새부서
                            and 사람이넣은부서 is not null) as 그중_사람이넣은것
    from x;`));
console.log(psql(`
  \\pset pager off
  with x as (
    select p.id, p.source, p.job_group, p.title,
           ${뽑기(지금식)} as 지금부서, ${뽑기(새식)} as 새부서
      from job_posts p join job_posts_pub v on v.id = p.id
  )
  select id, source, job_group as 직군, 지금부서, coalesce(새부서,'(없음)') as 새부서,
         left(title, 46) as 원문제목
    from x where 지금부서 is distinct from 새부서 order by id;`));

console.log('\n══ ⓑ 기관 이름이 **지자체 단독**인 공고 (「○구」「○군」) ══');
console.log(psql(`
  \\pset pager off
  select p.id, p.source, p.org_name, left(p.title, 44) as 제목,
         coalesce(p.sido,'') || ' ' || coalesce(p.sgg,'') as 지역,
         (v.id is not null) as 회원화면, coalesce(p."기관번호",'(없음)') as 기관번호
    from job_posts p left join job_posts_pub v on v.id = p.id
   where p.org_name ~ '^[가-힣]{1,3}(구|군)$'
      or p.org_name ~ '^[가-힣]{1,2}시$'
   order by (v.id is null), p.id;`));

console.log('\n── 그 공고들의 원문 (출처가 준 기관명·주소) ──');
console.log(psql(`
  \\pset pager off
  \\x on
  select p.id, p.source, p.org_name, p.title, p.url, p."원문제목",
         left(p.detail::text, 300) as detail
    from job_posts p
   where (p.org_name ~ '^[가-힣]{1,3}(구|군)$' or p.org_name ~ '^[가-힣]{1,2}시$')
     and exists (select 1 from job_posts_pub v where v.id = p.id)
   order by p.id limit 4;`));
console.log('\n★ 아무것도 바꾸지 않았습니다 (읽기만).');
