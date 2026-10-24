/* 공고 → 기관 **매칭 점검** (2026-10-24 세중님 M1·M2 · 정확도 1순위)
 *
 *   node tools/매핑점검_1024.mjs            봅니다 (읽기만)
 *   node tools/매핑점검_1024.mjs --손확인    docs/손확인_매핑_1024.md 를 만듭니다
 *
 * ── 무엇을 보나 ──────────────────────────────────────────────
 *   M1  회원 화면 288건이 **번호로 / 이름으로 / 안 붙음** 몇 건인가 · 안 붙은 것 목록
 *   M2  **이름으로 붙은 것 전수** — 「동명 기관을 한 묶음으로 본 것」을 찾습니다
 *       ① 한 `NAME:<이름키>` 에 공고의 **시도가 둘 이상** → 의심
 *          (「북구노인종합복지관」 부산·대구·광주가 한 기관으로 묶이는 꼴 ·
 *           sql/2026-10-08_기관표_1단계.sql 의 「알려 둔 한계」가 이것입니다)
 *       ② 심평원에 **그 이름을 품은 공식 이름**이 둘 이상 → 의심 (더 긴 이름과 헷갈림)
 *       ③ 이름키가 **너무 짧음**(글자 4자 이하) → 의심
 *   의심 건은 **회원 화면에 기관 정보를 붙이지 않습니다** — 붙이는 자리는
 *   11/1~6 화면 작업이고, 그때 `기관.확인한때` 가 없는 의심 건은 빼고 그립니다.
 *
 * ★ 읽기만 합니다. 매칭을 **짐작으로 고치지 않습니다** (지침 10-3) —
 *   고치는 길은 세중님이 손확인 문서를 채우고 `tools/손확인_매핑_읽기.mjs` 가 읽는 것입니다.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 손확인만들기 = process.argv.includes('--손확인');

const cfg = {};
for (const f of ['.env', '.env.local']) {
  if (!fs.existsSync(f)) continue;
  for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !cfg[m[1]]) cfg[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
if (!cfg.SUPABASE_DB_URL) { console.error('✗ SUPABASE_DB_URL 이 없습니다'); process.exit(1); }
const u = new URL(cfg.SUPABASE_DB_URL);
const env = {
  ...process.env,
  PGHOST: u.hostname, PGPORT: u.port || '5432',
  PGUSER: decodeURIComponent(u.username), PGPASSWORD: decodeURIComponent(u.password),
  PGDATABASE: decodeURIComponent(u.pathname.replace(/^\//, '')) || 'postgres',
  PGSSLMODE: u.searchParams.get('sslmode') || 'require',
};
function psql(sql, 꼴 = ['-X', '-A', '-q', '-F', '\t']) {
  const 임시 = path.join(os.tmpdir(), '매핑점검_' + process.pid + '.sql');
  fs.writeFileSync(임시, sql, 'utf8');
  const r = spawnSync('psql', [...꼴, '-v', 'ON_ERROR_STOP=1', '-f', 임시],
    { encoding: 'utf8', maxBuffer: 1 << 28, env });
  fs.unlinkSync(임시);
  if (r.status) { console.error('✗ psql\n' + (r.stderr || '').slice(0, 900)); process.exit(1); }
  return (r.stdout || '').trimEnd();
}
const 줄로 = (sql) => psql(sql, ['-X', '-A', '-t', '-q', '-F', '\t'])
  .split('\n').filter(Boolean).map((l) => l.split('\t'));

console.log('══ M1 회원 화면 매칭 ══\n');
console.log(psql(`
  select coalesce(p."연결상태",'(안 붙음)') as 연결상태, count(*) as 공고,
         count(*) filter (where p."기관번호" like 'HIRA:%') as 번호로,
         count(*) filter (where p."기관번호" like 'NAME:%') as 이름으로
    from job_posts p join job_posts_pub v on v.id = p.id
   group by 1 order by 2 desc;`));

const 안붙음 = 줄로(`
  select p.id, p.source, p.org_name, left(p.title, 50), coalesce(p."연결상태",'(빈칸)'),
         coalesce(p.sido,''), coalesce(p.sgg,'')
    from job_posts p join job_posts_pub v on v.id = p.id
   where p."기관번호" is null order by p.id;`);
console.log('\n── 안 붙은 공고 ' + 안붙음.length + '건 (기관 이름 원문) ──');
for (const [id, src, org, 제목, 상태, 시도, 시군구] of 안붙음) {
  console.log('  ● ' + id + ' [' + src + '] ' + 상태 + ' · ' + 시도 + ' ' + 시군구
    + '\n      기관 「' + org + '」\n      제목 ' + 제목);
}

console.log('\n══ M2 이름으로 붙은 것 전수 점검 ══\n');
/* 이름으로 붙은 기관마다 — 공고의 시도 가짓수 · 심평원에 그 이름을 품은 곳 수 */
const 이름것 = 줄로(`
  with 이름붙음 as (
    select p."기관번호", o.이름키, o.이름,
           count(*) as 공고,
           count(*) filter (where v.id is not null) as 회원화면,
           count(distinct nullif(p.sido,'')) as 시도수,
           string_agg(distinct nullif(p.sido,''), '·') as 시도들,
           min(p.id) as 견본공고, min(p.org_name) as 견본기관이름
      from job_posts p
      left join job_posts_pub v on v.id = p.id
      join 기관 o on o.기관번호 = p."기관번호"
     where p."기관번호" like 'NAME:%'
     group by 1, 2, 3
  )
  select i."기관번호", i.이름키, i.이름, i.공고::text, i.회원화면::text,
         i.시도수::text, coalesce(i.시도들,''),
         (select count(*) from hira_org h where h.name_key like '%' || i.이름키 || '%')::text as 품은곳,
         length(i.이름키)::text, i.견본공고, i.견본기관이름
    from 이름붙음 i
   order by i.회원화면 desc, i.공고 desc;`);

