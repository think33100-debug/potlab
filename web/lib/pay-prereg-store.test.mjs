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

const { addPrereg, cancelPrereg, createPreregController, myPreregStatus, 사전신청켜짐 } =
  await import('./pay-prereg-store.ts');

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
  /* 42501 은 로그인 실패가 아닙니다. 가입 미완료·탈퇴·기능 꺼짐도 같은 코드라 가려 말하지 않습니다 */
  assert.deepEqual(결과, { ok: false, error: 'denied' });
  assert.doesNotMatch(JSON.stringify(결과), /가짜/);
  assert.deepEqual(await addPrereg(가짜({ data: null, error: { code: '22023' } }), '연봉'),
    { ok: false, error: 'bad-kind' });
  const 던짐 = { rpc: async () => { throw new Error('가짜 끊김'); } };
  assert.deepEqual(await addPrereg(던짐, '연봉'), { ok: false, error: 'failed' });
});

/* ── 켜는 문: 고정값 하나뿐입니다 ── */

const web = join(dirname(fileURLToPath(import.meta.url)), '..');
const 패널길 = join(web, 'app', 'pay', 'prereg-panel.tsx');

test('아직 켜지 않았습니다 — 문은 고정 false 이고 설치 전에는 어디서도 안 열립니다', () => {
  assert.equal(사전신청켜짐, false);
  const 창구 = readFileSync(join(web, 'lib', 'pay-prereg-store.ts'), 'utf8');
  assert.match(창구, /export const 사전신청켜짐: boolean = false;/);
  const 패널 = readFileSync(패널길, 'utf8');
  assert.match(패널, /if \(!사전신청켜짐\) return null;/);
  for (const 글 of [창구, 패널]) {
    assert.doesNotMatch(글, /process\.env|useSearchParams|searchParams|location\.|localStorage|sessionStorage|document\.cookie/);
  }
});

test('입구는 /pay 패널 하나뿐이고, 관리자 명단·다른 회원 창구가 없습니다', () => {
  const 훑기 = (폴더) => readdirSync(폴더).flatMap((이름) => {
    const 길 = join(폴더, 이름);
    if (statSync(길).isDirectory()) return 훑기(길);
    return /\.(ts|tsx)$/.test(이름) && !이름.startsWith('pay-prereg-store.') ? [길] : [];
  });
  const 파일 = ['app', 'components', 'lib'].flatMap((d) => 훑기(join(web, d)));
  assert.ok(파일.length > 0, '훑은 파일이 0이면 시험이 뜻을 잃습니다');
  const 부르는곳 = 파일.filter((길) => /pay-prereg-store|pay_prereg_/.test(readFileSync(길, 'utf8')));
  assert.deepEqual(부르는곳, [패널길]);
  assert.match(readFileSync(join(web, 'app', 'pay', 'page.tsx'), 'utf8'), /<PreregPanel \/>/);
  const 창구 = readFileSync(join(web, 'lib', 'pay-prereg-store.ts'), 'utf8');
  assert.deepEqual([...new Set(창구.match(/pay_prereg_\w+/g))].sort(),
    ['pay_prereg_add', 'pay_prereg_cancel', 'pay_prereg_my_status']);
});

/* ── 흐름 시험: 응답 때를 손으로 정하는 가짜 client 입니다 ── */

const 줄세운가짜 = () => {
  const 호출 = [];
  return {
    호출,
    rpc: (name, args) => new Promise((풀기) => { 호출.push({ name, args, 풀기 }); }),
  };
};
const 상태 = (연봉, 후기) => ({ data: { 연봉, 후기 }, error: null });
const 회원 = (userId) => ({ who: '회원', userId, 설문: '마침' });
const 차례 = () => new Promise((풀기) => setImmediate(풀기));
const 조립 = (client, enabled = true) => {
  const 본것 = [];
  const 부름 = { client: 0 };
  const c = createPreregController({
    enabled,
    getClient: () => { 부름.client += 1; return client; },
    onChange: (v) => 본것.push(v),
  });
  return { c, 본것, 부름 };
};
const 준비시키기 = async (client, c, userId = '가짜-A') => {
  c.인증바뀜(회원(userId));
  client.호출.at(-1).풀기(상태(true, false));
  await 차례();
};

