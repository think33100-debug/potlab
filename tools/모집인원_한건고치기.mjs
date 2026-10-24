/* 공고 **한 건의 모집인원(headcount)** 을 세중님 승인으로 고칩니다 (2026-10-24)
 *
 *   node tools/모집인원_한건고치기.mjs --아이디 WNK… --새값 1            봅니다
 *   node tools/모집인원_한건고치기.mjs --아이디 WNK… --새값 1 --진짜      고칩니다
 *       [--근거 "원문 줄"]  [--누가 "관리자 수정 대행"]
 *
 * ── 왜 도구로 ───────────────────────────────────────────────
 * `칸되메우기` 창구는 `headcount` 를 **null 일 때만** 채웁니다 — 틀린 숫자는
 * 못 덮습니다. 통합 공고에서 **다른 직군 인원**을 집은 건이 그 꼴입니다
 * (WNK161232610080006 하온어린이집 2명 → 원문은 「1. 물리치료사 (1명 모집)」).
 *
 * ── 이 도구가 지키는 것 ─────────────────────────────────────
 *   ① **전후 원문**을 찍습니다 (고치기 전·후 모두)
 *   ② `칸기록` 에 손으로 남깁니다 — 누가 · 왜(근거 원문) · 옛값 · 새값
 *      (트리거는 `detail` 쪽만 보고 `headcount` 는 따로 보는 자리가 있어
 *       **직접 적어** 둡니다 — 되돌릴 근거가 남아야 합니다)
 *   ③ `admin_locked = true` — 규칙·수집기가 다시 덮지 못하게 (세중님 승인 건)
 *   ④ 되돌림 글을 `~/되돌림/` 에 남깁니다 (지침 8-19)
 *   ⑤ `updated_at` 은 안 건드립니다 (지침 9절)
 *
 * ★ 승인 없이 쓰지 않습니다 — 회원 화면 값을 손으로 고치는 자리입니다 (0-0).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const argv = process.argv.slice(2);
const 값 = (이름, 기본 = null) => {
  const i = argv.indexOf(이름);
  return i > -1 && argv[i + 1] != null ? argv[i + 1] : 기본;
};
const 아이디 = 값('--아이디');
const 새값 = 값('--새값');
const 근거 = 값('--근거', '');
const 누가 = 값('--누가', '관리자 수정 대행');
const 진짜 = argv.includes('--진짜');
if (!아이디 || 새값 == null || !/^\d+$/.test(String(새값))) {
  console.error('쓰는 법 — node tools/모집인원_한건고치기.mjs --아이디 <공고> --새값 <숫자> [--근거 "원문"] [--진짜]');
  process.exit(2);
}

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
function psql(sql, 꼴 = ['-X', '-A', '-q', '-F', '  ']) {
  const 임시 = path.join(os.tmpdir(), '인원한건_' + process.pid + '.sql');
  fs.writeFileSync(임시, sql, 'utf8');
  const r = spawnSync('psql', [...꼴, '-v', 'ON_ERROR_STOP=1', '-f', 임시],
    { encoding: 'utf8', maxBuffer: 1 << 26, env });
  fs.unlinkSync(임시);
  if (r.status) { console.error('✗ psql\n' + (r.stderr || '').slice(0, 900)); process.exit(1); }
  return (r.stdout || '').trimEnd();
}
/* ★ 2026-10-24 — **값 하나를 읽을 때는 `-t`(줄만)** 를 씁니다. 안 쓰면 꼬리의
   「(1 row)」 가 값으로 들어옵니다 — 첫 판에서 칸기록 옛값과 되돌림 글에
   「(1 row)」 가 적혔습니다 (그 자리에서 바로잡았습니다) */
const 한값 = (sql) => psql(sql, ['-X', '-A', '-t', '-q']).trim();
const 따옴 = (s) => String(s == null ? '' : s).replace(/'/g, "''");
const 보기 = `
  select p.id, p.source, p.org_name, left(p.title, 44) as 제목,
         coalesce(p.headcount::text, '(빈칸)') as headcount,
         coalesce(p."뽑은값"->>'모집인원', '(없음)') as 뽑은값_모집인원,
         coalesce(p.detail->>'직군인원', '(없음)') as detail_직군인원,
         p.admin_locked::text as 잠금,
         (select count(*) from job_posts_pub v where v.id = p.id)::text as 회원화면
    from job_posts p where p.id = '${따옴(아이디)}';`;

console.log('── 고치기 전 원문 ──\n' + psql(보기));
const 지금 = 한값(`select coalesce(headcount::text,'') from job_posts where id = '${따옴(아이디)}';`);
if (!지금 && 지금 !== '0') { console.error('✗ 그 공고가 없거나 headcount 가 빈칸입니다'); process.exit(1); }
console.log('\n고칠 것 — headcount ' + 지금 + ' → **' + 새값 + '** · admin_locked → true');
console.log('근거 — ' + (근거 || '(안 적었습니다)'));

if (!진짜) { console.log('\n[마른] 아무것도 안 고쳤습니다 — --진짜 로 고칩니다'); process.exit(0); }

const 되돌림터 = path.join(os.homedir(), '되돌림');
fs.mkdirSync(되돌림터, { recursive: true });
const d = new Date();
const 두 = (n) => String(n).padStart(2, '0');
const 때 = String(d.getFullYear()) + 두(d.getMonth() + 1) + 두(d.getDate())
  + '_' + 두(d.getHours()) + 두(d.getMinutes()) + 두(d.getSeconds());
const 되돌림 = path.join(되돌림터, '모집인원_' + 아이디 + '_되돌리기_' + 때 + '.sql');
fs.writeFileSync(되돌림,
  '/* 되돌리기 — ' + 아이디 + ' 의 모집인원을 ' + 지금 + ' 으로, 잠금을 풀기 */\n'
  + "update job_posts set headcount = " + 지금 + ", admin_locked = false\n"
  + " where id = '" + 따옴(아이디) + "';\n", 'utf8');
console.log('\n○ 되돌릴 글 — ' + 되돌림);

/* 칸기록을 **먼저** 남깁니다 — 고친 뒤에 적으려다 실패하면 근거가 없습니다 */
psql(`insert into "칸기록"(job_id, "칸", "옛값", "새값", "누가", "왜")
      values ('${따옴(아이디)}', '모집인원', '${따옴(지금)}', '${따옴(새값)}',
              '${따옴(누가)}', '${따옴(근거)}');`);
console.log('○ 칸기록을 남겼습니다 (누가 「' + 누가 + '」)');

psql(`update job_posts set headcount = ${Number(새값)}, admin_locked = true
       where id = '${따옴(아이디)}';`);
console.log('○ 고쳤습니다');

console.log('\n── 고친 뒤 원문 ──\n' + psql(보기));
console.log('\n── 칸기록 ──\n' + psql(`
  select "칸", coalesce("옛값",'') as 옛값, coalesce("새값",'') as 새값, "누가",
         left(coalesce("왜",''), 60) as 왜, 바뀐때::text
    from "칸기록" where job_id = '${따옴(아이디)}' order by 바뀐때 desc limit 3;`));
