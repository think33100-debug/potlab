/* node web/lib/avatar-path.test.mjs
   새 프로필 사진 경로에 회원 id 가 안 들어가는지 봅니다 (2026-11-11). */
import assert from 'node:assert/strict';
import { 새프로필사진경로, 새꼴, 옛꼴 } from './avatar-path.ts';
import { parseAvatar, withPhoto, withColor } from './avatar.ts';

const 회원 = '3f2a9c1e-1111-4222-8333-944455556666';

// 백 번 만들어 봅니다 — 매번 새 꼴에 맞고, 옛 꼴에는 안 맞고, 겹치지 않습니다
const 본것 = new Set();
for (let n = 0; n < 100; n++) {
  const 길 = 새프로필사진경로();
  assert.ok(새꼴.test(길), `새 꼴이어야: ${길}`);
  assert.ok(!옛꼴.test(길), `옛 꼴이면 안 됨: ${길}`);
  assert.ok(/^[\x21-\x7e]+$/.test(길), `ASCII 만: ${길}`);   // 작업지침 6-2b
  assert.ok(!길.includes(회원), '회원 id 가 들어가면 안 됨');
  assert.equal(길.split('/').length, 2, '폴더는 a/ 하나뿐');
  assert.ok(!/\d{13}/.test(길.replace(/[0-9a-f-]{36}/, '')), '올린 시각(ms)이 들어가면 안 됨');
  assert.ok(!본것.has(길), '같은 이름이 두 번 나오면 안 됨');
  본것.add(길);
}

// 받은 uuid 는 소문자로 · uuid 가 아닌 것은 안 받음
assert.equal(새프로필사진경로('ABCDEF01-2345-4678-9abc-def012345678'), 'a/abcdef01-2345-4678-9abc-def012345678.webp');
assert.throws(() => 새프로필사진경로('123'));
assert.throws(() => 새프로필사진경로(`${회원}/1`));

// 옛 꼴 — 지금 운영에 있는 꼴 (`<회원>/<Date.now()>.webp`)
assert.ok(옛꼴.test(`${회원}/1762841234567.webp`));
assert.ok(!새꼴.test(`${회원}/1762841234567.webp`));
assert.ok(!새꼴.test(`a/${회원}/x.webp`));
assert.ok(!새꼴.test(`a/${회원}.png`));
assert.ok(!새꼴.test(`${회원}.webp`));

// profiles.avatar 값과 이어 붙여도 화면이 같은 경로를 읽습니다 (lib/avatar.ts)
const 길 = 새프로필사진경로();
const 값 = withPhoto('🐣|#BBF7D0', 길);
assert.equal(값, `u/${길}|#BBF7D0`);
assert.deepEqual(parseAvatar(값), { kind: 'photo', path: 길, color: '#BBF7D0' });
// 색만 바꿔도 경로는 그대로
assert.equal(parseAvatar(withColor(값, '#FDE68A')).path, 길);

// 정리 도구(clean_orphan_files.js)의 avatars 「지워도 되는 꼴」에 새 꼴이 안 맞아야 합니다 —
// 맞으면 「a」 폴더를 주인 없는 회원 폴더로 읽고 새 사진을 지웁니다
const 치우개꼴 = /^[0-9a-f-]{36}\/[^/]+$/;
assert.ok(!치우개꼴.test(길), '정리 도구가 새 사진을 지울 수 있으면 안 됨');
assert.ok(치우개꼴.test(`${회원}/1762841234567.webp`));

console.log('avatar-path: 모두 통과');
