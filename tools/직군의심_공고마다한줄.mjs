/* `직군의심()` 이 **공고마다 한 줄**을 보게 합니다 (2026-10-23 세중님 I 승인)
 *
 *   node tools/직군의심_공고마다한줄.mjs            올릴 자리만 (기본 · 마른)
 *   node tools/직군의심_공고마다한줄.mjs --진짜      올립니다
 *   node tools/직군의심_공고마다한줄.mjs --자기점검   규칙만 (DB 안 두드림)
 *
 * ── 증상 ─────────────────────────────────────────────────────
 * 아침 메일이 「직군의심 **2**」로 찍는데 공고는 **하나**였습니다.
 *   의심 줄 2 · 서로 다른 주소 1 (GJ306151 국립재활원)
 *   회원 화면에 중복 공고는 **없습니다** (job_posts_pub 에 한 줄뿐)
 *
 * ── 뿌리 ─────────────────────────────────────────────────────
 * `글모음` CTE 가 `left join job_body b` 라 **본문 줄마다 한 줄**이 나옵니다.
 * GJ306151 은 본문이 둘(상세 본문 240자 · 첨부 23,935자)이라 두 줄이 됐습니다.
 *
 * ★ 셈이 부푸는 것보다 **더 나쁜 것** — `근거있음` 을 **줄마다 따로** 재니,
 *   우리 직군 말이 **한 줄에만** 있으면 다른 줄이 그 공고를 의심으로 올립니다
 *   (**헛의심**). 오늘 회원 화면에 본문 2줄인 공고가 **8건**입니다.
 *   같은 공고가 `의심목록` 과 「근거 있음」 양쪽에 걸릴 수 있습니다.
 *
 * ── 그래서 묶는 자리를 **출력이 아니라 뿌리**에 둡니다 ────────────
 * 세중님 승인은 「목록을 주소로 묶기」였습니다. 출력에서 주소로만 묶으면 셈은
 * 맞아지지만 **헛의심은 그대로 남습니다** — 그 줄이 애초에 안 생겨야 합니다.
 * 그리고 출력 쪽은 네 자리(`의심`·`의심목록`·`통합공고`·`통합공고목록`)를 다
 * 고쳐야 하는데, 뿌리는 **한 줄**입니다 (지침 6절 — 기준은 한 자리).
 *
 * ★ 인수가 그대로(없음)라 **같은 함수**이고 ACL 이 유지됩니다 (지침 6-2).
 *   그래도 전후로 `pg_proc.proacl` 을 찍어 글자까지 같은지 봅니다.
 * ★ `delete` 글자가 없어 승인 창이 뜨지 않습니다 (지침 8-7).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

/* ★ 2026-10-23 세중님 1번 — **되돌림 파일은 /tmp 에 두지 않습니다.**
   /tmp 는 서버가 다시 뜨면 비워집니다. 되돌릴 글을 거기 두면 「되돌릴 수 있다」가
   거짓이 됩니다. ~/되돌림/ 에 **날짜를 붙여** 남깁니다 (지침 8-19) */
const 되돌림자리 = () => {
  const 집 = os.homedir();
  const 터 = path.join(집, '되돌림');
  fs.mkdirSync(터, { recursive: true });
  const 때 = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 15);
  return path.join(터, '직군의심_되돌리기_' + 때 + '.sql');
};

const argv = process.argv.slice(2);
const 진짜 = argv.includes('--진짜');
const 자기점검만 = argv.includes('--자기점검');

export const 낡은조인 = `    from job_posts p
    join job_posts_pub v on v.id = p.id
    left join job_body b on b.job_id = p.id`;

export const 새조인 = `    from job_posts p
    join job_posts_pub v on v.id = p.id
    /* ★ 2026-10-23 세중님 I — **본문을 공고마다 하나로 묶습니다.**
       전에는 \`left join job_body b\` 라 **본문 줄마다 한 줄**이 나왔습니다. 그래서
         ① 의심 셈이 부풀었습니다 — GJ306151 이 본문 둘(상세 240자 · 첨부 23,935자)
            이라 「의심 2」로 찍혔습니다. 회원 화면에 중복 공고는 없었습니다
         ② 더 나쁜 것 — \`근거있음\` 을 **줄마다 따로** 재니, 우리 직군 말이 한 줄에만
            있으면 **다른 줄이 그 공고를 의심으로** 올립니다 (헛의심).
            2026-10-23 기준 회원 화면에 본문 2줄인 공고가 8건입니다
       묶는 자리를 **출력이 아니라 여기**에 둡니다 — 출력에서 주소로만 묶으면 ②가
       남고, 출력은 네 자리를 다 고쳐야 합니다 (지침 6절 — 기준은 한 자리) */
    left join (select b2.job_id, string_agg(coalesce(b2.body, ''), ' ') as body
                 from job_body b2 group by b2.job_id) b on b.job_id = p.id`;

/** 본문에 한 자리를 바꿉니다 — 딱 한 번이어야 합니다 */
export function 바꾸기(본문) {
  const s = String(본문 || '');
  if (s.includes('string_agg(coalesce(b2.body')) throw new Error('이미 들어 있습니다 — 두 번 넣지 않습니다');
  const 몇 = s.split(낡은조인).length - 1;
  if (몇 !== 1) throw new Error('조인 자리가 ' + 몇 + '번 나옵니다 (1번이어야 합니다)');
  return s.replace(낡은조인, 새조인);
}

