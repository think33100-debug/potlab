/* ㉡ **별명 아홉 줄**을 손확인 ① 문서에 보탭니다 (2026-10-25 세중님 1번)
 *
 *   node tools/별명후보_손확인에.mjs            봅니다 (마른)
 *   node tools/별명후보_손확인에.mjs --적기      docs/손확인_매핑_1024.md 끝에 붙입니다
 *
 * ── 무엇 ─────────────────────────────────────────────────────
 * 회원 화면 공고 가운데 **이름 글자가 심평원과 달라** 번호로 못 붙는 **병원 꼴 9곳**입니다
 * (docs/정확도_1025.md 3-2). 기관은 심평원에 **있는데** 열쇠(이름키)가 다릅니다 —
 *   「사회복지법인 삼동회 정읍시립요양병원」 ↔ 심평원 「정읍시립요양병원」
 *   「서울특별시 서초구 보건소」            ↔ 심평원 「서초구보건소」
 *
 * ── 어떻게 후보를 고르나 (짐작 아님) ────────────────────────
 * 우리 이름에서 **법인·재단·행정구역 말을 떼고 남는 꼬리 글자**(네 자 이상)를 심평원
 * 이름에서 찾습니다. 찾은 것을 **그대로 다 보여 드립니다** (번호·종별·지역·주소) —
 * 제가 고르지 않습니다. 세중님이 「바꿀 번호」 칸에 적으면 `손확인_매핑_읽기.mjs` 가 붙입니다.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const 뿌리 = path.join(import.meta.dirname, '..');
const 적기 = process.argv.includes('--적기');
const 문서자리 = path.join(뿌리, 'docs', '손확인_매핑_1024.md');
export const 머리 = '## 별명 아홉 줄 — **이름 글자가 심평원과 다른 병원**';

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
  const 임시 = path.join(os.tmpdir(), '별명_' + process.pid + '.sql');
  fs.writeFileSync(임시, sql, 'utf8');
  const r = spawnSync('psql', ['-X', '-A', '-t', '-q', '-F', '\t', '-v', 'ON_ERROR_STOP=1', '-f', 임시],
    { encoding: 'utf8', maxBuffer: 1 << 26, env });
  fs.unlinkSync(임시);
  if (r.status) { console.error('✗ psql\n' + (r.stderr || '').slice(0, 800)); process.exit(1); }
  return (r.stdout || '').trimEnd();
}

/* ── 그 아홉 곳을 **DB 에서 다시 고릅니다** (목록을 손으로 박지 않습니다) ── */
const 줄들 = psql(`
  with n as materialized (
    select j.org_name, count(*) as 공고,
           count(*) filter (where j.id in (select id from job_posts_pub)) as 회원화면,
           min(j.id) as 견본
      from job_posts j
     where j.id in (select id from job_posts_pub) and j."기관번호" like 'NAME:%'
       and j.org_name ~ '(병원|의원|한의원|치과|의료원|보건소)'
     group by 1
  )
  select n.org_name, n.공고::text, n.회원화면::text, n.견본,
         /* 꼬리 글자 — 법인·행정구역 말을 뗀 뒤 **뒤쪽 6자**로 심평원을 찾습니다 */
         right(regexp_replace(hira_name_key(n.org_name),
            '(의료법인|재단법인|학교법인|사회복지법인|사단법인|주식회사|의료재단|복지재단|특별시|광역시|특별자치도)', '', 'g'), 6) as 꼬리,
         /* ★ 후보는 **넷까지만** 보여 드립니다 — 「재활의학과병원」처럼 흔한 꼬리는
            수십 곳이 걸립니다. 그 수도 함께 적어 세중님이 「흔한 이름이구나」를 알게 합니다.
            ★ limit 은 **집계 안쪽**에 있어야 합니다 (바깥에 쓰면 한 줄이라 아무것도 안 잘립니다) */
         coalesce((select string_agg(x.s, ' ## ') from (
                     select h.yadm_nm || ' [' || h.cl_cd_nm || ' · ' || h.sido_nm || ' '
                            || coalesce(h.sggu_nm,'') || '] HIRA:' || h.ykiho as s
                       from hira_org h
                      where h.name_key like '%' || right(regexp_replace(hira_name_key(n.org_name),
                            '(의료법인|재단법인|학교법인|사회복지법인|사단법인|주식회사|의료재단|복지재단|특별시|광역시|특별자치도)', '', 'g'), 6) || '%'
                        and length(right(regexp_replace(hira_name_key(n.org_name),
                            '(의료법인|재단법인|학교법인|사회복지법인|사단법인|주식회사|의료재단|복지재단|특별시|광역시|특별자치도)', '', 'g'), 6)) >= 4
                      order by h.yadm_nm limit 4) x), '(비슷한 이름 못 찾음)') as 후보,
         (select count(*) from hira_org h
           where h.name_key like '%' || right(regexp_replace(hira_name_key(n.org_name),
                 '(의료법인|재단법인|학교법인|사회복지법인|사단법인|주식회사|의료재단|복지재단|특별시|광역시|특별자치도)', '', 'g'), 6) || '%'
             and length(right(regexp_replace(hira_name_key(n.org_name),
                 '(의료법인|재단법인|학교법인|사회복지법인|사단법인|주식회사|의료재단|복지재단|특별시|광역시|특별자치도)', '', 'g'), 6)) >= 4)::text as 후보수
    from n order by n.회원화면 desc, n.공고 desc;`);

