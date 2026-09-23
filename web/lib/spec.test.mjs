/* node web/lib/spec.test.mjs

   점수 계산은 DB(spec_parts)에 있고 여기서는 안 합니다.
   다만 배점 합이 100이 아니면 화면의 막대가 전부 거짓말이 되므로 그것부터 봅니다. */
import assert from 'node:assert/strict';
import { PART_MAX } from './spec-weights.ts';
import { tierOf, cheerOf, nextUp, CHEER_ORDER, NEXT_ORDER, PART_ORDER } from './spec.ts';

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

/* ③ 응원 — 채운 것 중 흔치 않은 것부터 짚습니다 (2026-09-23).
      전에는 「배점 대비 제일 많이 채운 칸」이었는데, 그러려면 배점을 화면 쪽에서
      알아야 해서 값이 브라우저로 딸려 나갔습니다. 지금은 채웠는지만 봅니다.
      DB 가 낸 실제 값(학생22번: 학점19·학력5·자격증1·실습3)으로 넣어 봅니다 */
{
  const parts = { gpa: 19, lang: 0, certs: 1, school: 5, courses: 0, practice: 3 };
  assert.match(cheerOf(28, parts), /실습 경험이 좋아요/);
}
/* 실습이 비면 그다음 차례(이수교육 → 자격증)로 내려갑니다 */
assert.match(cheerOf(28, { gpa: 19, lang: 0, certs: 1, school: 5, courses: 0, practice: 0 }),
  /자격증 챙긴 게/);
/* 학점만 채운 사람 — 학점이 배점은 제일 크지만 칭찬 차례는 뒤입니다 */
assert.match(cheerOf(28, { gpa: 40, lang: 0, certs: 0, school: 0, courses: 0, practice: 0 }),
  /학점을 이만큼/);
/* 아무것도 안 채운 사람 */
assert.match(cheerOf(3, { gpa: 0, lang: 0, certs: 0, school: 0, courses: 0, practice: 0 }),
  /이제 시작이니/);
/* 85점 넘으면 더 채우라고 안 합니다 */
assert.match(cheerOf(90, { gpa: 60, lang: 15, certs: 10, school: 5, courses: 5, practice: 5 }),
  /면접만 준비/);

/* ④ 손으로 정한 차례 셋 — 전부 배점과 달라야 합니다 (lib/spec-order.ts).

      다음에 누가 「보기 좋게」 배점 순서로 되돌려 놓으면 여기가 깨집니다.
      그게 이 시험의 전부입니다 */
{
  const byWeight = Object.keys(PART_MAX).sort((a, b) => PART_MAX[b] - PART_MAX[a]);
  const sameAsWeight = (order) =>
    JSON.stringify(order) === JSON.stringify(byWeight.filter((k) => order.includes(k)));

  assert.equal(sameAsWeight(NEXT_ORDER), false, '추천 차례가 배점 순서와 같습니다');
  assert.equal(sameAsWeight(PART_ORDER), false, '화면 차례가 배점 순서와 같습니다');
  assert.equal(sameAsWeight(CHEER_ORDER), false, '칭찬 차례가 배점 순서와 같습니다');

  /* 제일 큰 배점(학점 60)이 제일 먼저 권해지면 안 됩니다 */
  assert.notEqual(NEXT_ORDER[0], 'gpa');

  /* 학력은 아예 안 권합니다 — 지금 와서 바꿀 수 있는 게 아닙니다 */
  assert.equal(NEXT_ORDER.includes('school'), false);

  /* 차례 셋 다 항목을 빠뜨리거나 겹치지 않아야 합니다
     (추천만 학력을 뺀 다섯입니다) */
  assert.equal(new Set(PART_ORDER).size, 6);
  assert.equal(new Set(CHEER_ORDER).size, 6);
  assert.equal(new Set(NEXT_ORDER).size, 5);

  /* 안 채운 것 중 차례가 빠른 하나 */
  assert.equal(nextUp({ gpa: 19, lang: 0, certs: 1, school: 5, courses: 0, practice: 3 }), 'lang');
  assert.equal(nextUp({ gpa: 19, lang: 8, certs: 1, school: 5, courses: 0, practice: 3 }), 'courses');
  assert.equal(nextUp({ gpa: 0, lang: 8, certs: 1, school: 5, courses: 2, practice: 3 }), 'gpa');

  /* 전부 채웠으면 아무것도 안 권합니다 */
  assert.equal(nextUp({ gpa: 1, lang: 1, certs: 1, school: 1, courses: 1, practice: 1 }), null);
}

console.log('spec 통과 — 4가지');
