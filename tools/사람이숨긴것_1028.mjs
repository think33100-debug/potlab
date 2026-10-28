/* 사람이 숨긴 공고가 **다시 보입니다** — 까닭 찾기 + 전수 (2026-10-28 세중님 1번)
 *
 *   node tools/사람이숨긴것_1028.mjs                 읽기만 (한 건 원문 + 전수)
 *   node tools/사람이숨긴것_1028.mjs --공고 HS102260084
 *   node tools/사람이숨긴것_1028.mjs --진짜           다시 숨기고 **잠급니다**
 *
 * ── 어디를 봤나 ──────────────────────────────────────────────
 *   숨기는 길   `admin_decide()` (sql/기준구조_1025.sql:366~384) —
 *               hidden=true · hidden_why='관리자가 숨김 …' · **admin_locked=true**
 *   푸는 길 넷  ① hide_stale_posts ③ (3635) — `hidden_why = '마감 지남'` 만
 *               ② hide_stale_posts ④ (3644) — `'%일 지남'` + **not admin_locked**
 *               ③ 정찰 되살리기 (2382)      — **not admin_locked**
 *               ④ 공고연결풀기 (6892)       — **not admin_locked**
 *   `collect_put` 은 `hidden` 을 **안 씁니다** (on conflict 목록에 없습니다 ·
 *               hold 줄에서 `when j.hidden then false` 로 **읽기만** 합니다)
 *   → 그래서 **admin_locked 가 켜져 있었다면 아무 바퀴도 못 풉니다.**
 *     풀렸다면 ㉠ 잠금이 안 켜졌거나 ㉡ 숨긴 길이 admin_decide 가 아니었던 것입니다
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const 뿌리 = path.join(import.meta.dirname, '..');
const 진짜 = process.argv.includes('--진짜');
const 공고 = (() => { const i = process.argv.indexOf('--공고');
  return i < 0 ? 'HS102260084' : String(process.argv[i + 1] || ''); })();
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
  const 임시 = path.join(os.tmpdir(), '사람이숨긴것_' + process.pid + '.sql');
  fs.writeFileSync(임시, sql, 'utf8');
  const r = spawnSync('psql', [...꼴, '-v', 'ON_ERROR_STOP=1', '-f', 임시],
    { encoding: 'utf8', maxBuffer: 1 << 26, env });
  fs.unlinkSync(임시);
  if (r.status) { console.error('✗ psql\n' + (r.stderr || '').slice(0, 1200)); process.exit(1); }
  return (r.stdout || '').trimEnd();
}
const 글만 = (sql) => psql(sql, ['-X', '-A', '-t', '-q', '-F', '\t']);
const 머리 = '\\pset pager off\n';

console.log('══ ① ' + 공고 + ' — 지금 상태 ══');
console.log(psql(머리 + `
  select p.id, p.source, p.org_name, p.hidden, p.hold, p.admin_locked,
         coalesce(p.hidden_why,'(없음)') as 숨긴까닭, p.hidden_on as 숨긴날,
         p.admin_at at time zone 'Asia/Seoul' as 관리자가만진때,
         coalesce(p.admin_note,'(없음)') as 관리자메모,
         coalesce(p.edited_fields::text,'{}') as 사람이정한칸,
         exists (select 1 from job_posts_pub v where v.id = p.id) as "회원 화면에 있나",
         left(coalesce(p."보여줄제목", p.title), 46) as 제목
    from job_posts p where p.id = '${공고}';`));

console.log('── ② 상태 기록 전부 (job_state_log · 오래된 것부터) ──');
console.log(psql(머리 + `
  select l."바뀐때" at time zone 'Asia/Seoul' as 때, l."누가", coalesce(l."왜",'') as 왜,
         l."옛_hidden", l."새_hidden", l."옛_hold", l."새_hold"
    from job_state_log l where l.job_id = '${공고}' order by l."바뀐때";`));

console.log('── ③ 칸기록 (10/20 뒤 · 오래된 것부터) ──');
console.log(psql(머리 + `
  select k."바뀐때" at time zone 'Asia/Seoul' as 때, k."칸", k."누가", coalesce(k."왜",'') as 왜,
         left(coalesce(k."옛값",'(널)'), 28) as 옛값, left(coalesce(k."새값",'(널)'), 28) as 새값
    from "칸기록" k where k.job_id = '${공고}'
     and k."바뀐때" > '2026-10-20'
   order by k."바뀐때" limit 40;`));

console.log('\n══ ④ 결과 안내문 거르기에 왜 안 걸렸나 ══');
/* 거르기 규칙은 `tools/gas-rules.mjs` 의 `HS_SKIP_RE` **한 자리**입니다 (DB 함수가 아닙니다) */
const { HS_SKIP_RE } = await import('./gas-rules.mjs');
const 제목들 = 글만(`select coalesce(p.title,''), coalesce(p."보여줄제목",''),
    coalesce(p.job_group,''), coalesce(p.employ_type,'')
  from job_posts p where p.id = '${공고}';`).split('\t');
