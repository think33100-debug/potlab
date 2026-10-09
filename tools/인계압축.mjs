/* 인계압축 — **문서와 캡처만** 담은 묶음을 만듭니다 (코드·열쇠 없음).
 *
 *   node tools/인계압축.mjs            바탕화면에 POTJOB_인계_1010.zip
 *   node tools/인계압축.mjs --풀기만    압축 안 하고 폴더만 (검사용)
 *
 * 왜 있나 (2026-10-10)
 *   계정 초대 전에 **먼저 보고 반응을 보려고** 문서만 보냅니다.
 *   코드·sql·tools·gas·.env·승인대기·git 기록은 **안 넣습니다**.
 *
 * ★ 저장소 문서를 **고치지 않습니다.** 복사본에만 묶음용 손질을 합니다 —
 *   저장소를 받은 사람에게는 원래 글이 맞기 때문입니다.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 뿌리 = path.join(여기, '..');
const 바탕 = path.join(process.env.USERPROFILE || process.env.HOME, 'OneDrive', '바탕 화면');
const 묶음이름 = 'POTJOB_인계_1010';
const 일터 = path.join(바탕, 묶음이름);
const 풀기만 = process.argv.includes('--풀기만');

/* ── 넣을 것 ───────────────────────────────────────────── */
const 곁문서 = ['화면상태목록', '화면전수점검_1009', '공고상세_일곱칸_진단_1009',
  '칸채우기_미리보기_1010', '인계_읽기검토_1010'];

/* ── 1. 자리 비우기 ─────────────────────────────────────── */
if (fs.existsSync(일터)) fs.rmSync(일터, { recursive: true, force: true });
fs.mkdirSync(path.join(일터, 'docs', '인계'), { recursive: true });
fs.mkdirSync(path.join(일터, 'docs', 'screens'), { recursive: true });

/* ── 2. 인계 문서 여섯 (.md) — 묶음용 손질을 하며 옮깁니다 ── */
const 뱃지 = '*(저장소 접근 후 볼 수 있습니다 — 이 묶음에는 코드가 없습니다)*';

function 손질(이름, s) {
  /* ① 이 묶음에 **없는 파일**로 가는 링크는 링크를 풀고 까닭을 답니다.
        깨진 링크로 남기지 않습니다 */
  s = s.replace(/\[([^\]]+)\]\(\.\.\/\.\.\/CLAUDE\.md\)/g, (_, 글) => `\`${글}\` ${뱃지}`);
  s = s.replace(/\[([^\]]+)\]\(\.\.\/승인대기_1009\.md\)/g, (_, 글) => `\`${글}\` ${뱃지}`);

  /* ② 00 읽는법 — 계정 이야기는 「다음 단계」로 표시합니다 */
  if (이름 === '00_읽는법') {
    s = s.replace('## 개발자에게 줄 접근',
      '## 개발자에게 줄 접근 — **다음 단계** (오늘은 이 묶음만 보냅니다)');
    s = s.replace('## 마스터 계정으로 직접 보는 법',
      '## 마스터 계정으로 직접 보는 법 — **다음 단계** (계정은 나중에 드립니다)');
    /* 맨 위에 이 묶음이 무엇인지 한 줄 */
    s = s.replace('# 00. 읽는 법 — POTJOB 인계 문서',
      '# 00. 읽는 법 — POTJOB 인계 문서\n\n'
      + '> **이 묶음은 문서와 캡처뿐입니다.** 코드·SQL·수집기·열쇠는 안 들어 있습니다.\n'
      + '> 저장소와 계정은 **다음 단계**로 드립니다 — 먼저 보시고 말씀 주십시오.');
  }

  /* ③ 02 기술스펙 — 코드 파일을 가리키는 자리에 한 줄 */
  if (이름 === '02_기술스펙') {
    s = s.replace('# 02. 기술 스펙',
      '# 02. 기술 스펙\n\n'
      + '> **이 묶음에는 코드가 없습니다.** 아래에서 `web/…` · `tools/…` · `sql/…` 처럼\n'
      + '> 적힌 파일은 **저장소 접근 후** 볼 수 있습니다. 여기서는 「무엇이 어디에\n'
      + '> 있고 왜 그렇게 했는지」만 읽으시면 됩니다.');
  }
  return s;
}

const 인계방 = path.join(뿌리, 'docs', '인계');
const 인계md = fs.readdirSync(인계방).filter((f) => f.endsWith('.md')).sort();
for (const f of 인계md) {
  const 이름 = f.replace(/\.md$/, '');
  fs.writeFileSync(path.join(일터, 'docs', '인계', f),
    손질(이름, fs.readFileSync(path.join(인계방, f), 'utf8')));
}

