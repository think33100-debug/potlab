/* node web/lib/pay-prereg.test.mjs

   11월 연봉 통계 비공개 화면의 오프라인 회귀입니다.
   네트워크를 쓰지 않고, 실제 회원 자료 없이 가짜 값만 씁니다.
   이 시험은 화면 코드의 경계를 봅니다. 서버 권한을 재는 시험이 아닙니다. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test, { after } from 'node:test';
import { fileURLToPath } from 'node:url';

let 네트워크호출 = 0;
globalThis.fetch = async () => {
  네트워크호출 += 1;
  throw new Error('이 시험은 네트워크를 쓰지 않습니다');
};
after(() => assert.equal(네트워크호출, 0, '네트워크 호출이 0이어야 합니다'));

const web = join(dirname(fileURLToPath(import.meta.url)), '..');

/* 주석 속 낱말에 속지 않게 주석을 걷고 봅니다 */
const 코드 = (길) => readFileSync(join(web, 길), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

const 닫은호출 = /pay_stats|rookie_salary|salary_stats/;

test('/pay — 통계 호출·순위·급여 표시가 없는 안내입니다', () => {
  const s = 코드('app/pay/page.tsx');
  assert.doesNotMatch(s, 닫은호출);
  assert.doesNotMatch(s, /\.rpc\(|browserSupabase|PayRank|PayNote|man10|중위/);
  assert.match(s, /PAY_PREREG/);
});

test('/pay — 입력을 받거나 저장하는 자리가 없습니다', () => {
  const s = 코드('app/pay/page.tsx');
  assert.doesNotMatch(s, /<form|<input|<select|<textarea|onSubmit|\.insert\(|\.upsert\(/);
});

test('안내 글 — 0명·집계 전·신청 완료로 읽히지 않습니다', async () => {
  const { PAY_PREREG } = await import('./pay-prereg.ts');
  const 글 = Object.values(PAY_PREREG).join('\n');
  assert.match(글, /사전 신청/);
  assert.match(글, /준비/);
  assert.doesNotMatch(글, /0명|집계 전|신청 완료|제출|등록되었/);
});

test('첫 화면 — 브라우저로 넘길 통계에 참여·연봉 값이 없습니다', async () => {
  const { toPublicHomeStats } = await import('./home-stats.ts');
  const 가짜 = {
    hospitals: 11, ot: 22, pt: 33, hira_ver: '가짜판', min_n: 3,
    joined: [{ job: '작업치료사', n: 77, mid: 987654 }],
  };
  const 결과 = toPublicHomeStats(가짜);
  assert.deepEqual(결과, { hospitals: 11, ot: 22, pt: 33, hira_ver: '가짜판', min_n: 3 });
  const 글 = JSON.stringify(결과);
  assert.doesNotMatch(글, /joined|mid|987654/);
});

test('첫 화면 — 못 읽어도 병원 집계 기본값만 냅니다', async () => {
  const { toPublicHomeStats } = await import('./home-stats.ts');
  assert.deepEqual(toPublicHomeStats(null),
    { hospitals: 0, ot: 0, pt: 0, hira_ver: null, min_n: 3 });
});

test('첫 화면 — 서버에서 값을 걸러 넘기고, 화면은 연봉 값을 안 봅니다', () => {
  assert.match(코드('lib/home.ts'), /toPublicHomeStats\(stats\.data\)/);
  assert.doesNotMatch(코드('lib/home.ts'), /joined/);
  for (const 길 of ['components/home/hero.tsx', 'components/home/sections.tsx', 'app/page.tsx']) {
    const s = 코드(길);
    assert.doesNotMatch(s, /stats\.joined|\.mid\b|0명 참여|아직 집계 전/, 길);
  }
  assert.match(코드('components/home/hero.tsx'), /stats\.hospitals/);
  assert.match(코드('components/home/sections.tsx'), /stats\.hospitals/);
  assert.match(코드('components/home/sections.tsx'), /stats\.ot/);
  assert.match(코드('components/home/sections.tsx'), /stats\.pt/);
});

test('/pay 로 가는 단추 — 통계를 바로 볼 수 있다고 말하지 않습니다', () => {
  assert.doesNotMatch(코드('components/home/hero.tsx'), /hero\.cta1/);
  assert.match(코드('components/home/hero.tsx'), /PAY_PREREG/);
  assert.doesNotMatch(코드('app/tools/pay/page.tsx'), /또래 중에 내가 어디쯤인지|회원만 볼 수 있어요/);
});

test('첫 화면 — 급여 홍보 구역은 그리지 않고, 사전 신청 안내와 취업 구역은 둡니다', () => {
  const s = 코드('components/home/sections.tsx');
  assert.match(s, /export function PaySection\([^)]*\) \{\s*return null;\s*\}/);
  assert.doesNotMatch(s, /pay\.(eyebrow|title|lead|f0[1-5])/);
  assert.doesNotMatch(s, /Spread|Compare|상위 23%|47명|31만원|372만원/);
  assert.match(s, /PAY_PREREG\.title/);
  assert.match(s, /PAY_PREREG\.body/);
  assert.match(s, /t\('job\.f06\.title'\)/);
  assert.match(코드('app/page.tsx'), /<PayPrereg \/>/);
});

test('/spec — 급여 호출과 표시만 닫습니다', () => {
  const s = 코드('app/spec/page.tsx');
  assert.doesNotMatch(s, 닫은호출);
  assert.doesNotMatch(s, /Rookie|man10|PayNote|median_year|median_base/);
});

test('/spec — 학생 스펙 결과와 입력 입구를 그대로 둡니다', () => {
  const s = 코드('app/spec/page.tsx');
  assert.match(s, /\.rpc\('spec_stats'\)/);
  assert.match(s, /PART_ORDER\.map/);
  assert.match(s, /case 'lang':/);
  assert.match(s, /<NextUp /);
  assert.match(s, /profile \? '\/me' : session \? '\/welcome' : '\/login'/);
  assert.match(s, /href="\/volunteer"/);
});

test('스펙·어학·설문 저장 길을 그대로 둡니다', () => {
  const s = 코드('components/signup-survey.tsx');
  assert.match(s, /\.rpc\('save_my_survey'/);
  assert.match(s, /\.rpc\('lang_bands'\)/);
});
