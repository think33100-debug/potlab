/* 릴스 자료 규칙 전수 점검 — 렌더 없이 글만 (2026-11-16)
   node tools/reels/check.mjs <공고들.json> [오늘 YYYY-MM-DD]
   줄마다 칩 · 첫 장면 글 · 소개 · 공고 줄 · 마감을 찍고, 아래 넷을 「걸림」으로 셉니다
   ① 갈래(조교·연구·행정) 공고가 「채용」이라 말함  ② 칩이 겹침(상급종합+종합병원 · 대학병원+종합병원)
   ③ 소개 숫자에 0 · 음수 · 숫자 아님                 ④ 같은 공고문이 두 편 */
import fs from 'node:fs';
import { 릴스자료, 같은공고묶기, 일층인가 } from './reel-data.mjs';

const [, , 입력, 오늘 = '2026-11-16'] = process.argv;
const 줄들 = JSON.parse(fs.readFileSync(입력, 'utf8')).filter((x) => 일층인가(x.분류));
const 묶은 = 같은공고묶기(줄들);
let 만듦 = 0, 건넘 = 0; const 걸림 = [];
const 본공고문 = new Set();
for (const 공고 of 묶은) {
  const r = 릴스자료(공고, 공고.기관, { 오늘, 사이트: 'rapojob.co.kr' });
  if (r.건너뜀) { 건넘++; console.log(`· 건너뜀 ${공고.id} — ${r.건너뜀}`); continue; }
  만듦++;
  const 줄 = r.공고.줄.map((x) => `${x.이름}=${x.값 ?? '공고문 확인'}`).join(' | ');
  const 숫자 = r.소개.숫자.map((x) => `${x.이름} ${x.값}${x.단위}`).join(', ') || '(소개 장면 뺌)';
  console.log(`○ ${r.id}\n    칩 [${r.분류.join(', ')}] · 걸기 「${r.걸기}」 · ${r.마감.큰글}\n    소개 ${r.소개.메타.join(' · ') || '-'} / ${숫자}\n    ${줄}`);
  if (공고.조교연구 && /채용$/.test(r.걸기)) 걸림.push(`${r.id} ① 갈래인데 「채용」`);
  if (r.분류.includes('종합병원') && (r.분류.includes('상급종합') || r.분류.includes('대학병원'))) 걸림.push(`${r.id} ② 칩 겹침`);
  if (r.소개.숫자.some((x) => !(Number.isFinite(x.값) && x.값 > 0))) 걸림.push(`${r.id} ③ 소개 숫자`);
  const 열쇠 = [공고.org_name, 공고.원문제목, 공고.apply_to].join('|');
  if (본공고문.has(열쇠)) 걸림.push(`${r.id} ④ 같은 공고문 두 편`); 본공고문.add(열쇠);
}
console.log(`\n1층 ${줄들.length}줄 → 묶은 뒤 ${묶은.length}편 · 만듦 ${만듦} · 건너뜀 ${건넘} · 걸림 ${걸림.length}`);
걸림.forEach((x) => console.log('  ✗ ' + x));
process.exit(걸림.length ? 1 : 0);