/* ── 3. 곁 문서 ─────────────────────────────────────────── */
for (const 이름 of 곁문서) {
  const src = path.join(뿌리, 'docs', 이름 + '.md');
  if (!fs.existsSync(src)) { console.log('  · 없음 ' + 이름); continue; }
  fs.writeFileSync(path.join(일터, 'docs', 이름 + '.md'),
    손질(이름, fs.readFileSync(src, 'utf8')));
}

/* ── 4. .md → .html (손질한 글로 다시 만듭니다) ──────────── */
execFileSync(process.execPath, [path.join(여기, '문서html.mjs')], {
  cwd: 일터, stdio: 'pipe',
  env: { ...process.env, 인계_뿌리: 일터 },
});

/* ── 5. 캡처 ────────────────────────────────────────────── */
const 그림방 = path.join(뿌리, 'docs', 'screens');
let 그림수 = 0;
for (const f of fs.readdirSync(그림방)) {
  const s = fs.statSync(path.join(그림방, f));
  if (s.isDirectory()) continue;                       /* _토막 같은 임시 폴더는 안 넣습니다 */
  if (f.startsWith('_')) continue;                     /* _진단_*.json 등 */
  if (!/\.(png|html|json)$/.test(f)) continue;
  fs.copyFileSync(path.join(그림방, f), path.join(일터, 'docs', 'screens', f));
  if (f.endsWith('.png')) 그림수++;
}

/* ── 5-2. 그림 가볍게 (복사본만) ─────────────────────────
   캡처는 단색 바탕에 글자라 팔레트 PNG 로 다시 내면 60%쯤 줄어듭니다.
   **확장자가 그대로**라 index.html·목록.json 을 안 고쳐도 됩니다 */
if (!process.argv.includes('--원본크기')) {
  execFileSync(process.execPath,
    [path.join(여기, '그림줄이기.mjs'), path.join(일터, 'docs', 'screens')],
    { stdio: 'inherit' });
}

