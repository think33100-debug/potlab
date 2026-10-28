/* E 보강 — 「지원하러 가기」 ① 채용 게시판 주소를 **공고 쪽으로 잇는 길** 재 보기
 *   (2026-10-28 세중님 — ①이 0 인 까닭은 주소가 **사이트표에만** 있는 것입니다)
 *
 *   node tools/지원링크_잇기_1028.mjs           읽기만 합니다
 *   node tools/지원링크_잇기_1028.mjs --표본 20  고른 주소를 **열어** 봅니다 (200 인지)
 *
 * ── 어떻게 잇나 ─────────────────────────────────────────────
 *   공고.기관번호 는 두 꼴입니다 — `HIRA:<ykiho>` (심평원) · `NAME:<이름키>` (이름)
 *     ① 기관 표.채용페이지        기관번호로 바로
 *     ② 사이트표(hosp_sites).채용주소
 *          ykiho 로 · 없으면 이름열쇠(= 견줄이름) 로
 *   ★ 「의심」(연결상태 = '대기') 은 **뺍니다** — 어느 기관인지 아직 모르는 줄입니다
 *     (세중님 「이름으로 붙은 기관(의심 아닌 것만)도 포함」)
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const 뿌리 = path.join(import.meta.dirname, '..');
const 표본수 = (() => {
  const i = process.argv.indexOf('--표본');
  return i < 0 ? 0 : Math.max(0, Number(process.argv[i + 1] || 20));
})();

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
  const 임시 = path.join(os.tmpdir(), '지원링크_' + process.pid + '.sql');
  fs.writeFileSync(임시, sql, 'utf8');
  const r = spawnSync('psql', [...꼴, '-v', 'ON_ERROR_STOP=1', '-f', 임시],
    { encoding: 'utf8', maxBuffer: 1 << 26, env });
  fs.unlinkSync(임시);
  if (r.status) { console.error('✗ psql\n' + (r.stderr || '').slice(0, 1200)); process.exit(1); }
  return (r.stdout || '').trimEnd();
}
const 머리 = '\\pset pager off\n';

/* 잇는 길 한 자리 — 아래 모든 셈이 이 CTE 를 씁니다 */
const 이은것 = `
  with 공고 as (
    select p.id, p.source, p.org_name, p.url, p."기관번호", p."연결상태",
           nullif(p.detail->>'기관홈','')        as 기관홈,
           nullif(p.detail->>'기관홈페이지','')  as 기관홈2
      from job_posts p join job_posts_pub v on v.id = p.id
  ), 이음 as (
    select c.*,
           /* ① 기관 표.채용페이지 */
           nullif(o."채용페이지", '')  as 기관표_채용페이지,
           nullif(o."홈페이지", '')    as 기관표_홈페이지,
           /* ② 사이트표.채용주소 — ykiho 로, 없으면 이름열쇠로 */
           nullif(coalesce(sy."채용주소", sn."채용주소"), '') as 사이트표_채용주소,
           nullif(coalesce(sy.url, sn.url), '')               as 사이트표_홈,
           case when sy.name is not null then 'ykiho'
                when sn.name is not null then '이름열쇠' end   as 사이트표_어떻게
      from 공고 c
      left join "기관" o on o."기관번호" = c."기관번호"
      /* ★ 사이트표에 같은 열쇠가 여러 줄인 곳이 여덜 군데입니다 (ykiho 3 · 이름열쇠 5).
         그냥 join 하면 공고 하나가 두 줄로 세어집니다 — **한 줄만** 고릅니다
         (채용주소가 있는 쪽 → 홈이 있는 쪽 → 이름 차례) */
      left join lateral (
        select s.name, s."채용주소", s.url from hosp_sites s
         where c."기관번호" like 'HIRA:%' and s.ykiho = substr(c."기관번호", 6) and not s."끔"
         order by (nullif(s."채용주소",'') is null), (nullif(s.url,'') is null), s.name
         limit 1) sy on true
      left join lateral (
        select s.name, s."채용주소", s.url from hosp_sites s
         where s."이름열쇠" = coalesce(o."이름키", "견줄이름"(c.org_name)) and not s."끔"
         order by (nullif(s."채용주소",'') is null), (nullif(s.url,'') is null), s.name
         limit 1) sn on true
     where coalesce(c."연결상태",'') <> '대기'        /* ★ 의심은 뺍니다 */
  ), 차례 as (
    select i.*,
           case when i.기관표_채용페이지 is not null then '① 채용게시판(기관표)'
                when i.사이트표_채용주소  is not null then '① 채용게시판(사이트표)'
                when i.기관표_홈페이지    is not null then '② 기관홈(기관표)'
                when i.사이트표_홈        is not null then '② 기관홈(사이트표)'
                when coalesce(i.기관홈, i.기관홈2) is not null then '② 기관홈(공고 detail)'
                when i.url is not null                then '③ 원문'
                else '없음' end as 갈래,
           coalesce(i.기관표_채용페이지, i.사이트표_채용주소,
                    i.기관표_홈페이지, i.사이트표_홈,
                    i.기관홈, i.기관홈2, i.url) as 쓸주소
      from 이음 i
  )`;

