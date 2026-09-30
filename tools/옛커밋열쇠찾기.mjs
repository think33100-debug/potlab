/* 공개 저장소의 **옛 커밋 전체**에서 열쇠 모양 글자를 찾습니다 (2026-10-01).
 *
 *   node tools/옛커밋열쇠찾기.mjs
 *
 * ── 왜 ───────────────────────────────────────────────────────
 * 2026-09-30 에 `.env.server.bak-…` 을 실수로 올려 열쇠 여섯 개가
 * 1분 2초 동안 공개 저장소에 있었습니다. 지금은 추적에서 뺐지만
 * **옛 커밋에는 그대로 남아 있습니다.** 그것 말고도 더 있는지 봅니다.
 *
 * ── 읽기만 합니다 ────────────────────────────────────────────
 * 아무것도 고치거나 지우지 않습니다. 기록을 다시 쓰지도 않습니다.
 *
 * ── 값은 앞 6자만 찍습니다 ───────────────────────────────────
 */
import { execFileSync } from 'node:child_process';

const 깃 = (...a) => {
  try { return execFileSync('git', a, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }); }
  catch { return ''; }
};

/* 찾을 생김새 */
const 생김새 = [
  [/\bre_[A-Za-z0-9_-]{24,}/g, 'Resend 열쇠'],
  [/\bsk-[A-Za-z0-9_-]{24,}/g, 'OpenAI 꼴'],
  [/\bAKIA[0-9A-Z]{16}\b/g, 'AWS 열쇠'],
  [/\bAIza[0-9A-Za-z_-]{35}\b/g, '구글 API 열쇠'],
  [/\bgh[pousr]_[A-Za-z0-9]{30,}/g, 'GitHub 토큰'],
  [/\bey[A-Za-z0-9_-]{15,}\.ey[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}/g, 'JWT (Supabase 열쇠 등)'],
  [/\b[A-Za-z0-9+/]{60,}={0,2}(?![A-Za-z0-9+/=])/g, '긴 base64 (공공데이터 인증키 꼴)'],
  [/\b[A-Za-z0-9%]{80,}\b/g, '긴 인코딩 문자열'],
  [/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/g, 'UUID (고용24 authKey 꼴)'],
  [/\b[0-9a-f]{64}\b/g, '64자 16진수'],
];

/* 흔한 헛걸림 — 해시·잠금파일·번들 */
const 봐주기파일 = /package-lock\.json|yarn\.lock|pnpm-lock|\.map$|\.min\.(js|css)$|node_modules|\.svg$|\.png$|\.ico$|\.woff/i;
const 봐주기값 = /^[0-9a-f]{40}$/;     // git sha

const 블롭 = 깃('cat-file', '--batch-all-objects', '--batch-check=%(objecttype) %(objectname)')
  .split('\n').filter((l) => l.startsWith('blob ')).map((l) => l.split(' ')[1]);

console.log('저장소 옛 커밋 열쇠 찾기 — 블롭 ' + 블롭.length + '개\n');

/* 블롭 → 그 블롭이 들어 있는 경로·커밋 */
const 어디 = new Map();
for (const l of 깃('rev-list', '--objects', '--all').split('\n')) {
  const [sha, ...나머지] = l.split(' ');
  if (나머지.length) 어디.set(sha, 나머지.join(' '));
}

const 찾은것 = new Map();          // 값 → { 갈래, 파일들:Set, 블롭들:Set }
let 본것 = 0;

for (let i = 0; i < 블롭.length; i += 200) {
  const 덩 = 블롭.slice(i, i + 200);
  const 글 = 깃('cat-file', '--batch', ...[]) ;   // 아래에서 한 개씩 읽습니다
  void 글;
  for (const b of 덩) {
    const 길 = 어디.get(b) || '(이름 없음)';
    if (봐주기파일.test(길)) continue;
    let t = '';
    try { t = execFileSync('git', ['cat-file', 'blob', b], { encoding: 'latin1', maxBuffer: 32 * 1024 * 1024 }); }
    catch { continue; }
    if (t.length > 2 * 1024 * 1024) continue;
    본것++;
    for (const [re, 갈래] of 생김새) {
      re.lastIndex = 0;
      const m = t.match(re);
      if (!m) continue;
      for (const v of new Set(m)) {
        if (봐주기값.test(v)) continue;
        if (!찾은것.has(v)) 찾은것.set(v, { 갈래, 파일들: new Set(), 블롭들: new Set() });
        찾은것.get(v).파일들.add(길);
        찾은것.get(v).블롭들.add(b);
      }
    }
  }
}

console.log('읽은 블롭 ' + 본것 + '개 · 열쇠 모양 ' + 찾은것.size + '가지\n');

/* 어느 커밋에 들어 있나 */
const 커밋찾기 = (길) => {
  const 파일 = 길.split(' ')[0];
  if (!파일 || 파일 === '(이름') return '';
  const r = 깃('log', '--all', '--format=%h %ad', '--date=short', '-1', '--', 파일).trim();
  return r || '';
};

const 줄 = [...찾은것.entries()].map(([값, x]) => ({
  갈래: x.갈래,
  앞6: 값.slice(0, 6),
  길이: 값.length,
  파일: [...x.파일들][0],
  파일수: x.파일들.size,
  커밋: 커밋찾기([...x.파일들][0]),
}));

줄.sort((a, b) => a.갈래.localeCompare(b.갈래) || a.파일.localeCompare(b.파일));
for (const r of 줄) {
  console.log('  ' + r.갈래.padEnd(26) + r.앞6 + '…(' + String(r.길이).padStart(3) + '자)  '
    + r.파일.slice(0, 52).padEnd(54) + r.커밋);
}
if (!줄.length) console.log('  없습니다');
