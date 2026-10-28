/* ㉬ `hide_stale_posts()` — 긁기 공고가 **안 내려가는** 자리 고침
 *   (2026-10-28 세중님 ㉬ 승인 · **마른 실행 먼저**)
 *
 *   node tools/지난공고규칙_1028.mjs             마른 실행 (되돌림 안에서 전·후)
 *   node tools/지난공고규칙_1028.mjs --진짜       바꿉니다
 *
 * ── 세 자리만 바꿉니다 (지금 정의를 pg_get_functiondef 로 받아 글자 치환) ──
 *   ㉠ ② 의 기준 날짜 — **게시일 먼저**
 *        coalesce(first_seen, collected_at::date)
 *      → coalesce(posted_at, first_seen, collected_at::date)
 *   ㉡ ② 의 **정찰 면제에서 긁기(HS%) 를 뺍니다**
 *      긁기 정찰은 그 공고 쪽을 여는데, 병원이 옛 글을 안 내리면 그 쪽은 200 이고
 *      글도 그대로라 「살아 있다」가 **맞습니다**. 그래서 30일 규칙이 영영 안 걸립니다
 *   ㉢ ④ (정찰이 살아있다고 해서 다시 보이게)에 **같은 울타리** — 안 넣으면
 *      내린 것을 그 자리에서 다시 올립니다 (③④ 는 ①② 의 짝입니다)
 *
 * ★ 보류함은 안 건드립니다 — ② 의 `not hidden and not hold` 가 그대로입니다.
 * ★ 손으로 쓰지 않고 **지금 정의를 받아 바꿉니다** (security definer·search_path·
 *   인수 기본값이 그대로 따라옵니다 · ㉪㉫ 와 같은 꼴).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const 뿌리 = path.join(import.meta.dirname, '..');
const 진짜 = process.argv.includes('--진짜');
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
  const 임시 = path.join(os.tmpdir(), '지난공고규칙_' + process.pid + '.sql');
  fs.writeFileSync(임시, sql, 'utf8');
  const r = spawnSync('psql', [...꼴, '-v', 'ON_ERROR_STOP=1', '-f', 임시],
    { encoding: 'utf8', maxBuffer: 1 << 26, env });
  fs.unlinkSync(임시);
  if (r.status) { console.error('✗ psql\n' + (r.stderr || '').slice(0, 1500)); process.exit(1); }
  return (r.stdout || '').trimEnd();
}
const 글만 = (sql) => psql(sql, ['-X', '-A', '-t', '-q']);
const 머리 = '\\pset pager off\n';

/* ── 지금 정의·ACL ── */
const 몇벌 = 글만(`select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'hide_stale_posts';`);
if (몇벌 !== '1') { console.error('✗ hide_stale_posts 가 ' + 몇벌 + '벌입니다 (1 이어야 합니다)'); process.exit(1); }
const 전정의 = psql(머리 + `select pg_get_functiondef(p.oid) from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'hide_stale_posts';`, ['-X', '-A', '-t', '-q']);
const 전acl = 글만(`select coalesce(p.proacl::text,'(기본값)') from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'hide_stale_posts';`);
if (!전정의.trim()) { console.error('✗ 정의를 못 읽었습니다'); process.exit(1); }
console.log('전 — hide_stale_posts ' + 전정의.split('\n').length + '줄 · ACL ' + 전acl);

