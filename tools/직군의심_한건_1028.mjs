/* ③ 직군 의심 — 지금 걸린 것을 한 건씩 펼칩니다 (2026-10-28 세중님 2번)
 *
 *   node tools/직군의심_한건_1028.mjs
 *
 * 읽기만 합니다. 판정은 DB 의 `직군의심()` **한 자리**이고, 여기서는 그것이 낸
 * 공고를 받아 **원문 창 200자**와 **세중님이 누를 주소**를 붙입니다.
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
  const 임시 = path.join(os.tmpdir(), '직군의심_' + process.pid + '.sql');
  fs.writeFileSync(임시, sql, 'utf8');
  const r = spawnSync('psql', [...꼴, '-v', 'ON_ERROR_STOP=1', '-f', 임시],
    { encoding: 'utf8', maxBuffer: 1 << 26, env });
  fs.unlinkSync(임시);
  if (r.status) { console.error('✗ psql\n' + (r.stderr || '').slice(0, 1200)); process.exit(1); }
  return (r.stdout || '').trimEnd();
}
const 글만 = (sql) => psql(sql, ['-X', '-A', '-t', '-q', '-F', '\t']);
const 머리 = '\\pset pager off\n';

const 낸값 = 글만(`select "직군의심"()::text;`);
let 의심;
try { 의심 = JSON.parse(낸값); } catch { console.error('✗ 직군의심() 을 못 읽었습니다'); process.exit(1); }
console.log('══ 직군의심() 이 낸 값 ══');
for (const [k, v] of Object.entries(의심)) {
  if (Array.isArray(v)) console.log('  ' + k + ' — ' + v.length + '건');
  else console.log('  ' + k + ' — ' + JSON.stringify(v).slice(0, 120));
}

/* 목록이 담긴 열쇠를 찾습니다 (이름을 짐작하지 않고 **배열인 것**을 씁니다) */
const 목록열쇠 = Object.keys(의심).filter((k) => Array.isArray(의심[k]) && 의심[k].length);
if (!목록열쇠.length) { console.log('\n걸린 공고가 없습니다 (목록이 빈 배열입니다)'); process.exit(0); }

for (const 열쇠 of 목록열쇠) {
  console.log('\n══ ' + 열쇠 + ' — ' + 의심[열쇠].length + '건 ══');
  for (const x of 의심[열쇠]) {
    const id = typeof x === 'string' ? x
      : (x.id || x['공고id'] || x['공고'] || x['번호']
         || (String(x['주소'] || '').match(/wantedAuthNo=([A-Za-z0-9]+)/) ? 'WN' + String(x['주소']).match(/wantedAuthNo=([A-Za-z0-9]+)/)[1] : null));
    if (!id) console.log('   (열쇠 전문) ' + JSON.stringify(x));
    if (!id) { console.log('  (공고 번호를 못 찾았습니다) ' + JSON.stringify(x).slice(0, 160)); continue; }
    console.log('\n── ' + id + ' ──');
    if (typeof x === 'object') {
      for (const [k, v] of Object.entries(x)) {
        if (k === 'id') continue;
        console.log('   ' + k + ' — ' + String(v === null ? '(없음)' : v).slice(0, 110));
      }
    }
    console.log(psql(머리 + `
      select p.id, p.source, p.org_name, coalesce(p.job_group,'(빈칸)') as 직군,
             coalesce(p.employ_type,'(빈칸)') as 고용형태, p.apply_to as 마감,
             exists (select 1 from job_posts_pub v where v.id = p.id) as "회원 화면"
        from job_posts p where p.id = '${id}';`));
    console.log('   원문 제목 — ' + 글만(`select coalesce(p.title,'(없음)') from job_posts p where p.id = '${id}';`));
    console.log('   보여줄 제목 — ' + 글만(`select coalesce(p."보여줄제목",'(없음)') from job_posts p where p.id = '${id}';`));
    console.log('   원문 주소 — ' + 글만(`select coalesce(p.url,'(없음)') from job_posts p where p.id = '${id}';`));
    /* 원문 창 200자 — **우리가 쓴 글은 빼고** 봅니다 (제목 + 본문 + detail.걸린줄) */
    console.log('   ── 원문 창 200자 (우리 직군 말이 있나) ──');
    console.log(psql(머리 + `
      with 글 as (
        select coalesce(p.title,'') || ' '
            || coalesce((select string_agg(b.body, ' ' order by b.ord)
                          from job_body b where b.job_id = p.id), '') || ' '
            || coalesce(p.detail->>'걸린줄', '') as t
          from job_posts p where p.id = '${id}'
      )
      select coalesce(
               substring(regexp_replace(t, '[\\r\\n\\t]+', ' ', 'g')
                         from '(.{0,90}(?:물리|작업|도수)\\s*치료.{0,90})'),
               '★ 우리 직군 말이 **원문에 없습니다** — 앞 200자: '
                 || left(regexp_replace(t, '[\\r\\n\\t]+', ' ', 'g'), 200)) as 창
        from 글;`));
    console.log('   ── 세중님이 누를 자리 ──');
    console.log('   https://potjob-web.vercel.app/admin/jobs?state=live&q=' + encodeURIComponent(id));
  }
}
console.log('\n★ 아무것도 바꾸지 않았습니다 (읽기만).');
