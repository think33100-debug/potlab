/* node web/lib/auth-flow.test.mjs

   늦은 응답을 실제 비동기로 돌립니다 — 답을 붙잡아 두고, 로그아웃한 뒤, 답을 풉니다.
   lib/auth-flow.ts 진짜 코드를 부르고 가짜는 Supabase 자리뿐입니다.
   ※ 브라우저가 아닙니다. React 상태와 실제 Supabase 는 여기서 못 봅니다. */
import assert from 'node:assert/strict';
import { 로그아웃시도, 세션꺼내기, 인증흐름 } from './auth-flow.ts';

const 붙잡기 = () => {
  let 풀기; let 깨기;
  const p = new Promise((a, b) => { 풀기 = a; 깨기 = b; });
  return { p, 풀기, 깨기 };
};
const 흘려보내기 = async () => { for (let i = 0; i < 20; i += 1) await Promise.resolve(); };

const 세션 = (id) => ({ user: { id } });
const 있음 = { data: { user: { id: 'x' } }, error: null };
const 서버오류 = { data: { user: null }, error: { 서버: true } };
const 끊김 = { data: { user: null }, error: { 서버: false } };

/* 답을 차례로 넘기는 가짜. 함수를 주면 부를 때마다 그 답을 씁니다 */
function 차리기({ 처음 = null, 사용자 = [], 프로필 = [] } = {}) {
  const 상태 = {
    세션: '안정함', 프로필: '안정함', 준비: 0, 로컬로그아웃: 0, 프로필읽음: [], 알림: 0, 풀림: 0,
  };
  let 받기 = null;
  const 흐름 = 인증흐름({
    세션읽기: async () => (typeof 처음 === 'function' ? 처음() : 처음),
    사용자묻기: () => {
      const 답 = 사용자.shift();
      return 답 && 답.p ? 답.p : Promise.resolve(답 ?? 있음);
    },
    서버답인가: (e) => e.서버 === true,
    로컬로그아웃: async () => { 상태.로컬로그아웃 += 1; },
    구독: (f) => { 받기 = f; return () => { 상태.풀림 += 1; }; },
    프로필읽기: (s) => {
      상태.프로필읽음.push(s.user.id);
      const 답 = 프로필.shift();
      return 답 && 답.p ? 답.p : Promise.resolve(답 ?? `프로필:${s.user.id}`);
    },
    세션적용: (s) => { 상태.세션 = s; },
    프로필적용: (p) => { 상태.프로필 = p; },
    준비끝: () => { 상태.준비 += 1; },
    로그아웃알림: () => { 상태.알림 += 1; },
    다시읽기한도: 20,
  });
  return { 상태, 흐름, 사건: (e, s) => 받기(e, s) };
}

/* ① 확인(verify) 중 로그아웃 → 늦은 답이 세션을 안 되살립니다 */
{
  const 답 = 붙잡기();
  const { 상태, 흐름, 사건 } = 차리기({ 사용자: [답] });
  흐름.시작();
  const 진행 = 사건('SIGNED_IN', 세션('A'));
  await 흘려보내기();
  await 사건('SIGNED_OUT', null);
  assert.equal(상태.세션, null);
  assert.equal(상태.알림, 1, '다른 길의 로그아웃도 화면 자료를 비웁니다');
  답.풀기(있음);
  await 진행;
  await 흘려보내기();
  assert.equal(상태.세션, null, '늦은 verify 가 세션을 되살렸습니다');
  assert.equal(상태.프로필, null);
  assert.deepEqual(상태.프로필읽음, [], '로그아웃 뒤에 프로필을 읽었습니다');
}

/* ② 프로필(loadMe) 중 signOut → 늦은 답이 me 를 안 되살립니다 */
{
  const 답 = 붙잡기();
  const { 상태, 흐름, 사건 } = 차리기({ 프로필: [답] });
  흐름.시작();
  const 진행 = 사건('SIGNED_IN', 세션('A'));
  await 흘려보내기();
  assert.equal(상태.세션.user.id, 'A');
  assert.equal(await 흐름.로그아웃(async () => true), true);
  답.풀기('A의 프로필');
  await 진행;
  await 흘려보내기();
  assert.equal(상태.세션, null);
  assert.equal(상태.프로필, null, '늦은 loadMe 가 me 를 되살렸습니다');
}

