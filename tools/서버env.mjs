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
/* 고용24(워크넷) 전용 열쇠 — **공공데이터포털 열쇠가 아닙니다.** UUID 36자 */
있는것.WORK_KEY        ||= 꺼내기(/const WORK_API = \{[\s\S]*?KEY:\s*'([^']+)'/);
있는것.OCR_GAS_URL     ||= fs.existsSync('gas/ocr/README.md')
  ? (fs.readFileSync('gas/ocr/README.md', 'utf8')
      .match(/https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec/) || [''])[0] : '';

/* 공공데이터 인증키는 **.env.server 를 먼저** 씁니다 (2026-10-01 에 뒤집었습니다).
 *
 * ── 전에는 반대였습니다 ─────────────────────────────────────
 * 9/30 에 「옛 열쇠를 그대로 쓴다」 고 정해서, .env.server 에 새 열쇠가
 * 들어 있어도 여기서 gas/wage.js 의 옛 열쇠로 덮었습니다.
 *
 * ── 그 전제가 틀렸습니다 ────────────────────────────────────
 * 10/1 에 두 열쇠로 세 서비스를 한 번씩 불러 보니 —
 *     클린아이 B551982   옛 403 미등록  |  새 200
 *     나라일터 1760000   옛 403 미등록  |  새 200
 *     알리오   1051000   옛 403 미등록  |  새 200
 * **옛 열쇠는 세 곳 다 죽었습니다.** 세중님이 포털에서 확인하신 것도
 * 같았습니다 — 운영계정 승인(2026-09-08~2028-09-08)에 붙은 인증키가
 * 새 열쇠이고, /detail·/list 각 100,000/일입니다.
 *
 * ── gas/wage.js 는 안 건드립니다 ───────────────────────────
 * 그 파일은 동결이고, 새 열쇠를 파일에 박지 않습니다.
 * (확인 — 저장소에 추적되지 않고 원격에도 없습니다. 옛 열쇠는 그 안
 *  10군데에 있지만 공개된 적은 없습니다)
 * 옛 앱(Apps Script)의 JOB2·JOB3 수집기는 10/3 정리 대상입니다. */
if (!있는것.CLEANEYE_KEY || !있는것.ALIO_DETAIL_KEY) {
  const gas열쇠 = 꺼내기(/const JOB2_API = \{[\s\S]*?KEY:\s*'([^']+)'/);
  if (gas열쇠) {
    있는것.CLEANEYE_KEY ||= gas열쇠;
    있는것.ALIO_DETAIL_KEY ||= gas열쇠;
    console.error('⚠ .env.server 에 공공데이터 열쇠가 없어 gas/wage.js 것을 씁니다 — '
      + '그 열쇠는 2026-10-01 기준 죽어 있습니다');
  }
}

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
  'WORK_KEY',
  /* 백업 (2026-10-01). Supabase 무료 요금제에 Daily backups 가 없어
     서버에 임시로 떠 둡니다. tools/백업.mjs 가 이 둘을 씁니다.
     ⚠ SUPABASE_DB_URL 에는 DB 비밀번호가 들어 있습니다 —
       .env.server 는 .gitignore 50번 줄이 막고 있고 한 번도 올라간 적 없습니다 */
  'SUPABASE_DB_URL', 'BACKUP_KEY',
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
