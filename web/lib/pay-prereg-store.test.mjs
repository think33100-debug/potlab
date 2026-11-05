/* node web/lib/pay-prereg-store.test.mjs

   사전 신청 창구 초안의 오프라인 시험입니다. 가짜 값과 가짜 client 만 씁니다.
   DB 권한·탈퇴를 재는 시험이 아닙니다. 그것은 Postgres 에서 따로 봐야 합니다. */

import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test, { after } from 'node:test';
import { fileURLToPath } from 'node:url';

let 네트워크호출 = 0;
globalThis.fetch = async () => {
  네트워크호출 += 1;
  throw new Error('이 시험은 네트워크를 쓰지 않습니다');
};
after(() => assert.equal(네트워크호출, 0));

const { addPrereg, cancelPrereg, myPreregStatus } = await import('./pay-prereg-store.ts');

const 가짜 = (응답) => {
  const 호출 = [];
  return { 호출, rpc: async (name, args) => { 호출.push({ name, args }); return 응답; } };
};
const 켜짐 = { data: { 연봉: true, 후기: false }, error: null };

test('신청·취소·상태 — 정한 이름으로 종류만 보냅니다', async () => {
  const c = 가짜(켜짐);
  await addPrereg(c, '연봉');
  await cancelPrereg(c, '후기');
  await myPreregStatus(c);
  assert.deepEqual(c.호출, [
    { name: 'pay_prereg_add', args: { p_kind: '연봉' } },
    { name: 'pay_prereg_cancel', args: { p_kind: '후기' } },
    { name: 'pay_prereg_my_status', args: undefined },
  ]);
});

test('응답 — 참/거짓 둘만 넘기고 다른 칸은 버립니다', async () => {
  const c = 가짜({ data: { 연봉: true, 후기: false, member_id: '가짜-번호', 신청수: 99 }, error: null });
  assert.deepEqual(await myPreregStatus(c), { ok: true, status: { 연봉: true, 후기: false } });
});

test('이상한 응답을 신청 상태로 읽지 않습니다', async () => {
  for (const data of [null, {}, { 연봉: 'true', 후기: false }, { 연봉: true }]) {
    assert.deepEqual(await myPreregStatus(가짜({ data, error: null })), { ok: false, error: 'failed' });
  }
});

test('오류 — 서버 원문을 넘기지 않고 갈래만 줍니다', async () => {
  const 원문 = { code: '42501', message: '가짜-회원번호 가 새면 안 됩니다', details: '가짜' };
  const 결과 = await addPrereg(가짜({ data: null, error: 원문 }), '연봉');
  assert.deepEqual(결과, { ok: false, error: 'login' });
  assert.doesNotMatch(JSON.stringify(결과), /가짜/);
  assert.deepEqual(await addPrereg(가짜({ data: null, error: { code: '22023' } }), '연봉'),
    { ok: false, error: 'bad-kind' });
  const 던짐 = { rpc: async () => { throw new Error('가짜 끊김'); } };
  assert.deepEqual(await addPrereg(던짐, '연봉'), { ok: false, error: 'failed' });
});

test('아직 켜지 않았습니다 — 화면·입구·관리자 코드가 이 파일과 창구를 부르지 않습니다', () => {
  const web = join(dirname(fileURLToPath(import.meta.url)), '..');
  const 훑기 = (폴더) => readdirSync(폴더).flatMap((이름) => {
    const 길 = join(폴더, 이름);
    if (statSync(길).isDirectory()) return 훑기(길);
    return /\.(ts|tsx)$/.test(이름) && !이름.startsWith('pay-prereg-store.') ? [길] : [];
  });
  const 파일 = ['app', 'components', 'lib'].flatMap((d) => 훑기(join(web, d)));
  assert.ok(파일.length > 0, '훑은 파일이 0이면 시험이 뜻을 잃습니다');
  for (const 길 of 파일) {
    assert.doesNotMatch(readFileSync(길, 'utf8'), /pay-prereg-store|pay_prereg_/, 길);
  }
});
