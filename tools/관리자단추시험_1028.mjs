/* 관리자 단추가 **끝까지 가나** — 시험 공고로 네 단추를 돌려 봅니다 (2026-10-28 세중님 1번)
 *
 *   node tools/관리자단추시험_1028.mjs             되돌림 안에서 (아무것도 안 남습니다)
 *   node tools/관리자단추시험_1028.mjs --진짜       참으로 돌리고 **원래대로 되돌립니다**
 *
 * ── 어떻게 시험하나 (지침 12 — 보내는 쪽과 같은 도구) ──────
 *   화면이 부르는 **그 창구**(`admin_decide`)를 **같은 인수**로 부릅니다.
 *   화면 코드 세 자리를 읽어 보니 셋 다 `await rpc` → `if (error)` → 오류 토스트 →
 *   성공 토스트 차례입니다 (삼키는 자리 없음) —
 *     web/app/admin/jobs/page.tsx:137         목록
 *     web/app/admin/jobs/[id]/page.tsx:91     한 건
 *     web/components/admin-job-tools.tsx:69   공고 밑 단추
 *
 * ── ★ 역할을 함께 봅니다 ────────────────────────────────────
 *   `admin_decide` 는 맨 앞에서 `is_admin()` 을 봅니다 (sql/기준구조_1025.sql:356).
 *   그리고 `is_admin()` 은 **마스터 역할을 따릅니다** — 역할이 학생·치료사면 **거짓**
 *   (2026-10-28 확인). 그러니 **회원 역할로 바꿔 둔 채 「숨기기」를 누르면 막힙니다.**
 *   그게 10/23 에 숨김이 DB 에 안 닿은 가장 그럴듯한 까닭입니다 — 역할마다 돌려 봅니다.
 *
 * 시험 공고는 `시험자료 = true` 인 것만 씁니다 (지침 8-9).
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
  const 임시 = path.join(os.tmpdir(), '관리자단추_' + process.pid + '.sql');
  fs.writeFileSync(임시, sql, 'utf8');
  const r = spawnSync('psql', [...꼴, '-v', 'ON_ERROR_STOP=0', '-f', 임시],
    { encoding: 'utf8', maxBuffer: 1 << 26, env });
  fs.unlinkSync(임시);
  return (r.stdout || '') + (r.stderr ? '\n' + r.stderr : '');
}
const 글만 = (sql) => psql(sql, ['-X', '-A', '-t', '-q']).trim();
const 머리 = '\\pset pager off\n';
const 마스터되기 = String.raw`\o /dev/null
select set_config('request.jwt.claims',
  json_build_object('sub', m.auth_id, 'role', 'authenticated')::text, false)
  from "마스터페르소나" m limit 1;
\o
`;

/* 시험 공고 하나 — 시험자료 = true 인 것만 (지침 8-9) */
const 시험공고 = 글만(`select p.id from job_posts p
  where coalesce(p."시험자료", false) order by p.id limit 1;`);
if (!시험공고) { console.error('✗ 시험자료 = true 인 공고가 없습니다'); process.exit(1); }
console.log('시험 공고 — ' + 시험공고 + ' (시험자료 = true)');
console.log(psql(머리 + `
  select p.id, p.hidden, p.hold, p.admin_locked, coalesce(p.hidden_why,'(없음)') as 까닭,
         coalesce(p."시험자료"::text,'?') as 시험자료, left(coalesce(p."보여줄제목",p.title),40) as 제목
    from job_posts p where p.id = '${시험공고}';`));

/* 한 번 눌러 보는 글 — 역할을 세우고 창구를 부르고 결과를 찍습니다 */
const 눌러보기 = (역할, 무엇, 직군) => `
  update "마스터페르소나" set "지금역할" = '${역할}';
  select '${역할}' as 역할, '${무엇}' as 누른것, is_admin() as "is_admin()";
  select "admin_decide"('${시험공고}', '${무엇}'${직군 ? ", '" + 직군 + "'" : ', null'}, '단추 시험 2026-10-28') as 창구가낸값;
  select p.hidden, p.hold, p.admin_locked, coalesce(p.hidden_why,'(없음)') as 까닭
    from job_posts p where p.id = '${시험공고}';
  select count(*) as "job_state_log 줄" from job_state_log l where l.job_id = '${시험공고}';`;

console.log('\n══ ① 역할이 **학생**일 때 「숨기기」 ══');
console.log(psql(머리 + 마스터되기 + `begin;\n${눌러보기('학생', '숨기기')}\nrollback;`));
console.log('══ ② 역할이 **관리자**일 때 네 단추 ══');
for (const [무엇, 직군] of [['숨기기', null], ['보류함으로', null], ['살리기', '공통'], ['잠금풀기', null]]) {
  console.log('── 「' + 무엇 + '」 ──');
  console.log(psql(머리 + 마스터되기 + `begin;
    update "마스터페르소나" set "지금역할" = '관리자';
    ${눌러보기('관리자', 무엇, 직군).split('\n').slice(2).join('\n')}
    rollback;`));
}

console.log('\n══ ③ 신고 처리 단추 ══');
console.log(psql(머리 + 마스터되기 + `
  select count(*) as "신고 줄", count(*) filter (where "처리한때" is null) as "처리 전"
    from reports;`));
console.log(psql(머리 + 마스터되기 + `begin;
  update "마스터페르소나" set "지금역할" = '학생';
  select '학생' as 역할, is_admin() as "is_admin()";
  select "admin_신고처리"((select r.id from reports r order by r.id limit 1), '단추 시험') as 창구가낸값;
  rollback;`));
console.log(psql(머리 + 마스터되기 + `begin;
  update "마스터페르소나" set "지금역할" = '관리자';
  select '관리자' as 역할, is_admin() as "is_admin()";
  select "admin_신고처리"((select r.id from reports r order by r.id limit 1), '단추 시험') as 창구가낸값;
  rollback;`));

console.log('\n── 지금 역할이 그대로인지 (되돌림 안에서만 바꿨습니다) ──');
console.log(psql(머리 + `select m."지금역할" from "마스터페르소나" m;`));
console.log('\n★ 모두 begin … rollback 안입니다 — 공고·역할·신고가 한 줄도 안 바뀌었습니다.');