/* ── 바꿀 자리 셋. **글자가 정확히 한 번** 나와야 바꿉니다 (아니면 멈춥니다) ── */
const 바꿈들 = [
  {
    무엇: '㉠ ② 기준 날짜 — 게시일 먼저',
    옛: `and coalesce(first_seen, (collected_at at time zone 'Asia/Seoul')::date) < v_오늘 - p_days`,
    새: `/* ★ 2026-10-28 세중님 ㉬ — **게시일 먼저**입니다. 전에는 담은 날만 봐서,
       늦게 담은 공고가 그만큼 오래 남았습니다 (청주성모 게시일 없음·담은날 09-17) */
    and coalesce(posted_at, first_seen, (collected_at at time zone 'Asia/Seoul')::date) < v_오늘 - p_days`,
  },
  {
    무엇: '㉡ ② 정찰 면제에서 긁기 빼기',
    옛: `    and not (seen_on is not null and seen_on >= v_오늘 - v_정찰유효
             and coalesce(gone_streak, 0) = 0);
  get diagnostics v_날수 = row_count;`,
    새: `    /* ★ 2026-10-28 세중님 ㉬ — **긁기(HS%) 는 정찰 면제를 안 받습니다.**
       긁기 정찰은 그 공고 쪽을 여는데, 병원이 옛 글을 안 내리면 그 쪽은 200 이고
       글도 그대로라 「살아 있다」가 맞습니다. 그래서 30일 규칙이 영영 안 걸렸습니다 —
       10/28 에 포항세명 55일 · 청주성모 41일 · 대자인 36일이 그렇게 남아 있었습니다 */
    and not (source not like 'HS%'
             and seen_on is not null and seen_on >= v_오늘 - v_정찰유효
             and coalesce(gone_streak, 0) = 0);
  get diagnostics v_날수 = row_count;`,
  },
  {
    무엇: '㉢ ④ 되살리기에 같은 울타리',
    옛: `    and seen_on is not null and seen_on >= v_오늘 - v_정찰유효
    and coalesce(gone_streak, 0) = 0;
  get diagnostics v_정찰풀림 = row_count;`,
    새: `    /* ★ 2026-10-28 세중님 ㉬ — ②의 짝입니다. 여기에 울타리를 안 넣으면
       ②가 내린 긁기 공고를 **그 자리에서 다시 올립니다** */
    and source not like 'HS%'
    and seen_on is not null and seen_on >= v_오늘 - v_정찰유효
    and coalesce(gone_streak, 0) = 0;
  get diagnostics v_정찰풀림 = row_count;`,
  },
];
let 새정의 = 전정의;
for (const x of 바꿈들) {
  const 몇 = 새정의.split(x.옛).length - 1;
  if (몇 !== 1) {
    console.error('✗ ' + x.무엇 + ' — 바꿀 글자가 ' + 몇 + '번 나옵니다 (1 이어야 합니다). 멈춥니다');
    console.error('  찾던 글자 ↓\n' + x.옛);
    process.exit(1);
  }
  새정의 = 새정의.split(x.옛).join(x.새);
  console.log('○ ' + x.무엇);
}
const 바꾸기SQL = 새정의.trimEnd() + ';';

/* ── 마른 실행 — begin … rollback 안에서 전·후 ── */
const 셈SQL = `
  select count(*) as "회원 화면",
         count(*) filter (where p.source like 'HS%') as "그중 긁기",
         count(*) filter (where p.source like 'HS%' and p.apply_to is null) as "긁기·마감 없음",
         count(*) filter (where p.source like 'HS%' and p.apply_to is null
            and coalesce(p.posted_at, p.first_seen, (p.collected_at at time zone 'Asia/Seoul')::date)
                < (now() at time zone 'Asia/Seoul')::date - 30) as "긁기·30일 지남"
    from job_posts p join job_posts_pub v on v.id = p.id;`;
const 내려갈SQL = `
  select p.id, p.source, p.org_name, p.posted_at as 게시일, p.first_seen as 담은날,
         (now() at time zone 'Asia/Seoul')::date
           - coalesce(p.posted_at, p.first_seen,
                      (p.collected_at at time zone 'Asia/Seoul')::date) as 며칠됐나,
         p.hold as 보류함, p.seen_on as 정찰본날,
         left(p."보여줄제목", 42) as 보여줄제목
    from job_posts p
   where p.hidden and p.hidden_why = (select 30 || '일 지남')
   order by p.source, p.id;`;

console.log('\n══ 전 — 회원 화면 ══');
console.log(psql(머리 + 셈SQL));
console.log('\n══ 마른 실행 — 바꾼 뒤 함수를 **한 번 불러** 봅니다 (되돌림 안) ══');
console.log(psql(머리 + `
begin;
${바꾸기SQL}
select hide_stale_posts(30, 180) as "함수가 낸 값";
select '— 그 뒤 회원 화면 —' as x;
${셈SQL}
select '— 까닭이 「30일 지남」인 줄 **전부** (이번 바퀴 것만이 아닙니다) · 보류함 0 이어야 —' as x;
${내려갈SQL}
rollback;`));

