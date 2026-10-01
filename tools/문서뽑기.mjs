/* 개인정보 문서 전문을 파일로 뽑습니다.
 *
 *   node tools/문서뽑기.mjs
 *
 * ── 왜 기계로 뽑나 ───────────────────────────────────────────
 * 손으로 옮기면 한 글자라도 달라집니다. 동의 문서는 증빙이라
 * 「사이트에 올라간 글」 과 「검토용 파일」 이 다르면 안 됩니다.
 * 그래서 web/lib/terms.ts 를 **그대로 불러와** 찍습니다.
 * (Node 가 .ts 를 바로 읽습니다 — web/lib/who.test.mjs 와 같은 방식)
 *
 * terms.ts 를 고치면 이 명령을 다시 돌려야 합니다.
 */
import fs from 'node:fs';
import { AGREEMENTS, TERMS, TERMS_VERSION } from '../web/lib/terms.ts';

const 오늘 = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
const 순서 = ['service', 'privacy', 'community'];

let out = `# 개인정보 문서 전문 — POT JOB

**뽑은 날** ${오늘}
**판** ${TERMS_VERSION}
**어디서 나온 글인가** \`web/lib/terms.ts\` — 지금 사이트에 **그대로 올라가 있는 글**입니다.
**고치지 않았습니다.** 코드에서 기계로 뽑았습니다 (\`node tools/문서뽑기.mjs\`).

> 「초안」 딱지는 법률 검토가 끝날 때까지 그대로 둡니다.
> 딱지가 붙은 문서는 화면 맨 위에 빨간 칸으로
> 「초안입니다. 법률 검토를 받기 전이라 문구가 바뀔 수 있습니다」 가 뜹니다.

---

## 가입할 때 받는 동의 (체크 항목)

| 항목 | 화면에 뜨는 글자 | 필수 | 문서 |
|---|---|---|---|
`;

for (const a of AGREEMENTS) {
  out += `| \`${a.key}\` | ${a.label} | ${a.required ? '**필수**' : '선택'} | ${a.doc ?? '(문서 없음)'} |\n`;
}

out += `
필수 항목을 전부 체크하지 않으면 다음으로 넘어가지 않습니다.
선택 항목은 체크하지 않아도 가입됩니다 — 「거절함」 으로 기록에 남습니다
(\`약관동의\` 표).

---
`;

for (const k of 순서) {
  const t = TERMS[k];
  out += `
## ${t.title}  \`${k}\`

**초안 딱지** ${t.draft ? '**붙어 있습니다**' : '없습니다 (검토 끝)'}
**화면 주소** \`/terms/${k}\`

\`\`\`text
${t.body}
\`\`\`

---
`;
}

out += `
## 다시 뽑으려면

\`\`\`
node tools/문서뽑기.mjs
\`\`\`

\`web/lib/terms.ts\` 를 고치면 이 파일도 다시 뽑아야 합니다.
두 곳을 따로 고치면 어느 쪽이 진짜인지 알 수 없게 됩니다.
`;

fs.writeFileSync('개인정보문서_전문.md', out);
console.log('만들었습니다 — 개인정보문서_전문.md · ' + out.length + '자');
console.log('판 ' + TERMS_VERSION + ' · 문서 ' + 순서.length + '개 · 동의 항목 ' + AGREEMENTS.length + '개');
for (const k of 순서) {
  console.log('  ' + k.padEnd(10) + TERMS[k].title.padEnd(16)
    + (TERMS[k].draft ? '초안' : '검토 끝') + ' · ' + TERMS[k].body.length + '자');
}
