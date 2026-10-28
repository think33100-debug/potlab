/* 손확인 ② 에 **세 절**을 더합니다 (2026-10-28 세중님 3번)
 *
 *   node tools/손확인_주소_절더하기_1028.mjs            화면에만 찍습니다
 *   node tools/손확인_주소_절더하기_1028.mjs --적기      docs/손확인_주소_1024.md 뒤에 붙입니다
 *
 * ── 세 절 ───────────────────────────────────────────────────
 *   ㉠ 사각지대 · 홈페이지는 있고 **게시판을 못 찾은 곳** (115곳)
 *      → 상급종합·대학병원·종합병원을 **위로** 올립니다 (1층에서 귀한 쪽)
 *   ㉡ **robots 금지** — 「손등록 후보」. 우리는 두드리지 않습니다 (세중님 울타리)
 *   ㉢ **사이트있음**(= HS3 땅)인데 게시판 주소가 없는 곳 — 홈만 18 · 둘 다 없음 128
 *      → 비우지 말고 「HS3 가 **어떻게** 긁는지」를 적어 둘 자리입니다
 *
 * 읽기만 합니다 (문서만 씁니다). DB 는 안 고칩니다.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const 뿌리 = path.join(import.meta.dirname, '..');
const 적기 = process.argv.includes('--적기');
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
  const 임시 = path.join(os.tmpdir(), '손확인절_' + process.pid + '.sql');
  fs.writeFileSync(임시, sql, 'utf8');
  const r = spawnSync('psql', ['-X', '-A', '-t', '-q', '-F', '\t', '-v', 'ON_ERROR_STOP=1', '-f', 임시],
    { encoding: 'utf8', maxBuffer: 1 << 26, env });
  fs.unlinkSync(임시);
  if (r.status) { console.error('✗ psql\n' + (r.stderr || '').slice(0, 900)); process.exit(1); }
  return (r.stdout || '').trimEnd();
}

/* 상태별·게시판 유무로 가른 목록. 차례는 **귀한 쪽 먼저** */
const 뽑기 = (상태, 게시판있나, 홈있나) => psql(`
  with 구멍 as (select * from "일층병원_구멍"()),
  이름 as materialized (
    select "견줄이름"(g."기관") as k, g."기관" as 기관, g."갈래" as 갈래,
           g."종류" as 종류, g."시도" as 시도, g."시군구" as 시군구
      from 구멍 g where g."상태" = '${상태}')
  select n.갈래, coalesce(n.종류,'') , n.기관, btrim(coalesce(n.시도,'') || ' ' || coalesce(n.시군구,'')),
         max(coalesce(o."홈페이지",'')) as 홈
    from 이름 n left join "기관" o on o."이름키" = n.k
   group by 1,2,3,4
  having ${게시판있나 ? '' : 'not '}bool_or(coalesce(o."채용페이지",'') <> '')
     and ${홈있나 ? '' : 'not '}bool_or(coalesce(o."홈페이지",'') <> '')
   order by case n.갈래 when '상급종합' then 1 when '대학병원' then 2
                        when '종합병원' then 3 when '공공보건의료' then 4 else 5 end,
            n.기관;`).split('\n').filter(Boolean).map((l) => l.split('\t'));

const 사각_홈만 = 뽑기('사각지대', false, true);
const 사이트_홈만 = 뽑기('사이트있음', false, true);
const 사이트_둘다없음 = 뽑기('사이트있음', false, false);

const 셈 = (들) => {
  const c = {};
  for (const [갈래] of 들) c[갈래] = (c[갈래] || 0) + 1;
  return Object.entries(c).map(([k, v]) => k + ' ' + v).join(' · ');
};
console.log('㉠ 사각지대 · 홈만 있음 — ' + 사각_홈만.length + '곳 (' + 셈(사각_홈만) + ')');
console.log('㉢ 사이트있음 · 홈만 있음 — ' + 사이트_홈만.length + '곳 (' + 셈(사이트_홈만) + ')');
console.log('㉢ 사이트있음 · 둘 다 없음 — ' + 사이트_둘다없음.length + '곳 (' + 셈(사이트_둘다없음) + ')');

/* robots 금지로 **우리가 못 두드린 곳** — 10/28 두 바퀴와 다시걸러에서 나온 이름 */
const robots막힘 = ['대구의료원', '목포한국병원', '의료법인 박애의료재단 박애병원',
  '의료법인갑을의료재단 갑을장유병원', '의료법인명지의료재단명지병원',
  '의료법인삼백의료재단상주성모병원', '의료법인한국의료재단 순천한국병원',
  '경기도립노인전문여주병원', '국립공주병원', '국립춘천병원'];

