/* ═══════════════════════════════════════════════════════════════
 *  100줄 한도 검사 — 조용히 잘려 나가는 조회를 찾습니다 (2026-10-04)
 * ═══════════════════════════════════════════════════════════════
 *   node tools/백줄검사.mjs          어긋난 곳만
 *   node tools/백줄검사.mjs --전부   넘긴 것까지 다 보기
 *
 *  ── 왜 있나 ──────────────────────────────────────────────────
 *  Supabase(PostgREST)는 한 번에 **100줄만** 돌려줍니다.
 *  `limit` 을 키워도 소용없습니다 — 서버 쪽 max-rows 가 이깁니다.
 *  2026-10-03 에 직접 재 봤습니다 —
 *
 *    job_posts?select=id              → 100줄  Content-Range 0-99/2112
 *    job_posts?select=id&limit=5000   → 100줄  Content-Range 0-99/2112
 *    job_posts?select=id&limit=100000 → 100줄  Content-Range 0-99/2112
 *
 *  **오류가 안 납니다.** 101번째 줄부터 그냥 없는 것이 됩니다.
 *  이 프로젝트에서 두 번 밟았습니다 (봉사목록 379→100 · 교육 102→100).
 *
 *  ── 무엇을 잡나 ──────────────────────────────────────────────
 *  ① 줄이 100을 넘을 수 있는 **표**를 쪽 나누기 없이 읽는 곳
 *  ② **여러 줄을 돌려주는 함수**(SETOF·TABLE)를 쪽 나누기 없이 부르는 곳
 *
 *  jsonb·text·boolean 처럼 **한 값**을 돌려주는 함수는 한 줄이라 안전합니다.
 *  그래서 아래 두 목록을 DB 에서 떠다 박아 둡니다. 새 함수를 만들면
 *  `node tools/백줄검사.mjs --새로고침` 안내대로 다시 떠서 고치십시오.
 * ═══════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 뿌리 = path.join(여기, '..');
const 전부보기 = process.argv.includes('--전부');

if (process.argv.includes('--새로고침')) {
  console.log(`목록을 다시 뜨려면 Supabase 에서 이 둘을 돌려 이 파일에 옮기십시오.

-- ① 여러 줄을 돌려주는 함수
select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proretset order by 1;

-- ② 100줄을 넘을 수 있는 표
select relname, n_live_tup from pg_stat_user_tables
where schemaname='public' and n_live_tup > 100 order by n_live_tup desc;`);
  process.exit(0);
}

/* ── ① 여러 줄을 돌려주는 함수 (2026-10-04 · pg_proc.proretset) ── */
const 여러줄함수 = new Set([
  'admin_stats_daily', 'admin_stats_devices', 'admin_stats_screens',
  'admin_stats_top_jobs', 'admin_stats_top_posts', 'admin_동의기록',
  'admin_신고목록', 'admin_접속기록', 'admin_회원목록', 'admin_회원표',
  'alio_compete_state_get', 'alive_targets', 'beat_health', 'collect_peek',
  'exec_keys', 'gojobs_recheck', 'job_list', 'job_one', 'job_views',
  'lang_bands', 'lang_points_check', 'org_detail', 'org_hospital_by_name',
  'org_jobs', 'org_nearby', 'org_public', 'org_search', 'rejudge_hold_list',
  'route_health', 'salary_stats', 'spec_parts_check', '공개공고', '공개공고하나',
  '교육목록', '내프로필', '보낼알림', '봉사목록', '수집기박동', '심평원받을곳',
  '있는번호', '판정물어보기',
]);

/* ── ② 100줄을 넘을 수 있는 표 (2026-10-04 · n_live_tup) ── */
const 큰표 = new Map([
  ['org_group_mv', 58610], ['alio_compete', 16522], ['alio_compete_web', 16522],
  ['봉사처', 13257], ['hira_detail', 8063], ['job_state_log', 5197],
  ['alio_group_sum', 3217], ['수집판정', 3171], ['job_trash', 2966],
  ['job_posts', 2112], ['alio_post_meta', 1914], ['alio_compete_web_state', 1914],
  ['봉사모집', 1099], ['page_hits', 1017], ['collector_beat', 869],
  ['심평원인원월별', 534], ['job_body', 213], ['교육', 109], ['alio_post_file', 108],
]);

/* 「이건 괜찮다」고 손으로 적어 둔 곳. 까닭을 반드시 함께 적습니다 */
const 봐준곳파일 = path.join(여기, '백줄검사_봐준곳.json');
const 봐준곳 = fs.existsSync(봐준곳파일)
  ? JSON.parse(fs.readFileSync(봐준곳파일, 'utf8')) : {};

