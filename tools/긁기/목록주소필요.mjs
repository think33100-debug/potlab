/* ⑤목록 아님 22곳 — **공고 목록 주소**를 세중님이 적어 주실 자리 (2026-10-24 세중님 4번)
 *
 *   node tools/긁기/목록주소필요.mjs             표를 찍어 봅니다
 *   node tools/긁기/목록주소필요.mjs --붙이기      docs/손확인_주소_1024.md 끝에 붙입니다
 *
 * ── 왜 ───────────────────────────────────────────────────────
 * 139곳 한 바퀴에서 **⑤목록 아님 22곳**이 나왔습니다 — 쪽은 열리는데 그 주소가
 * **공고 목록이 아닙니다** (병원 소개·인사말·채용 안내 글만 있는 자리). 목록 주소를
 * 제가 **짐작해서 만들지 않습니다** (지침 3절 — 주소 하나를 확인했다고 나머지를
 * 규칙으로 만들지 않습니다). 그래서 손확인 ② 문서로 보냅니다.
 *
 * ★ 손확인 ② 와 **같은 꼴**(7칸)로 적습니다 — `tools/손확인_주소.mjs --읽기` 가
 *   「`| 숫자 |` 로 시작하는 줄」을 전부 읽으므로 **읽는 도구를 안 고칩니다** (지침 6절).
 *   다만 이 곳들은 사각지대가 아니라 **긁기 후보**라, 넷째·다섯째 칸을
 *   「지금 아는 주소」·「왜」 로 씁니다 (읽는 도구는 그 두 칸을 보여 주기만 합니다).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 한바퀴자리 = path.join(여기, '..', '..', 'docs', '긁기_한바퀴_1024.json');
const 문서자리 = path.join(여기, '..', '..', 'docs', '손확인_주소_1024.md');
export const 머리 = '## 목록 주소 필요 — ⑤목록 아님';

/** 표 줄들 — 없으면 빈 배열 */
export function 표만들기() {
  if (!fs.existsSync(한바퀴자리)) return [];
  const 곳들 = (JSON.parse(fs.readFileSync(한바퀴자리, 'utf8')).목록 || [])
    .filter((x) => x.갈래 === '⑤목록 아님')
    .sort((a, b) => String(a.이름).localeCompare(String(b.이름), 'ko'));
  if (!곳들.length) return [];
  const 줄 = ['', 머리 + ' **' + 곳들.length + '곳** (2026-10-24 세중님 4번)', '',
    '쪽은 **열립니다**. 그런데 그 주소에 공고 목록이 없습니다 — 병원 소개·채용 안내 글만',
    '있는 자리입니다. **목록 주소를 제가 짐작해 만들지 않습니다** (지침 3절).',
    '「공고 목록 주소」 칸에 **목록이 보이는 주소**를 적어 주시면 그 뒤 긁기가 돕니다.', '',
    '| # | 지금 아는 주소 | 왜 목록이 아닌가 | 기관 | 꼴 | 줄 | 공고 목록 주소 |',
    '|---:|---|---|---|---|---:|---|'];
  곳들.forEach((x, i) => {
    줄.push('| ' + (i + 1) + ' | ' + String(x.주소 || '').slice(0, 54)
      + ' | ' + String(x.왜 || '').replace(/\|/g, '/').slice(0, 44)
      + ' | ' + String(x.이름 || '').replace(/\|/g, '/')
      + ' | ' + (x.꼴 || '') + ' | ' + (x.줄 ?? '') + ' |  |');
  });
  return 줄;
}

const 내가주인 = import.meta.url === new URL('file://' + process.argv[1].replace(/\\/g, '/')).href
  || process.argv[1].endsWith('목록주소필요.mjs');
if (내가주인) {
  const 줄 = 표만들기();
  if (!줄.length) { console.error('✗ ⑤목록 아님 곳이 없습니다 — docs/긁기_한바퀴_1024.json 을 보십시오'); process.exit(1); }
  if (!process.argv.includes('--붙이기')) { console.log(줄.join('\n')); process.exit(0); }
  const 옛 = fs.readFileSync(문서자리, 'utf8');
  if (옛.includes(머리)) { console.log('○ 이미 붙어 있습니다 — 그대로 둡니다'); process.exit(0); }
  fs.writeFileSync(문서자리, 옛.trimEnd() + '\n' + 줄.join('\n') + '\n', 'utf8');
  console.log('○ docs/손확인_주소_1024.md 끝에 붙였습니다 — ' + (줄.length - 9) + '곳');
}
