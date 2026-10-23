/* `collect_put` 이 `evidence` 를 **덮지 않고 합치게** 합니다 (2026-10-23 세중님 승인)
 *
 *   node tools/collect_put_evidence합치기.mjs            올릴 자리만 (기본 · 마른)
 *   node tools/collect_put_evidence합치기.mjs --진짜      올립니다
 *   node tools/collect_put_evidence합치기.mjs --자기점검   규칙만 (DB 안 두드림)
 *
 * ── 왜 ───────────────────────────────────────────────────────
 * 2026-10-14 결정은 「원문 응시자격에 우리 직군이 있으면 그대로 두고 **근거를
 * evidence 에 원문 줄로**」 입니다. 그런데 그 자리가 **수집기 한 바퀴에 지워집니다.**
 *
 *   09:49  GJ305543 의 evidence 에 근거를 적었습니다
 *   13:42  `{}` 가 됐습니다 (같은 시각 WN 공고 수십 줄이 함께 바뀜 = upsert 한 바퀴)
 *
 * 까닭은 한 줄입니다 —
 *   evidence = case when (j.source = p_source or j.source = v_짝)
 *                   then excluded.evidence else j.evidence end
 * 수집기가 evidence 를 안 보내면 `coalesce(r->'evidence','{}')` 라 **빈 꼴**이 들어옵니다.
 *
 * ── 어떻게 ───────────────────────────────────────────────────
 * **같은 함수 안의 `detail` 줄과 글자까지 같은 꼴**로 바꿉니다 (지침 6절 — 기준은
 * 한 자리, 새로 만들지 않습니다). `detail` 은 2026 내내 이 꼴로 돌고 있습니다:
 *
 *   ① admin_locked 면 손대지 않음
 *   ② 수집기가 빈 꼴(또는 null)을 보내면 손대지 않음
 *   ③ 같은 출처(또는 짝)면 **합칩니다** (`j || excluded`) — 같은 열쇠는 수집기 값이 이깁니다
 *   ④ 다른 출처면 손대지 않음
 *
 * ★ 합치면 **낡은 열쇠가 영영 남습니다** — `detail`·`뽑은값` 도 같은 성질이고
 *   2026 내내 탈이 없었습니다. 치울 일이 생기면 그때 창구를 따로 둡니다.
 *
 * ★ 인수가 그대로라 `create or replace` 가 ACL 을 유지합니다 (지침 6-2).
 *   그래도 전후로 `pg_proc.proacl` 을 찍어 글자까지 같은지 봅니다.
 * ★ 되돌림은 `~/되돌림/` 에 날짜(KST)를 붙여 남깁니다 (지침 8-19).
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
  const d = new Date();
  const 두 = (n) => String(n).padStart(2, '0');
  const 때 = String(d.getFullYear()) + 두(d.getMonth() + 1) + 두(d.getDate())
    + '_' + 두(d.getHours()) + 두(d.getMinutes()) + 두(d.getSeconds());
  return path.join(터, 'collect_put_되돌리기_' + 때 + '.sql');
};

export const 낡은줄 =
  "        evidence   = case when (j.source = p_source or j.source = v_짝) then excluded.evidence   else j.evidence end,";

export const 새줄 = [
  '        /* ★ 2026-10-23 세중님 승인 — **덮지 않고 합칩니다.**',
  '           전에는 `then excluded.evidence` 라 통째로 덮었고, 수집기가 evidence 를',
  '           안 보내면 `coalesce(r->\'evidence\',\'{}\')` 가 들어와 **빈 꼴**이 됐습니다.',
  '           2026-10-23 09:49 에 GJ305543 에 적은 직군 근거가 13:42 upsert 에 지워졌습니다',
  '           (2026-10-14 결정 — 「근거를 evidence 에 원문 줄로」).',
  '           꼴은 **위 `detail` 줄과 같습니다** (지침 6절 — 새로 만들지 않습니다). */',
  '        evidence   = case when j.admin_locked then j.evidence',
  "                          when excluded.evidence is null or excluded.evidence = '{}'::jsonb then j.evidence",
  '                          when (j.source = p_source or j.source = v_짝)',
  "                               then coalesce(j.evidence, '{}'::jsonb) || excluded.evidence",
  '                          else j.evidence end,',
].join('\n');

export function 바꾸기(본문) {
  const s = String(본문 || '');
  if (s.includes('덮지 않고 합칩니다')) throw new Error('이미 들어 있습니다 — 두 번 넣지 않습니다');
  const 몇 = s.split(낡은줄).length - 1;
  if (몇 !== 1) throw new Error('evidence 줄이 ' + 몇 + '번 나옵니다 (1번이어야 합니다)');
  return s.replace(낡은줄, 새줄);
}

