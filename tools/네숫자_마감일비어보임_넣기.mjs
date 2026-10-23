/* `네숫자()` ② 에 「마감일이 비어 보이는 것」 두 칸을 끼웁니다 (2026-10-20 세중님 1번 뿌리②)
 *
 *   node tools/네숫자_마감일비어보임_넣기.mjs            올릴 SQL 전문만 찍습니다 (기본)
 *   node tools/네숫자_마감일비어보임_넣기.mjs --진짜      올립니다
 *   node tools/네숫자_마감일비어보임_넣기.mjs --자기점검   규칙만 (DB 안 두드림)
 *
 * ── 왜 ───────────────────────────────────────────────────────
 * ② 「마감인데 보임」은 **apply_to 를 오늘과 견주는** 지표입니다. apply_to 가
 * 비어 있으면 견줄 값이 없어 **0** 으로 나옵니다. 그 0 이 마감 지난 공고
 * 네 건을 가리고 있었습니다 —
 *   HS236379585  청주의료원  2026-07-09 17:00  103일 지남
 *   HS638584095  상주적십자  2026-08-06 18:00   75일 지남
 *   HS420894575  인천적십자  2026-09-04 10:00   46일 지남
 *   HS1650428387 광주씨티    2021-05-31       ★ 5년 5개월 전 공고
 * 2026-10-18 에 ②를 「원문 없어짐인데 보임」·「정찰이 한 번도 안 본 것」으로
 * 늘린 것과 같은 결입니다 — **모르는 것을 0 으로 세지 않기** (지침 15절).
 *
 * ── 왜 손으로 쓴 마이그레이션이 아닌가 ──────────────────────────
 * `네숫자()` 는 150줄이 넘습니다. 손으로 베껴 `create or replace` 하면
 * **다른 칸이 조용히 바뀝니다** (지침 7절 — 블록을 통째로 갈아끼우지 않기).
 * 그래서 **지금 본문을 떠서 한 자리에 두 줄만 끼웁니다.**
 *
 * ★ 인수가 그대로(없음)라 **같은 함수**이고 ACL 이 유지됩니다 (지침 6-2).
 *   그래도 전후로 `pg_proc.proacl` 을 찍어 **글자까지 같은지** 봅니다.
 * ★ `delete` 글자가 없어 승인 창이 뜨지 않습니다 (지침 8-7).
 *   그래서 **SQL 전문을 먼저 찍고**, 세중님 확인 뒤에만 `--진짜` 입니다 (지침 8-5).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const argv = process.argv.slice(2);
const 진짜 = argv.includes('--진짜');
const 자기점검만 = argv.includes('--자기점검');

/** 끼울 자리 — 이 줄 **바로 뒤**에 넣습니다 */
export const 자리표 = "'②정찰이사흘안에본것'";

export const 끼울것 = [
  "    '②마감일비어보임', (select count(*) from v where v.apply_to is null),",
  "    /* ★ 2026-10-20 — 「마감일이 비어 보이는 것」을 따로 셉니다 (세중님 1번 뿌리②).",
  "       ② 는 apply_to 를 오늘과 견주니, **비어 있으면 0** 으로 나옵니다. 그 0 이",
  "       마감 지난 공고 네 건을 가리고 있었습니다 (청주의료원 103일 지남 ·",
  "       상주적십자 75일 · 인천적십자 46일 · **광주씨티 2021년 공고**).",
  "",
  "       「확인할 것」을 따로 세는 까닭 — 「상시채용」·「채용 시 까지」처럼 **원문에",
  "       끝 날짜가 없는** 공고는 비어 있는 것이 맞습니다. 그래서 날짜가 **오래된",
  "       쪽**만 고릅니다. 기준은 `tools/마감비어보임.mjs` 와 같은 한 벌입니다 —",
  "         ㉠ 올린날·담은날 가운데 이른 것이 60일 넘었다  또는",
  "         ㉡ **올린날이 아예 없다**",
  "       ㉡ 가 없으면 **가장 나쁜 것을 놓칩니다** — 광주씨티는 2021년 공고인데",
  "       posted_at 이 비어 있고 우리가 10-18 에 담아서 「2일」로 보입니다.",
  "",
  "       ★ 이 숫자는 **세기만** 합니다. 숨기는 것은 원문을 보고 마감일을 채운",
  "         뒤 정리매시가 합니다 — 근거 없이 숨기지 않습니다 (세중님). */",
  "    '②마감일비어보임_확인할것', (select count(*) from v",
  "        join job_posts g on g.id = v.id",
  "       where v.apply_to is null",
  "         and (g.posted_at is null",
  "              or least(coalesce(g.posted_at, date '9999-12-31'),",
  "                       coalesce((g.db_insert_at at time zone 'Asia/Seoul')::date,",
  "                                date '9999-12-31'))",
  "                 <= (now() at time zone 'Asia/Seoul')::date - 60)),",
].join('\n');

/** 본문에 두 칸을 끼웁니다 — 자리표가 **딱 한 번** 나와야 합니다 */
export function 끼우기(본문) {
  const 줄들 = String(본문 || '').split('\n');
  const 자리 = 줄들.map((l, i) => (l.includes(자리표) ? i : -1)).filter((i) => i >= 0);
  if (자리.length !== 1) throw new Error('자리표가 ' + 자리.length + '번 나옵니다 — 손으로 봐야 합니다');
  /* 자리표 줄은 여러 줄에 걸쳐 있을 수 있습니다. **다음 칸 이름이 나오기 전까지**가 그 칸입니다 */
  let 끝 = 자리[0];
  while (끝 + 1 < 줄들.length && !/^\s*'[^']+',/.test(줄들[끝 + 1])) 끝++;
  if (본문.includes('②마감일비어보임')) throw new Error('이미 들어 있습니다 — 두 번 넣지 않습니다');
  return [...줄들.slice(0, 끝 + 1), 끼울것, ...줄들.slice(끝 + 1)].join('\n');
}