/* ③ signOut 이 끝나기 전에 온 토큰 갱신도 세션을 안 되살립니다. 누르자마자 잠깁니다 */
{
  const 나감 = 붙잡기();
  const { 상태, 흐름, 사건 } = 차리기();
  흐름.시작();
  await 사건('SIGNED_IN', 세션('A'));
  assert.equal(상태.프로필, '프로필:A');
  const 진행 = 흐름.로그아웃(() => 나감.p);
  assert.equal(상태.세션, null, '누른 순간 잠겨야 합니다');
  assert.equal(상태.프로필, null);
  await 사건('TOKEN_REFRESHED', 세션('A'));
  await 흘려보내기();
  assert.equal(상태.세션, null, '로그아웃 중 사건이 세션을 되살렸습니다');
  나감.풀기(true);
  await 진행;
  assert.equal(상태.세션, null);
  assert.equal(상태.알림, 0, 'signOut 길은 자기가 화면을 비웁니다');
}

/* ③-2 signOut 실패(실패 답·던짐) 뒤 사건·다시읽기·재시작 → 재노출 0. 성공한 재시도만 풀림 */
for (const 실패 of [async () => false, async () => { throw new Error('시험'); }]) {
  const { 상태, 흐름, 사건 } = 차리기({ 처음: 세션('A') });
  let 끝 = 흐름.시작();
  await 흘려보내기();
  assert.equal(상태.세션.user.id, 'A');
  assert.equal(await 흐름.로그아웃(실패), false);
  const 읽음 = 상태.프로필읽음.length;
  await 사건('SIGNED_IN', 세션('A'));
  await 사건('TOKEN_REFRESHED', 세션('A'));
  await 사건('INITIAL_SESSION', 세션('A'));
  await 흐름.다시읽기();
  끝();
  끝 = 흐름.시작();
  await 사건('SIGNED_IN', 세션('A'));
  await 흘려보내기();
  assert.equal(상태.세션, null, '실패한 로그아웃 뒤 세션이 되살아났습니다');
  assert.equal(상태.프로필, null, '실패한 로그아웃 뒤 프로필이 되살아났습니다');
  assert.equal(상태.프로필읽음.length, 읽음, '실패한 로그아웃 뒤 프로필을 읽었습니다');
  assert.equal(await 흐름.로그아웃(async () => true), true);
  await 사건('SIGNED_IN', 세션('B'));
  assert.equal(상태.세션.user.id, 'B', '성공한 재시도 뒤에는 새 로그인이 돼야 합니다');
  끝();
}

/* ③-3 실제 응답 꼴 — 서버 실패면 local 로 재시도하고 그 결과까지 봅니다 */
{
  const 호출 = [];
  const 답차례 = (답들) => async (옵션) => {
    호출.push(옵션?.scope ?? 'global');
    const 답 = 답들.shift();
    if (답 instanceof Error) throw 답;
    return 답;
  };
  const 오류 = { error: { message: '시험' } };
  const 정상 = { error: null };
  assert.equal(await 로그아웃시도(답차례([정상])), true);
  assert.deepEqual(호출, ['global']);
  호출.length = 0;
  assert.equal(await 로그아웃시도(답차례([오류, 정상])), true);
  assert.deepEqual(호출, ['global', 'local']);
  assert.equal(await 로그아웃시도(답차례([오류, 오류])), false, 'local 실패를 성공으로 봤습니다');
  assert.equal(await 로그아웃시도(답차례([오류, new Error('시험')])), false);
  assert.equal(await 로그아웃시도(답차례([new Error('시험')])), false);
}

