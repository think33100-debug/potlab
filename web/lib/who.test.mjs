/* node web/lib/who.test.mjs

   계정을 지운 분의 글은 남기고 이름만 가립니다.
   이 한 줄이 틀리면 둘 중 하나입니다 —
   지운 분의 닉네임이 화면에 다시 뜨거나(개인정보),
   멀쩡한 회원이 전부 「알 수 없음」으로 나옵니다. */
import assert from 'node:assert/strict';
import { shownName } from './who.ts';

/* ① 보통 회원 — 닉네임 그대로 */
assert.equal(shownName({ nickname: '나나로', erased_at: null }), '나나로');
assert.equal(shownName({ nickname: '나나로' }), '나나로');

/* ② 계정을 지운 분 — 닉네임 칸에 값이 남아 있어도 안 내보냅니다.
      nickname 은 UNIQUE · NOT NULL 이라 비울 수가 없어서
      DB 가 「지운계정-<uuid>」 를 넣어둡니다 (reset_my_account) */
assert.equal(
  shownName({ nickname: '지운계정-3f8a1c2d4e5f6071', erased_at: '2026-09-23T00:00:00Z' }),
  '알 수 없음',
);
/* 원래 닉네임이 그대로 남아 있는 경우에도 지운 표시가 이깁니다 */
assert.equal(shownName({ nickname: '나나로', erased_at: '2026-09-23T00:00:00Z' }), '알 수 없음');

/* ③ 줄 자체가 없을 때 (예전부터 그랬던 자리) */
assert.equal(shownName(null), '알 수 없음');
assert.equal(shownName(undefined), '알 수 없음');

console.log('who 통과 — 6가지');