/* ── 자기점검 ─────────────────────────────────────────── */
function 자기점검() {
  const 잼 = [];
  const 보 = (무엇, 참) => 잼.push([무엇, !!참]);
  const 본 = [
    'CREATE OR REPLACE FUNCTION public.collect_put(p_source text, p_rows jsonb)',
    'AS $function$',
    '      on conflict (id) do update set',
    '        detail     = case when j.admin_locked then j.detail',
    "                          when excluded.detail is null or excluded.detail = '{}'::jsonb then j.detail",
    '                          when (j.source = p_source or j.source = v_짝)',
    "                               then coalesce(j.detail, '{}'::jsonb) || excluded.detail",
    '                          else j.detail end,',
    낡은줄,
    '        updated_at = now()',
    '$function$',
  ].join('\n');

  let 새 = null;
  try { 새 = 바꾸기(본); } catch (e) { 보('견본에 적용됨 (' + e.message + ')', false); }
  if (새) {
    보('덮는 꼴이 사라졌다', !새.includes('then excluded.evidence   else j.evidence end'));
    보('admin_locked 갈래가 생겼다', 새.includes('case when j.admin_locked then j.evidence'));
    보('빈 꼴·null 이면 손 안 댄다',
      새.includes("when excluded.evidence is null or excluded.evidence = '{}'::jsonb then j.evidence"));
    보('같은 출처면 합친다',
      새.includes("then coalesce(j.evidence, '{}'::jsonb) || excluded.evidence"));
    보('다른 출처면 손 안 댄다', 새.includes('else j.evidence end,'));
    보('detail 줄은 안 건드렸다',
      새.includes("then coalesce(j.detail, '{}'::jsonb) || excluded.detail"));
    /* detail 과 **같은 꼴**인가 — 글자로 견줍니다 (지침 6절).
       ★ 주석 줄에도 「evidence」가 들어 있어서 처음엔 이 점검이 헛걸렸습니다.
         **SQL 줄만** 봅니다 — 다듬은 뒤 `◆ = case` · `when` · `then` · `else` 로
         시작하는 줄입니다 */
    const 꼴만 = (s, 칸) => s.split('\n')
      .map((l) => l.replace(new RegExp(칸, 'g'), '◆').replace(/\s+/g, ' ').trim())
      .filter((l) => l.includes('◆') && /^(?:◆ = case|when |then |else )/.test(l))
      .join('|');
    보('★ evidence 꼴이 detail 꼴과 글자까지 같다',
      꼴만(새, 'evidence') === 꼴만(새, 'detail'));
    보('두 번 넣으면 멈춘다', (() => { try { 바꾸기(새); return false; } catch { return true; } })());
    보('자리가 없으면 멈춘다', (() => { try { 바꾸기('아무 글'); return false; } catch { return true; } })());
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
  const 임시 = '/tmp/collect_put_evi_' + process.pid + '.sql';
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
  + " where n.nspname = 'public' and p.proname = 'collect_put';";

const 전권한 = psql(권한보기).trim();
console.log('\n── 올리기 전 ACL ──\n  ' + 전권한);

const 본문 = psql("select pg_get_functiondef(p.oid)\n"
  + '  from pg_proc p join pg_namespace n on n.oid = p.pronamespace\n'
  + " where n.nspname = 'public' and p.proname = 'collect_put';").trim();
if (!본문.startsWith('CREATE OR REPLACE FUNCTION')) {
  console.error('✗ 본문을 못 떴습니다 (앞 80자) — ' + 본문.slice(0, 80));
  process.exit(1);
}
console.log('  지금 본문 ' + 본문.split('\n').length + '줄 · ' + 본문.length + '자');

let 새본문;
try { 새본문 = 바꾸기(본문); } catch (e) { console.error('✗ ' + e.message); process.exit(1); }
console.log('  새 본문 ' + 새본문.split('\n').length + '줄 (+'
  + (새본문.split('\n').length - 본문.split('\n').length) + '줄)');

console.log('\n════════ 바꾸는 한 자리 ════════');
console.log('낡 ' + 낡은줄.trim());
console.log('새 ' + 새줄.replace(/\/\*[\s\S]*?\*\//, '/*…주석…*/').split('\n')
  .map((l) => l.trim()).filter(Boolean).join(' ⏎ '));
console.log('════════ 끝 ════════');

if (!진짜) {
  console.log('\n[마른] 아무것도 안 올립니다 — --진짜 로 올립니다');
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

console.log('\n── 올린 뒤 evidence 줄 ──');
console.log(psql("select pg_get_functiondef(p.oid)\n"
  + '  from pg_proc p join pg_namespace n on n.oid = p.pronamespace\n'
  + " where n.nspname = 'public' and p.proname = 'collect_put';")
  .split('\n').filter((l) => l.includes('evidence')).map((l) => '  ' + l.trim()).join('\n'));