const 볼곳 = [
  path.join(뿌리, 'web', 'app'), path.join(뿌리, 'web', 'lib'),
  path.join(뿌리, 'web', 'components'), path.join(뿌리, 'tools'),
];
const 파일들 = [];
const 훑기 = (d) => {
  if (!fs.existsSync(d)) return;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules' && e.name !== '.next') 훑기(p); }
    else if (/\.(tsx?|mjs|js)$/.test(e.name) && !/백줄검사/.test(e.name)) 파일들.push(p);
  }
};
for (const d of 볼곳) 훑기(d);
const 짧게 = (p) => path.relative(뿌리, p).replace(/\\/g, '/');

/* 한 조회가 여러 줄에 걸치므로 뒤 열두 줄까지 함께 봅니다 */
const 덩어리 = (줄들, i) => 줄들.slice(i, i + 12).join(' ');

const 쪽나눔 = (s) => (
  /모두받기\s*\(/.test(s)                       // tools/쪽나눠받기.mjs — 쪽을 다 돌며 받습니다
  || /\.single\(\)|\.maybeSingle\(\)/.test(s)
  || /head:\s*true/.test(s)
  || /\.range\(|offset=|&offset|\boffset:/.test(s)
  || /p_page|p_offset|_page:/.test(s)
  || (/\.limit\(\s*(\d+)/.test(s) && Number(s.match(/\.limit\(\s*(\d+)/)[1]) <= 100)
  || (/[?&]limit=(\d+)/.test(s) && Number(s.match(/[?&]limit=(\d+)/)[1]) <= 100)
);

const 걸린것 = [], 넘긴것 = [];
for (const f of 파일들) {
  const 줄들 = fs.readFileSync(f, 'utf8').split(/\r?\n/);
  줄들.forEach((l, i) => {
    const a = l.match(/\.from\(\s*['"]([^'"]+)['"]\s*\)/);
    const b = l.match(/\.rpc\(\s*['"]([^'"]+)['"]/);
    const c = l.match(/rest\/v1\/(rpc\/)?([^'"`?\s)]+)/);
    const 함수냐 = !!b || !!(c && c[1]);
    const 이름 = a ? a[1] : b ? b[1] : c ? decodeURIComponent(c[2]) : null;
    if (!이름) return;

    const s = 덩어리(줄들, i);
    /* 쓰기는 줄 수 한도와 무관합니다 */
    if (/\.(insert|update|upsert|delete)\(/.test(s) && !/\.select\(/.test(s)) return;
    if (/method:\s*['"](POST|PATCH|DELETE|PUT)['"]/.test(s) && !함수냐) return;

    /* 많이 올 수 있는 것만 봅니다 */
    const 많이올수있나 = 함수냐 ? 여러줄함수.has(이름) : 큰표.has(이름);
    const 자리 = 짧게(f) + ':' + (i + 1);
    /* ★ 봐준 곳의 열쇠는 **줄 번호가 아니라 이름**입니다.
       처음엔 「파일:줄」로 적었는데, 코드가 몇 줄만 밀려도 열쇠가 어긋나
       멀쩡하던 것이 갑자기 걸립니다. 2026-10-04 하루에 두 번 깨졌습니다.
       「파일|이름」이면 줄이 밀려도 그대로 붙어 있습니다 */
    const 열쇠 = 짧게(f) + '|' + 이름;
    const 몇줄 = 큰표.get(이름);
    if (!많이올수있나) { 넘긴것.push({ 자리, 이름, 까닭: 함수냐 ? '한 값만 돌려주는 함수' : '작은 표' }); return; }
    if (쪽나눔(s)) { 넘긴것.push({ 자리, 이름, 까닭: '쪽 나눔·한 줄·세기만' }); return; }
    if (봐준곳[열쇠]) { 넘긴것.push({ 자리, 이름, 까닭: '봐준 곳 — ' + 봐준곳[열쇠] }); return; }
    걸린것.push({ 자리, 이름, 몇줄, 함수냐, 열쇠 });
  });
}

if (전부보기) {
  console.log('── 넘긴 곳 ' + 넘긴것.length + ' ──');
  for (const x of 넘긴것) console.log('   ' + x.자리.padEnd(46) + x.이름.padEnd(26) + x.까닭);
  console.log('');
}

if (걸린것.length) {
  console.log('★ 100줄에서 잘릴 수 있는 조회 ' + 걸린것.length + '곳');
  console.log('  PostgREST 는 한 번에 100줄만 줍니다. limit 을 키워도 안 됩니다.');
  console.log('  쪽을 나누거나(.range), 100줄 안이라는 **근거**를 적어 넘기십시오 —');
  console.log('    tools/백줄검사_봐준곳.json   "파일|이름": "까닭"');
  for (const x of 걸린것) {
    console.log('   · ' + x.자리.padEnd(46) + x.이름
      + (x.몇줄 ? '  (표 ' + x.몇줄.toLocaleString() + '줄)' : '  (여러 줄 함수)'));
    console.log('       넘기려면 이 열쇠로 —  "' + x.열쇠 + '"');
  }
} else {
  console.log('○ 100줄에서 잘릴 수 있는 조회 없습니다 (넘긴 곳 ' + 넘긴것.length + ')');
}
process.exit(걸린것.length ? 1 : 0);
