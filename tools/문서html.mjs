/* 문서html — docs/인계/*.md 를 **같은 이름 .html** 로도 냅니다.
 *
 *   node tools/문서html.mjs
 *
 * 왜 있나 (2026-10-10)
 *   갤러리(docs/screens/index.html)가 「04 화면스펙 →」 로 `.md` 를 가리키는데,
 *   저장소를 clone 해서 **파일을 두 번 눌러** 열면 브라우저가 `.md` 를
 *   그냥 내려받습니다. 닻(#…)도 안 걸립니다.
 *   그래서 `.md` 옆에 `.html` 을 같이 두고 갤러리는 `.html` 을 가리킵니다.
 *
 *   **`.md` 가 원본입니다.** `.md` 를 고친 뒤 이것을 다시 돌리십시오.
 *
 * 밖에서 아무것도 안 받아옵니다 — 글꼴·스크립트 모두 없이 한 파일로 냅니다.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 뿌리 = path.join(여기, '..');
const 방 = path.join(뿌리, 'docs', '인계');

/* GitHub·VS Code 와 같은 닻 규칙 — 갤러리가 만드는 것과 **같아야** 합니다
   (tools/갤러리.mjs 의 닻 만들기와 한 쌍입니다) */
function 닻만들기(제목) {
  return 제목.toLowerCase().replace(/[^0-9a-z가-힣_\s-]/g, '').trim().replace(/\s+/g, '-');
}

const 안전 = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* 아주 작은 마크다운 → HTML. 우리 문서가 쓰는 것만 다룹니다 —
   제목 · 표 · 목록 · 인용 · 코드덩이 · 굵게 · 코드 · 링크 · 가로줄 */
function 바꾸기(md) {
  const 줄 = md.split(/\r?\n/);
  const out = [];
  let 코드중 = false, 표중 = false, 목록중 = false;

  const 속글 = (s) => 안전(s)
    .replace(/`([^`]+)`/g, (_, g) => `<code>${g}</code>`)
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/~~([^~]+)~~/g, '<del>$1</del>')
    /* 링크 — .md 를 가리키면 .html 로 돌려 놓습니다 (같은 폴더에 함께 냅니다) */
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, 글, 대상) => {
      const t = 대상.replace(/\.md(#|$)/, '.html$1');
      return `<a href="${t}">${글}</a>`;
    });

  const 표닫기 = () => { if (표중) { out.push('</tbody></table>'); 표중 = false; } };
  const 목록닫기 = () => { if (목록중) { out.push('</ul>'); 목록중 = false; } };

  for (let i = 0; i < 줄.length; i++) {
    const l = 줄[i];

    if (/^```/.test(l)) {
      표닫기(); 목록닫기();
      out.push(코드중 ? '</code></pre>' : '<pre><code>');
      코드중 = !코드중; continue;
    }
    if (코드중) { out.push(안전(l)); continue; }

    const h = l.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      표닫기(); 목록닫기();
      const n = h[1].length; const 글 = h[2].trim();
      out.push(`<h${n} id="${닻만들기(글)}">${속글(글)}</h${n}>`);
      continue;
    }

    /* 표 — | 로 시작하는 줄이 이어지는 동안 */
    if (/^\s*\|/.test(l)) {
      목록닫기();
      const 칸 = l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      if (/^[\s|:-]+$/.test(l)) continue;            /* ---|--- 줄은 건너뜁니다 */
      if (!표중) {
        out.push('<table><thead><tr>' + 칸.map((c) => `<th>${속글(c)}</th>`).join('') + '</tr></thead><tbody>');
        표중 = true;
      } else {
        out.push('<tr>' + 칸.map((c) => `<td>${속글(c)}</td>`).join('') + '</tr>');
      }
      continue;
    }
    표닫기();

    if (/^\s*[-*·]\s+/.test(l)) {
      if (!목록중) { out.push('<ul>'); 목록중 = true; }
      out.push('<li>' + 속글(l.replace(/^\s*[-*·]\s+/, '')) + '</li>');
      continue;
    }
    목록닫기();

    if (/^>\s?/.test(l)) { out.push('<blockquote>' + 속글(l.replace(/^>\s?/, '')) + '</blockquote>'); continue; }
    if (/^---+\s*$/.test(l)) { out.push('<hr>'); continue; }
    if (!l.trim()) continue;
    out.push('<p>' + 속글(l) + '</p>');
  }
  표닫기(); 목록닫기();
  if (코드중) out.push('</code></pre>');
  return out.join('\n');
}

