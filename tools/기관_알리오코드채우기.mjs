/* `기관.알리오코드` 를 알리오 **목록 응답**에서 채웁니다 (2026-10-24 세중님 ㉯)
 *
 *   node tools/기관_알리오코드채우기.mjs            봅니다 (안 바꿉니다)
 *   node tools/기관_알리오코드채우기.mjs --진짜      채웁니다
 *
 * ── 왜 목록인가 ──────────────────────────────────────────────
 * 세중님 지시 — 「알리오코드는 응답에 오는지 **먼저 두드려 원문 찍고** 칸 채움」.
 * 두드려 봤습니다 (2026-10-24) — **목록 응답에 이미 옵니다** —
 *
 *   pblntInstCd      C0331        ← 알리오 기관 코드
 *   pbadmsStdInstCd  B552907      ← 공공행정 표준 기관 코드
 *   instNm           (재)우체국물류지원단
 *
 * 상세를 안 두드려도 됩니다. 이 도구는 목록 몇 쪽만 받아(100건/쪽) **기관 이름 →
 * 코드** 표를 만들고, 이름키로 `기관` 줄에 올려 붙입니다.
 *
 * ★ 한 이름키에 코드가 **둘 이상이면 안 채웁니다** (짐작 금지 · 지침 10-3).
 * ★ 이미 찬 칸·`확인한때`가 있는 줄은 안 건드립니다.
 * ★ 수집기(collect-alio.mjs)도 2026-10-24 부터 `detail.알리오기관코드` 로 담습니다 —
 *   다음부터는 새 공고가 알아서 밑감을 남깁니다 (추가 호출 0).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const 진짜 = process.argv.includes('--진짜');
const 쪽수 = Number((process.argv.find((a) => a.startsWith('--쪽=')) || '').split('=')[1] || 8);

const cfg = {};
for (const f of ['.env', '.env.local']) {
  if (!fs.existsSync(f)) continue;
  for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z_0-9]+)=(.*)$/);
    if (m && !cfg[m[1]]) cfg[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}
if (!cfg.ALIO_LIST_KEY) { console.error('✗ ALIO_LIST_KEY 가 없습니다 (서버에서 돌리십시오)'); process.exit(1); }
if (!cfg.SUPABASE_DB_URL) { console.error('✗ SUPABASE_DB_URL 이 없습니다'); process.exit(1); }

const u = new URL(cfg.SUPABASE_DB_URL);
const env = {
  ...process.env,
  PGHOST: u.hostname, PGPORT: u.port || '5432',
  PGUSER: decodeURIComponent(u.username), PGPASSWORD: decodeURIComponent(u.password),
  PGDATABASE: decodeURIComponent(u.pathname.replace(/^\//, '')) || 'postgres',
  PGSSLMODE: u.searchParams.get('sslmode') || 'require',
};
function psql(sql) {
  const 임시 = path.join(os.tmpdir(), '알리오코드_' + process.pid + '.sql');
  fs.writeFileSync(임시, sql, 'utf8');
  const r = spawnSync('psql', ['-X', '-A', '-q', '-F', '\t', '-v', 'ON_ERROR_STOP=1', '-f', 임시],
    { encoding: 'utf8', maxBuffer: 1 << 26, env });
  fs.unlinkSync(임시);
  if (r.status) { console.error('✗ psql\n' + (r.stderr || '').slice(0, 900)); process.exit(1); }
  return (r.stdout || '').trimEnd();
}

/* ── 목록을 받습니다 (POST · 한 쪽 100건 · 같은 집이라 틈을 둡니다) ── */
const 이름별 = new Map();   /* instNm → Set(코드) */
let 받은줄 = 0;
for (let page = 1; page <= 쪽수; page++) {
  const url = 'https://opendata.alio.go.kr/new/v1/recruit/list.do?serviceKey=' + cfg.ALIO_LIST_KEY
    + '&pageNo=' + page + '&numOfRows=100&resultType=json';
  const r = await fetch(url, { method: 'POST', headers: { accept: 'application/json' } });
  const t = await r.text();
  if (r.status !== 200) { console.error('✗ 목록 ' + page + '쪽 HTTP ' + r.status); break; }
  let j = null; try { j = JSON.parse(t); } catch { console.error('✗ ' + page + '쪽 글이 JSON 이 아닙니다'); break; }
  const 줄 = j.result || j.items || j.data || [];
  if (!Array.isArray(줄) || !줄.length) break;
  받은줄 += 줄.length;
  for (const x of 줄) {
    const 이름 = String(x.instNm || '').trim();
    const 코드 = String(x.pblntInstCd || '').trim();
    if (!이름 || !코드) continue;
    if (!이름별.has(이름)) 이름별.set(이름, new Set());
    이름별.get(이름).add(코드);
  }
  if (줄.length < 100) break;
  await new Promise((r2) => setTimeout(r2, 1500));
}
console.log('목록 ' + 받은줄 + '줄 · 서로 다른 기관 이름 ' + 이름별.size + '개');
const 하나뿐 = [...이름별].filter(([, s]) => s.size === 1);
console.log('코드가 하나뿐인 이름 ' + 하나뿐.length + '개 · 둘 이상인 이름 '
  + (이름별.size - 하나뿐.length) + '개 (그것은 **안 채웁니다**)');
