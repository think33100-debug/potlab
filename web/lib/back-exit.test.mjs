/* node web/lib/back-exit.test.mjs
   시각을 넣어 돌리므로 진짜 2초를 기다리지 않습니다. */
import assert from 'node:assert/strict';
import { createBackExit } from './back-exit.ts';

let t = 1000;
const exit = createBackExit(2000, () => t);

// 한 번 누르면 안내
assert.equal(exit.press(), 'warn');

// 2초 안에 한 번 더 누르면 나감
t += 1900;
assert.equal(exit.press(), 'exit');

// 나간 뒤에는 처음부터 — 바로 또 눌러도 안내
t += 10;
assert.equal(exit.press(), 'warn');

// 2초가 지나면 안내부터 다시
t += 2001;
assert.equal(exit.press(), 'warn');
t += 1;
assert.equal(exit.press(), 'exit');

// 경계값 — 딱 2000ms 는 나감, 2001ms 는 안내
t += 5000;
assert.equal(exit.press(), 'warn');
t += 2000;
assert.equal(exit.press(), 'exit');

t += 5000;
assert.equal(exit.press(), 'warn');
t += 2001;
assert.equal(exit.press(), 'warn');

// reset 하면 세던 것을 버림
exit.reset();
t += 1;
assert.equal(exit.press(), 'warn');

console.log('back-exit 통과 — 9가지');
