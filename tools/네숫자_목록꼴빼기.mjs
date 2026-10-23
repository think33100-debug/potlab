/* `네숫자()` ③ 에서 **자격증 목록꼴을 뺍니다** (2026-10-23 세중님 H-2 = ⓐ)
 *
 *   node tools/네숫자_목록꼴빼기.mjs            올릴 SQL 전문만 (기본 · 마른)
 *   node tools/네숫자_목록꼴빼기.mjs --진짜      올립니다
 *   node tools/네숫자_목록꼴빼기.mjs --자기점검   규칙만 (DB 안 두드림)
 *
 * ── 왜 ───────────────────────────────────────────────────────
 * 두 결정이 어긋나 있었습니다.
 *
 *   2026-10-14 세중님 — 「원문 응시자격·모집직종에 작업치료사가 있으면 **그대로
 *                        두고** 근거를 evidence 에 원문 줄로」
 *   2026-10-22 신뢰 셋 ③ — 같은 꼴(「A, 작업치료사, B 중 1개 이상」)을 「우리 직군
 *                        아님」으로 **셈**. ③ 목표가 0 이니 치워야 하는 것처럼 보입니다
 *
 * 2026-10-23 세중님 판정 = **ⓐ 10-14 결정 유지.**
 *   · 목록꼴 공고는 **우리 직군 공고로 둡니다** (작업치료사 면허로 지원할 수 있는
 *     치매안심센터·정신건강복지센터 자리입니다 · 지침 10-4)
 *   · ③ 셈에서 **뺍니다**
 *   · 「목록꼴」은 **보조 줄**로 건수만 셉니다 — **목표값이 없습니다**
 *   · 그 공고의 모집인원은 우리 직군 인원이 아니므로 **비웁니다**
 *     → 오늘 두 건 다 이미 비어 있고(headcount·뽑은값·detail 셋 다 null),
 *       화면은 `모집인원 || '공고문 확인'` + 원문 링크로 그립니다
 *       (web/app/jobs/[id]/page.tsx:350) — **고칠 숫자가 없었습니다**
 *
 * ── 바꾸는 자리 셋 ─────────────────────────────────────────
 *   ① ③ 합에서 `d."목록꼴"` 을 뺍니다
 *   ② `③겹친것` 에서도 뺍니다 (빈칸 ∩ 의심 만)
 *   ③ 보조 줄의 뜻을 글로 남깁니다 (`③자격증목록꼴※`)
 * `③자격증목록꼴` **열쇠 이름은 그대로 둡니다** — `tools/신뢰셋.mjs` 와
 * `hold-digest` 가 그 이름을 읽습니다 (지침 6절 — 이름을 바꾸면 양쪽을 다 고쳐야 합니다).
 *
 * ★ 인수가 그대로(없음)라 **같은 함수**이고 ACL 이 유지됩니다 (지침 6-2).
 *   그래도 전후로 `pg_proc.proacl` 을 찍어 **글자까지 같은지** 봅니다.
 * ★ `delete` 글자가 없어 승인 창이 뜨지 않습니다 (지침 8-7).
 */
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const argv = process.argv.slice(2);
const 진짜 = argv.includes('--진짜');
const 자기점검만 = argv.includes('--자기점검');

