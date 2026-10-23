/* `route_health()` 의 빨간줄에서 **짝이 있는 옛 출처**를 뺍니다 (2026-10-23 세중님 K 승인)
 *
 *   node tools/route_health_옛길빼기.mjs            올릴 자리만 (기본 · 마른)
 *   node tools/route_health_옛길빼기.mjs --진짜      올립니다
 *   node tools/route_health_옛길빼기.mjs --자기점검   규칙만 (DB 안 두드림)
 *
 * ── 왜 ───────────────────────────────────────────────────────
 * 관리자 화면 빨간 상자가 네 줄을 올리고 있었습니다 —
 *   나라일터(옛) 24일 · 알리오(옛) 22일 · 홈페이지(구글) 17일 · 워크넷(옛) 15일
 * 넷 다 **2026-10-11 에 세중님 승인으로 일부러 멈춘** 옛 Apps Script 길이고
 * (`.github/workflows/sync.yml` 머리글 · `job_sync_log` 마지막 줄 10-11 07:22),
 * 짝이 되는 새 길이 **오늘도** 같은 공고를 받습니다.
 * 회원 화면 영향은 **1건**입니다 (`docs/빨간경고_옛출처_1023.md`).
 *
 * **경고는 맞는 신호였는데 고칠 것이 없습니다.** 그래서 빨간줄에서만 뺍니다 —
 * 줄 자체는 **안 지웁니다** (2026-09 공고를 다시 볼 날이 있습니다).
 *
 * ── 목록이 두 자리였습니다 ───────────────────────────────────
 * 옛↔새 짝이 `수집기짝` 표에 **이미** 있는데, `route_health()` 는 제 본문에
 * `이름` CTE 로 또 들고 있었습니다. 이제 빨간줄 판정은 **표를 봅니다** (지침 6절).
 * `collect_source.live` 는 이 함수가 **안 봅니다** — 끄는 자리가 아닙니다.
 *
 * ★ 인수가 없어 `create or replace` 가 ACL 을 그대로 둡니다 (지침 6-2).
 *   그래도 전후로 `pg_proc.proacl` 을 찍어 글자까지 같은지 봅니다.
 * ★ 되돌림은 `~/되돌림/` 에 날짜를 붙여 남깁니다 (지침 8-19).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const argv = process.argv.slice(2);
const 진짜 = argv.includes('--진짜');
const 자기점검만 = argv.includes('--자기점검');

const 되돌림자리 = () => {
  const 터 = path.join(os.homedir(), '되돌림');
  fs.mkdirSync(터, { recursive: true });
  const 때 = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 15);
  return path.join(터, 'route_health_되돌리기_' + 때 + '.sql');
};

/** 짝이 있나 — 세 자리에서 같은 글을 씁니다 (지침 6절) */
export const 짝있나 = 'exists (select 1 from "수집기짝" p where p."옛출처" = c.cd)';

export const 바꿀것 = [
  {
    무엇: '① 모음 CTE 가 출처 코드를 함께 들고 나오게',
    낡: `    select i.nm as "경로", l.마지막,`,
    새: `    /* ★ 2026-10-23 세중님 K — 빨간줄 판정에 **출처 코드**가 필요합니다.
       바깥 select 는 칸을 하나씩 골라 내므로 union all 쪽 칸 수는 그대로입니다 */
    select i.cd as cd, i.nm as "경로", l.마지막,`,
  },
  {
    무엇: '② 빨간줄에서 짝이 있는 옛 출처를 빼기',
    낡: `         (c."본틈" >= 5 and c."며칠째" >= c."기준일") as "빨간줄",`,
    새: `         /* ★ 2026-10-23 세중님 K — **짝이 있는 옛 출처는 빨개지지 않습니다.**
            2026-10-11 에 세중님 승인으로 멈춘 길이고(sync.yml 머리글), 짝이 되는
            새 길이 같은 공고를 받습니다(수집기짝 표 · docs/빨간경고_옛출처_1023.md).
            줄은 **안 지웁니다** — 아래 「왜」가 까닭을 글로 말합니다 */
         (c."본틈" >= 5 and c."며칠째" >= c."기준일"
          and not ${짝있나}) as "빨간줄",`,
  },
  {
    무엇: '③ 왜 — 옛 길이면 까닭을 글로',
    낡: `           when c.마지막 is null  then '한 번도 안 들어온 경로입니다'`,
    새: `           when c.마지막 is null  then '한 번도 안 들어온 경로입니다'
           when ${짝있나}
             then '**옛 길입니다** — 2026-10-11 에 일부러 멈췄고(세중님 승인) 새 길 '
                  || (select p."새출처" || ' ' || p."이름" from "수집기짝" p where p."옛출처" = c.cd)
                  || ' 이 같은 공고를 받습니다. **고칠 것이 없습니다** · 마지막 ' || c.마지막`,
  },
];

