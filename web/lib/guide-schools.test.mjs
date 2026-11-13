/* lib/guide-schools.ts 가 협회 사이트에서 받은 목록과 같은지 수로 맞춰 봅니다 (2026-11-13).
   돌리기: node web/lib/guide-schools.test.mjs
   아래 「받은 수」는 같은 날 협회 공식 사이트의 목록을 읽어 센 값입니다 (RAPO노트/검색노출/학교글_확인_1113.md).
   목록을 다시 받으면 이 수도 그때 센 값으로 바꿉니다 */
import { 작업치료학교들, 물리치료학교들 } from './guide-schools.ts';

const 받은수 = {
  작업치료: { 곳: 62, 삼년제: 29, 사년제: 33, WFOT: 27, 교육인증: 9, 누리집: 59 },
  물리치료: { 곳: 84, 대학교: 45, 전문대: 39, 누리집: 69 },
};
const 본 = {
  작업치료: {
    곳: 작업치료학교들.length,
    삼년제: 작업치료학교들.filter((x) => x.학제 === '3년제').length,
    사년제: 작업치료학교들.filter((x) => x.학제 === '4년제').length,
    WFOT: 작업치료학교들.filter((x) => x.WFOT).length,
    교육인증: 작업치료학교들.filter((x) => x.교육인증).length,
    누리집: 작업치료학교들.filter((x) => x.누리집).length,
  },
  물리치료: {
    곳: 물리치료학교들.length,
    대학교: 물리치료학교들.filter((x) => x.구분 === '대학교').length,
    전문대: 물리치료학교들.filter((x) => x.구분 === '전문대').length,
    누리집: 물리치료학교들.filter((x) => x.누리집).length,
  },
};

const 틀림 = [];
if (JSON.stringify(본) !== JSON.stringify(받은수)) 틀림.push(`수가 다릅니다 — 파일 ${JSON.stringify(본)} · 받은 수 ${JSON.stringify(받은수)}`);
for (const [이름, xs] of [['작업치료', 작업치료학교들], ['물리치료', 물리치료학교들]]) {
  const 슬 = xs.map((x) => x.슬러그);
  if (new Set(슬).size !== 슬.length) 틀림.push(`${이름}: 슬러그가 겹칩니다`);
  if (슬.some((s) => !/^[a-z0-9-]+$/.test(s))) 틀림.push(`${이름}: 슬러그에 영문 소문자·숫자·붙임표 말고 다른 글자가 있습니다`);
  if (xs.some((x) => /폐교|폐과/.test(x.학교))) 틀림.push(`${이름}: 폐교·폐과로 적힌 줄이 들어 있습니다`);
  if (xs.some((x) => x.누리집 && !/^https?:\/\/[^/]/.test(x.누리집))) 틀림.push(`${이름}: 누리집 주소 꼴이 다릅니다`);
}
if (작업치료학교들.some((x) => x.학과 && !/^작업치료학?과$/.test(x.학과))) 틀림.push('작업치료: 학과 이름이 「작업치료학과」·「작업치료과」가 아닙니다');

if (틀림.length) { console.error(틀림.join('\n')); process.exit(1); }
console.log(`맞음 — 작업치료 ${본.작업치료.곳}곳(3년제 ${본.작업치료.삼년제} · 4년제 ${본.작업치료.사년제}) · 물리치료 ${본.물리치료.곳}곳(대학교 ${본.물리치료.대학교} · 전문대 ${본.물리치료.전문대})`);
