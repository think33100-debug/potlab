/* 커뮤니티 점검 — 신고 → 숨김이 **정말 되나** (2026-10-28 세중님 3번)
 *
 *   node tools/커뮤니티점검_1028.mjs            읽기만 (숫자·권한·수칙)
 *   node tools/커뮤니티점검_1028.mjs --진짜      시험 글로 **한 바퀴** 돌고 **지웁니다**
 *
 * ── 운영 DB 시험값 — 세중님이 **이번 한 번** 허락하셨습니다 ──
 * 지침 8-9 는 「시험 자료를 운영에 넣지 않는다」입니다. 2026-10-28 세중님 3번에서
 * 「운영 DB 시험값 규칙은 예외로 한 번 · 끝나면 지움」으로 정해 주셨습니다.
 * ★ 그래도 **회원에게는 안 보입니다** — `공개글` 뷰가
 *   `(NOT p."시험자료" OR "시험자료볼까"())` 로 거릅니다. 넣는 글은 `시험자료 = true` 입니다.
 * ★ 글쓴이는 **관리자 계정**입니다 (지침 8-9 — 남의 회원번호를 쓰지 않습니다).
 * ★ 끝나면 **그 자리에서** 지웁니다. 지운 뒤 줄 수를 전·후로 찍습니다.
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
  const 임시 = path.join(os.tmpdir(), '커뮤니티점검_' + process.pid + '.sql');
  fs.writeFileSync(임시, sql, 'utf8');
  const r = spawnSync('psql', [...꼴, '-v', 'ON_ERROR_STOP=1', '-f', 임시],
    { encoding: 'utf8', maxBuffer: 1 << 26, env });
  fs.unlinkSync(임시);
  if (r.status) { console.error('✗ psql\n' + (r.stderr || '').slice(0, 900)); process.exit(1); }
  return (r.stdout || '').trimEnd();
}
const 글만 = (sql) => psql(sql, ['-X', '-A', '-t', '-q']);

console.log('══ 지금 ══');
console.log(psql(`
  \\pset pager off
  select count(*) as 글, count(*) filter (where hidden) as 감춘글,
         count(*) filter (where "시험자료") as 시험글,
         (select count(*) from comments) as 댓글,
         (select count(*) from reports) as 신고,
         (select count(*) from reports where handled_at is null) as 신고_처리전,
         (select count(*) from post_images) as 글사진
    from posts;`));
console.log(psql(`
  \\pset pager off
  select channel as 방, count(*) as 글, count(*) filter (where hidden) as 감춘것
    from posts group by 1 order by 2 desc;`));

console.log('\n══ 방을 볼 수 있는 사람 (학생·치료사 권한) ══');
console.log(글만(`select p.prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = '방볼수있나';`));
console.log('\n── 글을 쓸 수 있는 사람 (posts 정책) ──');
console.log(psql(`
  \\pset pager off
  select policyname as 정책, cmd as 무엇, roles::text as 역할
    from pg_policies where tablename = 'posts' order by cmd, policyname;`));

console.log('\n══ 신고가 글을 감추나 ══');
console.log('`admin_신고처리(p_id, p_note)` 는 **reports 의 handled_at·handled_by·handled_note 만**');
console.log('고칩니다 — **글을 감추지 않습니다.** 감추는 것은 관리자가 `/admin/posts` 에서');
console.log('`posts.hidden` 을 직접 켜는 것입니다 (뷰 `공개글` 이 `not hidden` 으로 거릅니다).');
console.log('→ 즉 **신고 = 알림**이고, **숨김 = 사람의 판단**입니다. 자동으로 감추지 않습니다.');

if (!진짜) { console.log('\n[마른] 시험 글을 안 넣었습니다 — --진짜 로 한 바퀴 돕니다'); process.exit(0); }

/* ── 한 바퀴 — 넣기 → 신고 → 감추기 → 확인 → 지우기 ── */
const 관리자 = 글만(`select id::text from profiles where role = 'admin' order by created_at limit 1;`);
if (!관리자) { console.error('✗ 관리자 계정을 못 찾았습니다 (profiles.role = admin)'); process.exit(1); }
console.log('\n글쓴이 — 관리자 계정 (끝 4글자 …' + 관리자.slice(-4) + ')');

const 전 = 글만(`select count(*)::text || ' / ' || (select count(*) from reports)::text from posts;`);
console.log('전 — 글 / 신고 = ' + 전);

const 한바퀴 = psql(`
  \\pset pager off
  \\set ON_ERROR_STOP on
  /* ① 시험 글 — 시험자료 = true 라 회원에게 안 보입니다 */
  insert into posts(channel, author_id, title, body, "시험자료")
  values ('자유', '${관리자}'::uuid, '[시험] 신고→숨김 한 바퀴 2026-10-28',
          '이 글은 신고·숨김이 되는지 보려고 넣은 시험 글입니다. 바로 지웁니다.', true)
  returning id as 시험글번호;`);
console.log(한바퀴);
const 글번호 = (한바퀴.match(/\n\s*(\d+)/) || [])[1];
if (!글번호) { console.error('✗ 시험 글 번호를 못 읽었습니다'); process.exit(1); }

console.log(psql(`
  \\pset pager off
  /* ② 신고 한 줄 */
  insert into reports(target_type, target_id, reporter_id, reason)
  values ('post', ${글번호}, '${관리자}'::uuid, '[시험] 신고 한 바퀴') returning id as 신고번호;
  /* ③ 신고가 들어온 뒤 — 글이 아직 보이나 (감춰지지 않아야 맞습니다) */
  select ${글번호} as 글번호,
         (select hidden from posts where id = ${글번호}) as 감춰졌나,
         (select count(*) from reports where target_type='post' and target_id=${글번호}) as 신고수;
  /* ④ 관리자가 감춥니다 (화면이 하는 것과 같은 한 줄) */
  update posts set hidden = true, hidden_at = now(), hidden_by = '${관리자}'::uuid
   where id = ${글번호};
  select (select hidden from posts where id = ${글번호}) as 감춤_뒤,
         (select count(*) from posts p where p.id = ${글번호} and not p.hidden) as 공개글에_남았나;`));

/* ⑤ 지우기 — 그 자리에서 */
console.log(psql(`
  \\pset pager off
  delete from reports where target_type = 'post' and target_id = ${글번호};
  delete from posts where id = ${글번호} and "시험자료";
  select count(*) as 남은_시험글 from posts where "시험자료";`));
const 후 = 글만(`select count(*)::text || ' / ' || (select count(*) from reports)::text from posts;`);
console.log('후 — 글 / 신고 = ' + 후 + (전 === 후 ? '  (전과 같습니다 — 치웠습니다)' : '  ⚠ 전과 다릅니다'));
