/* 긁기 공고 「지원하러 가기」가 **그 공고 글**로 가나 — 표본 (2026-10-28 세중님 2번)
 *
 *   node tools/지원링크_긁기표본_1028.mjs --몇개 10
 *
 * ★ 화면이 쓰는 **그 함수**를 그대로 들여와 씁니다 (`web/lib/job-state.ts` 의 지원링크).
 *   도구가 규칙을 다시 적으면 두 벌이 되고, 다를 때 아무도 모릅니다 (지침 6절).
 *   값은 `job_one` 이 **회원에게 내리는 것**을 그대로 받습니다 (지침 12절 — 같은 조건).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { 지원링크, 긁기공고인가 } from '../web/lib/job-state.ts';

const 뿌리 = path.join(import.meta.dirname, '..');
const 기관찾기 = (() => { const i = process.argv.indexOf('--기관');
  return i < 0 ? null : String(process.argv[i+1]||''); })();
/* --기관 을 주면 출처를 안 가리고 그 기관 공고를 봅니다 (고창은 워크넷입니다) */
const 몇개 = (() => { const i = process.argv.indexOf('--몇개');
  return i < 0 ? 10 : Math.max(1, Number(process.argv[i + 1] || 10)); })();
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
function psql(sql) {
  const 임시 = path.join(os.tmpdir(), '긁기표본_' + process.pid + '.sql');
  fs.writeFileSync(임시, sql, 'utf8');
  const r = spawnSync('psql', ['-X', '-A', '-t', '-q', '-v', 'ON_ERROR_STOP=1', '-f', 임시],
    { encoding: 'utf8', maxBuffer: 1 << 26, env });
  fs.unlinkSync(임시);
  if (r.status) { console.error('✗ psql\n' + (r.stderr || '').slice(0, 1000)); process.exit(1); }
  return (r.stdout || '').trimEnd();
}
/* job_one 은 auth.uid() 가 없으면 비회원 갈래입니다 — 회원 갈래로 받습니다 */
const 회원되기 = String.raw`\o /dev/null
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', false);
\o
`;

const 줄들 = JSON.parse(psql(회원되기 + `
  select coalesce(jsonb_agg(x), '[]'::jsonb)::text from (
    select p.id, p.source, p.org_name, p.title, j.url, j.detail
      from job_posts p join job_posts_pub v on v.id = p.id
      left join lateral job_one(p.id) j on true
     where ${기관찾기 ? "p.org_name like '%" + 기관찾기.replace(/'/g, "''") + "%'" : "p.source like 'HS%'"}
     order by p.id
  ) x;`));
console.log('회원 화면 긁기 공고 ' + 줄들.length + '건 — 표본 ' + Math.min(몇개, 줄들.length) + '건을 엽니다\n');

let 글로간것 = 0; let 이백 = 0; let 제목맞음 = 0;
const 표본 = 줄들.slice(0, 몇개);
for (const r of 표본) {
  const d = r.detail || {};
  const 지원 = 지원링크(r.url, d['접수방법'], d['기관홈'] ?? d['기관홈페이지'], d['채용게시판'], r.id);
  const 글인가 = 지원.갈래 === '원문' && 지원.주소 === r.url;
  if (글인가) 글로간것 += 1;
  let 코드 = '-'; let 쪽제목 = '';
  if (지원.주소) {
    try {
      /* 헤더 값은 latin-1 (지침 12) */
      const res = await fetch(지원.주소, { redirect: 'follow', signal: AbortSignal.timeout(20000),
        headers: { 'user-agent': 'Mozilla/5.0 (potjob-check)' } });
      코드 = String(res.status);
      const 글 = await res.text();
      쪽제목 = (글.match(/<title[^>]*>([\s\S]{0,140}?)<\/title>/i)?.[1] || '').replace(/\s+/g, ' ').trim();
      if (res.status === 200) 이백 += 1;
      /* 그 **공고 글**인가 — 우리 원문 제목의 글자가 쪽 제목이나 글에 있나 */
      const 키 = String(r.title || '').replace(/[^가-힣0-9A-Za-z]/g, '').slice(0, 10);
      const 쪽글자 = 글.replace(/<[^>]+>/g, ' ').replace(/[^가-힣0-9A-Za-z]/g, '');
      if (키.length >= 5 && 쪽글자.includes(키)) 제목맞음 += 1;
    } catch (e) { 코드 = '✗ ' + String(e.message || e).slice(0, 36); }
  }
  console.log((글인가 ? '글 ' : 지원.갈래.slice(0, 2) + ' ') + 코드.padEnd(6)
    + r.id.padEnd(16) + r.org_name.slice(0, 18).padEnd(20)
    + String(지원.주소 || '(없음)').slice(0, 58));
  console.log('      원문제목 ' + String(r.title || '').slice(0, 40) + ' · 쪽제목 ' + 쪽제목.slice(0, 44));
  await new Promise((x) => setTimeout(x, 3500));   /* 같은 집 틈 (지침) */
}

console.log('\n표본 ' + 표본.length + '건 — **그 공고 글로 가는 것 ' + 글로간것 + '** · 200 ' + 이백
  + ' · 쪽에 우리 제목이 보인 것 ' + 제목맞음);
console.log('── 전수 갈래 (회원 화면 긁기 공고 ' + 줄들.length + '건) ──');
const 셈 = {};
for (const r of 줄들) {
  const d = r.detail || {};
  const 지원 = 지원링크(r.url, d['접수방법'], d['기관홈'] ?? d['기관홈페이지'], d['채용게시판'], r.id);
  const 열쇠 = (지원.갈래 === '원문' && 지원.주소 === r.url) ? '⓪ 그 공고 글' : 지원.갈래;
  셈[열쇠] = (셈[열쇠] || 0) + 1;
}
console.log('  ' + Object.entries(셈).map(([k, v]) => k + ' ' + v).join(' · '));
console.log('  (긁기인가 판정: ' + 줄들.filter((r) => 긁기공고인가(r.id)).length + '/' + 줄들.length + ')');