const 표 = (들, 끝칸) => ['| # | 갈래 | 기관 | 지역 | 홈페이지 | ' + 끝칸 + ' |',
  '|---:|---|---|---|---|---|',
  ...들.map(([갈래, , 기관, 지역, 홈], i) =>
    '| ' + (i + 1) + ' | ' + 갈래 + ' | ' + 기관 + ' | ' + (지역 || '') + ' | '
    + (홈 ? '[열기](' + 홈 + ')' : '') + ' |  |')].join('\n');

const 글 = `

---

# ★ 2026-10-28 보탬 (세중님 3번) — 세 절

\`\`\`
10/28 에 「주소 꼴 두드리기」를 두 바퀴(40곳) 돌렸고 **찾은 것이 0곳**이었습니다.
까닭 — robots 금지 9 · 홈페이지에 채용 링크 없음 21 · 링크는 있는데 목록 줄 0 9 · 못 받음 1
그래서 **자동으로는 더 안 열립니다.** 아래는 사람 손이 필요한 자리입니다
(docs/1층넓히기_1028.md ④).
\`\`\`

## ㉠ 사각지대인데 **홈페이지는 아는** 곳 — ${사각_홈만.length}곳

채용 게시판만 모릅니다. **상급종합·대학병원·종합병원을 위로** 올렸습니다 (1층에서 귀한 쪽).
끝 칸에 **공고 목록이 보이는 주소**를 적어 주시면 그대로 담습니다.
(없으면 **「없음」**, 채용을 안 올리는 곳이면 **「안 올림」**)

${표(사각_홈만, '채용 게시판 주소')}

## ㉡ **robots 금지** — 손등록 후보 ${robots막힘.length}곳

우리는 **두드리지 않습니다** (세중님 울타리 · 403 도 우회 금지). 그래서 이 곳들은
**사람이 보고 적는** 길밖에 없습니다. 끝 칸에 게시판 주소를 적어 주시면 담고,
긁지는 않습니다 — **주소만 회원에게 보여 줍니다**(지원하러 가기 ①).

| # | 기관 | 채용 게시판 주소 | 공고를 올리나 |
|---:|---|---|---|
${robots막힘.map((n, i) => '| ' + (i + 1) + ' | ' + n + ' |  |  |').join('\n')}

## ㉢ **HS3 가 긁는 곳**인데 게시판 주소가 표에 없는 곳

이 곳들은 **공고가 들어오고 있습니다**(사이트표에 줄이 있어 HS3 가 긁습니다).
그런데 기관 표에 채용페이지가 없어서 **회원에게 보여 줄 ① 주소가 없습니다.**
→ 비우지 말고, **HS3 가 어떻게 긁는지**(사이트표의 어느 주소로 들어오는지)를
적어 두는 자리입니다. 세중님이 채우실 것은 없습니다 — **제 숙제**입니다.

- 홈페이지는 아는 곳 — **${사이트_홈만.length}곳** (${셈(사이트_홈만)})
- 홈페이지도 모르는 곳 — **${사이트_둘다없음.length}곳** (${셈(사이트_둘다없음)})

\`\`\`
할 일 (제 몫)   사이트표(hosp_sites)의 url·채용주소를 기관 표로 **옮겨 붙이기** —
               이름열쇠로 이미 158곳이 그렇게 들어왔습니다. 남은 곳은 이름이 안 맞는 것입니다
               → 기관번호(ykiho)로 잇는 길을 먼저 봅니다 (hosp_sites.ykiho 266줄)
\`\`\`
`;

/* ★ 서버에서는 **문서를 적지 않습니다** — docs/ 도 저장소 파일이라 `git pull` 로만
   갑니다 (지침 8-10). 그래서 `--내보내기` 로 글만 찍고, 붙이는 것은 손에서 합니다 */
if (process.argv.includes('--내보내기')) { process.stdout.write(글); process.exit(0); }
if (!적기) { console.log('\n[마른] 문서에 안 붙였습니다 — --내보내기 로 글을 받아 손에서 붙입니다\n'); process.exit(0); }
const 자리 = path.join(뿌리, 'docs', '손확인_주소_1024.md');
const 전 = fs.readFileSync(자리, 'utf8');
if (전.includes('★ 2026-10-28 보탬 (세중님 3번)')) {
  console.log('이미 붙어 있습니다 — 그 아래를 지우고 다시 붙입니다');
  fs.writeFileSync(자리, 전.slice(0, 전.indexOf('\n---\n\n# ★ 2026-10-28 보탬')) + 글, 'utf8');
} else {
  fs.writeFileSync(자리, 전.trimEnd() + 글, 'utf8');
}
console.log('○ 붙였습니다 — docs/손확인_주소_1024.md (전 ' + 전.split('\n').length
  + '줄 → 후 ' + fs.readFileSync(자리, 'utf8').split('\n').length + '줄)');