if (!하나뿐.length) process.exit(0);

/* ── 이름키로 기관 줄에 댑니다 ── */
const 값들 = 하나뿐.map(([이름, s]) => '(' + "'" + 이름.replace(/'/g, "''") + "',"
  + "'" + [...s][0].replace(/'/g, "''") + "')").join(',\n         ');
const 볼것 = `
  with 받은것(이름, 코드) as (values
         ${값들}
       ), 키로 as (
         /* ★ 2026-10-24 세중님 2번 — 이름 → **번호**로 풉니다. 심평원에 그 이름이
            여럿이면 창구가 null 을 주므로 **안 채웁니다** (짐작 금지 · 지침 10-3) */
         select "기관번호_이름으로"(이름) as 번호, min(코드) as 코드, count(distinct 코드) as 몇
           from 받은것 where "기관번호_이름으로"(이름) is not null group by 1
       )
  select count(*) filter (where o."알리오코드" is null and k.몇 = 1) as 채울것,
         count(*) filter (where o."알리오코드" is not null) as 이미찬것,
         count(*) filter (where k.몇 > 1) as 코드겹침
    from 기관 o join 키로 k on k.번호 = o."기관번호"
   where o."확인한때" is null;`;
console.log('\n── 기관 표에 댄 결과 ──\n' + psql(볼것));

if (!진짜) { console.log('\n[마른] 아무것도 안 채웠습니다 — --진짜 로 채웁니다'); process.exit(0); }

const 채우기 = `
  with 받은것(이름, 코드) as (values
         ${값들}
       ), 키로 as (
         /* ★ 2026-10-24 세중님 2번 — 이름 → **번호**로 풉니다. 심평원에 그 이름이
            여럿이면 창구가 null 을 주므로 **안 채웁니다** (짐작 금지 · 지침 10-3) */
         select "기관번호_이름으로"(이름) as 번호, min(코드) as 코드, count(distinct 코드) as 몇
           from 받은것 where "기관번호_이름으로"(이름) is not null group by 1
       )
  update 기관 o
     set "알리오코드" = k.코드,
         "불변근거"   = o."불변근거" || jsonb_build_object('알리오코드', '알리오 목록(instNm→pblntInstCd)'),
         "고친때"     = now()
    from 키로 k
   where k.번호 = o."기관번호" and k.몇 = 1
     and o."알리오코드" is null and o."확인한때" is null
  returning o.기관번호;`;
const 된것 = psql(채우기);
console.log('\n○ 채운 기관 ' + Math.max(0, 된것.split('\n').length - 1) + '곳');
console.log('\n── 채움 셈 ──\n' + psql(`
  select count(*) as 기관, count("알리오코드") as 알리오코드,
         count(*) filter (where "알리오코드" is not null and ykiho is not null) as 심평원번호도있음
    from 기관;`));
console.log('\n── 견본 다섯 ──\n' + psql(`
  select 이름, "알리오코드", coalesce("채용페이지",'-') as 채용페이지
    from 기관 where "알리오코드" is not null order by 이름 limit 5;`));