const [원문제목, 보여줄제목, 직군, 고용형태] = 제목들;
console.log('  원문 제목 (' + 원문제목.length + '자)');
console.log('    ' + 원문제목);
console.log('  보여줄 제목');
console.log('    ' + 보여줄제목);
console.log('  직군 ' + (직군 || '(빈칸)') + ' · 고용형태 ' + (고용형태 || '(빈칸)'));
const 걸림 = (t) => { HS_SKIP_RE.lastIndex = 0; const m = HS_SKIP_RE.exec(t); return m ? m[0] : null; };
console.log('  거르기(HS_SKIP_RE) — 원문 제목 전체 → '
  + (걸림(원문제목) ? '★ 걸립니다 「' + 걸림(원문제목) + '」' : '안 걸립니다'));
for (const n of [30, 60, 80]) {
  console.log('    앞 ' + n + '자로 자르면 → '
    + (걸림(원문제목.slice(0, n)) ? '걸립니다 「' + 걸림(원문제목.slice(0, n)) + '」' : '**안 걸립니다**'));
}
console.log('  보여줄 제목으로 대면 → '
  + (걸림(보여줄제목) ? '걸립니다 「' + 걸림(보여줄제목) + '」' : '**안 걸립니다** (제목을 우리가 다시 지어서입니다)'));

console.log('\n══ ⑤ 전수 — 10/23 뒤 **사람이 숨겼는데 지금 보이는** 공고 ══');
/* 「사람이 숨겼다」의 자: job_state_log 에 누가='관리자' 이고 새_hidden 이 참인 줄이 있음.
   그 뒤로 hidden 이 풀려 지금 회원 화면에 있는 것 */
const 전수조건 = `
    exists (select 1 from job_posts_pub v where v.id = p.id)
    and exists (select 1 from job_state_log l
                 where l.job_id = p.id and l."새_hidden"
                   and l."누가" like '%관리자%'
                   and l."바뀐때" >= '2026-10-23')`;
console.log(psql(머리 + `
  select p.id, p.source, p.org_name, p.hidden, p.admin_locked,
         coalesce(p.admin_note,'') as 관리자메모,
         (select max(l."바뀐때" at time zone 'Asia/Seoul') from job_state_log l
           where l.job_id = p.id and l."새_hidden" and l."누가" like '%관리자%') as 관리자가숨긴때,
         (select max(l."바뀐때" at time zone 'Asia/Seoul') from job_state_log l
           where l.job_id = p.id and l."옛_hidden" and not l."새_hidden") as 풀린때,
         (select l."누가" from job_state_log l
           where l.job_id = p.id and l."옛_hidden" and not l."새_hidden"
           order by l."바뀐때" desc limit 1) as 누가풀었나,
         left(coalesce(p."보여줄제목", p.title), 40) as 제목
    from job_posts p where ${전수조건}
   order by p.id;`));
console.log('── 셈 ──');
console.log(psql(머리 + `
  select count(*) as "사람이 숨겼는데 지금 보이는 공고" from job_posts p where ${전수조건};`));
