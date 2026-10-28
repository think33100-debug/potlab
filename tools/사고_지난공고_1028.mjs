/* 신뢰 셋 ① 구멍 — **긁기 공고가 안 내려갑니다** (2026-10-28 세중님 · 회원 화면 사고)
 *
 *   node tools/사고_지난공고_1028.mjs           ⓐ 두 건 원문 찍기 + ⓒ 전수 셈
 *   node tools/사고_지난공고_1028.mjs --쪽안열기  원문을 두드리지 않고 DB 만
 *
 * 읽기만 합니다.
 *
 * ── 세중님이 본 것 ──────────────────────────────────────────
 *   한성재단포항세명기독병원 · 청주성모병원 작업치료사 공고(HS3) —
 *   **지난 공고**이고 **계약직인데 제목에 없고** **공고 정보가 없습니다**
 *
 * ── 왜 안 내려갔나 (코드 자리) ──────────────────────────────
 *   `hide_stale_posts()` ② (sql/기준구조_1025.sql:3610~3618)
 *     · 기준 날짜가 **`coalesce(first_seen, collected_at)`** 입니다 —
 *       **담은 날**이고 **공고 게시일(`posted_at`)이 아닙니다**
 *     · 그리고 **정찰 면제**가 있습니다 —
 *         not (seen_on >= 오늘 - 14 and coalesce(gone_streak,0) = 0)
 *       정찰이 14일 안에 「살아 있다」고 본 공고는 **30일이 지나도 안 내려갑니다**
 *     · 뚜껑은 **90일**(②-2)이라 그때까지는 남습니다
 *   정찰은 `tools/없어진공고찾기.mjs` 가 돌고, 긁기 출처(HS·HS3)는 **쪽을 열어
 *   `없어짐말`** 로 봅니다 (tools/hosp/hs_목록상태.mjs 한 자리).
 *   → 그래서 **쪽이 200 이고 없어짐말이 없으면 「살아 있다」** 가 됩니다.
 *     글이 목록에서 빠졌어도 그 쪽이 200 이면 못 가립니다
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const 뿌리 = path.join(import.meta.dirname, '..');
const 찾을말 = (() => { const i = process.argv.indexOf('--기관');
  return i < 0 ? "'%포항세명%'" : "'%" + String(process.argv[i+1]||'').replace(/'/g,"''") + "%'"; })();
const 쪽안열기 = process.argv.includes('--쪽안열기');
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
  const 임시 = path.join(os.tmpdir(), '사고_' + process.pid + '.sql');
  fs.writeFileSync(임시, sql, 'utf8');
  const r = spawnSync('psql', [...꼴, '-v', 'ON_ERROR_STOP=1', '-f', 임시],
    { encoding: 'utf8', maxBuffer: 1 << 26, env });
  fs.unlinkSync(임시);
  if (r.status) { console.error('✗ psql\n' + (r.stderr || '').slice(0, 1200)); process.exit(1); }
  return (r.stdout || '').trimEnd();
}
const 글만 = (sql) => psql(sql, ['-X', '-A', '-t', '-q', '-F', '\t']);
const 머리 = '\\pset pager off\n';

/* 빈 칸을 세는 자 — **한 자리** (아래 ⓐⓒ 가 같이 씁니다).
   일곱 칸 가운데 **공고마다 다른 다섯**만 셉니다 —
   「바쁜 곳(경쟁률)」·「병원 뜯어보기(심평원)」는 기관 값이라 공고 탓이 아닙니다 */
const 빈칸수SQL = `
  (case when p.headcount is null
          and coalesce(p."뽑은값"->>'모집인원','') = ''
          and coalesce(p.detail->>'모집인원','') = '' then 1 else 0 end
 + case when p.apply_to is null
          and coalesce(p."뽑은값"->>'접수마감글','') = '' then 1 else 0 end
 + case when coalesce(p.work_place,'') = '' then 1 else 0 end
 + case when coalesce(p."뽑은값"->>'지원자격','') = ''
          and coalesce(p.detail->>'지원자격','') = '' then 1 else 0 end
 + case when coalesce(p."뽑은값"->>'예상연봉','') = ''
          and coalesce(p.detail->>'연봉','') = ''
          and coalesce(p.detail->>'예상연봉','') = '' then 1 else 0 end)`;

