/* node web/lib/post-image-path.test.mjs
   새 글 사진 경로에 글쓴이와 이어지는 값이 안 들어가는지 봅니다 (2026-11-11). */
import assert from 'node:assert/strict';
import { 새글사진경로, 새꼴, 옛꼴 } from './post-image-path.ts';

const 회원 = '3f2a9c1e-1111-4222-8333-944455556666';

// 백 번 만들어 봅니다 — 매번 새 꼴에 맞고, 옛 꼴에는 안 맞고, 둘이 겹치지 않습니다
const 본것 = new Set();
for (let n = 0; n < 100; n++) {
  const p = 새글사진경로();
  for (const 길 of [p.큰것, p.작은것]) {
    assert.ok(새꼴.test(길), `새 꼴이어야: ${길}`);
    assert.ok(!옛꼴.test(길), `옛 꼴이면 안 됨: ${길}`);
    assert.ok(/^[\x21-\x7e]+$/.test(길), `ASCII 만: ${길}`);   // 작업지침 6-2b
    assert.ok(!길.includes(회원), '회원 id 가 들어가면 안 됨');
    assert.equal(길.split('/').length, 2, '폴더는 i/ 하나뿐');
  }
  assert.equal(p.작은것, p.큰것.replace(/\.webp$/, '-t.webp'));
  assert.ok(!본것.has(p.큰것), '같은 이름이 두 번 나오면 안 됨');
  본것.add(p.큰것);
}

// 받은 uuid 를 그대로 쓰되 소문자로
assert.deepEqual(새글사진경로('ABCDEF01-2345-4678-9abc-def012345678'), {
  큰것: 'i/abcdef01-2345-4678-9abc-def012345678.webp',
  작은것: 'i/abcdef01-2345-4678-9abc-def012345678-t.webp',
});
// uuid 가 아닌 것은 받지 않습니다 — 회원 id 를 「글쓴이 폴더」로 넘기는 실수를 막지 못하므로
// (회원 id 도 uuid 꼴이라) 이 함수는 인수 없이 부르는 것이 원칙입니다
assert.throws(() => 새글사진경로('123'));
assert.throws(() => 새글사진경로(`${회원}/1`));

// 옛 꼴 — 지금 운영에 있는 꼴
assert.ok(옛꼴.test(`${회원}/12/0.webp`));
assert.ok(옛꼴.test(`${회원}/12/3-t.webp`));
assert.ok(!새꼴.test(`${회원}/12/0.webp`));
// 새 꼴에 다른 것이 끼면 안 맞습니다
assert.ok(!새꼴.test(`i/${회원}/x.webp`));
assert.ok(!새꼴.test(`i/${회원}.png`));
assert.ok(!새꼴.test(`${회원}.webp`));

console.log('post-image-path: 모두 통과');