const 의심 = [];
for (const r of 이름것) {
  const [기관번호, 이름키, 이름, 공고, 회원화면, 시도수, 시도들, 품은곳, 키길이, 견본공고, 견본이름] = r;
  const 까닭 = [];
  if (Number(시도수) > 1) 까닭.push('공고 시도가 ' + 시도수 + '곳 (' + 시도들 + ')');
  if (Number(품은곳) > 1) 까닭.push('심평원에 그 이름을 품은 곳 ' + 품은곳 + '곳');
  if (Number(키길이) <= 4) 까닭.push('이름키가 짧음(' + 키길이 + '자)');
  if (까닭.length) 의심.push({ 기관번호, 이름키, 이름, 공고, 회원화면, 까닭, 견본공고, 견본이름 });
}
console.log('이름으로 붙은 기관 ' + 이름것.length + '곳 · **매칭 의심 ' + 의심.length + '곳**');
console.log('  (의심 까닭 ① 공고 시도가 둘 이상 ② 심평원에 그 이름을 품은 곳이 둘 이상 ③ 이름키가 짧음)\n');
for (const x of 의심.slice(0, 40)) {
  console.log('  ● ' + x.이름.slice(0, 24).padEnd(25) + '공고 ' + String(x.공고).padStart(3)
    + ' (회원 화면 ' + x.회원화면 + ') · ' + x.까닭.join(' · '));
}