/* ④ 옛 세션의 늦은 답 — 새로 로그인한 사람을 안 내보내고 안 덮습니다 */
{
  const A확인 = 붙잡기();
  const { 상태, 흐름, 사건 } = 차리기({ 사용자: [A확인, 있음] });
  흐름.시작();
  const 진행 = 사건('SIGNED_IN', 세션('A'));
  await 흘려보내기();
  await 사건('SIGNED_IN', 세션('B'));
  assert.equal(상태.세션.user.id, 'B');
  A확인.풀기(서버오류);
  await 진행;
  await 흘려보내기();
  assert.equal(상태.로컬로그아웃, 0, '옛 답이 새 세션을 지웠습니다');
  assert.equal(상태.세션.user.id, 'B');
  assert.equal(상태.프로필, '프로필:B');
}

/* ⑤ A 의 늦은 프로필이 B 를 안 덮고, 바뀌는 사이 A 자료를 안 들고 있습니다 */
{
  const A프로필 = 붙잡기();
  const B프로필 = 붙잡기();
  const { 상태, 흐름, 사건 } = 차리기({ 프로필: ['프로필:A', A프로필, B프로필] });
  흐름.시작();
  await 사건('SIGNED_IN', 세션('A'));
  assert.equal(상태.프로필, '프로필:A');
  const a = 사건('TOKEN_REFRESHED', 세션('A'));
  await 흘려보내기();
  const b = 사건('SIGNED_IN', 세션('B'));
  await 흘려보내기();
  assert.equal(상태.프로필, '모름', '다른 사람으로 바뀌면 앞사람 자료를 치웁니다');
  B프로필.풀기('프로필:B');
  await b;
  A프로필.풀기('프로필:A늦음');
  await a;
  await 흘려보내기();
  assert.equal(상태.프로필, '프로필:B');
}

/* ⑥ 뒷정리 뒤의 답은 전부 버립니다 */
{
  const 답 = 붙잡기();
  const { 상태, 흐름, 사건 } = 차리기({ 처음: 세션('A'), 사용자: [답] });
  const 끝 = 흐름.시작();
  void 사건;
  await 흘려보내기();
  끝();
  assert.equal(상태.풀림, 1);
  답.풀기(있음);
  await 흘려보내기();
  assert.equal(상태.세션, '안정함', '뒷정리 뒤에 세션을 썼습니다');
  assert.equal(상태.준비, 0);
}

/* ⑦ 2026-09-25 규칙 그대로 — 끊김은 유지, 서버 답은 내보냄 */
{
  const { 상태, 흐름, 사건 } = 차리기({ 사용자: [끊김] });
  흐름.시작();
  await 사건('SIGNED_IN', 세션('A'));
  assert.equal(상태.세션.user.id, 'A');
  assert.equal(상태.로컬로그아웃, 0);
}
{
  const { 상태, 흐름 } = 차리기({ 처음: 세션('A'), 사용자: [서버오류] });
  흐름.시작();
  await 흘려보내기();
  assert.equal(상태.로컬로그아웃, 1);
  assert.equal(상태.세션, null);
}

/* ⑧ 실패는 닫힌 쪽 — 프로필을 못 읽으면 '모름', 세션을 못 읽으면 확인 중 유지 */
{
  const 답 = 붙잡기();
  const { 상태, 흐름, 사건 } = 차리기({ 프로필: [답] });
  흐름.시작();
  const 진행 = 사건('SIGNED_IN', 세션('A'));
  await 흘려보내기();
  답.깨기(new Error('시험'));
  await 진행;
  assert.equal(상태.프로필, '모름');
  assert.ok(상태.준비 >= 1);
}
{
  const { 상태, 흐름 } = 차리기({ 처음: () => { throw new Error('시험'); } });
  흐름.시작();
  await 흘려보내기();
  assert.equal(상태.세션, '안정함');
  assert.equal(상태.준비, 0, '세션을 못 읽었는데 확인이 끝났다고 했습니다');
}
/* getSession 의 실제 오류 답 { session: null, error } 와, 그때 라이브러리가 보내는
   INITIAL_SESSION(null) — 비회원으로 읽지 않습니다. 진짜 비회원은 비회원입니다 */
{
  const 오류답 = { data: { session: null }, error: { message: '시험' } };
  assert.throws(() => 세션꺼내기(오류답));
  assert.equal(세션꺼내기({ data: { session: null }, error: null }), null);
  const { 상태, 흐름, 사건 } = 차리기({ 처음: () => 세션꺼내기(오류답) });
  흐름.시작();
  await 사건('INITIAL_SESSION', null);
  await 흘려보내기();
  assert.equal(상태.세션, '안정함', '세션 오류를 비회원으로 읽었습니다');
  assert.equal(상태.준비, 0);
}
{
  const { 상태, 흐름, 사건 } = 차리기();
  흐름.시작();
  await 사건('INITIAL_SESSION', null);
  assert.equal(상태.세션, null);
  assert.ok(상태.준비 >= 1);
}

