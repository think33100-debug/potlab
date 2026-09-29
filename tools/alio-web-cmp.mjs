/* 알리오 웹 ↔ API 나란히 대조 (2026-09-29).
 *
 *   node tools/alio-web-cmp.mjs            아래 표본(연도별 6건씩)
 *   node tools/alio-web-cmp.mjs 296899 …   고른 공고만
 *
 * 세중님이 근로복지공단 sn 296899 로 잡아내신 어긋남을 재는 자입니다.
 *   API  steps 6개 전부 null
 *   웹   1차 20명/135명 · 최종 4명/19명 · 경쟁률 33.75
 */
import { 웹읽기, api읽기 } from './alio-web-check.mjs';

const 쉼 = (ms) => new Promise((y) => setTimeout(y, ms));

/* 연도마다 「DB 에 값 없음」 4건 · 「값 있음」 2건씩 무작위로 뽑은 것 */
const 표본 = {
  2026: { 없: [295729, 297109, 304022, 296262], 있: [301181, 300717] },
  2025: { 없: [280919, 279880, 286255, 293544], 있: [293644, 282256] },
  2024: { 없: [267206, 267678, 265979, 269308], 있: [278497, 285215] },
  2023: { 없: [264161, 254600, 262039, 263639], 있: [260130, 256195] },
  2022: { 없: [233767, 235043, 236068, 248440], 있: [245722, 243865] },
  2021: { 없: [221539, 211292, 212946, 221840], 있: [224006, 213327] },
  2020: { 없: [201240, 208166, 209691, 187616], 있: [207402, 200275] },
  2019: { 없: [182962, 178710, 184951, 184171], 있: [167548, 170950] },
  2018: { 없: [164083, 152815, 150272, 162218], 있: [160928, 161351] },
};

const 고른것 = process.argv.slice(2).filter((x) => /^\d+$/.test(x)).map(Number);
const 볼것 = 고른것.length
  ? 고른것.map((sn) => ({ 해: null, sn, DB: '?' }))
  : Object.entries(표본).flatMap(([해, g]) => Object.entries(g).flatMap(([k, sns]) =>
      sns.map((sn) => ({ 해: Number(해), sn, DB: k === '있' ? '있음' : '값없음' }))));

const 표 = [];
for (const x of 볼것) {
  const a = await api읽기(x.sn);
  const w = await 웹읽기(x.sn);
  const API값 = (a.steps || []).filter((s) => s.aplyNope != null).length;
  const 웹값 = (w.묶음 || []).reduce((n, g) => n + g.단계.filter((y) => y.응시 != null).length, 0);
  표.push({
    해: x.해, sn: x.sn, DB: x.DB,
    API단계: (a.steps || []).length, API값, 웹묶음: (w.묶음 || []).length, 웹값,
    어긋남: (API값 === 0 && 웹값 > 0) ? '웹에만 있음'
      : (API값 > 0 && 웹값 === 0) ? 'API에만 있음' : '',
    기관: (a.기관 || '').slice(0, 14),
  });
  await 쉼(600);
}
console.table(표);

const 웹에만 = 표.filter((x) => x.어긋남 === '웹에만 있음');
console.log('\n웹에만 값이 있는 것  ' + 웹에만.length + ' / ' + 표.length + '건');
for (const 해 of [...new Set(표.map((x) => x.해))].sort((a, b) => b - a)) {
  const t = 표.filter((x) => x.해 === 해);
  console.log('  ' + 해 + '   웹에만 ' + t.filter((x) => x.어긋남 === '웹에만 있음').length + ' / ' + t.length);
}