if (손확인만들기) {
  const 줄 = ['# 손확인 ① — **공고 ↔ 기관 매칭 의심** (2026-10-24)', '',
    '세중님이 「맞음/아님」 칸만 채워 주시면 `tools/손확인_매핑_읽기.mjs` 가 읽어',
    '기관 번호로 확정합니다 (칸기록에 남깁니다). **제가 짐작으로 고치지 않습니다.**', '',
    '```', '채우는 법   「맞음」 이면 그 기관으로 둡니다 · 「아님」 이면 기관 없음으로 되돌립니다',
    '           후보 번호를 적으면 **그 번호로** 바꿉니다 (HIRA:… 또는 NAME:…)', '```', '',
    '## ★ 먼저 — **안 붙은 공고** (대기 · 심평원에 동명이 여럿)', '',
    '| 공고 | 제목 | 기관 이름 원문 | 공고 지역 | 심평원 후보 (번호 · 지역 · 주소) | 고를 번호 |',
    '|---|---|---|---|---|---|'];
  /* ★ 2026-10-24 세중님 4번 — 안 붙은 것(대기)을 **맨 위에** 둡니다.
     후보는 심평원에서 **이름키가 같은 곳**을 주소까지 적어 올립니다 (짐작 금지) */
  for (const [id, , org, 제목, , 시도, 시군구] of 안붙음) {
    const 후보 = 줄로("select h.ykiho, coalesce(h.sido_nm,'')||' '||coalesce(h.sggu_nm,''),"
      + " coalesce(h.addr,'') from hira_org h"
      + " where h.name_key = hira_name_key('" + String(org).replace(/'/g, "''") + "')"
      + ' order by h.yadm_nm limit 4;');
    const 후보글 = 후보.length
      ? 후보.map(([y, 지역, 주소]) => '<code>HIRA:' + y + '</code> ' + 지역
        + ' · ' + String(주소).slice(0, 34)).join(' <br>')
      : '(심평원에 그 이름이 없습니다)';
    줄.push('| ' + id + ' | ' + String(제목).replace(/\|/g, '/').slice(0, 34)
      + ' | 「' + String(org).replace(/\|/g, '/') + '」 | ' + 시도 + ' ' + 시군구
      + ' | ' + 후보글 + ' |  |');
  }
  줄.push('', '★ 후보가 여럿이면 **지역이 맞는 것**을 골라 번호를 적어 주십시오 (번호 전체를 적어 두었습니다).',
    '', '## 이름으로 붙은 묶음 — 매칭 의심', '',
    '| 기관(지금 묶음) | 공고 | 회원 화면 | 의심 까닭 | 견본 공고 | 맞음/아님 | 바꿀 번호 |',
    '|---|---:|---:|---|---|---|---|');
  for (const x of 의심) {
    줄.push('| ' + x.이름.replace(/\|/g, '/') + ' <br><code>' + x.기관번호 + '</code> | '
      + x.공고 + ' | ' + x.회원화면 + ' | ' + x.까닭.join(' · ')
      + ' | ' + x.견본공고 + ' <br>「' + String(x.견본이름).replace(/\|/g, '/').slice(0, 30) + '」'
      + ' |  |  |');
  }
  줄.push('', '★ 「회원 화면」 숫자가 0 인 줄은 급하지 않습니다 — 보류함·숨김 공고입니다.',
    '★ 의심 건은 **회원 화면에 기관 정보를 붙이지 않습니다** (11/1~6 화면 작업 때 그 규칙으로).');
  const 낼곳 = path.join(여기, '..', 'docs', '손확인_매핑_1024.md');
  fs.writeFileSync(낼곳, 줄.join('\n') + '\n');
  console.log('\n○ docs/손확인_매핑_1024.md 에 적었습니다 (' + 의심.length + '줄)');
}

console.log('\n══ 매칭률 (아침 메일에 넣을 숫자) ══');
console.log(psql(`
  select count(*) as 회원화면,
         round(100.0 * count(*) filter (where p."기관번호" like 'HIRA:%') / greatest(count(*),1)) || '%' as 번호로,
         round(100.0 * count(*) filter (where p."기관번호" like 'NAME:%') / greatest(count(*),1)) || '%' as 이름으로,
         count(*) filter (where p."기관번호" is null) as 안붙음
    from job_posts p join job_posts_pub v on v.id = p.id;`));
console.log('\n★ 아무것도 바꾸지 않았습니다.');
