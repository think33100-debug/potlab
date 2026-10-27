/* 손확인 ① **오늘 볼 짧은 표** — 별명 줄 + 안 붙은 공고 (2026-10-27 세중님 3번)
 *
 *   node tools/손확인_오늘_1027.mjs            봅니다 (읽기만 · 전제 확인도 함께)
 *   node tools/손확인_오늘_1027.mjs --적기      docs/손확인_오늘_1027.md 를 만듭니다
 *
 * ── 왜 따로 ──────────────────────────────────────────────────
 * 손확인 ① 문서는 60줄이 넘습니다. 세중님이 **오늘 볼 것**은 그 가운데
 *   ㉠ 별명 줄 — 기관이 심평원에 **있는데** 이름 글자가 달라 번호로 못 붙는 곳
 *   ㉡ 안 붙은 공고 — 심평원에 **동명이 여럿**이라 기다리는 공고
 * 둘뿐입니다 (2026-10-27 세중님 3번 — 「세중이 오늘 볼 것은 이 11줄 + ② 주소 38곳」).
 *
 * ── 후보는 펼쳐 적습니다 ───────────────────────────────────
 * 「심평원에 8곳」 같은 **숫자만**으로는 고를 수 없습니다. `tools/심평원후보.mjs` 의
 * 규칙으로 **넷까지** 「이름 · 종별 · 시군구 · 번호」로 펼칩니다. 제가 고르지 않습니다.
 *
 * ── 채운 뒤 ─────────────────────────────────────────────────
 *   node tools/손확인_매핑_읽기.mjs --진짜     (이 문서도 함께 읽습니다)
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { 뗄말, 후보SQL, 후보칸, 이층인가 } from './심평원후보.mjs';

const 뿌리 = path.join(import.meta.dirname, '..');
const 적기 = process.argv.includes('--적기');
const 낼곳 = path.join(뿌리, 'docs', '손확인_오늘_1027.md');

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
  const 임시 = path.join(os.tmpdir(), '손확인오늘_' + process.pid + '.sql');
  fs.writeFileSync(임시, sql, 'utf8');
  const r = spawnSync('psql', [...꼴, '-v', 'ON_ERROR_STOP=1', '-f', 임시],
    { encoding: 'utf8', maxBuffer: 1 << 26, env });
  fs.unlinkSync(임시);
  if (r.status) { console.error('✗ psql\n' + (r.stderr || '').slice(0, 900)); process.exit(1); }
  return (r.stdout || '').trimEnd();
}
const 줄로 = (sql) => psql(sql).split('\n').filter(Boolean).map((l) => l.split('\t'));

/** 이름키의 **꼬리 6자** — 별명 후보를 찾는 열쇠입니다 (별명후보_손확인에.mjs 와 같은 규칙) */
const 꼬리식 = (칸) => "right(regexp_replace(hira_name_key(" + 칸 + "), '" + 뗄말 + "', '', 'g'), 6)";

/* ══ 0) 전제 확인 — 세중님이 「맞음」이라 하신 제주의료원 묶음 전수 ══ */
console.log('══ 0) 전제 확인 — NAME:제주의료원 묶음 전수 ══');
const 제주 = 줄로(`
  select p.id, p.source, coalesce(p.sido,'') || ' ' || coalesce(p.sgg,''),
         p.org_name, case when v.id is null then '-' else '회원화면' end, left(p.title, 40)
    from job_posts p left join job_posts_pub v on v.id = p.id
   where p."기관번호" = 'NAME:제주의료원' order by (v.id is null), p.id;`);
for (const [id, src, 지역, 이름, 눈, 제목] of 제주) {
  console.log('  ' + (눈 === '회원화면' ? '★' : ' ') + ' ' + id.padEnd(20) + '[' + src + '] '
    + 지역.padEnd(12) + '「' + 이름 + '」 ' + 제목);
}
console.log('  → 제주가 아닌 지역이 섞여 있으면 「맞음」 전제가 깨집니다\n');