/* ── 증명 — 면제 해제가 **정말 듣나** ───────────────────────────
 * 지금 숫자로는 함수가 내릴 것이 0건입니다 (낮에 손으로 셋을 내렸습니다).
 * 그래서 **기준을 잠깐 7일로 낮춰** 옛 정의와 새 정의를 견줍니다 (지침 8-16 —
 * 「기준을 잠깐 낮춰 정말 도는지 보고 원래대로」). 둘 다 **되돌림 안**입니다. */
const 센다 = (몇일) => `
  select count(*) filter (where p.source like 'HS%') as "긁기 내려감",
         count(*) filter (where p.source not like 'HS%') as "그밖 내려감",
         count(*) filter (where p.hold) as "보류함 건드림(0 이어야)"
    from job_posts p
   where p.hidden_on = (now() at time zone 'Asia/Seoul')::date
     and p.hidden_why = ${몇일} || '일 지남';`;
console.log('\n══ 증명 — 기준을 7일로 낮춰 옛 정의 ↔ 새 정의 (둘 다 되돌림 안) ══');
console.log('── 옛 정의로 7일 ──');
console.log(psql(머리 + `begin;\nselect hide_stale_posts(7, 180) as 낸값;\n${센다(7)}\nrollback;`));
console.log('── 새 정의로 7일 ──');
console.log(psql(머리 + `begin;\n${바꾸기SQL}\nselect hide_stale_posts(7, 180) as 낸값;\n${센다(7)}\nrollback;`));

if (!진짜) {
  console.log('\n[마른] 아무것도 안 바꿨습니다 (rollback) — --진짜 로 바꿉니다');
  process.exit(0);
}

/* ── 되돌림 ── */
const d = new Date(); const 두 = (n) => String(n).padStart(2, '0');
const 때 = String(d.getFullYear()) + 두(d.getMonth() + 1) + 두(d.getDate())
  + '_' + 두(d.getHours()) + 두(d.getMinutes()) + 두(d.getSeconds());
const 되돌림터 = path.join(os.homedir(), '되돌림');
fs.mkdirSync(되돌림터, { recursive: true });
const 되돌림 = path.join(되돌림터, 'hide_stale_posts_되돌리기_' + 때 + '.sql');
fs.writeFileSync(되돌림,
  '/* ㉬ 되돌리기 — 2026-10-28 전 정의 그대로 (pg_get_functiondef 로 받은 것) */\n'
  + 전정의.trimEnd() + ';\n'
  + '/* ★ 이 함수를 되돌려도 **이미 내려간 공고는 그대로 숨김**입니다.\n'
  + '   되살리려면 아래를 돌립니다 (까닭 글이 「30일 지남」인 긁기 공고만) */\n'
  + "-- update job_posts set hidden = false, hidden_why = null, hidden_on = null\n"
  + "--  where source like 'HS%' and hidden and hidden_why = '30일 지남'\n"
  + "--    and hidden_on = (now() at time zone 'Asia/Seoul')::date;\n", 'utf8');
console.log('\n○ 되돌릴 글 — ' + 되돌림);

console.log(psql(바꾸기SQL));
const 후acl = 글만(`select coalesce(p.proacl::text,'(기본값)') from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'hide_stale_posts';`);
console.log('후 ACL — ' + 후acl + (후acl === 전acl ? '  (전과 같습니다)' : '  ⚠ 전과 다릅니다'));

console.log('\n══ 실행 — 함수를 한 번 돌립니다 ══');
console.log(psql(머리 + `select hide_stale_posts(30, 180) as "함수가 낸 값";`));
console.log('── 후 · 회원 화면 ──');
console.log(psql(머리 + 셈SQL));
console.log('── 까닭이 「30일 지남」인 줄 전부 (이번 바퀴 것만이 아닙니다) ──');
console.log(psql(머리 + 내려갈SQL));
