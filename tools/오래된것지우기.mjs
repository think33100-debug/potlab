/* ㉥ **보관 기간이 지난 것**을 지웁니다 (2026-10-25 세중님 2번 승인)
 *
 *   node tools/오래된것지우기.mjs            마른 — **지울 줄 수만** 셉니다
 *   node tools/오래된것지우기.mjs --진짜      지웁니다 (지운 줄을 되돌림으로 남깁니다)
 *
 * ── 왜 ───────────────────────────────────────────────────────
 * 개인정보 처리 동의서에 **보관 기간**을 적어 두었는데 지우는 자리가 없었습니다
 * (docs/약관점검_1025.md 4절). 적어 둔 것은 지켜야 합니다.
 *
 *   채팅        쓴 지 **1년**        chat_messages.created_at
 *   신고 기록    처리 끝 + **1년**    공고신고.handled_at  ★ **처리 중(handled_at null)은 뺍니다**
 *   눌러본 기록  **3개월**           page_hits.created_at · seen_postings.opened_at
 *
 * ── 울타리 ───────────────────────────────────────────────────
 *   ★ 지우기 전에 **지울 줄을 그대로 떠서** `~/되돌림/` 에 `insert` 글로 남깁니다
 *     (지운 뒤에는 그 파일이 유일한 되돌림입니다 · 지침 8-19)
 *   ★ 한 바퀴에 **표마다 5,000줄**까지만 지웁니다 (실수로 통째로 비우지 않게)
 *   ★ 지운 기록을 `site_settings['오래된것지우기']` 와 `~/log/오래된것지우기.log` 에 남깁니다
 *     (언제 · 몇 줄 · 어느 표)
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const 뿌리 = path.join(import.meta.dirname, '..');
const 진짜 = process.argv.includes('--진짜');
const 뚜껑 = 5000;

/** 지울 것 — 한 자리에 모읍니다 (글과 코드가 어긋나지 않게) */
export const 지울것들 = [
  { 이름: '채팅 1년', 표: 'chat_messages', 어디: `created_at < now() - interval '1 year'`,
    글: '처리방침 「채팅에 남긴 말 → 쓴 지 1년」' },
  { 이름: '신고 처리끝+1년', 표: '공고신고',
    어디: `handled_at is not null and handled_at < now() - interval '1 year'`,
    글: '처리방침 「신고 기록 → 처리가 끝나고 1년」 · **처리 중인 건은 안 지웁니다**' },
  { 이름: '눌러본 기록 3개월', 표: 'page_hits', 어디: `created_at < now() - interval '3 months'`,
    글: '처리방침 「공고를 눌러본 기록 → 3개월」' },
  { 이름: '본 공고 3개월', 표: 'seen_postings', 어디: `opened_at < now() - interval '3 months'`,
    글: '처리방침 「공고를 눌러본 기록 → 3개월」 (수집기 쪽 기록)' },
];

if (process.argv.includes('--자기점검')) {
  const 잼 = [];
  const 보 = (무엇, 참) => 잼.push([무엇, !!참]);
  보('표가 넷', 지울것들.length === 4);
  보('신고는 처리 중을 뺀다', /handled_at is not null/.test(지울것들[1].어디));
  보('채팅은 1년', /1 year/.test(지울것들[0].어디));
  보('눌러본 기록은 3개월', 지울것들.filter((x) => /3 months/.test(x.어디)).length === 2);
  보('모든 줄에 까닭(글)이 있다', 지울것들.every((x) => x.글 && x.글.includes('처리방침')));
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
function psql(sql, 꼴 = ['-X', '-A', '-t', '-q', '-F', '\t']) {
  const 임시 = path.join(os.tmpdir(), '오래된것_' + process.pid + '.sql');
  fs.writeFileSync(임시, sql, 'utf8');
  const r = spawnSync('psql', [...꼴, '-v', 'ON_ERROR_STOP=1', '-f', 임시],
    { encoding: 'utf8', maxBuffer: 1 << 26, env });
  fs.unlinkSync(임시);
  if (r.status) { console.error('✗ psql\n' + (r.stderr || '').slice(0, 800)); process.exit(1); }
  return (r.stdout || '').trimEnd();
}

const d = new Date(); const 두 = (n) => String(n).padStart(2, '0');
const 때 = String(d.getFullYear()) + 두(d.getMonth() + 1) + 두(d.getDate()) + '_'
  + 두(d.getHours()) + 두(d.getMinutes()) + 두(d.getSeconds());
const 이제 = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 16).replace('T', ' ');