console.log('══ ⓐ 세중님이 보신 두 건 ══');
const 두건 = 글만(`
  select p.id, p.source, coalesce(p.url,'') from job_posts p
   join job_posts_pub v on v.id = p.id
   where (p.org_name like 찾을말)
     
   order by p.org_name;`).split('\n').filter(Boolean).map((l) => l.split('\t'));
console.log(psql(머리 + `
  select p.id, p.source, p.org_name,
         coalesce(p.job_group,'(빈칸)') as 직군,
         coalesce(p.employ_type,'(빈칸)') as 고용형태,
         p.posted_at as 게시일, p.first_seen as 담은날,
         (p.collected_at at time zone 'Asia/Seoul')::date as 받은날,
         p.apply_to as 마감, p.apply_to_time as 마감시각,
         p.seen_on as 정찰본날, coalesce(p.gone_streak,0) as 없어짐연속,
         p.hidden, p.hold, p.admin_locked,
         (select count(*) from job_body b where b.job_id = p.id) as 본문줄,
         (select coalesce(sum(length(b.body)),0) from job_body b where b.job_id = p.id) as 본문글자,
         (select count(*) from "공고첨부" a where a."공고id" = p.id) as 첨부,
         (select count(*) from "공고첨부" a where a."공고id" = p.id and a."읽었나") as 읽은첨부,
         ${빈칸수SQL} as "빈 칸(다섯 중)",
         left(p."보여줄제목", 44) as 보여줄제목
    from job_posts p join job_posts_pub v on v.id = p.id
   where (p.org_name like 찾을말)
     
   order by p.org_name;`));
console.log('── 원문 제목·주소 · detail·뽑은값 열쇠 ──');
console.log(psql(머리 + `
  select p.id, left(p.title, 58) as 원문제목,
         coalesce((select string_agg(k, ',' order by k) from jsonb_object_keys(coalesce(p.detail,'{}'::jsonb)) k), '(없음)') as detail열쇠,
         coalesce((select string_agg(k, ',' order by k) from jsonb_object_keys(coalesce(p."뽑은값",'{}'::jsonb)) k), '(없음)') as 뽑은값열쇠,
         coalesce(p.url,'(없음)') as 원문주소
    from job_posts p join job_posts_pub v on v.id = p.id
   where (p.org_name like 찾을말)
     
   order by p.org_name;`));
console.log('── 상태가 바뀐 기록 (job_state_log) ──');
console.log(psql(머리 + `
  select l.job_id, l."누가", l."왜", l."바뀐때" at time zone 'Asia/Seoul' as 바뀐때,
         l."옛_hidden", l."새_hidden", l."옛_hold", l."새_hold"
    from job_state_log l
   where l.job_id in (select p.id from job_posts p
                        where (p.org_name like 찾을말)
                          )
   order by l."바뀐때" desc limit 10;`));

if (!쪽안열기) {
  console.log('\n── 원문을 열어 봅니다 (제목 글자가 아직 쪽에 있나) ──');
  for (const [id, 출처, 주소] of 두건) {
    if (!주소) { console.log('  ' + id + ' — 원문 주소가 없습니다'); continue; }
    const 제목 = 글만(`select coalesce(p.title,'') from job_posts p where p.id = '${id}';`);
    let 코드 = '-'; let 있나 = '-'; let 글자수 = 0; let 쪽제목 = '';
    try {
      /* 헤더 값은 latin-1 입니다 (지침 12) */
      const r = await fetch(주소, { redirect: 'follow', signal: AbortSignal.timeout(20000),
        headers: { 'user-agent': 'Mozilla/5.0 (potjob-check)' } });
      코드 = String(r.status);
      const 글 = await r.text();
      글자수 = 글.length;
      쪽제목 = (글.match(/<title[^>]*>([\s\S]{0,120}?)<\/title>/i)?.[1] || '').replace(/\s+/g, ' ').trim();
      /* 제목에서 글자만 남겨 쪽 글자와 견줍니다 (띄어쓰기·기호가 달라도 걸리게) */
      const 키 = 제목.replace(/[^가-힣0-9A-Za-z]/g, '').slice(0, 14);
      const 쪽글자 = 글.replace(/<[^>]+>/g, ' ').replace(/[^가-힣0-9A-Za-z]/g, '');
      있나 = 키.length >= 6 ? (쪽글자.includes(키) ? '★ 쪽에 **남아 있습니다**' : '쪽에 없습니다') : '제목이 짧아 못 봄';
    } catch (e) { 코드 = '✗ ' + String(e.message || e).slice(0, 44); }
    console.log('  ' + id + ' [' + 출처 + '] HTTP ' + 코드 + ' · ' + 글자수 + '자 · ' + 있나);
    console.log('      주소 ' + 주소);
    console.log('      쪽 제목 ' + 쪽제목.slice(0, 70));
    console.log('      우리 제목 ' + 제목.slice(0, 70));
    await new Promise((r) => setTimeout(r, 3500));   /* 같은 집 틈 (지침) */
  }
}

