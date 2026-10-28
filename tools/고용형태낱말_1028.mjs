/* 고용형태 낱말 — 세중님 목록이 **이미 들어 있나** + 되메우기 마른 실행 수
 *   (2026-10-28 세중님 1번)
 *
 *   node tools/고용형태낱말_1028.mjs --자기점검   낱말마다 지금 뭐라고 읽나
 *   node tools/고용형태낱말_1028.mjs             회원 화면에서 몇 건이 바뀔까 (읽기만)
 *
 * ★ 판정은 `tools/공고문읽기.mjs` 의 `고용형태판정()` **한 자리**입니다 (지침 6절).
 *   이 도구는 그것을 **불러만** 봅니다 — 규칙을 다시 적지 않습니다.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { 고용형태판정 } from './공고문읽기.mjs';

const 뿌리 = path.join(import.meta.dirname, '..');
const 낱말들 = ['단기간근로', '기간제', '촉탁', '대체', '임기제', '시간선택제'];

if (process.argv.includes('--자기점검')) {
  console.log('세중님 낱말을 **지금 규칙**에 넣어 보면 (제목 자리에 넣어 부릅니다)\n');
  for (const w of 낱말들) {
    const r = 고용형태판정('작업치료사(' + w + ') 채용', '');
    console.log('  ' + w.padEnd(8) + ' → ' + (r && r.값 ? r.값 : '(아무것도 안 나옴)')
      + (r && r.왜 ? "   까닭 " + r.왜 : ""));
  }
  console.log('\n── 같은 뜻의 **다른 꼴**도 넣어 봅니다 ──');
  for (const w of ['기간제근로자', '일반임기제', '시간선택제임기제', '한시결원대체',
    '육아휴직 대체', '휴직대체', '단기고용직', '초단시간', '시간선택제 공무원']) {
    const r = 고용형태판정('물리치료사(' + w + ') 채용', '');
    console.log('  ' + w.padEnd(14) + ' → ' + (r && r.값 ? r.값 : '(아무것도 안 나옴)'));
  }
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
function psql(sql, 꼴 = ['-X', '-q']) {
  const 임시 = path.join(os.tmpdir(), '고용형태낱말_' + process.pid + '.sql');
  fs.writeFileSync(임시, sql, 'utf8');
  const r = spawnSync('psql', [...꼴, '-v', 'ON_ERROR_STOP=1', '-f', 임시],
    { encoding: 'utf8', maxBuffer: 1 << 26, env });
  fs.unlinkSync(임시);
  if (r.status) { console.error('✗ psql\n' + (r.stderr || '').slice(0, 1200)); process.exit(1); }
  return (r.stdout || '').trimEnd();
}
const 머리 = '\\pset pager off\n';

console.log('══ 회원 화면 — 고용형태 칸이 어떻게 차 있나 ══');
console.log(psql(머리 + `
  select coalesce(nullif(p.employ_type,''),'(빈칸)') as 고용형태, count(*) as 공고
    from job_posts p join job_posts_pub v on v.id = p.id
   group by 1 order by 2 desc;`));

console.log('\n══ 세중님 낱말이 **원문에 있는데** 고용형태 칸이 빈 공고 ══');
const 낱말SQL = 낱말들.map((w) => `count(*) filter (where 글 ~ '${w}') as "${w}"`).join(',\n         ');
console.log(psql(머리 + `
  with x as (
    select p.id, coalesce(p.employ_type,'') as 지금,
           coalesce(p.title,'') || ' ' ||
           coalesce((select string_agg(b.body, ' ') from job_body b where b.job_id = p.id), '') as 글
      from job_posts p join job_posts_pub v on v.id = p.id
  )
  select count(*) as "회원 화면", count(*) filter (where 지금 = '') as "고용형태 빈칸",
         ${낱말SQL}
    from x where 지금 = '';`));

console.log('── 그 공고들 (빈칸인 것 전수) ──');
const 줄들 = psql(머리 + `
  with x as (
    select p.id, p.source, p.org_name, coalesce(p.title,'') as 제목,
           coalesce((select string_agg(b.body, ' ') from job_body b where b.job_id = p.id), '') as 본문
      from job_posts p join job_posts_pub v on v.id = p.id
     where coalesce(p.employ_type,'') = ''
  )
  /* ★ 본문에는 **줄바꿈이 들어 있습니다** — 안 지우면 한 공고가 여러 줄로 쪼개져
     「317건」처럼 터무니없는 수가 나옵니다 (2026-10-28 에 그랬습니다) */
  select id || E'\\t' || source || E'\\t' || left(org_name, 24) || E'\\t'
      || regexp_replace(제목, '[\\r\\n\\t]+', ' ', 'g') || E'\\t'
      || left(regexp_replace(본문, '[\\r\\n\\t]+', ' ', 'g'), 6000)
    from x order by id;`, ['-X', '-A', '-t', '-q']);
let 채워질것 = 0;
for (const l of 줄들.split('\n').filter(Boolean)) {
  const [id, 출처, 기관, 제목, 본문] = l.split('\t');
  const r = 고용형태판정(제목 || '', 본문 || '');
  const 값 = r && r.값 ? r.값 : null;
  if (값) 채워질것 += 1;
  console.log('  ' + (값 ? '○ ' : '· ') + id.padEnd(16) + (출처 || '').padEnd(5)
    + (기관 || '').slice(0, 20).padEnd(22) + (값 || '(안 나옴)').padEnd(10)
    + String(제목 || '').slice(0, 34));
}
console.log('\n**되메우기 마른 실행 — 지금 규칙으로 채워질 것 ' + 채워질것 + '건**'
  + ' (빈칸 ' + 줄들.split('\n').filter(Boolean).length + '건 가운데)');
console.log('★ 아무것도 바꾸지 않았습니다 (읽기만).');
