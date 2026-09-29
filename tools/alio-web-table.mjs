/* 알리오 웹 ↔ API 를 **직군 묶음 한 줄씩** 나란히 놓는 표 (2026-09-29).
 *
 *   node tools/alio-web-table.mjs 294873 279788 …
 *
 * 세중님이 「무작위 10건을 나란히 비교한 표」 를 달라고 하셔서 만든 것입니다.
 * 위쪽 alio-web-cmp.mjs 는 건수만 세고, 이건 숫자를 하나하나 견줍니다.
 */
import { 웹읽기, api읽기 } from './alio-web-check.mjs';

const 쉼 = (ms) => new Promise((y) => setTimeout(y, ms));
const sns = process.argv.slice(2).filter((x) => /^\d+$/.test(x)).map(Number);

const 표 = [];
for (const sn of sns) {
  const a = await api읽기(sn);
  const w = await 웹읽기(sn);

  /* API 를 minStepSn 으로 묶습니다 (우리 수집기와 같은 방식) */
  const 묶 = new Map();
  for (const s of a.steps || []) {
    const k = s.minStepSn ?? s.recrutStepSn;
    if (!묶.has(k)) 묶.set(k, []);
    묶.get(k).push(s);
  }
  const api묶음 = [...묶.values()];

  (w.묶음 || []).forEach((g, i) => {
    const ag = api묶음[i] || [];
    const a첫 = ag[0], a끝 = ag[ag.length - 1];
    const w첫 = g.단계[0], w끝 = g.단계[g.단계.length - 1];
    const 웹률 = g.경쟁률;
    const api률 = a끝 && a끝.cmpttRt != null ? a끝.cmpttRt : null;
    표.push({
      해: String(a.마감 || '').slice(0, 4),
      sn,
      기관: String(a.기관 || '').slice(0, 12),
      직군: String(g.이름 || '').slice(0, 24),
      '웹 1차': w첫 ? w첫.선발 + '/' + w첫.응시 : '—',
      '웹 최종': w끝 ? w끝.선발 + '/' + w끝.응시 : '—',
      '웹 경쟁률': 웹률 == null ? '—' : 웹률,
      'API 1차': a첫 ? (a첫.recrutNope ?? 'null') + '/' + (a첫.aplyNope ?? 'null') : '—',
      'API 최종': a끝 ? (a끝.recrutNope ?? 'null') + '/' + (a끝.aplyNope ?? 'null') : '—',
      'API 경쟁률': api률 == null ? 'null' : api률,
      같나: (웹률 != null && api률 != null && Math.abs(웹률 - api률) < 0.01) ? '같음'
        : (웹률 != null && (api률 == null || api률 === 0)) ? '웹에만' : '다름',
    });
  });
  await 쉼(700);
}
console.table(표);
const 웹에만 = 표.filter((x) => x.같나 === '웹에만').length;
console.log('\n묶음 ' + 표.length + '개 중 · 같음 ' + 표.filter((x) => x.같나 === '같음').length
  + ' · 웹에만 ' + 웹에만 + ' · 다름 ' + 표.filter((x) => x.같나 === '다름').length);
