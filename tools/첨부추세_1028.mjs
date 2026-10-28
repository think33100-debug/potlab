/* 안 읽은 첨부가 **언제 다 읽히나** — 추세 (2026-10-28 · 작업큐 2번)
 *
 *   node tools/첨부추세_1028.mjs
 *
 * ── 왜 다시 세나 ─────────────────────────────────────────────
 * 10/25 에 「837줄 · 10/29 에 끝남」이라고 셌는데, 10/26 에 보니 **796 → 852 로
 * 늘었습니다.** 새 첨부가 들어오는 속도를 빼지 않고 센 것입니다 — 「하루 몇 줄
 * 읽나」만 보고 **「하루 몇 줄 들어오나」**를 안 봤습니다 (지침 10-5 · 재는 자).
 *
 * ── 세는 법 ─────────────────────────────────────────────────
 *   읽은 수   `job_attachments.parsed_at` 이 그날인 줄 (= 그날 읽은 것)
 *   새 줄     `만든때` 가 그날인 줄 (= 그날 들어온 것)
 *   남은 것   `parsed_at is null` 인 줄
 *   순감소    (하루 읽은 수) − (하루 새 줄) · 7일 중간값으로 봅니다
 * ★ 순감소가 0 이하면 **영영 안 끝납니다** — 그러면 차례를 바꾸는 안을 올립니다
 *   (회원 화면 공고 첨부부터 먼저).
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
  const 임시 = path.join(os.tmpdir(), '첨부추세_' + process.pid + '.sql');
  fs.writeFileSync(임시, sql, 'utf8');
  const r = spawnSync('psql', [...꼴, '-v', 'ON_ERROR_STOP=1', '-f', 임시],
    { encoding: 'utf8', maxBuffer: 1 << 26, env });
  fs.unlinkSync(임시);
  if (r.status) { console.error('✗ psql\n' + (r.stderr || '').slice(0, 900)); process.exit(1); }
  return (r.stdout || '').trimEnd();
}
const 글만 = (sql) => psql(sql, ['-X', '-A', '-t', '-q']);

console.log('══ 첨부 — 지금 ══');
console.log(psql(`
  \\pset pager off
  select count(*) as 전체,
         count(*) filter (where parsed_at is not null) as 읽음,
         count(*) filter (where parsed_at is null and "읽기탈" is not null) as 읽어봤는데_안됨,
         count(*) filter (where parsed_at is null and "읽기탈" is null) as 아직_안봄
    from job_attachments;`));

console.log('\n══ 날마다 — 읽은 수 ↔ 새로 들어온 수 (한국 시간) ══');
console.log(psql(`
  \\pset pager off
  with d as (
    select (now() at time zone 'Asia/Seoul')::date - g as 날 from generate_series(0, 7) g
  )
  select d.날,
         (select count(*) from job_attachments a
           where (a.parsed_at at time zone 'Asia/Seoul')::date = d.날) as 읽음,
         (select count(*) from job_attachments a
           where (a."만든때" at time zone 'Asia/Seoul')::date = d.날) as 새로들어옴,
         (select count(*) from job_attachments a
           where (a.parsed_at at time zone 'Asia/Seoul')::date = d.날)
       - (select count(*) from job_attachments a
           where (a."만든때" at time zone 'Asia/Seoul')::date = d.날) as 순감소
    from d order by d.날 desc;`));

/* 중간값으로 셈 — 하루치가 들쭉날쭉합니다 (크론이 못 돈 날이 섞입니다) */
const 남은것 = Number(글만(`select count(*) from job_attachments where parsed_at is null and "읽기탈" is null;`));
const 순감소 = Number(글만(`
  with d as (
    select (now() at time zone 'Asia/Seoul')::date - g as 날 from generate_series(1, 7) g
  ), x as (
    select (select count(*) from job_attachments a
             where (a.parsed_at at time zone 'Asia/Seoul')::date = d.날)
         - (select count(*) from job_attachments a
             where (a."만든때" at time zone 'Asia/Seoul')::date = d.날) as v
      from d
  )
  select coalesce(percentile_cont(0.5) within group (order by v), 0)::int from x;`));

console.log('\n══ 다 읽히는 날 ══');
console.log('아직 안 본 것 ' + 남은것 + '줄 · 하루 순감소(이레 중간값) ' + 순감소 + '줄');
if (순감소 <= 0) {
  console.log('✗ **순감소가 0 이하입니다 — 지금 설정으로는 안 끝납니다.**');
  console.log('  → 차례를 바꾸는 안(회원 화면 공고 첨부 먼저)을 승인대기에 올립니다');
} else {
  const 날수 = Math.ceil(남은것 / 순감소);
  const 끝날 = new Date(Date.now() + 날수 * 86400000 + 9 * 3600000);
  console.log('→ ' + 날수 + '일 뒤 = ' + 끝날.toISOString().slice(0, 10) + ' 무렵에 끝납니다'
    + (끝날 < new Date('2026-11-10T00:00:00Z') ? '  (11/10 오픈 전입니다)' : '  ⚠ **11/10 오픈 뒤입니다**'));
}

console.log('\n══ 회원 화면 공고의 첨부는 몇 줄이 안 읽혔나 (차례를 바꿀 근거) ══');
console.log(psql(`
  \\pset pager off
  select count(*) as 회원화면_첨부,
         count(*) filter (where a.parsed_at is not null) as 읽음,
         count(*) filter (where a.parsed_at is null and a."읽기탈" is null) as 아직_안봄
    from job_attachments a join job_posts_pub v on v.id = a.job_id;`));
console.log('\n★ 아무것도 바꾸지 않았습니다 (읽기만).');