/** 바꿀 자리 셋 — 글자 그대로 */
export const 바꿀것 = [
  {
    무엇: '① ③ 합에서 목록꼴 빼기',
    낡: `      '③우리직군아님_직군빈칸', (select count(*) from "직군셋" d
          where d."빈칸" or d."목록꼴" or d."의심인가"),`,
    새: `      /* ★ 2026-10-23 세중님 H-2 = ⓐ — **목록꼴을 ③ 에서 뺐습니다.**
         「A, 작업치료사, B 중 1개 이상」 꼴은 2026-10-14 결정대로 **우리 직군
         공고로 둡니다**. ③ 의 뜻은 「우리 직군이 **아닌** 공고」인데, 면허를
         받아 주는 공고는 아닌 것이 아닙니다. 건수는 아래 보조 줄로 셉니다. */
      '③우리직군아님_직군빈칸', (select count(*) from "직군셋" d
          where d."빈칸" or d."의심인가"),`,
  },
  {
    무엇: '② 겹친것에서도 빼기',
    낡: `      '③겹친것', (select count(*) from "직군셋" d
          where (d."빈칸" or d."목록꼴") and d."의심인가"),`,
    새: `      '③겹친것', (select count(*) from "직군셋" d
          where d."빈칸" and d."의심인가"),`,
  },
  {
    무엇: '③ 보조 줄의 뜻을 글로',
    낡: `      '③자격증목록꼴', (select count(*) from "직군셋" where "목록꼴"),`,
    새: `      '③자격증목록꼴', (select count(*) from "직군셋" where "목록꼴"),
      '③자격증목록꼴※', '**보조 줄입니다 — 목표값이 없습니다.** 「A, 작업치료사,'
           || ' B 중 1개 이상」 꼴은 우리 직군 공고로 둡니다 (2026-10-14 · 10-23 세중님).'
           || ' 건수만 봅니다. 그 공고의 모집인원은 우리 직군 인원이 아니라 비웁니다',`,
  },
];

/** 본문에 셋을 적용합니다 — 자리마다 **딱 한 번**이어야 합니다 */
export function 바꾸기(본문) {
  let s = String(본문 || '');
  if (s.includes('③자격증목록꼴※')) throw new Error('이미 들어 있습니다 — 두 번 넣지 않습니다');
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
    'CREATE OR REPLACE FUNCTION public."네숫자"()',
    'AS $function$',
    '  select jsonb_build_object(',
    "      '③우리직군아님_직군빈칸', (select count(*) from \"직군셋\" d",
    '          where d."빈칸" or d."목록꼴" or d."의심인가"),',
    "      '③직군빈칸', (select count(*) from \"직군셋\" where \"빈칸\"),",
    "      '③자격증목록꼴', (select count(*) from \"직군셋\" where \"목록꼴\"),",
    "      '③직군의심', (select j->'의심' from 의심),",
    "      '③겹친것', (select count(*) from \"직군셋\" d",
    '          where (d."빈칸" or d."목록꼴") and d."의심인가"),',
    '  )',
    '$function$',
  ].join('\n');

  let 새 = null;
  try { 새 = 바꾸기(본); } catch (e) { 보('견본에 적용됨 (' + e.message + ')', false); }
  if (새) {
    보('③ 합에서 목록꼴이 빠졌다',
      새.includes('where d."빈칸" or d."의심인가"),')
      && !/or d\."목록꼴" or d\."의심인가"/.test(새));
    보('겹친것에서도 빠졌다', 새.includes('where d."빈칸" and d."의심인가"),'));
    보('보조 줄 뜻이 들어갔다', 새.includes('③자격증목록꼴※'));
    보('목록꼴 셈 자체는 남았다', 새.includes(`'③자격증목록꼴', (select count(*) from "직군셋" where "목록꼴"),`));
    보('③직군빈칸·③직군의심 은 그대로', 새.includes("'③직군빈칸'") && 새.includes("'③직군의심'"));
    보('두 번 넣으면 멈춘다', (() => { try { 바꾸기(새); return false; } catch { return true; } })());
    보('자리가 없으면 멈춘다', (() => { try { 바꾸기('아무 글'); return false; } catch { return true; } })());
    보('줄 수가 늘어난다', 새.split('\n').length > 본.split('\n').length);
  }

  const 어긴것 = 잼.filter(([, ok]) => !ok);
  for (const [무엇, ok] of 잼) console.log((ok ? '  ○ ' : '  ✗ ') + 무엇);
  if (어긴것.length) { console.error('✗ 자기점검 ' + 어긴것.length + '가지 실패'); process.exit(1); }
  console.log('○ 자기점검 통과 — ' + 잼.length + '가지');
}

