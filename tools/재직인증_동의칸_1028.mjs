/* ㉨ `재직인증` 에 **동의 기록 칸 둘** (2026-10-28 세중님 승인)
 *
 *   node tools/재직인증_동의칸_1028.mjs            봅니다 (전문·지금 칸)
 *   node tools/재직인증_동의칸_1028.mjs --진짜      더합니다
 *
 * 동의한때   언제 동의했나 (timestamptz)
 * 동의문구   그때 보여 준 문구의 판 (text · 예 'verify-2026-11')
 *
 * ★ 칸을 **더하기만** 합니다 — 지우거나 고치지 않습니다. 표 권한·정책은 그대로입니다.
 * ★ 지금 네 줄은 **전부 시험자료**라 null 로 남습니다 (채울 것이 없습니다).
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
  const 임시 = path.join(os.tmpdir(), '동의칸_' + process.pid + '.sql');
  fs.writeFileSync(임시, sql, 'utf8');
  const r = spawnSync('psql', [...꼴, '-v', 'ON_ERROR_STOP=1', '-f', 임시],
    { encoding: 'utf8', maxBuffer: 1 << 26, env });
  fs.unlinkSync(임시);
  if (r.status) { console.error('✗ psql\n' + (r.stderr || '').slice(0, 900)); process.exit(1); }
  return (r.stdout || '').trimEnd();
}

export const 전문 = `alter table "재직인증"
  add column if not exists "동의한때" timestamptz,
  add column if not exists "동의문구" text;`;

console.log('── 올릴 글 ──\n' + 전문);
console.log('\n── 지금 칸 ──');
console.log(psql(`
  \\pset pager off
  select column_name as 칸, data_type as 꼴, is_nullable as 빌수있나
    from information_schema.columns
   where table_schema = 'public' and table_name = '재직인증'
   order by ordinal_position;`));
console.log('── 표 권한 (전) ──');
console.log(psql(`
  \\pset pager off
  select grantee as 역할, string_agg(privilege_type, ',' order by privilege_type) as 권한
    from information_schema.role_table_grants
   where table_schema = 'public' and table_name = '재직인증'
   group by 1 order by 1;`));
console.log('── 줄 수 ──');
console.log(psql(`
  \\pset pager off
  select count(*) as 전체, count(*) filter (where "시험자료") as 시험자료 from "재직인증";`));

if (!진짜) { console.log('\n[마른] 아무것도 안 바꿨습니다 — --진짜 로 더합니다'); process.exit(0); }

const d = new Date(); const 두 = (n) => String(n).padStart(2, '0');
const 때 = String(d.getFullYear()) + 두(d.getMonth() + 1) + 두(d.getDate())
  + '_' + 두(d.getHours()) + 두(d.getMinutes()) + 두(d.getSeconds());
const 되돌림터 = path.join(os.homedir(), '되돌림');
fs.mkdirSync(되돌림터, { recursive: true });
const 되돌림 = path.join(되돌림터, '재직인증_동의칸_되돌리기_' + 때 + '.sql');
fs.writeFileSync(되돌림, [
  '/* 되돌리기 — 재직인증 의 동의 기록 칸 둘을 내립니다 (2026-10-28 ㉨)',
  ' * ★ 내리면 **그동안 쌓인 동의 기록이 사라집니다.** 세중님 지시가 있을 때만 돌립니다 */',
  'alter table "재직인증" drop column if exists "동의한때";',
  'alter table "재직인증" drop column if exists "동의문구";',
].join('\n') + '\n', 'utf8');
console.log('\n○ 되돌릴 글 — ' + 되돌림);

console.log(psql(전문));
console.log('\n── 더한 뒤 ──');
console.log(psql(`
  \\pset pager off
  select column_name as 칸, data_type as 꼴
    from information_schema.columns
   where table_schema = 'public' and table_name = '재직인증'
     and column_name in ('동의한때', '동의문구') order by column_name;`));
console.log('── 표 권한 (후) ──');
console.log(psql(`
  \\pset pager off
  select grantee as 역할, string_agg(privilege_type, ',' order by privilege_type) as 권한
    from information_schema.role_table_grants
   where table_schema = 'public' and table_name = '재직인증'
   group by 1 order by 1;`));