console.log('보관 기간 지난 것 — ' + (진짜 ? '**지웁니다**' : '마른(셈만)') + ' · ' + 이제);
const 셈 = [];
for (const x of 지울것들) {
  const n = Number(psql(`select count(*) from "${x.표}" where ${x.어디};`).trim() || 0);
  const 전체 = Number(psql(`select count(*) from "${x.표}";`).trim() || 0);
  셈.push({ ...x, 지울줄: n, 전체 });
  console.log('  ' + x.이름.padEnd(18) + x.표.padEnd(16) + '지울 줄 ' + String(n).padStart(6)
    + ' / 전체 ' + String(전체).padStart(7) + (n > 뚜껑 ? '  ★ 뚜껑 ' + 뚜껑 + '까지만' : ''));
}
const 모두 = 셈.reduce((a, b) => a + b.지울줄, 0);
console.log('  — 모두 ' + 모두 + '줄');

if (!진짜) { console.log('\n[마른] 아무것도 안 지웠습니다 — --진짜 로 지웁니다'); process.exit(0); }
if (!모두) {
  /* 지울 것이 없어도 **돌았다는 기록**은 남깁니다 (크론이 도는지 보려고) */
  psql(`insert into site_settings (key, value)
        values ('오래된것지우기', jsonb_build_object('돈때','${이제}','지운줄',0,'표별','{}'::jsonb))
        on conflict (key) do update set value = excluded.value, updated_at = now();`);
  console.log('\n지울 것이 없습니다 — 돌았다는 기록만 남겼습니다');
  process.exit(0);
}

const 되돌림터 = path.join(os.homedir(), '되돌림');
fs.mkdirSync(되돌림터, { recursive: true });
const 되돌림 = path.join(되돌림터, '오래된것지우기_되돌리기_' + 때 + '.sql');
const 줄 = ['/* 되돌리기 — ' + 이제 + ' 에 지운 줄을 **그대로** 되살립니다 (보관 기간 지난 것) */'];
const 결과 = {};
for (const x of 셈) {
  if (!x.지울줄) continue;
  /* ① 지울 줄을 insert 글로 떠 둡니다 (지운 뒤에는 이것이 유일한 되돌림입니다) */
  const 뜬것 = psql(`
    select 'insert into "${x.표}" select * from jsonb_populate_record(null::"${x.표}", '
        || quote_literal(to_jsonb(t)::text) || '::jsonb) on conflict do nothing;'
      from (select * from "${x.표}" where ${x.어디} limit ${뚜껑}) t;`);
  줄.push('-- ' + x.이름 + ' (' + x.표 + ')', 뜬것);
  /* ② 지웁니다 — 같은 조건·같은 뚜껑 */
  const 지움 = psql(`
    with 집을것 as (select ctid from "${x.표}" where ${x.어디} limit ${뚜껑})
    delete from "${x.표}" t using 집을것 c where t.ctid = c.ctid returning 1;`)
    .split('\n').filter(Boolean).length;
  결과[x.표] = 지움;
  console.log('  ○ ' + x.이름.padEnd(18) + '지웠습니다 ' + 지움 + '줄');
}
fs.writeFileSync(되돌림, 줄.join('\n') + '\n', 'utf8');
const 지운합 = Object.values(결과).reduce((a, b) => a + b, 0);
psql(`insert into site_settings (key, value)
      values ('오래된것지우기', jsonb_build_object('돈때','${이제}','지운줄',${지운합},
                 '표별','${JSON.stringify(결과).replace(/'/g, "''")}'::jsonb,
                 '되돌림','${되돌림.replace(/'/g, "''")}'))
      on conflict (key) do update set value = excluded.value, updated_at = now();`);
const 로그 = path.join(os.homedir(), 'log', '오래된것지우기.log');
fs.mkdirSync(path.dirname(로그), { recursive: true });
fs.appendFileSync(로그, '[' + 이제 + '] 지운 줄 ' + 지운합 + ' — '
  + Object.entries(결과).map(([k, v]) => k + ' ' + v).join(' · ') + ' · 되돌림 ' + 되돌림 + '\n');
console.log('\n○ 모두 ' + 지운합 + '줄 지웠습니다 · 되돌림 ' + 되돌림);
console.log('  기록 — site_settings[오래된것지우기] · ' + 로그);
