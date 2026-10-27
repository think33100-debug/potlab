/* 제목이 틀린 공고 **둘**의 까닭을 찾습니다 (2026-10-28 세중님 4번)
 *
 *   node tools/제목틀린둘_1028.mjs            원문을 찍습니다 (읽기만)
 *
 * ── 무엇 ─────────────────────────────────────────────────────
 *   ⓐ 「경기도의료원 수원병원 **마취통증의학과** 작업치료사 계약직」
 *      → 부서가 어디서 붙었나. **통합공고에서 남의 직군 부서**가 붙은 꼴이면
 *        그 규칙(파일:줄)과 같은 꼴이 회원 화면에 몇 건인지
 *   ⓑ 「**중구** 작업치료사 계약직 채용공고」
 *      → 기관 이름이 「중구」로만 잡힘. ND 출처 **기관명 원문**을 확인하고,
 *        지자체 이름만 남은 기관(「○구」「○군」「○시」 단독) 전수
 *
 * ★ 읽기만 합니다 — 고치는 것은 세중님이 보신 뒤입니다 (지침 2절 — 원문부터).
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
  const 임시 = path.join(os.tmpdir(), '제목틀린둘_' + process.pid + '.sql');
  fs.writeFileSync(임시, sql, 'utf8');
  const r = spawnSync('psql', [...꼴, '-v', 'ON_ERROR_STOP=1', '-f', 임시],
    { encoding: 'utf8', maxBuffer: 1 << 26, env });
  fs.unlinkSync(임시);
  if (r.status) { console.error('✗ psql\n' + (r.stderr || '').slice(0, 900)); process.exit(1); }
  return (r.stdout || '').trimEnd();
}

console.log('══ ⓐ 「마취통증의학과」가 붙은 제목 ══');
console.log(psql(`
  \\pset pager off
  select p.id, p.source, p.org_name, p.title,
         p."뽑은값"->>'부서' as 뽑은값_부서,
         p.detail->>'부서' as detail_부서,
         p.job_group, p."통합공고"::text
    from job_posts p
   where p.title like '%마취통증의학과%'
   order by p.id;`));

console.log('\n── 그 공고의 원문 제목·근거 (있는 대로) ──');
console.log(psql(`
  \\pset pager off
  \\x on
  select p.id, p."원본제목" as 원본제목, left(p.evidence::text, 700) as evidence,
         left(p."뽑은값"::text, 700) as 뽑은값, left(p.detail::text, 700) as detail
    from job_posts p where p.title like '%마취통증의학과%' limit 2;`));

console.log('\n── 제목에 **진료과 이름**이 든 회원 화면 공고 (같은 꼴 전수) ──');
console.log(psql(`
  \\pset pager off
  select count(*) as 회원화면_전체,
         count(*) filter (where p.title ~ '(마취통증|재활|정형외과|신경과|신경외과|소아청소년|가정의학|영상의학|진단검사|응급의학|산부인과|피부과|안과|이비인후|치과)') as 진료과가_제목에
    from job_posts p join job_posts_pub v on v.id = p.id;`));
console.log(psql(`
  \\pset pager off
  select p.id, p.source, left(p.title, 58) as 제목
    from job_posts p join job_posts_pub v on v.id = p.id
   where p.title ~ '(마취통증|신경과|신경외과|소아청소년|가정의학|영상의학|진단검사|응급의학|산부인과|피부과|안과|이비인후)'
   order by p.id;`));

console.log('\n══ ⓑ 기관 이름이 지자체 단독인 공고 ══');
console.log(psql(`
  \\pset pager off
  select p.id, p.source, p.org_name, left(p.title, 50) as 제목,
         coalesce(p.sido,'') || ' ' || coalesce(p.sgg,'') as 지역,
         (v.id is not null) as 회원화면, coalesce(p."기관번호",'(없음)') as 기관번호
    from job_posts p left join job_posts_pub v on v.id = p.id
   where p.org_name ~ '^[가-힣]{1,4}(구|군|시)$'
   order by (v.id is null), p.id;`));

console.log('\n── 「중구」 공고의 원문 기관명 (ND 가 준 글자) ──');
console.log(psql(`
  \\pset pager off
  \\x on
  select p.id, p.source, p.org_name, p.title, p.url,
         left(p.evidence::text, 500) as evidence,
         left(p.detail::text, 500) as detail
    from job_posts p where p.org_name = '중구' order by p.id limit 3;`));
console.log('\n★ 아무것도 바꾸지 않았습니다 (읽기만).');
