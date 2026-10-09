/* 비로그인에게 열려 있는 창구 점검 (2026-10-07 → 2026-10-09 에 뒤집음).
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

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 목록파일 = path.join(여기, '공개허용목록.json');
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

/* 열린창구() 는 service_role 만 부릅니다 (anon·authenticated 에서 걷었습니다) */
async function 열린것() {
  const res = await fetch(cfg.SUPABASE_URL + '/rest/v1/rpc/' + encodeURIComponent('열린창구'), {
    method: 'POST',
    headers: { apikey: cfg.SUPABASE_SERVICE_KEY,
               Authorization: 'Bearer ' + cfg.SUPABASE_SERVICE_KEY,
               'Content-Type': 'application/json',
               'x-who': 'security-check tools/anon-check' },
    body: '{}',
  });
  if (!res.ok) throw new Error(res.status + ' ' + (await res.text()).slice(0, 200));
  return res.json();
}

/* 갈래마다 「왜 열어 두는지」. --처음 일 때 이 말이 파일에 들어갑니다.
   새로 열린 것은 갈래를 모르므로, 사람이 손으로 적어야 통과합니다 */
const 왜 = {
  비회원화면: '비회원 화면이 씁니다 — 홈 · 공고 맛보기 · 교육 · 봉사 · 청년 · 커뮤니티 공개 보기',
  수집기창구: '수집기가 anon 열쇠 + p_secret 으로 돕니다 (tools/collect-*.mjs · 밤정리 · 재판정). '
            + '여기서 anon 을 걷으면 수집이 멈춥니다. 막는 자리는 p_secret 입니다',
  순수계산:   '순수 계산 — 인수만 가공하고 표를 안 읽습니다',
  트리거:     '트리거 함수 — 직접 못 부릅니다 (PostgreSQL 이 막습니다)',
  검토:       '★ 닫아야 할 후보. 2026-10-09 점검에서 표시했습니다 — '
            + '관리자·회원 자리인데 열려 있습니다. 닫을 때 이 줄을 지웁니다',
};

function 읽기() {
  if (!fs.existsSync(목록파일)) return null;
  return JSON.parse(fs.readFileSync(목록파일, 'utf8'));
}

const 열림 = await 열린것();
const 지금함수 = (열림['함수'] || []).map((x) => x['이름']);
const 지금표 = (열림['표'] || []).map((x) => x['이름']);

if (처음인가) {
  const 줄 = (x) => ({ 이름: x['이름'], 왜: 왜[x['갈래']] || '(왜 열어 두는지 적으십시오)' });
  fs.writeFileSync(목록파일, JSON.stringify({
    만든날: new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10),
    '왜 이 파일이 있나':
      '비로그인(anon)에게 열어 두기로 **정한** 창구만 적습니다. 여기 없는 것이 열려 있으면 '
      + '점검이 실패합니다. 이름에 인수까지 적는 까닭 — 인수가 바뀌면 새 함수가 되고 '
      + '권한이 기본값(PUBLIC)으로 돌아갑니다 (2026-09-25 org_public 이 그렇게 다시 열렸습니다).',
    함수: (열림['함수'] || []).map(줄),
    표: (열림['표'] || []).map((x) => ({
      이름: x['이름'],
      왜: x['갈래'] === '쓰기까지'
        ? '★ 비로그인이 **쓸 수 있습니다**. 2026-10-09 점검에서 표시했습니다 — 확인이 필요합니다'
        : '비회원 화면이 읽습니다',
    })),
  }, null, 2) + '\n', 'utf8');
  console.log('공개허용목록.json 을 지금 상태로 만들었습니다 — 함수 '
              + (열림['함수'] || []).length + ' · 표 ' + (열림['표'] || []).length);
  console.log('★ 로 시작하는 줄은 **닫아야 할 후보**입니다. 닫은 뒤 그 줄을 지우십시오.');
  process.exit(0);
}

const 허용 = 읽기();
if (!허용) {
  console.error('공개허용목록.json 이 없습니다.');
  process.exit(2);
}

const 허용함수 = new Set((허용['함수'] || []).map((x) => x['이름']));
const 허용표 = new Set((허용['표'] || []).map((x) => x['이름']));

const 새로열린함수 = 지금함수.filter((n) => !허용함수.has(n));
const 새로열린표 = 지금표.filter((n) => !허용표.has(n));
/* 닫힌 것도 알려 줍니다 — 목록이 낡으면 그것도 고쳐야 합니다 */
const 닫힌함수 = [...허용함수].filter((n) => !지금함수.includes(n));
const 닫힌표 = [...허용표].filter((n) => !지금표.includes(n));

console.log('비로그인에게 열린 것 — 함수 ' + 지금함수.length + ' · 표 ' + 지금표.length);
console.log('허용 목록        — 함수 ' + 허용함수.size + ' · 표 ' + 허용표.size);

const 보임 = (제목, 줄들) => {
  if (!줄들.length) return;
  console.log('\n' + 제목 + ' ' + 줄들.length + '건');
  줄들.forEach((n) => console.log('  ' + n));
};

보임('★ 허용 목록에 없는데 열려 있습니다 —', 새로열린함수.concat(새로열린표));
보임('○ 허용 목록에 있는데 지금은 닫혀 있습니다 (목록을 줄이세요) —', 닫힌함수.concat(닫힌표));

const 검토중 = (허용['함수'] || []).filter((x) => String(x['왜'] || '').startsWith('★')).length;
if (검토중) console.log('\n· 닫아야 할 후보로 표시해 둔 것 ' + 검토중 + '건 (허용 목록의 ★)');

if (새로열린함수.length + 새로열린표.length > 0) {
  console.log('\n허용 목록 밖에 열린 것이 있습니다. '
            + '일부러 연 것이면 공개허용목록.json 에 **왜** 와 함께 적으십시오.');
  process.exit(1);
}
console.log('\n○ 허용 목록 밖에 열린 것 없습니다.');
