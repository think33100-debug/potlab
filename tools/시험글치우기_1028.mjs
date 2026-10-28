/* ㉡ 커뮤니티 **시험 글**을 치웁니다 (2026-10-28 세중님 승인)
 *
 *   node tools/시험글치우기_1028.mjs            무엇을 지울지만 (마른)
 *   node tools/시험글치우기_1028.mjs --진짜      지웁니다 (백업 먼저)
 *
 * ── 무엇 ─────────────────────────────────────────────────────
 * `posts."시험자료" = true` 인 글입니다. 뷰 `공개글` 이 회원에게 안 보여 주지만,
 * 오픈 전에 치우는 것이 깨끗합니다 (docs/오픈범위_1110.md).
 *
 * ── 지우기 전에 **원문을 남깁니다** ─────────────────────────
 *   ~/되돌림/시험글_<때>.sql  —  글·댓글·신고·사진·좋아요를 **넣는 글**(insert)로
 * ★ `/tmp` 가 아니라 `~/되돌림/` 입니다 (지침 8-19).
 * ★ 딸린 줄(댓글·신고·사진·좋아요)도 **함께** 지웁니다 — 남으면 고아가 됩니다.
 *   Storage 의 사진 **파일**은 SQL 로 못 지웁니다(`storage.protect_delete`) —
 *   `tools/clean_orphan_files.js` 가 10분마다 주인 없는 파일을 치웁니다.
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
  const 임시 = path.join(os.tmpdir(), '시험글_' + process.pid + '.sql');
  fs.writeFileSync(임시, sql, 'utf8');
  const r = spawnSync('psql', [...꼴, '-v', 'ON_ERROR_STOP=1', '-f', 임시],
    { encoding: 'utf8', maxBuffer: 1 << 26, env });
  fs.unlinkSync(임시);
  if (r.status) { console.error('✗ psql\n' + (r.stderr || '').slice(0, 900)); process.exit(1); }
  return (r.stdout || '').trimEnd();
}
const 글만 = (sql) => psql(sql, ['-X', '-A', '-t', '-q']);

const 전 = 글만(`select count(*)::text || ' / ' || (select count(*) from comments)::text
  || ' / ' || (select count(*) from reports)::text
  || ' / ' || (select count(*) from post_images)::text
  || ' / ' || (select count(*) from post_likes)::text from posts;`);
console.log('전 — 글 / 댓글 / 신고 / 사진 / 좋아요 = ' + 전);

console.log('\n── 지울 글 ──');
console.log(psql(`
  \\pset pager off
  select p.id, p.channel as 방, left(p.title, 44) as 제목, p.hidden as 감춤,
         p.created_at::date as 만든날,
         (select count(*) from comments c where c.post_id = p.id) as 댓글,
         (select count(*) from reports r where r.target_type = 'post' and r.target_id = p.id) as 신고,
         (select count(*) from post_images i where i.post_id = p.id) as 사진,
         (select count(*) from post_likes l where l.post_id = p.id) as 좋아요
    from posts p where p."시험자료" order by p.id;`));

if (!진짜) { console.log('\n[마른] 아무것도 안 지웠습니다 — --진짜 로 지웁니다'); process.exit(0); }

/* ── 백업 — 넣는 글로 ── */
const d = new Date(); const 두 = (n) => String(n).padStart(2, '0');
const 때 = String(d.getFullYear()) + 두(d.getMonth() + 1) + 두(d.getDate())
  + '_' + 두(d.getHours()) + 두(d.getMinutes()) + 두(d.getSeconds());
const 되돌림터 = path.join(os.homedir(), '되돌림');
fs.mkdirSync(되돌림터, { recursive: true });
const 되돌림 = path.join(되돌림터, '시험글_' + 때 + '.sql');