console.log('── 견주기: 10/23 뒤 관리자가 숨긴 공고 전부 ──');
console.log(psql(머리 + `
  select count(distinct l.job_id) as "관리자가 숨긴 공고",
         count(distinct l.job_id) filter (where p.hidden) as "아직 숨김",
         count(distinct l.job_id) filter (where not p.hidden) as "풀린 것",
         count(distinct l.job_id) filter (where p.admin_locked) as "잠긴 것"
    from job_state_log l join job_posts p on p.id = l.job_id
   where l."새_hidden" and l."누가" like '%관리자%' and l."바뀐때" >= '2026-10-23';`));

console.log('\n══ ⑥ 틈 — 원문 제목이 **잘린 채** 담긴 회원 화면 공고 ══');
/* 거르기는 **담을 때 한 번**만 돕니다. 제목이 잘려 오면 뒤에 있는 「면접일정 안내」·
   「합격자 발표」를 못 보고 회원 화면에 올립니다 (tools/결과공고다시거르기.mjs 머리글).
   상세를 읽어도 제목이 **그대로 잘려 있으면** 다시 걸러도 못 잡습니다 — HS102260084 */
console.log(psql(머리 + `
  select count(*) as "회원 화면",
         count(*) filter (where p.title ~ '(\\.\\.\\.|…)\\s*$') as "제목이 잘린 것",
         count(*) filter (where p.title ~ '(\\.\\.\\.|…)\\s*$' and p.source like 'HS%') as "그중 긁기",
         count(*) filter (where length(p.title) between 54 and 62) as "제목 길이 54~62자"
    from job_posts p join job_posts_pub v on v.id = p.id;`));
console.log('── 잘린 제목 전수 ──');
console.log(psql(머리 + `
  select p.id, p.source, length(p.title) as 길이, p.title as 원문제목
    from job_posts p join job_posts_pub v on v.id = p.id
   where p.title ~ '(\\.\\.\\.|…)\\s*$' order by p.id;`));

/* ── --이것숨기기 — 한 건만 숨기고 **잠급니다** (세중님이 10/23 에 누르려던 것) ── */
if (process.argv.includes('--이것숨기기')) {
  const 전 = 글만(`select p.hidden::text, coalesce(p.hidden_why,''), p.admin_locked::text,
      coalesce(p.edited_fields::text,'{}') from job_posts p where p.id = '${공고}';`).split('\t');
  if (!진짜) {
    console.log('\n[마른] ' + 공고 + ' — 지금 hidden ' + 전[0] + ' · 잠금 ' + 전[2]
      + ' → **숨김 + 잠금**으로 바꿉니다 (--이것숨기기 --진짜)');
    process.exit(0);
  }
  const d2 = new Date(); const 두2 = (n) => String(n).padStart(2, '0');
  const 때2 = String(d2.getFullYear()) + 두2(d2.getMonth() + 1) + 두2(d2.getDate())
    + '_' + 두2(d2.getHours()) + 두2(d2.getMinutes()) + 두2(d2.getSeconds());
  const 터 = path.join(os.homedir(), '되돌림');
  fs.mkdirSync(터, { recursive: true });
  const 길 = path.join(터, '공고숨김_되돌리기_' + 때2 + '.sql');
  fs.writeFileSync(길, '/* 되돌리기 — ' + 공고 + ' 숨김·잠금 (2026-10-28) */\n'
    + `update job_posts set hidden = ${전[0]}, hidden_why = ${전[1] ? "'" + 전[1].replace(/'/g, "''") + "'" : 'null'}`
    + `, hidden_on = null, admin_locked = ${전[2]}, edited_fields = '${전[3]}'::text[]`
    + ` where id = '${공고}';` + '\n', 'utf8');
  console.log('\n○ 되돌릴 글 — ' + 길);
  console.log(psql(머리 + `
select set_config('app.누가', '관리자', true);
select set_config('app.왜', '숨기기 · 면접일정 안내(결과 안내문) · 우리 직군 아님 — 세중님 2026-10-23 뜻 2026-10-28 반영', true);
update job_posts p set hidden = true, hold = false,
       hidden_why = '관리자가 숨김 · 면접일정 안내(결과 안내문) · 제목이 잘려 거르기를 지나쳤습니다',
       hidden_on = (now() at time zone 'Asia/Seoul')::date,
       admin_locked = true, admin_at = now(),
       admin_note = '세중님 2026-10-23 숨기기 — DB 에 안 닿아 2026-10-28 에 다시',
       edited_fields = (select array_agg(distinct x)
                          from unnest(coalesce(p.edited_fields, '{}') || array['hidden','hold']) x)
 where p.id = '${공고}';`));
  console.log('── 후 ──');
  console.log(psql(머리 + `
    select p.id, p.hidden, p.hold, p.admin_locked, p.hidden_why,
           exists (select 1 from job_posts_pub v where v.id = p.id) as "회원 화면에 있나"
      from job_posts p where p.id = '${공고}';`));
  console.log('회원 화면 — ' + 글만('select count(*) from job_posts_pub;') + '건');
  process.exit(0);
}

