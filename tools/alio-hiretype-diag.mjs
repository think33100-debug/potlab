/* 고용형태를 못 가린 공고를 원문째로 찍어 봅니다 (2026-09-29).
 *
 *   node tools/alio-hiretype-diag.mjs 209690 230849 …
 *
 * 세중님 물음 — 「경쟁률은 읽었는데 고용형태를 모른다는 게 이상하다.
 *               /list · /detail 에 hireTypeLst 가 있을 텐데 쓰고 있나?」
 *
 * 그래서 넷을 나란히 찍습니다.
 *   ① API /detail 원문 (hireType* 를 포함해 앞부분 그대로)
 *   ② 알리오 웹 화면의 고용형태 칸
 *   ③ 묶음 이름들
 *   ④ 공고 제목
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 웹읽기 } from './alio-web-check.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const KEY = (fs.readFileSync(path.join(여기, '..', 'gas', 'wage.js'), 'utf8')
  .match(/const JOB3_API = \{[\s\S]*?KEY:\s*'([^']+)'/) || [])[1];
const 쉼 = (ms) => new Promise((y) => setTimeout(y, ms));

for (const sn of process.argv.slice(2).filter((x) => /^\d+$/.test(x))) {
  const r = await fetch('https://apis.data.go.kr/1051000/recruitment/detail?serviceKey=' + KEY
    + '&resultType=json&sn=' + sn, { headers: { accept: 'application/json' } });
  const 글 = await r.text();
  const j = JSON.parse(글);
  const m = Array.isArray(j.result) ? j.result[0] : j.result;
  const w = await 웹읽기(sn);

  console.log('\n' + '═'.repeat(78));
  console.log('sn ' + sn + ' · ' + m.instNm);
  console.log('④ 공고 제목   ' + m.recrutPbancTtl);
  console.log('③ 묶음 이름들 ' + (w.묶음 || []).map((g) => g.이름).join('  ‖  '));
  console.log('② 웹 화면 고용형태 칸   ' + (w.머리?.고용형태 ?? '(없음)')
    + '   · 근무지 ' + (w.머리?.근무지 ?? '(없음)'));
  console.log('① API 의 고용형태 항목');
  console.log('     hireTypeLst    ' + JSON.stringify(m.hireTypeLst));
  console.log('     hireTypeNmLst  ' + JSON.stringify(m.hireTypeNmLst));
  console.log('     recrutSeNm     ' + JSON.stringify(m.recrutSeNm)
    + ' · workRgnNmLst ' + JSON.stringify(m.workRgnNmLst));
  console.log('   steps 에 고용형태 칸이 있나 → '
    + (m.steps?.[0] ? Object.keys(m.steps[0]).filter((k) => /hire|Type|형태/i.test(k)).join(',') || '없음' : 'steps 없음'));
  /* 원문 앞부분 — 항목 이름을 눈으로 확인하려고 그대로 찍습니다 */
  console.log('   ── /detail 원문 앞 900자 ──');
  console.log('   ' + 글.slice(0, 900).replace(/\n/g, ' '));
  await 쉼(700);
}
