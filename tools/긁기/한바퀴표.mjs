/* 긁기 — **①HTML게시판 139곳을 한 바퀴** 돌려 표를 만듭니다 (2026-10-24 세중님 B)
 *
 *   node tools/긁기/한바퀴표.mjs            전부 (읽기만 · 담지 않습니다)
 *   node tools/긁기/한바퀴표.mjs --몇개 20
 *
 * ── 내는 표 ─────────────────────────────────────────────────
 *   열림 / 줄 있음 / 막힘 — 곳마다 한 줄, 그리고 **줄 0 인 곳은 갈래**까지
 *     ① JSON·API      응답이 JSON 입니다 (목록을 JSON 으로 줍니다)
 *     ② AJAX 목록      첫 HTML 에 글이 없고 쪽이 뒤에 불러옵니다
 *     ③ onclick 전용   앵커에 href 가 없고 onclick 만 있습니다
 *     ④ iframe        목록이 iframe 안입니다
 *     ⑤ 목록 아님      채용 안내 쪽이고 목록이 다른 주소에 있습니다
 *     ⑥ 그밖
 *   ★ 갈래는 **받은 응답으로만** 가립니다 — 다음 판 읽기를 그 갈래에 맞춰 만듭니다.
 *
 * ★ robots·같은 집 틈을 지킵니다 (공통.mjs). 아무것도 담지 않습니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 받기 } from './공통.mjs';
import { 그누읽기, 표준읽기 } from './읽기들.mjs';
/* ★ 경기도의료원 설정은 그 파일 안에 있는데, **들여오면 바로 긁기를 시작**합니다.
   그래서 세 곳만 여기 적어 둡니다 (주소는 그 파일과 **같은 글자**입니다) */
const 경기곳들 = [
  { 이름: '경기도의료원 수원병원', 게시판: 227, 메뉴: 731 },
  { 이름: '경기도의료원 이천병원', 게시판: 266, 메뉴: 913 },
  { 이름: '경기도의료원의정부병원', 게시판: 240, 메뉴: 786 },
];
const 경기주소 = (곳) => 'https://www.medical.or.kr/front/boardList.do?brd_mgrno='
  + 곳.게시판 + '&menu_no=' + 곳.메뉴;

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const 몇개 = Number(argv.includes('--몇개') ? argv[argv.indexOf('--몇개') + 1] : 999) || 999;

/** 줄 0 인 쪽의 갈래 — 받은 응답으로만 */
export function 줄0갈래({ html, 머리 }) {
  const t = String(html || '');
  const 꼴 = String(머리 || '');
  if (/^\s*[[{]/.test(t) || /application\/json/i.test(꼴)) return { 갈래: '①JSON·API', 왜: '응답이 JSON' };
  if (/<iframe[^>]+src=/i.test(t)) return { 갈래: '④iframe', 왜: '목록이 iframe 안' };
  const 앵커수 = (t.match(/<a\s/gi) || []).length;
  const onclick수 = (t.match(/onclick\s*=/gi) || []).length;
  if (/\$\.(?:ajax|get|post)\s*\(|XMLHttpRequest|fetch\s*\(|axios/i.test(t)) {
    return { 갈래: '②AJAX 목록', 왜: '쪽이 글을 뒤에 불러옵니다 (앵커 ' + 앵커수 + ')' };
  }
  if (onclick수 > 3 && 앵커수 > 0) return { 갈래: '③onclick 전용', 왜: 'onclick ' + onclick수 + '개' };
  const 글 = t.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ').trim();
  if (/채\s*용|모\s*집|구\s*인/.test(글)) return { 갈래: '⑤목록 아님', 왜: '채용 말은 있는데 목록 꼴이 없음' };
  return { 갈래: '⑥그밖', 왜: '글 ' + 글.length + '자 · 앵커 ' + 앵커수 };
}

const 그누 = JSON.parse(fs.readFileSync(path.join(여기, '그누보드_곳들.json'), 'utf8')).곳들;
const 표준 = JSON.parse(fs.readFileSync(path.join(여기, '표준게시판_곳들.json'), 'utf8')).곳들;
const 모두 = [
  ...경기곳들.map((x) => ({ 이름: x.이름, 주소: 경기주소(x), 꼴: '경기도의료원' })),
  ...그누.map((x) => ({ ...x, 꼴: '그누보드' })),
  ...표준.map((x) => ({ ...x, 꼴: '표준게시판' })),
].slice(0, 몇개);
console.log('①HTML게시판 ' + 모두.length + '곳을 한 바퀴 돕니다 (읽기만)');

const 낸것 = [];
for (const 곳 of 모두) {
  const r = await 받기(곳.주소);
  if (!r.됨) { 낸것.push({ ...곳, 열림: false, 줄: 0, 갈래: '막힘', 왜: r.왜 }); continue; }
  const 줄들 = 곳.꼴 === '그누보드' ? 그누읽기(r.html, 곳.주소) : 표준읽기(r.html, 곳.주소);
  if (줄들.length) {
    낸것.push({ ...곳, 열림: true, 줄: 줄들.length, 갈래: '줄 있음',
      왜: '첫 줄 「' + String(줄들[0].제목).slice(0, 30) + '」' });
  } else {
    const 판 = 줄0갈래({ html: r.html, 머리: '' });
    낸것.push({ ...곳, 열림: true, 줄: 0, ...판 });
  }
  if (낸것.length % 25 === 0) console.log('  ' + 낸것.length + '곳…');
}

const 셈 = new Map();
for (const x of 낸것) 셈.set(x.갈래, (셈.get(x.갈래) || 0) + 1);
console.log('\n══ 갈래별 ══');
for (const [k, v] of [...셈].sort((a, b) => b[1] - a[1])) console.log('  ' + String(v).padStart(4) + '곳  ' + k);
console.log('\n열림 ' + 낸것.filter((x) => x.열림).length + ' · 막힘 '
  + 낸것.filter((x) => !x.열림).length + ' · 줄 있음 '
  + 낸것.filter((x) => x.줄 > 0).length + ' · 줄 0 ' + 낸것.filter((x) => x.열림 && !x.줄).length);

console.log('\n══ 막힘 까닭 ══');
const 막힘셈 = new Map();
for (const x of 낸것.filter((y) => !y.열림)) {
  const k = String(x.왜).replace(/\(.*\)/, '').trim();
  막힘셈.set(k, (막힘셈.get(k) || 0) + 1);
}
for (const [k, v] of [...막힘셈].sort((a, b) => b[1] - a[1])) console.log('  ' + String(v).padStart(3) + '곳  ' + k);

const 낼곳 = path.join(여기, '..', '..', 'docs', '긁기_한바퀴_1024.json');
fs.writeFileSync(낼곳, JSON.stringify({ 잰때: new Date().toLocaleString('sv-SE').replace('T', ' '),
  곳: 낸것.length, 목록: 낸것 }, null, 1) + '\n');
console.log('\n○ docs/긁기_한바퀴_1024.json 에 적었습니다');
