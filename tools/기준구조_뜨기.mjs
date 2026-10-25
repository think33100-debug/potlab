/* 운영 DB **구조만** 떠서 비밀 글자를 검사합니다 (2026-10-25 세중님 1번 승인)
 *
 *   node tools/기준구조_뜨기.mjs            ⓐ 떠서 ⓑ 검사만 (파일은 tmp/ 에)
 *   node tools/기준구조_뜨기.mjs --저장소    깨끗하면 sql/기준구조_1025.sql 자리로 복사
 *
 * ── 울타리 ───────────────────────────────────────────────────
 *   ★ 운영 DB 는 **읽기만** 합니다 — `pg_dump --schema-only` 한 번입니다
 *   ★ 자료는 **한 줄도** 안 뜹니다 (`--schema-only` · `--no-owner` · `--no-privileges` 는 **안 씁니다**
 *     — 권한(ACL)·RLS 정책이 설계도에 있어야 개발용에서 같은 울타리가 섭니다)
 *   ★ ⓑ **비밀 글자 검사** — 열쇠 꼴(JWT)·service_role·주소 속 토큰·이메일이 덤프에 있나.
 *     **값은 안 찍습니다** (지침 8-11) — 몇째 줄에 무슨 갈래가 걸렸는지만 냅니다
 *   ★ 걸린 줄이 있으면 **저장소에 안 넣습니다** (`--저장소` 를 줘도 멈춥니다)
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const 뿌리 = path.join(import.meta.dirname, '..');
const argv = process.argv.slice(2);
const 저장소에 = argv.includes('--저장소');

/* ── 비밀 글자 자 — 한 자리 ── */
export const 비밀자 = [
  ['JWT 열쇠 꼴', /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/],
  ['service_role 글자', /service_role_key|SUPABASE_SERVICE|sb_secret|sbp_[A-Za-z0-9]{20,}/i],
  ['주소 속 열쇠', /[?&](?:serviceKey|apikey|api_key|key|token|secret)=[A-Za-z0-9%+_-]{12,}/i],
  ['이메일', /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/],
  ['비밀번호 글자', /password\s*[:=]\s*'[^']{4,}'/i],
  ['DB 접속 주소', /postgres(?:ql)?:\/\/[^\s'"]+/i],
];
/* 걸려도 되는 것 — 함수 주석·예시에 든 **우리 쪽 공개 글자** */
export const 봐주는꼴 = [
  /noreply@anthropic\.com/i,
  /@potjob\.(?:co\.kr|kr)/i,              /* 우리 도메인 메일 (시험 계정 주소 등) */
  /example\.(?:com|org)/i,
];

if (argv.includes('--자기점검')) {
  const 잼 = [];
  const 보 = (무엇, 참) => 잼.push([무엇, !!참]);
  const 찾 = (줄) => 비밀자.filter(([, re]) => re.test(줄)).map(([n]) => n);
  보('JWT 꼴을 잡는다', 찾('안녕 eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIx').includes('JWT 열쇠 꼴'));
  보('주소 속 열쇠를 잡는다', 찾("select 'https://a.or.kr/x?serviceKey=abcdefghijklmnop'").includes('주소 속 열쇠'));
  보('이메일을 잡는다', 찾("comment on table t is '문의 hong@naver.com'").includes('이메일'));
  보('DB 주소를 잡는다', 찾("-- postgresql://postgres:pw@db.x.supabase.co:5432/postgres").includes('DB 접속 주소'));
  보('멀쩡한 줄은 안 잡는다', 찾('create table 기관 (기관번호 text primary key);').length === 0);
  보('우리 도메인 메일은 봐준다', 봐주는꼴.some((re) => re.test('test-pt@potjob.co.kr')));
  const 어긴것 = 잼.filter(([, ok]) => !ok);
  for (const [무엇, ok] of 잼) console.log((ok ? '  ○ ' : '  ✗ ') + 무엇);
  if (어긴것.length) { console.error('✗ 자기점검 ' + 어긴것.length + '가지 실패'); process.exit(1); }
  console.log('○ 자기점검 통과 — ' + 잼.length + '가지');
  process.exit(0);
}

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

/* ── ⓐ 구조만 뜨기 (운영은 읽기만) ── */
const 임시자리 = path.join(뿌리, 'tmp');
fs.mkdirSync(임시자리, { recursive: true });
const 덤프자리 = path.join(임시자리, '기준구조_1025.sql');
console.log('ⓐ pg_dump --schema-only (자료 0건 · 운영은 읽기만)');
const r = spawnSync('pg_dump', ['--schema-only', '--no-comments=false' /* 주석도 설계도입니다 */,
  '--schema=public', '--file=' + 덤프자리], { encoding: 'utf8', env, maxBuffer: 1 << 28 });
if (r.status) {
  /* --no-comments=false 를 모르는 판이 있습니다 — 그러면 그 깃발 없이 다시 */
  const r2 = spawnSync('pg_dump', ['--schema-only', '--schema=public', '--file=' + 덤프자리],
    { encoding: 'utf8', env, maxBuffer: 1 << 28 });
  if (r2.status) { console.error('✗ pg_dump\n' + (r2.stderr || r.stderr || '').slice(0, 600)); process.exit(1); }
}
const 글 = fs.readFileSync(덤프자리, 'utf8');
const 줄들 = 글.split('\n');
console.log('  떴습니다 — ' + 줄들.length.toLocaleString() + '줄 · '
  + (Buffer.byteLength(글) / 1024).toFixed(0) + 'KB · ' + 덤프자리);
const 셈 = (re) => (글.match(re) || []).length;
console.log('  안에 든 것 — create table ' + 셈(/^CREATE TABLE /gm)
  + ' · view ' + 셈(/^CREATE VIEW /gm)
  + ' · function ' + 셈(/^CREATE FUNCTION |^CREATE OR REPLACE FUNCTION /gm)
  + ' · policy ' + 셈(/^CREATE POLICY /gm)
  + ' · trigger ' + 셈(/^CREATE TRIGGER /gm)
  + ' · grant ' + 셈(/^GRANT /gm)
  + ' · insert(자료) ' + 셈(/^INSERT INTO /gm));

/* ── ⓑ 비밀 글자 검사 (값은 안 찍습니다) ── */
console.log('\nⓑ 비밀 글자 검사 — **값은 안 찍습니다** (줄 번호와 갈래만)');
const 걸린것 = [];
줄들.forEach((줄, i) => {
  if (봐주는꼴.some((re) => re.test(줄))) return;
  for (const [이름, re] of 비밀자) {
    if (re.test(줄)) 걸린것.push({ 줄번호: i + 1, 갈래: 이름, 길이: 줄.length,
      어디: (줄.match(/^\s*(?:CREATE|COMMENT|ALTER|GRANT|--)[^(]{0,40}/) || [''])[0].trim().slice(0, 48) });
  }
});
const 갈래셈 = {};
for (const x of 걸린것) 갈래셈[x.갈래] = (갈래셈[x.갈래] || 0) + 1;
if (!걸린것.length) console.log('  ○ 걸린 줄 **0** — 깨끗합니다');
else {
  console.log('  ✗ 걸린 줄 **' + 걸린것.length + '** — ' + Object.entries(갈래셈).map(([k, v]) => k + ' ' + v).join(' · '));
  for (const x of 걸린것.slice(0, 40)) {
    console.log('     ' + String(x.줄번호).padStart(6) + '줄  [' + x.갈래 + ']  ' + x.어디);
  }
  if (걸린것.length > 40) console.log('     … ' + (걸린것.length - 40) + '줄 더');
}
fs.writeFileSync(path.join(임시자리, '기준구조_검사_1025.json'),
  JSON.stringify({ 잰때: new Date().toISOString().slice(0, 16).replace('T', ' '),
    줄수: 줄들.length, 갈래셈, 걸린것 }, null, 1) + '\n', 'utf8');
console.log('  검사 결과 — tmp/기준구조_검사_1025.json (값 없이 줄번호·갈래만)');

/* ── ⓒ 깨끗하면 저장소 자리로 ── */
if (!저장소에) { console.log('\n[여기까지] 저장소에 안 넣었습니다 — --저장소 로 넣습니다'); process.exit(0); }
if (걸린것.length) {
  console.error('\n✗ 걸린 줄이 있어 **저장소에 안 넣습니다** (세중님 1번 ⓑ 조건)');
  process.exit(1);
}
const 저장자리 = path.join(뿌리, 'sql', '기준구조_1025.sql');
fs.mkdirSync(path.dirname(저장자리), { recursive: true });
fs.copyFileSync(덤프자리, 저장자리);
console.log('\n○ sql/기준구조_1025.sql 에 넣었습니다 — 커밋은 손으로 (운영 재건 설계도 겸용)');
