/* 별명 두 줄의 **후보를 전부** 펼쳐 봅니다 — 넷에서 끊지 않고 (2026-10-29 세중님 ㉡)
 *
 *   node tools/후보전부_1029.mjs          읽기만 (아무것도 안 바꿉니다)
 *   node tools/후보전부_1029.mjs --자기점검
 *
 * ── 왜 ───────────────────────────────────────────────────────
 * 손확인 ① 문서는 후보를 **넷까지만** 적습니다 (심평원후보.mjs 의 limit 4).
 * 세중님 10/29 답: 「삼동회정읍시립요양병원 · 신안의료재단연세요양병원 — 후보 전부
 * 펼쳐서 「정읍」「신안의료재단」 든 줄이 있으면 그 번호를 올리고, 없으면 아님.」
 * 그래서 같은 꼬리 규칙으로 **전부** 적고, 찾을 글자가 든 줄에 ★ 를 답니다.
 * ★ 제가 고르지 않습니다 (지침 10-3) — 찾은 것 그대로 적고 세중님이 고릅니다.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { 뗄말 } from './심평원후보.mjs';

/** 찾을 것 — 기관번호 : 그 줄에 들었나 볼 글자들 */
export const 볼것 = [
  { 키: 'NAME:삼동회정읍시립요양병원', 글자: ['정읍'] },
  { 키: 'NAME:신안의료재단연세요양병원', 글자: ['신안의료재단', '신안'] },
];

/** 그 후보 줄이 찾는 글자를 품었나 */
export function 품었나(줄, 글자들) {
  return 글자들.filter((g) => String(줄).includes(g));
}

if (process.argv.includes('--자기점검')) {
  const 잼 = [];
  const 보 = (무엇, 참) => 잼.push([무엇, !!참]);
  보('정읍이 들면 찾는다', 품었나('정읍시립요양병원 · 요양병원 · 전북 정읍시 · HIRA:x', ['정읍']).length === 1);
  보('안 들면 안 찾는다', 품었나('상주시립요양병원 · 요양병원 · 경북 상주시 · HIRA:x', ['정읍']).length === 0);
  보('두 글자 중 하나만 들어도 찾는다',
    품었나('신안연세요양병원 · HIRA:x', ['신안의료재단', '신안']).join(',') === '신안');
  보('빈 줄은 안 찾는다', 품었나('', ['정읍']).length === 0);
  const 어긴것 = 잼.filter(([, ok]) => !ok);
  for (const [무엇, ok] of 잼) console.log((ok ? '  ○ ' : '  ✗ ') + 무엇);
  if (어긴것.length) { console.error('✗ 자기점검 ' + 어긴것.length + '가지 실패'); process.exit(1); }
  console.log('○ 자기점검 통과 — ' + 잼.length + '가지');
  process.exit(0);
}

const 뿌리 = path.join(import.meta.dirname, '..');
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
  const 임시 = path.join(os.tmpdir(), '후보전부_' + process.pid + '.sql');
  fs.writeFileSync(임시, sql, 'utf8');
  const r = spawnSync('psql', ['-X', '-A', '-t', '-q', '-F', '\t', '-v', 'ON_ERROR_STOP=1', '-f', 임시],
    { encoding: 'utf8', maxBuffer: 1 << 26, env });
  fs.unlinkSync(임시);
  if (r.status) { console.error('✗ psql\n' + (r.stderr || '').slice(0, 900)); process.exit(1); }
  return (r.stdout || '').trimEnd();
}
const 줄로 = (sql) => psql(sql).split('\n').filter(Boolean).map((l) => l.split('\t'));
const 따옴 = (s) => String(s).replace(/'/g, "''");

/* 문서가 쓴 것과 **같은 꼬리 규칙** — right(이름키 - 뗄말, 6) 을 품은 이름 */
const 꼬리식 = "right(regexp_replace(hira_name_key(n.org_name), '" + 뗄말 + "', '', 'g'), 6)";

for (const { 키, 글자 } of 볼것) {
  console.log('\n══ ' + 키 + ' ══');
  const 꼬리 = psql("select " + 꼬리식 + " from (select min(org_name) as org_name"
    + " from job_posts where \"기관번호\" = '" + 따옴(키) + "') n;").trim();
  console.log('  이름 꼬리(후보를 찾는 열쇠) — 「' + 꼬리 + '」');
  const 후보 = 줄로("select h.yadm_nm || ' · ' || coalesce(h.cl_cd_nm,'종별 모름')"
    + " || ' · ' || coalesce(h.sido_nm,'') || ' ' || coalesce(h.sggu_nm,'')"
    + " || ' · HIRA:' || h.ykiho from hira_org h"
    /* 꼬리를 **값으로** 받아 그대로 넣습니다 — 문서가 쓴 것과 같은 like 한 줄 */
    + " where h.name_key like '%" + 따옴(꼬리) + "%' order by h.yadm_nm;");
  console.log('  후보 ' + 후보.length + '곳 — 전부:');
  let 걸린것 = 0;
  for (const [s] of 후보) {
    const 든것 = 품었나(s, 글자);
    if (든것.length) 걸린것++;
    console.log((든것.length ? '    ★ ' : '      ') + s + (든것.length ? '   ← 「' + 든것.join('·') + '」' : ''));
  }
  console.log('  → ' + (걸린것 ? '★ ' + 걸린것 + '줄이 그 글자를 품었습니다 — 세중님 확인'
    : '그 글자를 품은 줄이 **없습니다** → 아님'));

  /* 후보 밖 — 심평원 **전체**에서 그 글자로 한 번 더 (꼬리로 못 걸린 곳이 있나) */
  for (const g of 글자) {
    const 밖 = 줄로("select h.yadm_nm || ' · ' || coalesce(h.cl_cd_nm,'종별 모름')"
      + " || ' · ' || coalesce(h.sido_nm,'') || ' ' || coalesce(h.sggu_nm,'')"
      + " || ' · HIRA:' || h.ykiho from hira_org h"
      + " where h.yadm_nm like '%" + 따옴(g) + "%' order by h.yadm_nm limit 30;");
    console.log('  [후보 밖] 심평원 이름에 「' + g + '」 — ' + 밖.length + '곳'
      + (밖.length ? ':' : ' (없음)'));
    for (const [s] of 밖) console.log('      · ' + s);
  }
}
