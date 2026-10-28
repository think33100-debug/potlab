/* 공고문이 **그림 파일**인 공고 — 담겼나·읽었나·칸이 비나 (2026-10-28 세중님 3번)
 *
 *   node tools/그림첨부_1028.mjs                     ⓐ 한 건 원문 + ⓒ 전수
 *   node tools/그림첨부_1028.mjs --공고 HS2028439844
 *
 * 읽기만 합니다.
 *
 * ── 첨부가 두 표에 있습니다 ──────────────────────────────────
 *   `job_attachments`  수집기가 담는 **공고 첨부** (url·parsed_at·읽기탈)
 *   `공고첨부`          담당자·관리자가 **올리는** 첨부 (저장소 경로)
 *   둘을 따로 셉니다 — 섞으면 「없다」와 「못 읽었다」가 구별되지 않습니다
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const 뿌리 = path.join(import.meta.dirname, '..');
const 공고 = (() => { const i = process.argv.indexOf('--공고');
  return i < 0 ? 'HS2028439844' : String(process.argv[i + 1] || ''); })();
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
  const 임시 = path.join(os.tmpdir(), '그림첨부_' + process.pid + '.sql');
  fs.writeFileSync(임시, sql, 'utf8');
  const r = spawnSync('psql', [...꼴, '-v', 'ON_ERROR_STOP=1', '-f', 임시],
    { encoding: 'utf8', maxBuffer: 1 << 26, env });
  fs.unlinkSync(임시);
  if (r.status) { console.error('✗ psql\n' + (r.stderr || '').slice(0, 1200)); process.exit(1); }
  return (r.stdout || '').trimEnd();
}
const 머리 = '\\pset pager off\n';

/* 그림 꼴인가 — 이름이나 주소 꼬리로 봅니다 (한 자리) */
const 그림꼴 = `(coalesce(a.name,'') ~* '\\.(jpe?g|png|gif|bmp|tiff?|webp)$'
                 or coalesce(a.url,'')  ~* '\\.(jpe?g|png|gif|bmp|tiff?|webp)(\\?|$)')`;
const 글꼴 = `(coalesce(a.name,'') ~* '\\.(pdf|hwpx?|docx?|xlsx?|zip)$'
               or coalesce(a.url,'')  ~* '\\.(pdf|hwpx?|docx?|xlsx?|zip)(\\?|$)')`;
const 빈칸수SQL = `
  (case when p.headcount is null and coalesce(p."뽑은값"->>'모집인원','') = ''
          and coalesce(p.detail->>'모집인원','') = '' then 1 else 0 end
 + case when p.apply_to is null and coalesce(p."뽑은값"->>'접수마감글','') = '' then 1 else 0 end
 + case when coalesce(p.work_place,'') = '' then 1 else 0 end
 + case when coalesce(p."뽑은값"->>'지원자격','') = ''
          and coalesce(p.detail->>'지원자격','') = '' then 1 else 0 end
 + case when coalesce(p."뽑은값"->>'예상연봉','') = '' and coalesce(p.detail->>'연봉','') = ''
          and coalesce(p.detail->>'예상연봉','') = '' then 1 else 0 end)`;

console.log('══ ⓐ ' + 공고 + ' — 첨부가 담겼나 ══');
console.log(psql(머리 + `
  select a.id, coalesce(a.kind,'(없음)') as 갈래, coalesce(a.name,'(이름 없음)') as 이름,
         a.parsed_at at time zone 'Asia/Seoul' as 읽은때,
         coalesce(a."읽기탈",'(없음)') as 읽기탈,
         a."만든때" at time zone 'Asia/Seoul' as 담은때,
         left(a.url, 72) as 주소
    from job_attachments a where a.job_id = '${공고}' order by a.id;`));
console.log('── 올린 첨부(공고첨부) ──');
console.log(psql(머리 + `
  select a.id, a."갈래", a."이름", a."형식", a."크기", a."읽었나"
    from "공고첨부" a where a."공고id" = '${공고}' order by a.id;`));
console.log('── 본문(job_body) 줄과 글자 수 ──');
console.log(psql(머리 + `
  select b.ord, coalesce(b.kind,'') as 갈래, coalesce(b.file_name,'(쪽)') as 파일,
         length(b.body) as 글자수, left(regexp_replace(b.body,'[\\r\\n\\t]+',' ','g'), 160) as 앞160
    from job_body b where b.job_id = '${공고}' order by b.ord;`));
console.log('── 본문에 연봉 글자가 있나 (원문 500자 창) ──');
console.log(psql(머리 + `
  select b.ord,
         substring(regexp_replace(b.body,'[\\r\\n\\t]+',' ','g')
                   from '(.{0,160}(?:연봉|급여|보수|월급|임금|처우).{0,160})') as 창
    from job_body b where b.job_id = '${공고}'
     and b.body ~ '연봉|급여|보수|월급|임금|처우' order by b.ord limit 3;`));
console.log('── 칸 상태 ──');
console.log(psql(머리 + `
  select p.id, ${빈칸수SQL} as "빈 칸(다섯 중)", p.apply_to as 마감,
         coalesce(p.detail->>'연봉', p."뽑은값"->>'예상연봉', '(없음)') as 연봉,
         coalesce(p.work_place,'(없음)') as 근무지, p.headcount as 인원
    from job_posts p where p.id = '${공고}';`));

console.log('\n══ ⓒ 전수 — 회원 화면에서 **첨부가 그림뿐**인 공고 ══');
const 그림뿐조건 = `
    exists (select 1 from job_attachments a where a.job_id = p.id and ${그림꼴})
    and not exists (select 1 from job_attachments a where a.job_id = p.id and ${글꼴})`;
console.log(psql(머리 + `
  select count(*) as "회원 화면",
         count(*) filter (where exists (select 1 from job_attachments a where a.job_id = p.id))
           as "첨부 있음",
         count(*) filter (where ${그림뿐조건}) as "첨부가 그림뿐",
         count(*) filter (where ${그림뿐조건} and ${빈칸수SQL} >= 3) as "그림뿐 + 셋 이상 빔"
    from job_posts p join job_posts_pub v on v.id = p.id;`));
console.log('── 그림뿐인 공고 전수 ──');
console.log(psql(머리 + `
  select p.id, p.source, left(p.org_name, 22) as 기관, ${빈칸수SQL} as "빈 칸",
         (select count(*) from job_attachments a where a.job_id = p.id) as 첨부,
         (select count(*) from job_attachments a where a.job_id = p.id and a.parsed_at is not null)
           as 읽은첨부,
         (select count(*) from job_body b where b.job_id = p.id) as 본문줄,
         left(coalesce(p."보여줄제목", p.title), 36) as 제목
    from job_posts p join job_posts_pub v on v.id = p.id
   where ${그림뿐조건} order by p.id;`));
console.log('── 견주기: 첨부 꼴별 (회원 화면) ──');
console.log(psql(머리 + `
  select case when ${그림꼴} then '그림' when ${글꼴} then '글(pdf·hwp·doc)' else '그 밖' end as 꼴,
         count(*) as 첨부, count(a.parsed_at) as 읽은것,
         count(*) filter (where coalesce(a."읽기탈",'') <> '') as 읽기탈있음
    from job_attachments a
   where exists (select 1 from job_posts_pub v where v.id = a.job_id)
   group by 1 order by 2 desc;`));
console.log('\n★ 아무것도 바꾸지 않았습니다 (읽기만).');
