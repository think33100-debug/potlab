/* 정답지를 쓰기 전에 **후보 줄**을 좁혀 찍습니다 (2026-10-21 · 둘째 표본)
 *
 *   node tools/능력시험/정답후보.mjs --방 원문2 --부터 0 --몇개 10
 *
 * 칸마다 「이 줄이 근거일 수 있다」는 것만 모읍니다 — **고르는 것은 사람**입니다.
 * 우리 수집기 값은 안 찍습니다 (베끼면 시험이 아닙니다).
 * ★ 파일만 읽습니다.
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
const 몇개 = Number(값('--몇개', 10));

const 우리직군 = /(물리|작업|도수)\s*치료\s*(사|실|팀|부)/;
const 버릴 = /개인정보|쿠키|로그인|파기|위탁|열람|정정|동의서|제3자|회원|발급번호|취득일자|생년월일/;

const 자르기 = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);

for (const x of 표본.slice(부터, 부터 + 몇개)) {
  const d = path.join(방, x.id);
  const 쪽 = fs.existsSync(path.join(d, '쪽.txt')) ? fs.readFileSync(path.join(d, '쪽.txt'), 'utf8') : '';
  let 첨 = '';
  const 첨방 = path.join(d, '첨부');
  if (fs.existsSync(첨방)) {
    const 들 = fs.readdirSync(첨방).filter((f) => f.endsWith('.txt'));
    const 점 = (f) => (/공고|채용|모집/.test(f) ? 2 : /지원서|양식|동의|서식|기술서|반환|홍보|CI/.test(f) ? 0 : 1);
    for (const f of 들.sort((a, b) => 점(b) - 점(a))) 첨 += fs.readFileSync(path.join(첨방, f), 'utf8') + '\n';
  }
  const 온 = (첨 + '\n' + 쪽).split(/\r?\n/);

  const 집 = (re, 몇 = 4, 또걸러 = null) => {
    const 본 = [];
    for (const l of 온) {
      if (버릴.test(l)) continue;
      if (!re.test(l)) continue;
      if (또걸러 && 또걸러.test(l)) continue;
      const t = 자르기(l, 120);
      if (t.length < 8 || 본.includes(t)) continue;
      본.push(t);
      if (본.length >= 몇) break;
    }
    return 본;
  };

  console.log('\n══ ' + x.id + ' [' + x.source + '] ' + 자르기(x.기관, 20) + ' — ' + 자르기(x.제목, 60));
  console.log('   우리 직군 말이 원문에 ' + (우리직군.test(첨 + 쪽) ? '**있습니다**' : '없습니다')
    + ' · 첨부글 ' + 첨.length + '자 · 쪽글 ' + 쪽.length + '자');
  const 칸들 = [
    ['접수마감', /(접수|원서|제출|마감)[^\n]{0,40}(20\d{2}|['’]\d{2})[.\s]*\d{1,2}[.\s]*\d{1,2}/, 5],
    ['마감시각', /\d{1,2}\s*[:시]\s*\d{0,2}\s*(까지|분|도착)/, 4],
    ['모집인원', /\d{1,2}\s*명|[○◯〇]\s*명/, 5],
    ['지원자격', /(면허|자격증|소지자|학위|전공|졸업)/, 5],
    ['근무지', /(근무\s*(지|부서|처|장소)|배치|소재지)/, 4],
    ['예상연봉', /(보\s*수|급\s*여|연\s*봉|임\s*금|호봉|기본급|처\s*우)/, 4],
    ['고용형태', /(고용\s*형태|정규직|계약직|무기계약|기간제|임시직|촉탁|대체|공무직|임기제|기간의\s*정함)/, 4],
  ];
  for (const [이름, re, 몇] of 칸들) {
    const 본 = 집(re, 몇);
    console.log('   ── ' + 이름 + (본.length ? '' : '  (후보 없음)'));
    for (const t of 본) console.log('      ' + t);
  }
}
console.log('\n(' + 몇개 + '건 · 고르는 것은 사람입니다)');