/* ── 자기점검 ─────────────────────────────────────────── */
function 자기점검() {
  const 잼 = [];
  const 보 = (무엇, 참) => 잼.push([무엇, !!참]);
  const 본 = [
    'CREATE OR REPLACE FUNCTION public."직군의심"()',
    'AS $function$',
    'with 글모음 as (',
    '  select p.id, p.source, p.org_name, p.title, p.job_group, p.url,',
    "         coalesce(p.title, '') || ' ' || coalesce(b.body, '') as 글",
    낡은조인,
    '), 잼 as (',
    '  select g.* from 글모음 g',
    ')',
    '$function$',
  ].join('\n');

  let 새 = null;
  try { 새 = 바꾸기(본); } catch (e) { 보('견본에 적용됨 (' + e.message + ')', false); }
  if (새) {
    보('본문을 묶는 갈래가 들어갔다', 새.includes('string_agg(coalesce(b2.body'));
    보('낡은 조인이 사라졌다', !새.includes('left join job_body b on b.job_id = p.id'));
    보('b.body 를 쓰는 글 식은 그대로', 새.includes("coalesce(b.body, '')"));
    보('job_posts_pub 조인은 그대로', 새.includes('join job_posts_pub v on v.id = p.id'));
    보('두 번 넣으면 멈춘다', (() => { try { 바꾸기(새); return false; } catch { return true; } })());
    보('자리가 없으면 멈춘다', (() => { try { 바꾸기('아무 글'); return false; } catch { return true; } })());
    보('자리가 둘이면 멈춘다',
      (() => { try { 바꾸기(본 + '\n' + 낡은조인); return false; } catch { return true; } })());
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
  const 임시 = '/tmp/직군의심묶기_' + process.pid + '.sql';
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
  + " where n.nspname = 'public' and p.proname = '직군의심';";

const 전권한 = psql(권한보기).trim();
console.log('\n── 올리기 전 ACL ──\n  ' + 전권한);

const 본문 = psql("select pg_get_functiondef(p.oid)\n"
  + '  from pg_proc p join pg_namespace n on n.oid = p.pronamespace\n'
  + " where n.nspname = 'public' and p.proname = '직군의심';").trim();
if (!본문.startsWith('CREATE OR REPLACE FUNCTION')) {
  console.error('✗ 본문을 못 떴습니다 (앞 80자) — ' + 본문.slice(0, 80));
  process.exit(1);
}
console.log('  지금 본문 ' + 본문.split('\n').length + '줄 · ' + 본문.length + '자');

const 전값 = psql("select '의심 ' || (\"직군의심\"()->>'의심')\n"
  + "       || ' · 줄 ' || jsonb_array_length(\"직군의심\"()->'의심목록')\n"
  + "       || ' · 서로 다른 주소 ' || (select count(distinct x->>'주소')\n"
  + "            from jsonb_array_elements(\"직군의심\"()->'의심목록') x)\n"
  + "       || ' · 통합공고 ' || (\"직군의심\"()->>'통합공고')\n"
  + "       || ' · 조교연구 ' || (\"직군의심\"()->>'조교연구');").trim();
console.log('\n── 올리기 전 ──\n  ' + 전값);
const 전삼 = psql("select \"네숫자\"()->'신뢰셋'->>'③우리직군아님_직군빈칸';").trim();
console.log('  네숫자 ③ = ' + 전삼);

let 새본문;
try { 새본문 = 바꾸기(본문); } catch (e) { console.error('✗ ' + e.message); process.exit(1); }
console.log('\n  새 본문 ' + 새본문.split('\n').length + '줄 (+'
  + (새본문.split('\n').length - 본문.split('\n').length) + '줄)');
console.log('\n════════ 바꾸는 자리 ════════');
console.log('낡 ' + 낡은조인.replace(/\n\s*/g, ' ⏎ '));
console.log('새 ' + 새조인.replace(/\/\*[\s\S]*?\*\//, '/* …주석… */').replace(/\n\s*/g, ' ⏎ '));
console.log('════════ 끝 ════════');

if (!진짜) {
  console.log('\n[마른] 아무것도 안 올립니다 — --진짜 로 올립니다');
  process.exit(0);
}

const 되돌림 = 되돌림자리();
fs.writeFileSync(되돌림, 본문 + ';\n', 'utf8');
console.log('\n되돌릴 본문을 ' + 되돌림 + ' 에 남겼습니다 ('
  + 본문.split('\n').length + '줄)');
psql(새본문 + ';');
console.log('○ 올렸습니다');

const 후권한 = psql(권한보기).trim();
console.log('\n── 올린 뒤 ACL ──\n  ' + 후권한);
console.log(전권한 === 후권한 ? '○ ACL 이 글자까지 같습니다' : '★ ACL 이 달라졌습니다 — 되돌려야 합니다');

console.log('\n── 올린 뒤 ──\n  ' + psql("select '의심 ' || (\"직군의심\"()->>'의심')\n"
  + "       || ' · 줄 ' || jsonb_array_length(\"직군의심\"()->'의심목록')\n"
  + "       || ' · 서로 다른 주소 ' || (select count(distinct x->>'주소')\n"
  + "            from jsonb_array_elements(\"직군의심\"()->'의심목록') x)\n"
  + "       || ' · 통합공고 ' || (\"직군의심\"()->>'통합공고')\n"
  + "       || ' · 조교연구 ' || (\"직군의심\"()->>'조교연구');").trim());
console.log('  네숫자 ③ = ' + psql("select \"네숫자\"()->'신뢰셋'->>'③우리직군아님_직군빈칸';").trim()
  + '   (전 ' + 전삼 + ')');
console.log('\n── 올린 뒤 의심목록 ──');
console.log(psql("select \"직군의심\"()->'의심목록';").trim());