/* ── 자기점검 ─────────────────────────────────────────── */
function 자기점검() {
  const 잼 = [];
  const 보 = (무엇, 참) => 잼.push([무엇, !!참]);
  const 본 = [
    'CREATE OR REPLACE FUNCTION public."네숫자"()',
    'AS $function$',
    '  select jsonb_build_object(',
    "    '②정찰이사흘안에본것', (select count(*) from v",
    '        join job_posts g on g.id = v.id',
    "        where g.seen_on >= (now() at time zone 'Asia/Seoul')::date - 3),",
    "    '③일곱칸', jsonb_build_object(",
    "        '모집인원', 1)",
    '  )',
    '$function$',
  ].join('\n');
  const 새 = 끼우기(본);
  보('두 칸이 들어갔다', 새.includes("'②마감일비어보임'") && 새.includes("'②마감일비어보임_확인할것'"));
  보('③일곱칸 **앞**에 들어갔다',
    새.indexOf("'②마감일비어보임'") < 새.indexOf("'③일곱칸'"));
  보('여러 줄짜리 칸을 쪼개지 않았다',
    새.includes("date - 3),\n    '②마감일비어보임'"));
  보('본문의 다른 줄은 그대로',
    본.split('\n').every((l) => 새.includes(l)));
  let 두번 = false;
  try { 끼우기(새); } catch (e) { 두번 = /이미 들어 있습니다/.test(e.message); }
  보('두 번 넣으면 멈춘다', 두번);
  let 없으면 = false;
  try { 끼우기('아무것도 없는 글'); } catch (e) { 없으면 = /자리표가 0번/.test(e.message); }
  보('자리표가 없으면 멈춘다', 없으면);
  const 탈 = 잼.filter((y) => !y[1]);
  for (const y of 잼) if (!y[1]) console.log('  ✗ ' + y[0]);
  console.log((탈.length ? '✗ 자기점검 ' + 탈.length + '가지 탈'
    : '○ 자기점검 통과 — ' + 잼.length + '가지') + ' (DB 를 두드리지 않았습니다)');
  return !탈.length;
}
if (!자기점검()) process.exit(1);
if (자기점검만) process.exit(0);

/* ── psql — 열쇠는 **환경변수로** 넘깁니다 (명령줄에 안 적습니다 · 지침 8-11) ── */
const cfg = {};
for (const f of ['.env', '.env.local']) {
  if (!fs.existsSync(f)) continue;
  for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) cfg[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const DB = cfg.SUPABASE_DB_URL;
if (!DB) { console.error('✗ SUPABASE_DB_URL 이 없습니다'); process.exit(1); }
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
  const 임시 = '/tmp/네숫자_넣기_' + process.pid + '.sql';
  fs.writeFileSync(임시, sql, 'utf8');
  const r = spawnSync('psql', [...꼴, '-v', 'ON_ERROR_STOP=1', '-f', 임시],
    { encoding: 'utf8', maxBuffer: 1 << 28, env });
  fs.unlinkSync(임시);
  if (r.status) { console.error('✗ psql\n' + (r.stderr || '').slice(0, 800)); process.exit(1); }
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

const 새본문 = 끼우기(본문);
console.log('  새 본문 ' + 새본문.split('\n').length + '줄 (+'
  + (새본문.split('\n').length - 본문.split('\n').length) + '줄)');

console.log('\n════════ 올릴 SQL 전문 ════════');
console.log(새본문 + ';');
console.log('════════ 끝 ════════');

if (!진짜) {
  console.log('\n[마른] 아무것도 안 올립니다 — 세중님 확인 뒤 --진짜');
  console.log('되돌리는 법 — 위 「지금 본문」을 그대로 다시 create or replace 하면 됩니다.');
  console.log('  (이 도구를 --진짜 전에 한 번 더 돌려 지금 본문을 파일로 받아 두십시오)');
  process.exit(0);
}

/* ★ 2026-10-23 — /tmp 금지 (세중님 1번). ~/되돌림/ 에 날짜를 붙입니다 */
const 되돌림터 = path.join(os.homedir(), '되돌림');
fs.mkdirSync(되돌림터, { recursive: true });
/* ★ 2026-10-23 — 서버 지역 시각(KST)으로 · 점이 겹치지 않게 */
const 두때 = (() => {
  const d = new Date();
  const 두 = (n) => String(n).padStart(2, '0');
  return String(d.getFullYear()) + 두(d.getMonth() + 1) + 두(d.getDate())
    + '_' + 두(d.getHours()) + 두(d.getMinutes()) + 두(d.getSeconds());
})();
const 되돌림 = path.join(되돌림터, '네숫자_되돌리기_' + 두때 + '.sql');
fs.writeFileSync(되돌림, 본문 + ';\n', 'utf8');
console.log('\n되돌릴 본문을 ' + 되돌림 + ' 에 남겼습니다');
psql(새본문 + ';');
console.log('○ 올렸습니다');

const 후권한 = psql(권한보기).trim();
console.log('\n── 올린 뒤 ACL ──\n  ' + 후권한);
console.log(전권한 === 후권한 ? '○ ACL 이 글자까지 같습니다' : '★ ACL 이 달라졌습니다 — 되돌려야 합니다');

console.log('\n── 새 칸 값 ──');
console.log(psql("select \"네숫자\"() -> '②마감일비어보임' as \"비어보임\",\n"
  + "       \"네숫자\"() -> '②마감일비어보임_확인할것' as \"확인할것\";", ['-X', '-A', '-q']).trim());