const 곳들 = 줄들.split('\n').filter(Boolean).map((l) => {
  const [이름, 공고, 회원화면, 견본, 꼬리, ...나머지] = l.split('\t');
  return { 이름, 공고, 회원화면, 견본, 꼬리, 후보: 나머지.join('\t') };
});
console.log('병원 꼴인데 심평원에 이름이 없는 곳 ' + 곳들.length + '곳\n');
for (const x of 곳들) {
  console.log('■ ' + x.이름 + '  (공고 ' + x.공고 + ' · 회원 화면 ' + x.회원화면
    + ' · 꼬리 「' + x.꼬리 + '」 · 심평원에 비슷한 이름 ' + x.후보수 + '곳)');
  for (const c of String(x.후보).split('\\n')) console.log('    후보 — ' + c);
}

if (!적기) { console.log('\n[마른] 문서에 안 붙였습니다 — --적기 로 붙입니다'); process.exit(0); }

const 줄 = ['', 머리 + ' (' + 곳들.length + '곳 · 2026-10-25)', '',
  '기관은 심평원에 **있는데** 이름 글자가 달라 번호로 못 붙습니다. 그래서 회원 화면에',
  '**기관 정보(주소·전화·홈페이지)가 안 붙습니다** — 공고 자체는 멀쩡히 보입니다.', '',
  '```',
  '채우는 법   후보 가운데 **맞는 것의 번호**(HIRA:…)를 「바꿀 번호」 칸에 그대로 적습니다',
  '           맞는 후보가 없으면 **아님** 이라고 적어 주십시오 (기관 없음으로 둡니다)',
  '★ 제가 고르지 않았습니다 — 꼬리 글자로 찾은 것을 **그대로** 보여 드립니다 (지침 10-3)',
  '```', '',
  '| 기관(공고 이름) | 공고 | 회원 화면 | 심평원 후보 (번호 · 종별 · 지역) | 견본 공고 | 맞음/아님 | 바꿀 번호 |',
  '|---|---:|---:|---|---|---|---|'];
for (const x of 곳들) {
  const 후보칸 = String(x.후보).split('\\n').map((c) => c.trim()).filter(Boolean)
    .map((c) => '`' + c + '`').join(' <br>');
  줄.push('| ' + String(x.이름).replace(/\|/g, '/') + ' | ' + x.공고 + ' | ' + x.회원화면
    + ' | ' + (후보칸 || '(없음)') + ' | ' + x.견본 + ' |  |  |');
}
const 옛 = fs.readFileSync(문서자리, 'utf8');
const 새 = 옛.includes(머리)
  ? 옛.slice(0, 옛.indexOf(머리)).trimEnd() + '\n' + 줄.join('\n') + '\n'
  : 옛.trimEnd() + '\n' + 줄.join('\n') + '\n';
fs.writeFileSync(문서자리, 새, 'utf8');
console.log('\n○ docs/손확인_매핑_1024.md 끝에 붙였습니다 — ' + 곳들.length + '곳');
