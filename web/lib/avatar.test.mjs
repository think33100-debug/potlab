/* node web/lib/avatar.test.mjs

   사진을 덮기 전에 물어볼지 말지를 이 한 줄이 정합니다
   (components/avatar-picker.tsx 의 askOverwrite).
   여기가 틀리면 둘 중 하나입니다 —
   말없이 사진이 날아가거나, 이모지만 쓰는 분에게 매번 확인창이 뜹니다. */
import assert from 'node:assert/strict';
import { isPhoto, withColor, withEmoji, withPhoto } from './avatar.ts';

/* ① 사진을 올려둔 상태 — 물어봐야 합니다 */
assert.equal(isPhoto('u/abc/1.webp|#FDE68A'), true);
assert.equal(isPhoto(withPhoto('🐣|#FDE68A', 'abc/1.webp')), true);

/* ② 이모지만 쓰는 상태 — 잃을 게 없으니 안 묻습니다 */
assert.equal(isPhoto('🐣|#FDE68A'), false);
assert.equal(isPhoto('🏥|#BBF7D0'), false);
assert.equal(isPhoto(null), false);
assert.equal(isPhoto(undefined), false);
assert.equal(isPhoto(''), false);

/* ③ 바탕색만 바꾸는 것은 사진을 안 건드립니다 — 그래서 안 묻습니다 */
const photo = 'u/abc/1.webp|#FDE68A';
assert.equal(withColor(photo, '#BBF7D0'), 'u/abc/1.webp|#BBF7D0');
assert.equal(isPhoto(withColor(photo, '#BBF7D0')), true);

/* ④ 이모지를 누르면 사진 경로가 사라집니다 — 이게 물어보는 이유입니다 */
assert.equal(withEmoji(photo, '🏥'), '🏥|#FDE68A');
assert.equal(isPhoto(withEmoji(photo, '🏥')), false);

console.log('avatar.test.mjs ok');