export function 바꾸기(본문) {
  let s = String(본문 || '');
  if (s.includes('짝이 있는 옛 출처는 빨개지지 않습니다')) {
    throw new Error('이미 들어 있습니다 — 두 번 넣지 않습니다');
  }
  for (const x of 바꿀것) {
    const 몇 = s.split(x.낡).length - 1;
    if (몇 !== 1) throw new Error(x.무엇 + ' — 자리가 ' + 몇 + '번 나옵니다 (1번이어야 합니다)');
    s = s.replace(x.낡, x.새);
  }
  return s;
}

/* ── 자기점검 ─────────────────────────────────────────── */
function 자기점검() {
  const 잼 = [];
  const 보 = (무엇, 참) => 잼.push([무엇, !!참]);
  const 본 = [
    'CREATE OR REPLACE FUNCTION public.route_health()',
    'AS $function$',
    '  with 오늘 as (select (now() at time zone \'Asia/Seoul\')::date as d),',
    '  모음 as (',
    '    select i.nm as "경로", l.마지막,',
    '           ((select d from 오늘) - l.마지막)::integer as "며칠째"',
    '      from 이름 i',
    '  )',
    '  select c."경로", c.마지막, c."며칠째",',
    '         (c."본틈" >= 5 and c."며칠째" >= c."기준일") as "빨간줄",',
    '         case',
    "           when c.마지막 is null  then '한 번도 안 들어온 경로입니다'",
    "           when c.\"본틈\" < 5      then '아직 못 봐서 판단을 미룹니다'",
    "           else '들어오고 있습니다'",
    '         end as "왜"',
    '    from 모음 c',
    '  union all',
    "  select '다리(시트→DB)', null, null, false, '30분마다 돕니다'",
    '$function$',
  ].join('\n');

  let 새 = null;
  try { 새 = 바꾸기(본); } catch (e) { 보('견본에 적용됨 (' + e.message + ')', false); }
  if (새) {
    보('① cd 가 모음에 들어갔다', 새.includes('select i.cd as cd, i.nm as "경로"'));
    보('② 빨간줄에 not exists 가 붙었다',
      /and not exists \(select 1 from "수집기짝" p where p\."옛출처" = c\.cd\)\) as "빨간줄"/.test(새));
    보('③ 왜 에 옛 길 갈래가 생겼다', 새.includes('**옛 길입니다**'));
    보('③ 왜 가 새출처 이름을 함께 냅니다', 새.includes('p."새출처" || \' \' || p."이름"'));
    보('union all 쪽은 안 건드렸다', 새.includes("select '다리(시트→DB)', null, null, false"));
    보('「본틈 < 5」 갈래는 그대로', 새.includes("when c.\"본틈\" < 5"));
    보('두 번 넣으면 멈춘다', (() => { try { 바꾸기(새); return false; } catch { return true; } })());
    보('자리가 없으면 멈춘다', (() => { try { 바꾸기('아무 글'); return false; } catch { return true; } })());
    보('줄 수가 늘어난다', 새.split('\n').length > 본.split('\n').length);
    /* 「짝있나」 글이 두 자리에 **같게** 들어갔나 (지침 6절) */
    보('짝있나 글이 두 자리에 같게', (새.split(짝있나).length - 1) === 2);
  }

  const 어긴것 = 잼.filter(([, ok]) => !ok);
  for (const [무엇, ok] of 잼) console.log((ok ? '  ○ ' : '  ✗ ') + 무엇);
  if (어긴것.length) { console.error('✗ 자기점검 ' + 어긴것.length + '가지 실패'); process.exit(1); }
  console.log('○ 자기점검 통과 — ' + 잼.length + '가지');
}

console.log('── 자기점검 ──');
자기점검();
if (자기점검만) process.exit(0);