const 껍데기 = (제목, 몸, 차례) => `<!doctype html>
<html lang="ko">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${안전(제목)} · POTJOB 인계</title>
<style>
  :root { --줄: #e5e7eb; --흐림: #6b7280; --파랑: #2563eb; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #fafafa; color: #111;
         font: 16px/1.75 -apple-system, "Segoe UI", "Malgun Gothic", sans-serif; }
  .판 { max-width: 1040px; margin: 0 auto; padding: 24px 20px 80px; }
  nav.위 { position: sticky; top: 0; z-index: 5; background: #fff; border-bottom: 1px solid var(--줄);
           padding: 10px 20px; display: flex; flex-wrap: wrap; gap: 10px; align-items: baseline; }
  nav.위 a { font-size: 13px; color: var(--파랑); text-decoration: none; }
  nav.위 b { font-size: 13px; color: var(--흐림); }
  h1 { font-size: 26px; margin: 24px 0 8px; }
  h2 { font-size: 20px; margin: 32px 0 8px; padding-top: 8px; border-top: 1px solid var(--줄); }
  h3 { font-size: 17px; margin: 22px 0 6px; }
  h4 { font-size: 15px; margin: 18px 0 4px; }
  p { margin: 8px 0; }
  ul { margin: 8px 0 8px 22px; padding: 0; }
  li { margin: 3px 0; }
  code { background: #f3f4f6; border-radius: 4px; padding: 1px 5px; font-size: 0.92em; }
  pre { background: #11161b; color: #e6edf3; border-radius: 8px; padding: 14px 16px;
        overflow-x: auto; font-size: 13px; line-height: 1.6; }
  pre code { background: none; color: inherit; padding: 0; }
  blockquote { margin: 10px 0; padding: 8px 14px; border-left: 4px solid var(--파랑);
               background: #eff6ff; border-radius: 0 8px 8px 0; }
  table { border-collapse: collapse; margin: 12px 0; width: 100%; font-size: 14px;
          background: #fff; display: block; overflow-x: auto; }
  th, td { border: 1px solid var(--줄); padding: 7px 10px; text-align: left; vertical-align: top; }
  th { background: #f9fafb; white-space: nowrap; }
  hr { border: 0; border-top: 1px solid var(--줄); margin: 28px 0; }
  a { color: var(--파랑); }
  .만든말 { color: var(--흐림); font-size: 12px; margin-top: 40px; }
</style>
<nav class="위"><b>POTJOB 인계</b>${차례}<a href="../screens/index.html">갤러리</a></nav>
<div class="판">
${몸}
<p class="만든말">이 쪽은 <code>${안전(제목)}.md</code> 에서 만든 것입니다.
글을 고치면 <code>node tools/문서html.mjs</code> 를 다시 돌리십시오.</p>
</div>
</html>
`;

const 파일들 = fs.readdirSync(방).filter((f) => f.endsWith('.md')).sort();
const 차례 = 파일들.map((f) => {
  const 이름 = f.replace(/\.md$/, '');
  return `<a href="${encodeURI(이름)}.html">${이름.replace(/^\d+_/, '')}</a>`;
}).join('');

for (const f of 파일들) {
  const 이름 = f.replace(/\.md$/, '');
  const md = fs.readFileSync(path.join(방, f), 'utf8');
  fs.writeFileSync(path.join(방, 이름 + '.html'), 껍데기(이름, 바꾸기(md), 차례));
  console.log('  ○ ' + 이름 + '.html');
}
console.log(`\n인계 문서 ${파일들.length}개를 .html 로도 냈습니다 → docs/인계/`);