test('문이 닫히면 — client 생성 0 · RPC 0 · 어떤 조작에도 그대로입니다', async () => {
  const client = 줄세운가짜();
  const { c, 본것, 부름 } = 조립(client, false);
  c.인증바뀜(회원('가짜-A'));
  c.신청('연봉');
  c.취소('후기');
  c.다시확인();
  await 차례();
  assert.equal(부름.client, 0);
  assert.equal(client.호출.length, 0);
  assert.deepEqual(c.보기(), { 단계: '꺼짐' });
  assert.deepEqual(본것, []);
});

test('확인 중·비회원·가입 미완료·못 읽음 — RPC 없이 갈립니다', async () => {
  const client = 줄세운가짜();
  const { c, 부름 } = 조립(client);
  c.인증바뀜({ who: '모름', userId: null, 설문: '모름' });
  assert.deepEqual(c.보기(), { 단계: '확인중' });
  c.인증바뀜({ who: '비회원', userId: null, 설문: '안마침' });
  assert.deepEqual(c.보기(), { 단계: '로그인필요' });
  c.인증바뀜({ who: '회원', userId: '가짜-A', 설문: '안마침' });
  assert.deepEqual(c.보기(), { 단계: '가입미완료' });
  c.인증바뀜({ who: '회원', userId: '가짜-A', 설문: '모름' });
  assert.deepEqual(c.보기(), { 단계: '확인중' });
  c.인증바뀜({ who: '회원', userId: null, 설문: '마침' });
  assert.deepEqual(c.보기(), { 단계: '확인중' });
  c.신청('연봉');
  await 차례();
  assert.equal(부름.client, 0);
  assert.equal(client.호출.length, 0);
});

test('같은 회원의 토큰 갱신 — 다시 부르지 않습니다', async () => {
  const client = 줄세운가짜();
  const { c } = 조립(client);
  await 준비시키기(client, c);
  c.인증바뀜(회원('가짜-A'));
  assert.equal(client.호출.length, 1);
  assert.deepEqual(c.보기(), { 단계: '준비', status: { 연봉: true, 후기: false }, 처리중: null });
});

test('세션 전환 — 앞 회원의 늦은 응답이 뒤 회원 화면에 안 앉습니다', async () => {
  const client = 줄세운가짜();
  const { c } = 조립(client);
  c.인증바뀜(회원('가짜-A'));
  const A응답 = client.호출[0];
  c.인증바뀜(회원('가짜-B'));
  client.호출[1].풀기(상태(false, true));
  await 차례();
  A응답.풀기(상태(true, false));
  await 차례();
  assert.deepEqual(c.보기(), { 단계: '준비', status: { 연봉: false, 후기: true }, 처리중: null });
});

test('로그아웃 — 신청 중이던 늦은 응답이 상태를 되살리지 않습니다', async () => {
  const client = 줄세운가짜();
  const { c } = 조립(client);
  await 준비시키기(client, c);
  c.신청('후기');
  const 늦은것 = client.호출.at(-1);
  c.인증바뀜({ who: '비회원', userId: null, 설문: '안마침' });
  늦은것.풀기(상태(true, true));
  await 차례();
  assert.deepEqual(c.보기(), { 단계: '로그인필요' });
});

test('화면을 떠남 — 늦은 응답을 알리지 않고 뒤 조작도 안 나갑니다', async () => {
  const client = 줄세운가짜();
  const { c, 본것 } = 조립(client);
  await 준비시키기(client, c);
  c.신청('후기');
  const 늦은것 = client.호출.at(-1);
  const 호출수 = client.호출.length;
  const 본수 = 본것.length;
  c.닫기();
  늦은것.풀기(상태(true, true));
  await 차례();
  c.취소('연봉');
  c.인증바뀜(회원('가짜-B'));
  await 차례();
  assert.equal(본것.length, 본수);
  assert.equal(client.호출.length, 호출수);
});

test('중복 클릭 — 처리 중에는 같은 종류도 다른 종류도 안 나갑니다', async () => {
  const client = 줄세운가짜();
  const { c } = 조립(client);
  await 준비시키기(client, c);
  c.신청('후기');
  c.신청('후기');
  c.취소('연봉');
  assert.equal(client.호출.length, 2);
  assert.deepEqual(c.보기(), { 단계: '준비', status: { 연봉: true, 후기: false }, 처리중: '후기' });
  client.호출[1].풀기(상태(true, true));
  await 차례();
  assert.deepEqual(c.보기(), { 단계: '준비', status: { 연봉: true, 후기: true }, 처리중: null });
});