/* ── psql ── */
const cfg = {};
for (const f of ['.env', '.env.local']) {
  if (!fs.existsSync(f)) continue;
  for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !cfg[m[1]]) cfg[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const DB = cfg.SUPABASE_DB_URL;
if (!DB) { console.error('✗ SUPABASE_DB_URL 이 없습니다 (서버에서 돌리십시오)'); process.exit(1); }
const u = new URL(DB);
const env = {
  ...process.env,
  PGHOST: u.hostname,
  PGPORT: u.port || '5432',
  PGUSER: decodeURIComponent(u.username),
  PGPASSWORD: decodeURIComponent(u.password),
  PGDATABASE: decodeURIComponent(u.pathname.replace(/^\//, '')) || 'postgres',
  PGSSLMODE: u.searchParams.get('sslmode') || 'require',
};
function psql(sql, 꼴 = ['-X', '-A', '-t', '-q']) {
  const 임시 = '/tmp/route_health_옛길_' + process.pid + '.sql';
  fs.writeFileSync(임시, sql, 'utf8');
  const r = spawnSync('psql', [...꼴, '-v', 'ON_ERROR_STOP=1', '-f', 임시],
    { encoding: 'utf8', maxBuffer: 1 << 28, env });
  fs.unlinkSync(임시);
  if (r.status) { console.error('✗ psql\n' + (r.stderr || '').slice(0, 900)); process.exit(1); }
  return r.stdout || '';
}

const 권한보기 = "select p.oid::regprocedure::text || '  ' || coalesce(p.proacl::text, '(없음)')\n"
  + "       || '  secdef=' || p.prosecdef\n"
  + '  from pg_proc p join pg_namespace n on n.oid = p.pronamespace\n'
  + " where n.nspname = 'public' and p.proname = 'route_health' and p.prokind = 'f';";

const 빨간보기 = "select coalesce(string_agg(\"경로\" || ' ' || \"며칠째\" || '일', ' · ' order by \"며칠째\" desc), '(없음)')\n"
  + '  from route_health() where "빨간줄";';

const 전권한 = psql(권한보기).trim();
console.log('\n── 올리기 전 ACL ──\n  ' + 전권한);
console.log('── 올리기 전 빨간 줄 ──\n  ' + psql(빨간보기).trim());

const 본문 = psql("select pg_get_functiondef(p.oid)\n"
  + '  from pg_proc p join pg_namespace n on n.oid = p.pronamespace\n'
  + " where n.nspname = 'public' and p.proname = 'route_health' and p.prokind = 'f';").trim();
if (!본문.startsWith('CREATE OR REPLACE FUNCTION')) {
  console.error('✗ 본문을 못 떴습니다 (앞 80자) — ' + 본문.slice(0, 80));
  process.exit(1);
}
console.log('  지금 본문 ' + 본문.split('\n').length + '줄 · ' + 본문.length + '자');

let 새본문;
try { 새본문 = 바꾸기(본문); } catch (e) { console.error('✗ ' + e.message); process.exit(1); }
console.log('\n  새 본문 ' + 새본문.split('\n').length + '줄 (+'
  + (새본문.split('\n').length - 본문.split('\n').length) + '줄)');

console.log('\n════════ 바꾸는 자리 셋 ════════');
for (const x of 바꿀것) {
  console.log('── ' + x.무엇);
  console.log('  낡 ' + x.낡.trim().replace(/\n\s*/g, ' ⏎ '));
  console.log('  새 ' + x.새.replace(/\/\*[\s\S]*?\*\//, '/*…주석…*/').trim().replace(/\n\s*/g, ' ⏎ '));
}
console.log('════════ 끝 ════════');

if (!진짜) {
  console.log('\n[마른] 아무것도 안 올립니다 — --진짜 로 올립니다');
  console.log('되돌림은 --진짜 가 ' + path.join(os.homedir(), '되돌림') + ' 에 날짜를 붙여 남깁니다');
  process.exit(0);
}

const 되돌림 = 되돌림자리();
fs.writeFileSync(되돌림, 본문 + ';\n', 'utf8');
console.log('\n되돌릴 본문을 ' + 되돌림 + ' 에 남겼습니다 (' + 본문.split('\n').length + '줄)');
psql(새본문 + ';');
console.log('○ 올렸습니다');

const 후권한 = psql(권한보기).trim();
console.log('\n── 올린 뒤 ACL ──\n  ' + 후권한);
console.log(전권한 === 후권한 ? '○ ACL 이 글자까지 같습니다' : '★ ACL 이 달라졌습니다 — 되돌려야 합니다');

console.log('\n── 올린 뒤 빨간 줄 ──\n  ' + psql(빨간보기).trim());
console.log('\n── 옛 길 넷이 표에 남아 있나 (빨간줄 · 왜) ──');
console.log(psql("select rpad(\"경로\",18) || ' | 빨간줄=' || \"빨간줄\"::text || ' | ' || left(\"왜\", 96)\n"
  + "  from route_health()\n"
  + " where \"경로\" like '%(옛)%' or \"경로\" like '%(구글)%'\n"
  + ' order by "며칠째" desc;').trim());
