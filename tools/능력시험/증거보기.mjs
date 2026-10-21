/* 정답지를 쓰려고 **원문 근거 줄**을 찍습니다 (2026-10-21 · 둘째 표본)
 *
 *   node tools/능력시험/증거보기.mjs --방 원문2 --부터 0 --몇개 6
 *   node tools/능력시험/증거보기.mjs --방 원문2 --아이디 CE80089
 *
 * 칸마다 **글귀가 있을 자리**를 좁혀 찍습니다 — 제가 사람처럼 읽어 정답지를 쓰려는
 * 자리입니다. 우리 수집기 값은 **안 찍습니다** (베끼면 시험이 아닙니다 · 세중님).
 * ★ 파일만 읽습니다. 그물·DB 를 안 두드립니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const 값 = (이름, 기본) => {
  const i = argv.indexOf(이름);
  return i > -1 && argv[i + 1] != null ? argv[i + 1] : 기본;
};
const 방 = path.join(여기, 값('--방', '원문2'));
const 표본 = JSON.parse(fs.readFileSync(path.join(여기, 값('--표본', '표본2.json')), 'utf8')).표본;
const 부터 = Number(값('--부터', 0));
const 몇개 = Number(값('--몇개', 6));
const 아이디 = 값('--아이디', '');
const 전문 = Number(값('--전문', 0));   /* 공고문 앞머리를 몇 자까지 그대로 찍나 */

/* 개인정보 안내·입사지원서 서식에서 오는 잡음 — 정답 근거가 아닙니다 */
const 버릴줄 = /개인정보|동의서|동의\s?[(]필수|쿠키|로그인|파기|위탁|열람|정정|삭제\s?요구|발급하기|발급|보 수집|회원정보|이용자|제3자|홈페이지 운영|인증평가|td>|th>|tr>/;
const 찾을것 = [
  ['접수·마감', /(접수|원서|제출|마감|기간|일정)[^\n]{0,80}/g],
  ['인원', /(인\s*원|명\s*)[^\n]{0,60}/g],
  ['직군·자격', /(물리|작업|도수)\s*치료[^\n]{0,70}|(자격|면허|경력|학력|전공|우대)[^\n]{0,70}/g],
  ['근무지·부서', /(근무|부서|배치|지역|소재)[^\n]{0,60}/g],
  ['보수', /(보\s*수|급\s*여|연\s*봉|임\s*금|처\s*우|기본급|호봉)[^\n]{0,60}/g],
  ['고용형태', /(고용\s*형태|정규직|계약직|무기계약|기간제|임시직|촉탁|대체|공무직|임기제)[^\n]{0,50}/g],
];

const 볼것 = 아이디 ? 표본.filter((x) => x.id === 아이디) : 표본.slice(부터, 부터 + 몇개);
for (const x of 볼것) {
  const d = path.join(방, x.id);
  const 쪽p = path.join(d, '쪽.txt');
  const 쪽 = fs.existsSync(쪽p) ? fs.readFileSync(쪽p, 'utf8') : '';
  let 첨 = '';
  const 첨방 = path.join(d, '첨부');
  const 첨목록 = [];
  if (fs.existsSync(첨방)) {
    for (const f of fs.readdirSync(첨방).sort()) {
      if (!f.endsWith('.txt')) continue;
      const t = fs.readFileSync(path.join(첨방, f), 'utf8');
      첨목록.push(f.replace(/[.]txt$/, '') + ' (' + t.length + '자)');
      첨 += '\n【' + f + '】\n' + t;
    }
  }
  console.log('\n══════ ' + x.id + ' [' + x.source + '] ' + String(x.기관).slice(0, 24)
    + (x.숨김 ? ' · 숨김' : '') + (x.보류 ? ' · 보류' : ''));
  console.log('  제목 ' + String(x.제목).slice(0, 92));
  console.log('  주소 ' + String(x.주소).slice(0, 92));
  console.log('  쪽글 ' + 쪽.length + '자 · 첨부 ' + (첨목록.length ? 첨목록.join(' · ').slice(0, 150) : '없음'));
  const 온글 = 쪽 + '\n' + 첨;
  if (전문) {
    /* 공고문 같은 첨부(이름에 공고·채용·모집)의 앞머리를 **그대로** — 사람이 읽는 자리 */
    const 들 = fs.existsSync(첨방) ? fs.readdirSync(첨방).filter((f) => f.endsWith('.txt')) : [];
    const 점 = (f) => (/공고|채용|모집/.test(f) ? 2 : /지원서|양식|동의|서식|기술서/.test(f) ? 0 : 1);
    const 고른 = 들.sort((x, y) => 점(y) - 점(x))[0];
    const 몸 = 고른 ? fs.readFileSync(path.join(첨방, 고른), 'utf8') : 쪽;
    console.log('  ── 전문 앞머리 (' + (고른 || '쪽.txt') + ')');
    console.log(몸.replace(/\n{2,}/g, '\n').slice(0, 전문)
      .split('\n').map((l) => '     ' + l.slice(0, 118)).join('\n'));
  }
  for (const [이름, re] of 찾을것) {
    re.lastIndex = 0;
    const 본것 = new Set();
    let m;
    while ((m = re.exec(온글)) && 본것.size < 6) {
      const t = m[0].replace(/\s+/g, ' ').trim();
      if (t.length < 6) continue;
      if (버릴줄.test(t)) continue;        /* 개인정보 안내·서식 잡음은 근거가 아닙니다 */
      본것.add(t.slice(0, 96));
    }
    if (본것.size) {
      console.log('  ── ' + 이름);
      for (const t of 본것) console.log('     ' + t);
    }
  }
}
console.log('\n(' + (아이디 ? 1 : 볼것.length) + '건 · 우리 값은 안 찍었습니다)');
