/* node --experimental-strip-types web/lib/keep-login.test.mjs */
import assert from 'node:assert/strict';
import { 로그인쿠키인가, 쿠키지문 } from './keep-login.ts';

assert.equal(로그인쿠키인가('sb-abc-auth-token'), true);
assert.equal(로그인쿠키인가('sb-abc-auth-token.0'), true);
assert.equal(로그인쿠키인가('sb-abc-auth-token.12'), true);
assert.equal(로그인쿠키인가('sb-abc-auth-token-code-verifier'), false);
assert.equal(로그인쿠키인가('sb-abc-auth-token-flow-1-code-verifier'), false);
assert.equal(로그인쿠키인가('rapo-keep'), false);

const 가 = [{ name: 'sb-abc-auth-token.0', value: 'base64-AAA' }, { name: 'sb-abc-auth-token.1', value: 'BBB' }];
assert.equal(쿠키지문([]), null);
assert.equal(쿠키지문([{ name: 'other', value: 'x' }]), null);
assert.match(쿠키지문(가), /^[0-9a-f]{8}$/);
/* 차례가 달라도 같은 지문 */
assert.equal(쿠키지문(가), 쿠키지문([...가].reverse()));
/* 다른 쿠키가 섞여도 같은 지문 */
assert.equal(쿠키지문(가), 쿠키지문([{ name: 'x', value: 'y' }, ...가, { name: 'sb-abc-auth-token-code-verifier', value: 'v' }]));
/* 값이 바뀌면 다른 지문 */
assert.notEqual(쿠키지문(가), 쿠키지문([{ name: 'sb-abc-auth-token.0', value: 'base64-AAB' }, 가[1]]));
/* 빈 조각(지워지는 중)은 안 셉니다 */
assert.equal(쿠키지문(가), 쿠키지문([...가, { name: 'sb-abc-auth-token.2', value: '' }]));
assert.equal(쿠키지문([{ name: 'sb-abc-auth-token', value: '' }]), null);
console.log('keep-login 자기점검 통과');