test('오류 뒤 — 지난 성공 상태를 남기지 않고, 다시 확인해야 상태가 돌아옵니다', async () => {
  const client = 줄세운가짜();
  const { c } = 조립(client);
  await 준비시키기(client, c);
  c.신청('후기');
  client.호출.at(-1).풀기({ data: null, error: { code: '42501', message: '가짜-원문' } });
  await 차례();
  assert.deepEqual(c.보기(), { 단계: '오류', 오류: 'denied' });
  assert.doesNotMatch(JSON.stringify(c.보기()), /가짜|연봉|후기/);
  const 호출수 = client.호출.length;
  c.신청('후기');
  assert.equal(client.호출.length, 호출수, '오류 상태에서는 상태를 다시 읽기 전에 쓰지 않습니다');
  c.다시확인();
  client.호출.at(-1).풀기(상태(true, false));
  await 차례();
  assert.equal(client.호출.at(-1).name, 'pay_prereg_my_status');
  assert.deepEqual(c.보기(), { 단계: '준비', status: { 연봉: true, 후기: false }, 처리중: null });
});

test('같은 회원이 설문 모름→마침을 거쳐도 — 쓰기가 끝나기 전에 읽지 않고, 실패를 가리지 않습니다', async () => {
  const 모름 = { who: '회원', userId: '가짜-A', 설문: '모름' };
  const 쓰기중에돌아옴 = async () => {
    const client = 줄세운가짜();
    const { c } = 조립(client);
    await 준비시키기(client, c);
    c.신청('후기');
    c.인증바뀜(모름);
    c.인증바뀜(회원('가짜-A'));
    return { client, c, 쓰기: client.호출[1] };
  };

  /* 성공 — 잠긴 채 기다렸다가, 쓰기가 끝난 뒤에야 상태를 다시 읽습니다 */
  const 성공 = await 쓰기중에돌아옴();
  assert.equal(성공.client.호출.length, 2, '쓰기 완료 전 상태 조회가 나가면 옛 상태로 열립니다');
  assert.deepEqual(성공.c.보기(), { 단계: '불러오는중' });
  성공.c.취소('연봉');
  assert.equal(성공.client.호출.length, 2, '기다리는 동안 다른 쓰기가 나가면 안 됩니다');
  성공.쓰기.풀기(상태(true, true));
  await 차례();
  assert.equal(성공.client.호출.at(-1).name, 'pay_prereg_my_status');
  assert.deepEqual(성공.c.보기(), { 단계: '불러오는중' });
  성공.client.호출.at(-1).풀기(상태(true, true));
  await 차례();
  assert.deepEqual(성공.c.보기(), { 단계: '준비', status: { 연봉: true, 후기: true }, 처리중: null });

  /* 실패 — 돌아온 뒤 실패해도 오류로 남고 옛 상태로 열리지 않습니다 */
  const 실패 = await 쓰기중에돌아옴();
  실패.쓰기.풀기({ data: null, error: { code: '42501', message: '가짜-원문' } });
  await 차례();
  assert.equal(실패.client.호출.length, 2);
  assert.deepEqual(실패.c.보기(), { 단계: '오류', 오류: 'denied' });

  /* 설문 모름인 동안 실패 — 마침으로 돌아와도 새 조회로 덮지 않습니다 */
  const client = 줄세운가짜();
  const { c } = 조립(client);
  await 준비시키기(client, c);
  c.신청('후기');
  c.인증바뀜(모름);
  client.호출[1].풀기({ data: null, error: { code: '가짜-기타' } });
  await 차례();
  c.인증바뀜(회원('가짜-A'));
  assert.equal(client.호출.length, 2);
  assert.deepEqual(c.보기(), { 단계: '오류', 오류: 'failed' });
});

test('client 를 못 만들면 — 원문 없이 실패 갈래로 닫습니다', async () => {
  const c = createPreregController({
    enabled: true,
    getClient: () => { throw new Error('가짜-원문'); },
    onChange: () => {},
  });
  c.인증바뀜(회원('가짜-A'));
  await 차례();
  assert.deepEqual(c.보기(), { 단계: '오류', 오류: 'failed' });
});