console.log('\n══ ⓒ 전수 — 회원 화면 긁기 공고 ══');
console.log(psql(머리 + `
  with 긁기 as (
    select p.* from job_posts p join job_posts_pub v on v.id = p.id
     where p.source like 'HS%'
  )
  select count(*) as "긁기 공고",
         count(*) filter (where apply_to is null) as "마감 없음",
         count(*) filter (where posted_at is not null) as "게시일 있음",
         count(*) filter (where apply_to is null
            and coalesce(posted_at, first_seen, (collected_at at time zone 'Asia/Seoul')::date)
                < (now() at time zone 'Asia/Seoul')::date - 30) as "게시일(없으면 담은날) 30일 지남",
         count(*) filter (where apply_to is null
            and coalesce(first_seen, (collected_at at time zone 'Asia/Seoul')::date)
                < (now() at time zone 'Asia/Seoul')::date - 30) as "담은날만 30일 지남",
         count(*) filter (where seen_on is not null
            and seen_on >= (now() at time zone 'Asia/Seoul')::date - 14
            and coalesce(gone_streak,0) = 0) as "정찰 면제에 걸린 것"
    from 긁기;`));
console.log('── 출처별 ──');
console.log(psql(머리 + `
  select p.source, count(*) as 공고,
         count(*) filter (where p.apply_to is null) as "마감 없음",
         count(*) filter (where p.apply_to is null
            and coalesce(p.posted_at, p.first_seen, (p.collected_at at time zone 'Asia/Seoul')::date)
                < (now() at time zone 'Asia/Seoul')::date - 30) as "30일 지남",
         count(*) filter (where ${빈칸수SQL} >= 3) as "다섯 칸 중 셋 이상 빔",
         count(*) filter (where (select count(*) from job_body b where b.job_id = p.id) = 0)
           as "본문 못 읽음"
    from job_posts p join job_posts_pub v on v.id = p.id
   group by 1 order by 2 desc;`));
console.log('\n── ★ 내려갈 목록 — 마감 없고 30일 지난 긁기 공고 (전수) ──');
console.log(psql(머리 + `
  select p.id, p.source, p.org_name,
         p.posted_at as 게시일, p.first_seen as 담은날, p.seen_on as 정찰본날,
         coalesce(p.gone_streak,0) as 없어짐연속,
         ${빈칸수SQL} as "빈 칸",
         (select count(*) from job_body b where b.job_id = p.id) as 본문줄,
         left(p."보여줄제목", 40) as 보여줄제목
    from job_posts p join job_posts_pub v on v.id = p.id
   where p.source like 'HS%' and p.apply_to is null
     and coalesce(p.posted_at, p.first_seen, (p.collected_at at time zone 'Asia/Seoul')::date)
         < (now() at time zone 'Asia/Seoul')::date - 30
   order by coalesce(p.posted_at, p.first_seen), p.id;`));
console.log('\n── ★ 보류함으로 보낼 목록 — 다섯 칸 중 셋 이상 빈 긁기 공고 ──');
console.log(psql(머리 + `
  select p.id, p.source, p.org_name, ${빈칸수SQL} as "빈 칸",
         (select count(*) from job_body b where b.job_id = p.id) as 본문줄,
         (select count(*) from "공고첨부" a where a."공고id" = p.id) as 첨부,
         p.apply_to as 마감, left(p."보여줄제목", 40) as 보여줄제목
    from job_posts p join job_posts_pub v on v.id = p.id
   where p.source like 'HS%' and ${빈칸수SQL} >= 3
   order by ${빈칸수SQL} desc, p.id;`));

console.log('\n★ 아무것도 바꾸지 않았습니다 (읽기만).');