/* ── 6. 시작.html ───────────────────────────────────────── */
const 시작 = `<!doctype html>
<html lang="ko">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>POTJOB 인계 — 여기서 시작하세요</title>
<style>
  :root { --줄:#e5e7eb; --흐림:#6b7280; --파랑:#2563eb; }
  *{box-sizing:border-box}
  body{margin:0;background:#fafafa;color:#111;
       font:16px/1.75 -apple-system,"Segoe UI","Malgun Gothic",sans-serif}
  .판{max-width:900px;margin:0 auto;padding:40px 20px 80px}
  h1{font-size:30px;margin:0 0 6px}
  .밑{color:var(--흐림);font-size:14px;margin:0 0 28px}
  .큰{display:block;background:#111;color:#fff;text-decoration:none;border-radius:12px;
     padding:18px 22px;margin:0 0 12px;font-size:18px;font-weight:700}
  .큰 span{display:block;font-size:13px;font-weight:400;opacity:.75;margin-top:4px}
  ol.순서{counter-reset:n;list-style:none;padding:0;margin:0}
  ol.순서 li{counter-increment:n;background:#fff;border:1px solid var(--줄);border-radius:10px;
             padding:14px 18px 14px 54px;margin-bottom:10px;position:relative}
  ol.순서 li::before{content:counter(n);position:absolute;left:16px;top:14px;width:26px;height:26px;
     border-radius:50%;background:#111;color:#fff;font-size:14px;font-weight:700;
     display:flex;align-items:center;justify-content:center}
  ol.순서 a{font-size:17px;font-weight:700;color:var(--파랑);text-decoration:none}
  ol.순서 p{margin:3px 0 0;font-size:14px;color:var(--흐림)}
  .쪽{background:#fff;border:1px solid var(--줄);border-radius:10px;padding:16px 20px;margin-top:24px}
  .쪽 h2{font-size:16px;margin:0 0 8px}
  .쪽 ul{margin:0;padding-left:20px;font-size:14px}
  .쪽 li{margin:3px 0}
  .알림{background:#eff6ff;border-left:4px solid var(--파랑);border-radius:0 8px 8px 0;
        padding:12px 16px;font-size:14px;margin:0 0 24px}
  code{background:#f3f4f6;border-radius:4px;padding:1px 5px;font-size:.9em}
</style>
<div class="판">
  <h1>POTJOB 인계</h1>
  <p class="밑">2026-10-10 · 화면 62곳 · 캡처 ${그림수}장 · 문서 ${인계md.length + 곁문서.length}개</p>

  <div class="알림">
    <b>이 묶음은 문서와 캡처뿐입니다.</b> 코드·SQL·수집기·열쇠는 들어 있지 않습니다.
    저장소와 계정은 <b>다음 단계</b>로 드립니다 — 먼저 보시고 말씀 주십시오.
  </div>

  <a class="큰" href="docs/screens/index.html">캡처 갤러리 바로 보기
    <span>화면 62곳 × 페르소나 아홉 × 상태 × PC/휴대폰 — 글보다 이게 빠릅니다</span></a>
  <a class="큰" href="docs/인계/00_읽는법.html#낱말-풀이-먼저-읽으십시오" style="background:#2563eb">낱말 풀이
    <span>창구 · 페르소나 · A 규칙 · 보류함 · 일곱 칸 … 먼저 보면 나머지가 읽힙니다</span></a>

  <h2 style="font-size:18px;margin:28px 0 10px">읽는 순서</h2>
  <ol class="순서">
    <li><a href="docs/인계/00_읽는법.html">00. 읽는 법</a>
      <p>낱말 풀이 · 읽는 순서 · 지금 진행 중인 일</p></li>
    <li><a href="docs/인계/01_기획.html">01. 기획</a>
      <p>왜 이 서비스인가 · 사용자 역할 아홉 · 운영 원칙</p></li>
    <li><a href="docs/인계/03_IA.html">03. Information Architecture</a>
      <p>화면 62곳 지도 · 역할별로 보이는 범위 · 들어가는 길</p></li>
    <li><a href="docs/screens/index.html">캡처 갤러리</a>
      <p>화면마다 페르소나 × 상태 × PC/휴대폰이 나란히. 칸마다 화면 스펙으로 건너뜁니다</p></li>
    <li><a href="docs/인계/04_화면스펙.html">04. 화면 스펙</a>
      <p>화면마다 목적 · 누가 · 구성 · 상태별 모습 · 알려진 문제</p></li>
    <li><a href="docs/인계/02_기술스펙.html">02. 기술 스펙</a>
      <p>고칠 때 무엇을 건드리면 안 되나 (창구 · 권한 · 규칙)</p></li>
    <li><a href="docs/인계/05_부록.html">05. 부록</a>
      <p>전수 점검표 · 알려진 문제 · <b>정해야 할 것</b> · 알려진 문서 문제</p></li>
  </ol>

  <div class="쪽">
    <h2>곁에 두고 볼 것</h2>
    <ul>
      <li><a href="docs/인계_읽기검토_1010.html">인계 문서 읽기 검토</a> —
        이 문서들을 <b>처음 받은 사람이 걸린 것 48개</b>. 고칠지 말지는 함께 정합니다</li>
      <li><a href="docs/화면전수점검_1009.html">화면 전수 점검표</a> — 화면마다 ○△✗</li>
      <li><a href="docs/화면상태목록.html">화면 상태 목록</a> — 「어느 계정으로 · 어느 주소로」</li>
      <li><a href="docs/공고상세_일곱칸_진단_1009.html">공고 상세 일곱 칸 진단</a> — 왜 그 일곱인가</li>
      <li><a href="docs/칸채우기_미리보기_1010.html">칸 채우기 미리보기</a> — 지금 자료로 어디까지 차나</li>
    </ul>
  </div>

  <div class="쪽">
    <h2>먼저 봐 주셨으면 하는 둘</h2>
    <ul>
      <li><b>화면 제목 문구</b> — 지금 탭 이름이 전부 「POTJOB · 채용공고」입니다 (05 부록)</li>
      <li><b>카드 디자인 한 벌</b> — 공고 카드와 기관 카드의 테두리·여백이 다릅니다</li>
    </ul>
  </div>
</div>
</html>
`;
fs.writeFileSync(path.join(일터, '시작.html'), 시작);

/* ── 7. 압축 ────────────────────────────────────────────── */
const 잰것 = (() => {
  let n = 0, b = 0;
  const 걷기 = (d) => {
    for (const f of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, f.name);
      if (f.isDirectory()) 걷기(p); else { n++; b += fs.statSync(p).size; }
    }
  };
  걷기(일터); return { n, b };
})();
console.log(`\n폴더 — 파일 ${잰것.n}개 · ${(잰것.b / 1024 / 1024).toFixed(1)}MB → ${일터}`);

if (!풀기만) {
  const zip = path.join(바탕, 묶음이름 + '.zip');
  if (fs.existsSync(zip)) fs.rmSync(zip);
  execFileSync('powershell', ['-NoProfile', '-Command',
    `Compress-Archive -Path '${일터}\\*' -DestinationPath '${zip}' -CompressionLevel Optimal`],
  { stdio: 'pipe' });
  const mb = fs.statSync(zip).size / 1024 / 1024;
  console.log(`압축 — ${mb.toFixed(1)}MB → ${zip}`);
}