const 글백업 = 글만(`
  select coalesce(string_agg(
    'insert into posts(id, channel, author_id, title, body, hidden, hidden_at, hidden_by, '
    || 'created_at, "시험자료") values ('
    || p.id || ', ' || quote_literal(p.channel) || ', ' || quote_nullable(p.author_id::text) || '::uuid, '
    || quote_nullable(p.title) || ', ' || quote_nullable(p.body) || ', ' || p.hidden::text || ', '
    || quote_nullable(p.hidden_at::text) || '::timestamptz, '
    || quote_nullable(p.hidden_by::text) || '::uuid, '
    || quote_nullable(p.created_at::text) || '::timestamptz, true);', E'\\n'), '')
    from posts p where p."시험자료";`);
const 댓글백업 = 글만(`
  select coalesce(string_agg(
    'insert into comments(id, post_id, author_id, body, created_at) values ('
    || c.id || ', ' || c.post_id || ', ' || quote_nullable(c.author_id::text) || '::uuid, '
    || quote_nullable(c.body) || ', ' || quote_nullable(c.created_at::text) || '::timestamptz);', E'\\n'), '')
    from comments c where c.post_id in (select id from posts where "시험자료");`);
const 신고백업 = 글만(`
  select coalesce(string_agg(
    'insert into reports(id, target_type, target_id, reporter_id, reason, created_at, handled_at) values ('
    || r.id || ', ' || quote_literal(r.target_type) || ', ' || r.target_id || ', '
    || quote_nullable(r.reporter_id::text) || '::uuid, ' || quote_nullable(r.reason) || ', '
    || quote_nullable(r.created_at::text) || '::timestamptz, '
    || quote_nullable(r.handled_at::text) || '::timestamptz);', E'\\n'), '')
    from reports r
   where (r.target_type = 'post' and r.target_id in (select id from posts where "시험자료"))
      or (r.target_type = 'comment' and r.target_id in
            (select id from comments where post_id in (select id from posts where "시험자료")));`);
const 사진백업 = 글만(`
  select coalesce(string_agg(
    '/* post_images — 파일은 Storage 에 있습니다: ' || i.path || ' */', E'\\n'), '')
    from post_images i where i.post_id in (select id from posts where "시험자료");`);

fs.writeFileSync(되돌림, [
  '/* 되돌리기 — 커뮤니티 시험 글 (2026-10-28 ㉡ 세중님 승인)',
  ' * 글·댓글·신고를 **넣는 글**로 남겼습니다. 사진 파일은 Storage 라 경로만 적습니다.',
  ' * 되살릴 때는 번호(id)가 그대로 들어가므로 그 번호가 비어 있어야 합니다. */',
  'begin;',
  글백업, 댓글백업, 신고백업, 사진백업,
  'commit;',
].filter(Boolean).join('\n') + '\n', 'utf8');
console.log('\n○ 되돌릴 글 — ' + 되돌림 + ' ('
  + fs.readFileSync(되돌림, 'utf8').split('\n').length + '줄)');

/* ── 지우기 — 딸린 줄부터 ── */
console.log(psql(`
  \\pset pager off
  begin;
  delete from reports
   where (target_type = 'comment' and target_id in
            (select id from comments where post_id in (select id from posts where "시험자료")))
      or (target_type = 'post' and target_id in (select id from posts where "시험자료"));
  delete from post_likes where post_id in (select id from posts where "시험자료");
  delete from post_images where post_id in (select id from posts where "시험자료");
  delete from comments where post_id in (select id from posts where "시험자료");
  delete from posts where "시험자료";
  commit;
  select count(*) as 남은_시험글 from posts where "시험자료";`));

const 후 = 글만(`select count(*)::text || ' / ' || (select count(*) from comments)::text
  || ' / ' || (select count(*) from reports)::text
  || ' / ' || (select count(*) from post_images)::text
  || ' / ' || (select count(*) from post_likes)::text from posts;`);
console.log('후 — 글 / 댓글 / 신고 / 사진 / 좋아요 = ' + 후);
console.log('★ Storage 의 사진 파일은 tools/clean_orphan_files.js 가 10분마다 치웁니다');