/* ⑨ 다시읽기 — 로그아웃 뒤 늦은 답을 버리고, 나중 읽기가 이깁니다 */
{
  const 답 = 붙잡기();
  const { 상태, 흐름, 사건 } = 차리기({ 처음: 세션('A'), 프로필: ['첫', 답] });
  흐름.시작();
  await 흘려보내기();
  assert.equal(상태.프로필, '첫');
  const 읽기 = 흐름.다시읽기();
  await 흘려보내기();
  await 사건('SIGNED_OUT', null);
  답.풀기('늦음');
  await 읽기;
  assert.equal(상태.프로필, null, '늦은 다시읽기가 me 를 되살렸습니다');
}
{
  const 앞 = 붙잡기();
  const 뒤 = 붙잡기();
  const { 상태, 흐름 } = 차리기({ 처음: 세션('A'), 프로필: ['첫', 앞, 뒤] });
  흐름.시작();
  await 흘려보내기();
  const a = 흐름.다시읽기();
  await 흘려보내기();
  const b = 흐름.다시읽기();
  await 흘려보내기();
  뒤.풀기('새값');
  await b;
  앞.풀기('옛값');
  await a;
  assert.equal(상태.프로필, '새값');
}

/* ⑩ 진행 중 세션 확인이 멈춰도 다시읽기는 돌아옵니다. 자기 읽기가 멈춰도 한도에서 돌아옵니다 */
{
  const 멈춘확인 = 붙잡기();
  const { 상태, 흐름, 사건 } = 차리기({ 처음: 세션('A'), 사용자: [있음, 멈춘확인] });
  흐름.시작();
  await 흘려보내기();
  const 멈춤 = 사건('TOKEN_REFRESHED', 세션('A'));
  await 흘려보내기();
  await 흐름.다시읽기();
  void 멈춤;
  assert.equal(상태.세션.user.id, 'A');
  assert.deepEqual(상태.프로필읽음, ['A', 'A'], '다시읽기가 진행 중 확인에 묶였습니다');
}
{
  const 멈춘읽기 = 붙잡기();
  const { 상태, 흐름 } = 차리기({ 처음: 세션('A'), 프로필: ['첫', 멈춘읽기] });
  흐름.시작();
  await 흘려보내기();
  await 흐름.다시읽기();      // 한도 20ms 로 돌아옵니다
  assert.equal(상태.프로필, '첫');
}

/* ⑪ 다른 계정의 세션을 읽으면 프로필을 섞지 않습니다 */
{
  let 저장 = 세션('A');
  const { 상태, 흐름 } = 차리기({ 처음: () => 저장 });
  흐름.시작();
  await 흘려보내기();
  assert.equal(상태.프로필, '프로필:A');
  저장 = 세션('B');
  await 흐름.다시읽기();
  assert.equal(상태.세션.user.id, 'A');
  assert.equal(상태.프로필, '프로필:A', '다른 계정 프로필을 앞 세션과 섞었습니다');
  assert.deepEqual(상태.프로필읽음, ['A']);
}

console.log('auth-flow 통과 — 늦은 응답 실제 실행 · 로그아웃 3길 · 실패 잠금 2 · 재시도 응답 5 · 새 세션 2 · 뒷정리 · 09-25 규칙 2 · 실패 닫힘 4 · 다시읽기 5');