if (!진짜) {
  console.log('\n[마른] 아무것도 안 바꿨습니다 — --진짜 로 다시 숨기고 잠급니다');
  process.exit(0);
}

const 줄들 = 글만(`select p.id from job_posts p where ${전수조건} order by p.id;`)
  .split('\n').filter(Boolean);
if (!줄들.length) { console.log('\n다시 숨길 것이 없습니다'); process.exit(0); }
const d = new Date(); const 두 = (n) => String(n).padStart(2, '0');
const 때 = String(d.getFullYear()) + 두(d.getMonth() + 1) + 두(d.getDate())
  + '_' + 두(d.getHours()) + 두(d.getMinutes()) + 두(d.getSeconds());
const 되돌림터 = path.join(os.homedir(), '되돌림');
fs.mkdirSync(되돌림터, { recursive: true });
const 되돌림 = path.join(되돌림터, '사람이숨긴것_되돌리기_' + 때 + '.sql');
const 전값 = 글만(`select p.id, p.hidden::text, coalesce(p.hidden_why,''), p.admin_locked::text,
    coalesce(p.edited_fields::text,'{}') from job_posts p where ${전수조건} order by p.id;`);
fs.writeFileSync(되돌림, ['/* 되돌리기 — 2026-10-28 사람이 숨긴 공고 다시 숨기고 잠근 것 */',
  ...전값.split('\n').filter(Boolean).map((l) => {
    const [id, h, why, lock, ef] = l.split('\t');
    return `update job_posts set hidden = ${h}, hidden_why = ${why ? "'" + why.replace(/'/g, "''") + "'" : 'null'}`
      + `, admin_locked = ${lock}, edited_fields = '${ef}'::text[] where id = '${id}';`;
  })].join('\n') + '\n', 'utf8');
console.log('\n○ 되돌릴 글 — ' + 되돌림 + ' (' + 줄들.length + '건)');

console.log(psql(머리 + `
select set_config('app.누가', '관리자 숨김 되돌리기 2026-10-28 (세중님 1번)', true);
select set_config('app.왜', '사람이 숨긴 공고가 다시 보였습니다 — 다시 숨기고 잠급니다', true);
update job_posts p set hidden = true, hold = false,
       hidden_why = coalesce(nullif(p.hidden_why,''), '관리자가 숨김 · 2026-10-28 다시 숨김'),
       hidden_on = (now() at time zone 'Asia/Seoul')::date,
       admin_locked = true,
       /* ★ hold 와 같은 꼴 — 사람이 정한 칸으로 **잠급니다** (지침 8-24) */
       edited_fields = (select array_agg(distinct x)
                          from unnest(coalesce(p.edited_fields, '{}') || array['hidden','hold']) x)
 where ${전수조건};`));
console.log('── 후 ──');
console.log(psql(머리 + `
  select count(*) as "아직 보이는 것(0 이어야)" from job_posts p where ${전수조건};`));
console.log('회원 화면 — ' + 글만('select count(*) from job_posts_pub;') + '건');