/* ══ 1) 안 붙은 공고 — 회원 화면에 있고 기관번호가 없는 것 ══ */
const 안붙음 = 줄로(`
  select p.id, p.source, coalesce(p.sido,'') || ' ' || coalesce(p.sgg,''), p.org_name,
         left(p.title, 38),
         ${후보SQL('hira_name_key(p.org_name)', 4, '같음')},
         ${후보SQL(꼬리식('p.org_name'))},
         (select count(*) from hira_org h where h.name_key = hira_name_key(p.org_name))::text
    from job_posts p join job_posts_pub v on v.id = p.id
   where p."기관번호" is null order by p.id;`);
console.log('══ 1) 안 붙은 공고 ' + 안붙음.length + '건 ══');
for (const [id, src, 지역, 이름, 제목, 딱, 꼬리후보, 딱수] of 안붙음) {
  console.log('  ● ' + id + ' [' + src + '] ' + 지역 + ' 「' + 이름 + '」 ' + 제목);
  console.log('      후보(이름 딱 같음 ' + 딱수 + '곳) — ' + String(딱).split(' ## ').join('\n                                    '));
  if (Number(딱수) === 0) console.log('      후보(꼬리로) — ' + String(꼬리후보).split(' ## ').join('\n                      '));
}

/* ══ 2) 별명 줄 — 병원 꼴인데 심평원에 이름이 없어 번호로 못 붙는 곳 ══ */
const 별명 = 줄로(`
  with n as materialized (
    select j."기관번호", j.org_name, count(*) as 공고,
           count(*) filter (where j.id in (select id from job_posts_pub)) as 회원화면,
           min(j.id) as 견본
      from job_posts j
     where j.id in (select id from job_posts_pub) and j."기관번호" like 'NAME:%'
       and j.org_name ~ '(병원|의원|한의원|치과|의료원|보건소)'
     group by 1, 2
  )
  select n."기관번호", n.org_name, n.공고::text, n.회원화면::text, n.견본,
         ${후보SQL(꼬리식('n.org_name'))},
         (select count(*) from hira_org h
           where h.name_key like '%' || ${꼬리식('n.org_name')} || '%')::text
    from n order by n.회원화면 desc, n.공고 desc, n.org_name;`);
console.log('\n══ 2) 별명 줄 ' + 별명.length + '곳 ══');
for (const [번호, 이름, 공고, 눈, 견본, 후보, 후보수] of 별명) {
  console.log('  ■ ' + 이름 + '  (공고 ' + 공고 + ' · 회원 화면 ' + 눈
    + ' · 심평원에 비슷한 이름 ' + 후보수 + '곳 · ' + 번호 + ')');
  for (const c of String(후보).split(' ## ')) console.log('      후보 — ' + c);
}

/* ══ 3) 2층 업체 — 세중님 목록에서 뺄 것 (2026-10-27 세중님 2번) ══ */
const 이름붙음 = 줄로(`
  with m as (
    select p."기관번호" as 번호, min(p.org_name) as 이름, count(*) as 공고,
           count(*) filter (where exists (select 1 from job_posts_pub v where v.id = p.id)) as 회원화면
      from job_posts p where p."기관번호" like 'NAME:%' group by 1
  )
  select m.번호, m.이름, m.공고::text, m.회원화면::text,
         (select count(*) from hira_org h where h.name_key = hira_name_key(m.이름))::text
    from m order by m.회원화면 desc, m.공고 desc;`);
const 이층 = 이름붙음.filter(([, 이름, , , 딱수]) => 이층인가(이름, 딱수));
console.log('\n══ 3) 2층 업체 (심평원 밖) ' + 이층.length + '곳 — 세중님 목록에서 뺍니다 ══');
for (const [번호, 이름, 공고, 눈] of 이층) {
  console.log('  · ' + 이름.padEnd(26) + '공고 ' + String(공고).padStart(3)
    + ' · 회원 화면 ' + 눈 + ' · ' + 번호);
}

if (!적기) { console.log('\n[마른] 문서를 안 만들었습니다 — --적기 로 만듭니다'); process.exit(0); }

