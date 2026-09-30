/* 서버에 넣을 .env 를 만듭니다 (2026-09-30).
 *
 *   node tools/서버env.mjs            무엇이 들어가는지 이름만 보여 줍니다
 *   node tools/서버env.mjs --내보내기  알맹이를 표준출력으로 (ssh 로 파이프)
 *
 * ⚠ 서버에 넣을 때는 **덮어쓰지 말고 합치세요.** 2026-09-30 에 덮어써서
 *   서버에만 있던 COLLECT_KEY_AL2 · COLLECT_KEY_CE2 · ALIVE_KEY 를 잃었습니다.
 *
 *   node tools/서버env.mjs --내보내기 \
 *     | ssh ubuntu@… 'node ~/potlab/tools/env합치기.mjs ~/potlab/.env'
 *
 * ── 지킬 것 ───────────────────────────────────────────────
 * · `--내보내기` 없이는 **값을 한 글자도 안 찍습니다**
 * · 서버에 안 올리는 것 — SUPABASE_SERVICE_KEY (세중님 지침) · VAPID/PUSH
 * · 열쇠는 .env.local · .env.server · gas/wage.js · gas/ocr/README.md 에서 모읍니다
 */
import fs from 'node:fs';

const 있는것 = {};
for (const f of ['.env.local', '.env', 'web/.env.local', '.env.server']) {
  if (!fs.existsSync(f)) continue;
  fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((l) => {
    const m = l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*?)\s*$/);
    if (m && m[2]) 있는것[m[1]] = m[2];      // 뒤 파일이 이깁니다 (.env.server 가 마지막)
  });
}
/* gas 안에 박혀 있는 것 */
const gas = fs.readFileSync('gas/wage.js', 'utf8');
const 꺼내기 = (re) => (gas.match(re) || [])[1] || '';
있는것.ALIO_DETAIL_KEY ||= 꺼내기(/const JOB3_API = \{[\s\S]*?KEY:\s*'([^']+)'/);
있는것.ALIO_LIST_KEY   ||= 꺼내기(/const JOB_API = \{[\s\S]*?KEY:\s*'([^']+)'/);
있는것.OCR_GAS_URL     ||= fs.existsSync('gas/ocr/README.md')
  ? (fs.readFileSync('gas/ocr/README.md', 'utf8')
      .match(/https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec/) || [''])[0] : '';

/* ⚠ 공공데이터 인증키는 **gas/wage.js 의 JOB2_API 가 쓰는 것**을 그대로 씁니다.
 *
 * 2026-09-30 에 재발급을 받았지만 그 열쇠에는 운영계정 상향 한도가 안 붙어
 * 알리오 상세가 하루 1,000건이었습니다 (우리만 1,230건을 씁니다).
 * 세중님 결정 — **옛 열쇠를 그대로 씁니다.** 이 열쇠는 공개 채용공고를 읽는
 * 열쇠라 남이 써도 우리 한도를 축내는 것 말고는 할 수 있는 게 없고,
 * 노출 뒤 사용량도 한도의 1.2% 로 정상입니다.
 * 대신 **서비스별 하루 사용량이 70% 를 넘으면 알립니다** (api_quota).
 *
 * 그래서 .env.server 에 다른 값이 들어 있어도 여기서는 gas 쪽을 씁니다. */
const 살아있는열쇠 = 꺼내기(/const JOB2_API = \{[\s\S]*?KEY:\s*'([^']+)'/);
if (살아있는열쇠) { 있는것.CLEANEYE_KEY = 살아있는열쇠; 있는것.ALIO_DETAIL_KEY = 살아있는열쇠; }

/* 별명 */
있는것.SUPABASE_URL ||= 있는것.NEXT_PUBLIC_SUPABASE_URL;
있는것.SUPABASE_ANON_KEY ||= 있는것.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/* 서버가 쓰는 것만. **SUPABASE_SERVICE_KEY 는 일부러 뺐습니다** */
const 넣을것 = [
  'SUPABASE_URL', 'SUPABASE_ANON_KEY',
  'COLLECT_KEY_AL2', 'COLLECT_KEY_CE2', 'COLLECT_KEY_HS3', 'COLLECT_KEY_JF',
  'ALIO_LIST_KEY', 'ALIO_DETAIL_KEY', 'CLEANEYE_KEY',
  'OCR_GAS_URL', 'OCR_KEY',
  'RESEND_KEY', 'MAIL_FROM', 'NOTIFY_EMAIL',
  'ALIVE_KEY', 'EXPORT_KEY', 'APPS_SCRIPT_URL', 'ADMIN_URL', 'VERCEL_BASE',
];

if (process.argv.includes('--내보내기')) {
  /* ⚠ 값에 따옴표를 씌웁니다. `.env` 를 셸에서 `. ./.env` 로 읽는데,
     괄호·빈칸이 든 값을 안 씌우면 「syntax error near unexpected token `('」 가 납니다
     (2026-09-30 에 POTJOB_WHERE 로 겪었습니다). 작은따옴표 안은 셸이 안 건드립니다. */
  const 씌우기 = (v) => "'" + String(v).replace(/'/g, "'\\''") + "'";
  const 줄 = ['# potjob 수집기 · Lightsail 서울 (2026-09-30 에 만듦)',
    '# SUPABASE_SERVICE_KEY 는 일부러 안 넣었습니다 — 공개 키 + DB 함수로 갑니다',
    'POTJOB_WHERE=' + 씌우기('Lightsail 서울 (ap-northeast-2)'), 'TZ=Asia/Seoul'];
  for (const k of 넣을것) if (있는것[k]) 줄.push(k + '=' + 씌우기(있는것[k]));
  process.stdout.write(줄.join('\n') + '\n');
} else {
  console.log('서버 .env 에 들어갈 것 — 값은 안 찍습니다\n');
  console.table(넣을것.map((k) => ({
    이름: k, 있나: 있는것[k] ? '○' : '✗ 없음', 길이: 있는것[k] ? 있는것[k].length : 0,
  })));
  const 빈것 = 넣을것.filter((k) => !있는것[k]);
  console.log(빈것.length ? '\n아직 없는 것: ' + 빈것.join(' · ') : '\n다 있습니다');
  console.log('일부러 뺀 것: SUPABASE_SERVICE_KEY · VAPID_* · PUSH_KEY');
}
