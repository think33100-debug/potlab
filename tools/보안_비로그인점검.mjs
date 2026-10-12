/* 열려 있는 창구 점검 — **비로그인(anon)과 로그인(authenticated) 둘 다**
 * (2026-10-07 → 10-09 에 뒤집음 → **10-12 에 로그인까지 넓힘**).
 *
 * ★ 2026-10-12 — 전까지는 **비로그인만** 봤습니다. 그래서 job_posts 를 대량으로
 *   고치는데 열쇠도 is_admin() 도 없이 authenticated 에게 열려 있던 창구 넷을
 *   한 번도 보지 않았습니다 (fill_deadline_from_title · hide_closed_by_title ·
 *   hide_backfill_nodate · 시험자료치우기). 셈은 tools/보안_열린것.mjs 한 곳입니다.
 *
 *   node tools/보안_비로그인점검.mjs            견주기만 (허용 목록 밖이 있으면 exit 1)
 *   node tools/보안_비로그인점검.mjs --처음      지금 상태로 허용 목록을 처음 만듭니다
 *
 * ── 왜 뒤집었나 ──────────────────────────────────────────────
 * 처음 판은 **손으로 적은 목록**이었습니다. 표 21개·함수 22개를 적어 두고
 * 「이것들이 막혔나」를 물었습니다. 그래서 목록에 없는 org_public 이
 * 비로그인에게 열려 있던 것을 **보름 동안 못 잡았습니다**
 * (2026-09-25 에 인수가 늘며 새 함수가 되었고 PUBLIC 이 다시 붙었습니다).
 *
 * 이제 거꾸로 묻습니다 — **「허용 목록 밖에 열린 것이 있나」**.
 * 목록은 DB 가 만들고, 사람은 「왜 열어 두는지」만 적습니다.
 *
 * ── 응답이 아니라 권한으로 판정합니다 ────────────────────────
 * 앞 판은 돌아온 몸통이 `[]` 면 「○ 열리지만 빈 것」으로 봤습니다.
 * org_public 은 인수를 안 주면 `[]` 라, 목록에 있었더라도 ○ 로 지나갔습니다.
 * 그래서 이제 has_function_privilege / has_table_privilege 로 봅니다 —
 * **부를 수 있나**가 기준이고, 무엇이 나오는지는 안 봅니다.
 *
 * ── 이름에 인수까지 적습니다 ─────────────────────────────────
 * org_public(text,text,text,text) 처럼. 인수가 바뀌면 **다른 함수**이고
 * 권한이 기본값으로 돌아가므로, 그때 반드시 새 줄로 걸립니다.
 *
 * 열쇠 값은 어디에도 찍지 않습니다. service 열쇠로 열린창구() 를 부릅니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 열린것견주기, 허용목록읽기, 왜, 목록파일 } from './보안_열린것.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 처음인가 = process.argv.includes('--처음');

function env() {
  const out = {};
  for (const f of [path.join(여기, '..', '.env.local'), path.join(여기, '..', '.env'),
    path.join(여기, '..', 'web', '.env.local')]) {
    if (!fs.existsSync(f)) continue;
    fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((l) => {
      const m = l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*?)\s*$/);
      if (m && !out[m[1]]) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    });
  }
  Object.keys(process.env).forEach((k) => { if (process.env[k]) out[k] = process.env[k]; });
  out.SUPABASE_URL = out.SUPABASE_URL || out.NEXT_PUBLIC_SUPABASE_URL;
  out.SUPABASE_SERVICE_KEY = out.SUPABASE_SERVICE_KEY || out.SUPABASE_SERVICE_ROLE_KEY;
  return out;
}

const cfg = env();
if (!cfg.SUPABASE_URL || !cfg.SUPABASE_SERVICE_KEY) {
  console.error('SUPABASE_URL · SUPABASE_SERVICE_KEY 가 없습니다');
  process.exit(2);
}

const 답 = await 열린것견주기(cfg);

if (처음인가) {
  const 줄 = (x) => ({ 이름: x['이름'], 왜: 왜[x['갈래']] || '(왜 열어 두는지 적으십시오)' });
  const 칸만들기 = (칸) => {
    const s2 = 답[칸];
    if (!s2) return null;
    return { 함수: (s2.원본['함수'] || []).map(줄), 표: (s2.원본['표'] || []).map(줄) };
  };
  fs.writeFileSync(목록파일, JSON.stringify({
    만든날: new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10),
    '왜 이 파일이 있나':
      '열어 두기로 **정한** 창구만 적습니다. 비로그인(anon)과 로그인(authenticated)을 '
      + '따로 둡니다 — 전까지 비로그인만 봐서, authenticated 에게 열려 있던 창구 넷을 '
      + '2026-10-12 까지 못 잡았습니다. 여기 없는 것이 열려 있으면 점검이 실패하고 '
      + '하루 요약 메일에도 한 줄이 뜹니다. 이름에 인수까지 적는 까닭 — 인수가 바뀌면 '
      + '새 함수가 되고 권한이 기본값(PUBLIC)으로 돌아갑니다 (지침 6-2).',
    비로그인: 칸만들기('비로그인'),
    로그인: 칸만들기('로그인'),
  }, null, 2) + '\n', 'utf8');
  for (const 칸 of ['비로그인', '로그인']) {
    const s2 = 답[칸];
    console.log('  ' + 칸 + ' — ' + (s2 ? ('함수 ' + s2.열림.함수 + ' · 표 ' + s2.열림.표) : '못 봤습니다'));
  }
  console.log('공개허용목록.json 을 지금 상태로 만들었습니다.');
  console.log('★ 로 시작하는 줄은 **닫아야 할 후보**입니다. 닫은 뒤 그 줄을 지우십시오.');
  process.exit(0);
}

if ((답.못봄 || []).length) {
  console.error('★ 점검을 못 한 칸이 있습니다 —');
  답.못봄.forEach((m) => console.error('  ' + m));
}

let 탈 = 0;
for (const 칸 of ['비로그인', '로그인']) {
  const s2 = 답[칸];
  console.log('');
  if (!s2) { console.log(칸 + ' — 못 봤습니다'); 탈++; continue; }
  console.log(칸 + '에게 열린 것 — 함수 ' + s2.열림.함수 + ' · 표 ' + s2.열림.표
    + (s2.옛창구 ? '  (옛 열린창구() 로 봤습니다)' : ''));
  if (!s2.목록있나) {
    console.log('  ★ 허용 목록에 「' + 칸 + '」 칸이 없습니다 — --처음 으로 만드십시오');
    탈++;
    continue;
  }
  if (s2.밖.length) {
    console.log('  ★ 허용 목록에 없는데 열려 있습니다 — ' + s2.밖.length + '건');
    s2.밖.forEach((n) => console.log('     ' + n));
    탈++;
  }
  if (s2.닫힘.length) {
    console.log('  ○ 허용 목록에 있는데 지금은 닫혀 있습니다 (목록을 줄이세요) — ' + s2.닫힘.length + '건');
    s2.닫힘.forEach((n) => console.log('     ' + n));
  }
  if (!s2.밖.length && !s2.닫힘.length) console.log('  ○ 목록과 똑같습니다');
}

console.log('');
if (탈) {
  console.log('허용 목록 밖에 열린 것이 있습니다. '
            + '일부러 연 것이면 공개허용목록.json 에 **왜** 와 함께 적으십시오.');
  process.exit(1);
}
console.log('○ 두 역할 모두 허용 목록 밖에 열린 것 없습니다.');