const 글 = ['# 손확인 ① — **오늘 볼 것** (2026-10-27)', '',
  '세중님이 오늘 볼 것은 **이 ' + (안붙음.length + 별명.length) + '줄**입니다.',
  '주소 쪽(② 38곳)은 [`손확인_주소_1024.md`](손확인_주소_1024.md) 입니다.', '',
  '## 채우는 법 (3줄)', '',
  '1. 후보 가운데 맞는 것이 있으면 그 **번호(`HIRA:…`)를 맨 끝 칸에 그대로** 적습니다.',
  '2. 맞는 후보가 **없으면** 「맞음/아님」 칸에 **아님** 이라고 적습니다 (기관 없음으로 둡니다).',
  '3. 지금 묶음이 맞으면 **맞음** 이라고 적습니다 (그 기관으로 둡니다).', '',
  '읽는 길 — `node tools/손확인_매핑_읽기.mjs --진짜` (이 문서도 함께 읽습니다)', '',
  '★ 제가 고르지 않았습니다 — 심평원에서 **찾은 것 그대로** 넷까지 적었습니다 (지침 10-3).', '',
  '## ㉠ 안 붙은 공고 — ' + 안붙음.length + '건 (심평원에 동명이 여럿)', '',
  '| 공고 <br>(이름 원문) | 제목 | 공고 지역 | 심평원 후보 (이름 · 종별 · 시군구 · 번호) | 견본 | 맞음/아님 | 고를 번호 |',
  '|---|---|---|---|---|---|---|'];
for (const [id, src, 지역, 이름, 제목, 딱, 꼬리후보, 딱수] of 안붙음) {
  글.push('| 「' + String(이름).replace(/\|/g, '/') + '」 <br><code>POST:' + id + '</code> | '
    + String(제목).replace(/\|/g, '/') + ' | ' + 지역 + ' | '
    + 후보칸(Number(딱수) > 0 ? 딱 : 꼬리후보)
    + (Number(딱수) === 0 ? ' <br>*(이름이 딱 같은 곳은 없어 꼬리 글자로 찾았습니다)*' : '')
    + ' | ' + id + ' [' + src + '] |  |  |');
}
글.push('', '## ㉡ 별명 줄 — ' + 별명.length + '곳 (심평원에 있는데 이름 글자가 다름)', '',
  '기관 정보(주소·전화·홈페이지)가 **안 붙습니다** — 공고 자체는 멀쩡히 보입니다.', '',
  '| 기관(공고 이름) | 공고 | 회원 화면 | 심평원 후보 (이름 · 종별 · 시군구 · 번호) | 견본 공고 | 맞음/아님 | 바꿀 번호 |',
  '|---|---:|---:|---|---|---|---|');
for (const [번호, 이름, 공고, 눈, 견본, 후보, 후보수] of 별명) {
  글.push('| ' + String(이름).replace(/\|/g, '/') + ' <br><code>' + 번호 + '</code> | '
    + 공고 + ' | ' + 눈 + ' | ' + 후보칸(후보)
    + (Number(후보수) > 4 ? ' <br>*(비슷한 이름 ' + 후보수 + '곳 가운데 넷)*' : '')
    + ' | ' + 견본 + ' |  |  |');
}
글.push('', '## 제가 처리한 것 — **2층 업체 ' + 이층.length + '곳** (세중님이 볼 것 아님)', '',
  '요양원·방문요양·주식회사 꼴이고 **심평원에 그 이름이 없는 곳**입니다. 1층 대상이',
  '아니므로(CLAUDE.md 「1층 대상 기준」) **기관 없음(2층)** 으로 둡니다.', '',
  '| 기관 | 공고 | 회원 화면 | 번호 |', '|---|---:|---:|---|');
for (const [번호, 이름, 공고, 눈] of 이층) {
  글.push('| ' + String(이름).replace(/\|/g, '/') + ' | ' + 공고 + ' | ' + 눈
    + ' | <code>' + 번호 + '</code> |');
}
글.push('', '★ 1층 꼴 낱말(병원·의원·보건소·의료원·대학교…)이 이름에 있으면 **자동으로 빼지',
  '않습니다** — 「○○요양병원」은 공공일 수 있어 세중님이 볼 자리입니다 (tools/심평원후보.mjs).');
fs.writeFileSync(낼곳, 글.join('\n') + '\n', 'utf8');
console.log('\n○ docs/손확인_오늘_1027.md — 안 붙은 공고 ' + 안붙음.length
  + '건 · 별명 ' + 별명.length + '곳 · 2층 ' + 이층.length + '곳');
console.log('★ 아무것도 바꾸지 않았습니다 (문서만).');