console.log('── 자기점검 ──');
자기점검();
if (자기점검만) process.exit(0);

/* ── psql — 열쇠는 환경변수로 (지침 8-11·8-12) ── */
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
  const 임시 = '/tmp/목록꼴빼기_' + process.pid + '.sql';
  fs.writeFileSync(임시, sql, 'utf8');
  const r = spawnSync('psql', [...꼴, '-v', 'ON_ERROR_STOP=1', '-f', 임시],
    { encoding: 'utf8', maxBuffer: 1 << 28, env });
  fs.unlinkSync(임시);
  if (r.status) { console.error('✗ psql\n' + (r.stderr || '').slice(0, 900)); process.exit(1); }
  return r.stdout || '';
}

const 권한보기 = "select p.oid::regprocedure::text || '  ' || coalesce(p.proacl::text, '(없음)')\n"
  + '  from pg_proc p join pg_namespace n on n.oid = p.pronamespace\n'
  + " where n.nspname = 'public' and p.proname = '네숫자';";

const 전권한 = psql(권한보기).trim();
console.log('\n── 올리기 전 ACL ──\n  ' + 전권한);

const 본문 = psql("select pg_get_functiondef(p.oid)\n"
  + '  from pg_proc p join pg_namespace n on n.oid = p.pronamespace\n'
  + " where n.nspname = 'public' and p.proname = '네숫자';").trim();
if (!본문.startsWith('CREATE OR REPLACE FUNCTION')) {
  console.error('✗ 본문을 못 떴습니다 (앞 80자) — ' + 본문.slice(0, 80));
  process.exit(1);
}
console.log('  지금 본문 ' + 본문.split('\n').length + '줄 · ' + 본문.length + '자');

const 전값 = psql("select \"네숫자\"() -> '신뢰셋';").trim();
console.log('\n── 올리기 전 신뢰 셋 ──\n  ' + 전값);

let 새본문;
try { 새본문 = 바꾸기(본문); } catch (e) { console.error('✗ ' + e.message); process.exit(1); }
console.log('\n  새 본문 ' + 새본문.split('\n').length + '줄 (+'
  + (새본문.split('\n').length - 본문.split('\n').length) + '줄)');

console.log('\n════════ 올릴 SQL 전문 (바뀐 자리만) ════════');
for (const x of 바꿀것) {
  console.log('── ' + x.무엇);
  console.log('  낡 ' + x.낡.replace(/\n\s*/g, ' ⏎ '));
  console.log('  새 ' + x.새.replace(/\n\s*/g, ' ⏎ '));
}
console.log('════════ 끝 ════════');

if (!진짜) {
  console.log('\n[마른] 아무것도 안 올립니다 — --진짜 로 올립니다');
  console.log('되돌리는 법 — --진짜 가 /tmp/네숫자_목록꼴_되돌리기.sql 에 지금 본문을 남깁니다');
  process.exit(0);
}

fs.writeFileSync('/tmp/네숫자_목록꼴_되돌리기.sql', 본문 + ';\n', 'utf8');
console.log('\n되돌릴 본문을 /tmp/네숫자_목록꼴_되돌리기.sql 에 남겼습니다 ('
  + 본문.split('\n').length + '줄)');
psql(새본문 + ';');
console.log('○ 올렸습니다');

const 후권한 = psql(권한보기).trim();
console.log('\n── 올린 뒤 ACL ──\n  ' + 후권한);
console.log(전권한 === 후권한 ? '○ ACL 이 글자까지 같습니다' : '★ ACL 이 달라졌습니다 — 되돌려야 합니다');

console.log('\n── 올린 뒤 신뢰 셋 ──\n  ' + psql("select \"네숫자\"() -> '신뢰셋';").trim());