console.log('══ ①이 0 이던 까닭 — 공고에 담긴 칸을 그대로 셉니다 ══');
console.log(psql(머리 + `
  select count(*) as 회원화면,
         count(*) filter (where coalesce(p.detail->>'채용게시판','') <> '') as "공고에_채용게시판칸",
         count(*) filter (where coalesce(p.detail->>'기관홈','') <> ''
                             or coalesce(p.detail->>'기관홈페이지','') <> '') as "공고에_기관홈칸",
         count(*) filter (where coalesce(p.url,'') <> '') as "원문주소"
    from job_posts p join job_posts_pub v on v.id = p.id;`));
console.log('── 주소가 있는 자리 (사이트표·기관 표) ──');
console.log(psql(머리 + `
  select count(*) as "사이트표_줄", count(*) filter (where coalesce("채용주소",'') <> '') as "채용주소있음",
         count(*) filter (where coalesce(url,'') <> '') as "홈있음",
         count(*) filter (where ykiho is not null) as "ykiho있음",
         count(*) filter (where "끔") as "끈것"
    from hosp_sites;`));
console.log(psql(머리 + `
  select count(*) as "기관표_줄", count(*) filter (where coalesce("채용페이지",'') <> '') as "채용페이지있음",
         count(*) filter (where coalesce("홈페이지",'') <> '') as "홈페이지있음"
    from "기관";`));

/* ★ 재는 자를 먼저 의심합니다 (지침 10-5) — 아침 마른 실행은 「기관 표 홈페이지 0건」
   이라고 적었는데 아래 갈래 셈은 19건을 냅니다. 둘 다 맞을 수 없으니 함께 찍습니다 */
console.log('\n══ 대조 — 아침에 쓴 질의 ↔ 이어 본 셈 (둘이 다르면 자가 틀린 것입니다) ══');
console.log(psql(머리 + `
  select count(*) as "회원화면(join 뒤 줄 수)",
         count(distinct p.id) as "공고 수",
         count(*) filter (where o."홈페이지" is not null and o."홈페이지" <> '') as "기관표에_홈페이지",
         count(*) filter (where o."채용페이지" is not null and o."채용페이지" <> '') as "기관표에_채용페이지",
         count(*) filter (where p."기관번호" is null) as "기관번호_빈것",
         count(*) filter (where o."기관번호" is null) as "기관표에_없는번호"
    from job_posts p join job_posts_pub v on v.id = p.id
    left join "기관" o on o."기관번호" = p."기관번호";`));
console.log('── 사이트표가 한 공고에 여러 줄 붙나 (붙으면 갈래 셈이 부풀니다) ──');
console.log(psql(머리 + `
  select 'ykiho' as 열쇠, count(*) as "여러줄인_열쇠", coalesce(sum(n) - count(*), 0) as "늘어나는_줄"
    from (select ykiho, count(*) as n from hosp_sites where ykiho is not null and not "끔"
           group by 1 having count(*) > 1) x
  union all
  select '이름열쇠', count(*), coalesce(sum(n) - count(*), 0)
    from (select "이름열쇠", count(*) as n from hosp_sites
           where "이름열쇠" is not null and not "끔" group by 1 having count(*) > 1) y;`));
console.log('── 기관 표 주소가 **언제** 담겼나 (아침 11:35 에 0 이던 것이 참인가) ──');
console.log(psql(머리 + `
  select ("고친때" at time zone 'Asia/Seoul')::date as 고친날,
         count(*) filter (where coalesce("홈페이지",'') <> '') as 홈페이지,
         count(*) filter (where coalesce("채용페이지",'') <> '') as 채용페이지
    from "기관" where coalesce("홈페이지",'') <> '' or coalesce("채용페이지",'') <> ''
   group by 1 order by 1 desc limit 8;`));
console.log('── 갈래 셈의 줄 수 ↔ 공고 수 ──');
console.log(psql(머리 + 이은것 + `
  select count(*) as "갈래셈_줄수", count(distinct id) as "공고수" from 차례;`));

console.log('\n══ 이어 보니 — 회원 화면 공고의 갈래 ══');
console.log(psql(머리 + 이은것 + `
  select 갈래, count(*) as 공고 from 차례 group by 1 order by 1;`));
console.log('── 연결상태별 (의심 「대기」는 위 셈에서 빠져 있습니다) ──');
console.log(psql(머리 + `
  select coalesce(p."연결상태",'(빈칸)') as 연결상태, count(*) as 회원화면,
         count(*) filter (where p."기관번호" like 'HIRA:%') as "심평원번호",
         count(*) filter (where p."기관번호" like 'NAME:%') as "이름으로"
    from job_posts p join job_posts_pub v on v.id = p.id group by 1 order by 2 desc;`));
