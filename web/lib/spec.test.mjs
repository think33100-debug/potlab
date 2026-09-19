/* node web/lib/spec.test.mjs

   점수 계산은 DB(spec_parts)에 있고 여기서는 안 합니다.
   다만 배점 합이 100이 아니면 화면의 막대가 전부 거짓말이 되므로 그것부터 봅니다. */
import assert from 'node:assert/strict';
import { PART_MAX, tierOf, cheerOf, gaps } from './spec.ts';

/* ① 배점 합 100 — 학점60·어학15·자격증10·학력5·교육5·실습5 */
assert.equal(Object.values(PART_MAX).reduce((a, b) => a + b, 0), 100);
assert.equal(PART_MAX.gpa, 60);
assert.equal(PART_MAX.lang, 15);
assert.equal(PART_MAX.certs, 10);
assert.equal(PART_MAX.school, 5);
assert.equal(PART_MAX.courses, 5);
assert.equal(PART_MAX.practice, 5);

/* ② 등급 경계 — 옛 앱과 같은 자리에서 갈려야 합니다 */
assert.equal(tierOf(100).key, 'S');
assert.equal(tierOf(85).key, 'S');
assert.equal(tierOf(84).key, 'A');
assert.equal(tierOf(70).key, 'A');
assert.equal(tierOf(69).key, 'B');
assert.equal(tierOf(55).key, 'B');
assert.equal(tierOf(54).key, 'C');
assert.equal(tierOf(40).key, 'C');
assert.equal(tierOf(39).key, 'D');
assert.equal(tierOf(0).key, 'D');

/* ③ 응원 — 비율이 제일 높은 칸을 짚습니다.
      DB 가 낸 실제 값(학생22번: 학점19·학력5·자격증1·실습3)으로 넣어 봅니다.
      학력 5/5 가 꽉 찼으니 학력을 짚어야 합니다 */
{
  const parts = { gpa: 19, lang: 0, certs: 1, school: 5, courses: 0, practice: 3 };
  assert.match(cheerOf(28, parts), /학교에서 잘 버텨오셨어요/);
}
/* 아무것도 안 채운 사람 */
assert.match(cheerOf(3, { gpa: 0, lang: 0, certs: 0, school: 0, courses: 0, practice: 0 }),
  /이제 시작이니/);
/* 85점 넘으면 더 채우라고 안 합니다 */
assert.match(cheerOf(90, { gpa: 60, lang: 15, certs: 10, school: 5, courses: 5, practice: 5 }),
  /면접만 준비/);

/* ④ 남은 점수 — 제일 많이 오를 칸부터 */
{
  const g = gaps({ gpa: 19, lang: 0, certs: 1, school: 5, courses: 0, practice: 3 });
  assert.equal(g[0].key, 'gpa');    // 60 - 19 = 41
  assert.equal(g[0].left, 41);
  assert.equal(g[1].key, 'lang');   // 15 - 0 = 15
  assert.equal(g.find((x) => x.key === 'school'), undefined);  // 꽉 찬 칸은 안 나옵니다
}

console.log('spec 통과 — 4가지');
