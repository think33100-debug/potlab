/* **서버 작업나무가 더러우면 경고합니다** (2026-10-22 세중님 4번 · 지침 8-10)
 *
 *   node tools/작업나무점검.mjs            봅니다 (더러우면 exit 1)
 *   node tools/작업나무점검.mjs --메일      더러울 때만 메일을 보냅니다
 *
 * ── 왜 ───────────────────────────────────────────────────────────
 * 2026-10-22 밤에 **세 번째**로 같은 일을 했습니다 — 저장소에 커밋하지 않고
 * 파일을 서버에 **직접 복사**했습니다. 그러면 서버 작업나무가 더러워지고
 * `git pull` 이 막힙니다. 그날 밤 여덜 파일이 그렇게 막혔습니다
 * (고쳐 보니 저장소와 **글자까지 같았습니다** — 그래서 더 위험합니다.
 *  서버에서 도는 코드가 저장소와 다를 수 있는데 아무도 모릅니다).
 *
 * 규칙으로 막으려 했지만 세 번 어겼습니다. 그래서 **도구로** 막습니다 (세중님 지시).
 *
 * ── 무엇을 보나 ──────────────────────────────────────────────────
 *   ① 추적 중인 파일이 고쳐졌나 (M·A·D·R)   ← 이것이 「더러움」입니다
 *   ② HEAD 가 origin 보다 뒤처졌나           ← git pull 을 안 한 것입니다
 *   ③ 추적 안 되는 **코드** 파일이 있나 (tools/·web/·supabase/ 의 .mjs·.ts·.sql)
 * 자료 파일(log/·*.json 결과)은 **안 셉니다** — .gitignore 에 넣었습니다.
 *
 * ★ 아무것도 바꾸지 않습니다. 읽기와 메일뿐입니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 뿌리 = path.join(여기, '..');
const 메일보내기 = process.argv.includes('--메일');

const 깃 = (...옛) => {
  try { return execFileSync('git', ['-C', 뿌리, ...옛], { encoding: 'utf8' }).trim(); }
  catch (e) { return '✗ ' + String(e.message).slice(0, 120); }
};

const 줄들 = 깃('status', '--porcelain').split('\n').filter(Boolean);
const 고쳐진것 = 줄들.filter((l) => /^[ MARCD][MARCD]/.test(l) || /^[MARCD]/.test(l));
const 코드꼴 = /\.(mjs|js|ts|tsx|sql|json|md)$/;
const 안추적된코드 = 줄들.filter((l) => l.startsWith('??'))
  .map((l) => l.slice(3).replace(/^"|"$/g, ''))
  .filter((f) => /^(tools|web|supabase)\//.test(f) && 코드꼴.test(f));

/* origin 과 견주기 — 받아만 보고 합치지 않습니다 */
깃('fetch', '--quiet', 'origin');
const 뒤처짐 = 깃('rev-list', '--count', 'HEAD..@{upstream}');
const 앞섬 = 깃('rev-list', '--count', '@{upstream}..HEAD');

const 탈 = [];
if (고쳐진것.length) 탈.push('추적 중인 파일이 고쳐졌습니다 — ' + 고쳐진것.length + '개');
if (안추적된코드.length) 탈.push('저장소에 없는 코드 파일이 있습니다 — ' + 안추적된코드.length + '개');
if (/^\d+$/.test(뒤처짐) && Number(뒤처짐) > 0) 탈.push('저장소보다 ' + 뒤처짐 + '커밋 뒤처졌습니다 (git pull 을 안 했습니다)');
if (/^\d+$/.test(앞섬) && Number(앞섬) > 0) 탈.push('서버에만 있는 커밋이 ' + 앞섬 + '개 있습니다');

const 글 = [];
글.push('서버 작업나무 점검 — ' + new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 16));
글.push('HEAD  ' + 깃('log', '--oneline', '-1'));
글.push('');
if (!탈.length) {
  글.push('○ 깨끗합니다 — 서버가 도는 코드가 저장소와 같습니다');
} else {
  글.push('██ 서버가 도는 코드가 저장소와 다를 수 있습니다 ██');
  for (const x of 탈) 글.push('  ✗ ' + x);
  if (고쳐진것.length) {
    글.push('');
    글.push('고쳐진 파일');
    for (const l of 고쳐진것.slice(0, 12)) 글.push('    ' + l);
  }
  if (안추적된코드.length) {
    글.push('');
    글.push('저장소에 없는 코드 파일');
    for (const f of 안추적된코드.slice(0, 12)) 글.push('    ' + f);
  }
  글.push('');
  글.push('고치는 법 — 서버에서');
  글.push('    cd ~/potlab && git status          # 무엇이 다른지 먼저 봅니다');
  글.push('    git diff                           # 서버에만 있는 고침이 값진 것인지 봅니다');
  글.push('    git checkout -- <파일>             # 저장소 것으로 되돌립니다');
  글.push('    git pull');
  글.push('★ 까닭은 거의 늘 **커밋하지 않고 서버에 직접 복사한 것**입니다 (지침 8-10).');
}
console.log(글.join('\n'));

if (메일보내기 && 탈.length) {
  const cfg = {};
  for (const f of [path.join(뿌리, '.env'), path.join(뿌리, '.env.local')]) {
    if (!fs.existsSync(f)) continue;
    for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
      const m = l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*?)\s*$/);
      if (m && !cfg[m[1]]) cfg[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  }
  if (cfg.RESEND_KEY && cfg.NOTIFY_EMAIL) {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + cfg.RESEND_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: cfg.MAIL_FROM || 'potjob <onboarding@resend.dev>',
        to: [cfg.NOTIFY_EMAIL],
        subject: '[피오티잡] ★ 서버 작업나무가 더럽습니다 — ' + 탈.length + '가지',
        text: 글.join('\n'),
      }),
    });
    console.log(r.ok ? '\n메일을 보냈습니다' : '\n메일 못 보냄 — HTTP ' + r.status);
  } else {
    console.log('\n※ RESEND_KEY·NOTIFY_EMAIL 이 없어 메일은 못 보냅니다');
  }
}
process.exit(탈.length ? 1 : 0);
