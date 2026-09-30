/* 커밋 직전에 **열쇠가 섞여 들어갔는지** 봅니다 (2026-09-30).
 *
 *   node tools/열쇠검사.mjs            커밋할 것(staged)만 봅니다
 *   node tools/열쇠검사.mjs --전부      추적 중인 파일 전부
 *
 * ── 왜 만드나 ────────────────────────────────────────────────
 * 9월 30일에 `.env.server.bak-2026-09-30` 을 만들어 두고 `git add -A` 를 했습니다.
 * `.gitignore` 에 `.env.server` 는 있었지만 `.bak` 은 없어서, **공개 저장소에**
 * 열쇠 여섯 개가 1분 2초 동안 올라갔습니다.
 *
 * 막는 방법은 하나뿐입니다 — **커밋 직전에 기계가 보는 것.**
 * 사람은 「이번엔 괜찮겠지」 를 반드시 합니다.
 *
 * ── 무엇을 보나 ──────────────────────────────────────────────
 * ① 파일 이름     .env · *.bak · *.pem · id_rsa 같은 것
 * ② 알려진 값     .env* 에 실제로 들어 있는 값이 다른 파일에 그대로 있나
 * ③ 생김새        re_… · sk-… · AKIA… · 긴 base64 serviceKey · 구글 열쇠
 *
 * ② 가 핵심입니다. 생김새 규칙은 늘 빠뜨리지만, **우리 열쇠 그 자체**를
 * 찾는 것은 안 빠집니다.
 *
 * ── 값은 한 글자도 안 찍습니다 ───────────────────────────────
 * 걸리면 파일과 줄 번호, 어떤 이름의 열쇠인지만 알려 줍니다.
 */
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const 전부 = process.argv.includes('--전부');

const 깃 = (...a) => {
  try { return execFileSync('git', a, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); }
  catch { return ''; }
};

/* ⚠ **-z 로 받아야 합니다.** git 은 기본으로 한글 이름을 이렇게 줍니다 —
 *     "\355\225\234\352\270\200\354\213\234\355\227\230.md"
 * 그 이름으로는 파일을 못 엽니다. 이 저장소는 한글 이름이 많아서
 * 그냥 두면 검사가 거의 다 헛돕니다 (2026-09-30 에 시험하다 찾았습니다).
 * -z 는 NUL 로 나누고 따옴표를 안 씌웁니다. */
const 줄나누기 = (s) => s.split('\0').filter(Boolean);
const 볼파일 = 전부
  ? 줄나누기(깃('ls-files', '-z'))
  : 줄나누기(깃('diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'));

if (!볼파일.length) { console.log('볼 것이 없습니다'); process.exit(0); }

/* ── ① 아예 들어오면 안 되는 이름 ────────────────────────── */
const 나쁜이름 = [
  [/(^|[\\/])\.env($|\.)/i, '.env 계열'],
  [/\.bak(-|$)|\.바꾸기전$|~$/i, '사본 파일'],
  [/\.pem$|\.ppk$|(^|[\\/])id_(rsa|ed25519)$/i, '접속 열쇠'],
  [/(^|[\\/])(credentials|secrets?)\.(json|ya?ml|txt)$/i, '비밀 파일'],
];
/* 저장소에 일부러 두는 것 */
const 봐주기 = [/\.env\.example$/i, /(^|[\\/])\.gitignore$/];

/* ── ② 우리가 실제로 쓰는 값 ─────────────────────────────── */
const 아는값 = new Map();          // 값 → 이름
for (const f of ['.env', '.env.local', '.env.server', 'web/.env.local', '.env.server.bak']) {
  if (!fs.existsSync(f)) continue;
  for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    const v = m[2].replace(/^['"]|['"]$/g, '');
    /* 짧은 것·주소·메일은 뺍니다 — 비밀이 아니고 헛걸림만 냅니다 */
    if (v.length < 20 || /^https?:\/\//.test(v) || /@/.test(v)) continue;
    아는값.set(v, m[1]);
  }
}
/* gas 에 박혀 있는 것도 (수집기 열쇠들) */
if (fs.existsSync('gas/wage.js')) {
  const g = fs.readFileSync('gas/wage.js', 'utf8');
  for (const m of g.matchAll(/(KEY|REST_KEY)\s*:\s*'([^']{20,})'/g)) 아는값.set(m[2], 'gas 의 ' + m[1]);
}

/* ── ③ 생김새 ───────────────────────────────────────────── */
const 생김새 = [
  [/\bre_[A-Za-z0-9_-]{20,}/g, 'Resend 열쇠'],
  [/\bsk-[A-Za-z0-9_-]{20,}/g, 'OpenAI 꼴 열쇠'],
  [/\bAKIA[0-9A-Z]{16}\b/g, 'AWS 열쇠'],
  [/\bAIza[0-9A-Za-z_-]{35}\b/g, '구글 API 열쇠'],
  [/\bghp_[A-Za-z0-9]{30,}/g, 'GitHub 토큰'],
  [/\bey[A-Za-z0-9_-]{10,}\.ey[A-Za-z0-9_-]{10,}\./g, 'JWT (Supabase 열쇠 등)'],
  [/serviceKey=(?!<|%3C|\$|\{)[A-Za-z0-9%+/=]{40,}/g, '주소에 박힌 serviceKey'],
];

const 걸린것 = [];

for (const f of 볼파일) {
  if (봐주기.some((re) => re.test(f))) continue;

  for (const [re, 왜] of 나쁜이름) {
    if (re.test(f)) 걸린것.push({ 파일: f, 줄: '-', 왜: '이름이 「' + 왜 + '」 입니다' });
  }

  let 글 = '';
  try { 글 = fs.readFileSync(f, 'utf8'); } catch { continue; }   // 그림 등
  if (글.includes('\u0000')) continue;

  const 줄들 = 글.split(/\r?\n/);
  줄들.forEach((l, i) => {
    for (const [값, 이름] of 아는값) {
      if (l.includes(값)) 걸린것.push({ 파일: f, 줄: i + 1, 왜: '우리 열쇠 ' + 이름 + ' 의 값이 그대로 있습니다' });
    }
    for (const [re, 왜] of 생김새) {
      re.lastIndex = 0;
      if (re.test(l)) 걸린것.push({ 파일: f, 줄: i + 1, 왜: 왜 + ' 꼴이 보입니다' });
    }
  });
}

if (!걸린것.length) {
  console.log('○ 열쇠가 섞인 곳 없습니다 (' + 볼파일.length + '개 파일)');
  process.exit(0);
}

console.error('\n★ 커밋을 멈췄습니다 — 열쇠가 섞여 있습니다\n');
const 본것 = new Set();
for (const x of 걸린것) {
  const 표 = x.파일 + ':' + x.줄 + ' ' + x.왜;
  if (본것.has(표)) continue;
  본것.add(표);
  console.error('  ' + x.파일 + ':' + x.줄 + '  ' + x.왜);
}
console.error('\n어떻게 할지 —');
console.error('  · 그 파일을 커밋에서 빼세요        git restore --staged <파일>');
console.error('  · 저장소에 두면 안 되는 파일이면   .gitignore 에 넣으세요');
console.error('  · 정말 괜찮다면                    git commit --no-verify');
console.error('    ※ 2026-09-30 에 --no-verify 같은 마음으로 열쇠 여섯 개가 새어 나갔습니다\n');
process.exit(1);