console.log('── 사이트표를 어떻게 찾았나 ──');
console.log(psql(머리 + 이은것 + `
  select coalesce(사이트표_어떻게,'(못찾음)') as 어떻게, count(*) as 공고,
         count(*) filter (where 사이트표_채용주소 is not null) as "채용주소있음"
    from 차례 group by 1 order by 2 desc;`));

/* ★ ⑥ job_one 이 실제로 내리는 ① 과 위 셈을 **맞대어** 봅니다 (2026-10-28)
     마른 실행은 ① 19 라고 했고 job_one 실행 뒤 셈은 ① 18 입니다. 어느 줄이 다른지
     찍습니다 — 숫자가 다르면 자가 틀린 것입니다 (지침 10-5) */
console.log('\n══ ⑥ 마른 셈 ↔ job_one 이 내리는 것 (다른 줄만) ══');
/* ★ job_one 은 auth.uid() 가 없으면 **비회원 갈래**를 갑니다 — 회원 갈래를 재려면
   요청 claim 을 세웁니다 (이 연결에서만 · 자료는 안 건드립니다) */
const 회원되기 = String.raw`\o /dev/null
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', false);
\o
\pset pager off
`;
console.log(psql(회원되기 + 이은것 + `,
  둘 as (
    select c.id, c.org_name,
           (c.갈래 like '①%') as "마른이_①",
           (coalesce(j.detail->>'채용게시판','') <> '') as "job_one_①",
           c.기관표_채용페이지 is not null as "기관표",
           c.사이트표_채용주소 is not null as "사이트표",
           c."연결상태"
      from 차례 c
      /* ★ job_one 은 여러 줄 함수라 coalesce 안에서 못 부릅니다 — lateral 로 풉니다 */
      left join lateral job_one(c.id) j on true
  )
  select * from 둘 where "마른이_①" is distinct from "job_one_①";`));
console.log('── 둘의 셈 ──');
console.log(psql(회원되기 + 이은것 + `
  select count(*) filter (where c.갈래 like '①%') as "마른 셈 ①",
         count(*) filter (where coalesce(j.detail->>'채용게시판','') <> '') as "job_one ①"
    from 차례 c left join lateral job_one(c.id) j on true;`));

if (!표본수) {
  console.log('\n★ 아무것도 바꾸지 않았습니다 (읽기만). --표본 20 으로 주소를 열어 봅니다.');
  process.exit(0);
}

/* ── 표본 — ① 로 뽑힌 주소를 **열어** 봅니다 ── */
const 뽑기 = psql(머리 + 이은것 + `
  select id || E'\\t' || org_name || E'\\t' || 갈래 || E'\\t' || 쓸주소
    from 차례 where 갈래 like '①%' order by random() limit ${표본수};`, ['-X', '-A', '-t', '-q']);
const 줄들 = 뽑기.split('\n').map((l) => l.split('\t')).filter((a) => a.length === 4);
if (!줄들.length) {
  console.log('\n표본 — ① 로 뽑히는 공고가 **0 건**입니다 (열어 볼 것이 없습니다).');
  process.exit(0);
}
console.log('\n══ 표본 ' + 줄들.length + '건 — ① 주소를 열어 봅니다 ══');
let 이백 = 0, 이름보임 = 0;
for (const [id, 기관, , 주소] of 줄들) {
  let 코드 = '-', 제목 = '';
  try {
    const r = await fetch(주소, { redirect: 'follow', signal: AbortSignal.timeout(15000),
      /* ★ 헤더 값은 latin-1 입니다 — 한글을 넣으면 fetch 가 통째로 죽습니다 (지침 12) */
      headers: { 'user-agent': 'Mozilla/5.0 (potjob-check)' } });
    코드 = String(r.status);
    const 글 = (await r.text()).slice(0, 200000);
    제목 = (글.match(/<title[^>]*>([\s\S]{0,120}?)<\/title>/i)?.[1] || '').replace(/\s+/g, ' ').trim();
    if (r.status === 200) 이백 += 1;
    /* 그 기관의 채용 게시판인가 — 기관 이름의 앞 토막이 쪽 안에 있나 (지침 10-3: 짐작 안 함) */
    const 토막 = (기관.replace(/\(.*?\)|주식회사|의료법인|재단법인|사회복지법인/g, '').trim().slice(0, 4));
    if (토막.length >= 2 && (글.includes(토막) || 제목.includes(토막))) 이름보임 += 1;
  } catch (e) { 코드 = '✗ ' + String(e.message || e).slice(0, 40); }
  console.log([코드.padEnd(6), id.padEnd(20), 기관.slice(0, 22).padEnd(24),
    주소.slice(0, 68), 제목.slice(0, 40)].join(' '));
}
console.log('\n200 — ' + 이백 + '/' + 줄들.length + ' · 쪽에 기관 이름이 보인 것 — ' + 이름보임 + '/' + 줄들.length);
console.log('★ 아무것도 바꾸지 않았습니다 (읽기만).');
