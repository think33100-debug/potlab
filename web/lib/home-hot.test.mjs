/* node web/lib/home-hot.test.mjs

   ① 진짜 getHome() 을 가짜 Supabase 로 돌려, 비회원 첫 화면 자료에 글이 없는지 봅니다
   ② 회원 인기 글 조회를 실제 비동기로 돌립니다 — 답을 붙잡고, 로그아웃하고, 풉니다
   ※ 브라우저·서버 렌더 실행이 아닙니다. node_modules 없이 돌도록 ./supabase 만 바꿉니다. */
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { 인기글열쇠, 인기글자리, 인기글줄, 회원인기글읽기 } from './home-hot.ts';

/* ── ① 첫 화면 자료 ── */
const 비밀제목 = '비회원에게_나가면_안되는_글제목';
const 호출 = [];
const 조회 = (이름) => {
  const 답 = {
    home_blocks: [{ id: 1, kind: 'big', title: '인기', descr: '관리자 설명', metric: 'hot', href: '/community', enabled: true, sort: 1 }],
    공개글: [{ id: 9, title: 비밀제목, body: 비밀제목 }],
    posts: [{ id: 9, title: 비밀제목, body: 비밀제목 }],
  }[이름] ?? [];
  const 고리 = new Proxy({}, {
    get: (_, 키) => {
      if (키 === 'then') return (ok) => ok({ data: 답, error: null });
      if (키 === 'maybeSingle') return async () => ({ data: null, error: null });
      return () => 고리;
    },
  });
  return 고리;
};
globalThis.__가짜DB = {
  from: (이름) => { 호출.push(`from:${이름}`); return 조회(이름); },
  rpc: async (이름) => {
    호출.push(`rpc:${이름}`);
    return { data: 이름 === 'job_totals' ? { deadline: 3, jobs: 40 } : null, error: null };
  },
};
const 훅 = registerHooks({
  resolve(말, 맥락, 다음) {
    if (말 === './supabase') return { url: 'data:text/javascript,export const supabase = globalThis.__가짜DB;', shortCircuit: true };
    return 다음(말, 맥락);
  },
});
const { getHome, metricLine } = await import('./home.ts');
const 자료 = await getHome();
훅.deregister();

assert.ok(호출.includes('from:home_blocks'), '가짜가 진짜 경로를 안 탔습니다');
assert.ok(호출.includes('rpc:job_totals'), '공고 숫자 조회가 사라졌습니다');
assert.equal(자료.metrics.jobs, 40);
assert.ok(!호출.some((c) => /공개글|posts|comments|공개댓글/.test(c)), `첫 화면이 글을 읽었습니다: ${호출}`);
assert.ok(!JSON.stringify(자료).includes(비밀제목), '첫 화면 자료에 글 제목이 있습니다');
assert.ok(!('hot' in 자료.metrics));
assert.equal(metricLine(자료.bigs[0], 자료.metrics), '관리자 설명');

/* ── ② 조회 여부 ── */
const 표 = [
  [{ who: '모름', 회원번호: null, 프로필있음: false, 관리자: false }, null],
  [{ who: '모름', 회원번호: 'A', 프로필있음: true, 관리자: false }, null],
  [{ who: '비회원', 회원번호: null, 프로필있음: false, 관리자: false }, null],
  [{ who: '회원', 회원번호: 'A', 프로필있음: false, 관리자: false }, null],   // 가입 전·프로필 못 읽음
  [{ who: '회원', 회원번호: 'A', 프로필있음: true, 관리자: false }, 'A'],
  [{ who: '회원', 회원번호: 'A', 프로필있음: false, 관리자: true }, 'A'],
];
for (const [입력, 답] of 표) assert.equal(인기글열쇠(입력), 답, JSON.stringify(입력));

/* 비회원·확인 중 조회 0 */
{
  let 읽음 = 0;
  const 자리 = 인기글자리(async () => { 읽음 += 1; return 'x'; }, () => {});
  자리.바꿈(인기글열쇠(표[0][0]));
  자리.바꿈(인기글열쇠(표[2][0]));
  assert.equal(읽음, 0, '비회원·확인 중에 글을 읽었습니다');
}

const 붙잡기 = () => {
  let 풀기; let 깨기;
  const p = new Promise((a, b) => { 풀기 = a; 깨기 = b; });
  return { p, 풀기, 깨기 };
};
const 흘려보내기 = async () => { for (let i = 0; i < 10; i += 1) await Promise.resolve(); };

/* 회원 조회 유지 → 로그아웃 때 비움 */
{
  let 값 = '안정함';
  const 자리 = 인기글자리(async () => '이번 주 글', (v) => { 값 = v; });
  자리.바꿈('A');
  await 흘려보내기();
  assert.deepEqual(값, { 열쇠: 'A', 제목: '이번 주 글' });
  assert.equal(인기글줄('A', 값, '설명'), '이번 주 글');
  자리.바꿈(null);
  assert.equal(값, null, '로그아웃 때 안 비웠습니다');
  assert.equal(인기글줄(null, 값, '설명'), '설명');
}

/* 조회 중 로그아웃 → 늦은 답을 버림 */
{
  const 답 = 붙잡기();
  let 값 = null;
  const 자리 = 인기글자리(() => 답.p, (v) => { 값 = v; });
  자리.바꿈('A');
  자리.바꿈(null);
  답.풀기('늦은 제목');
  await 흘려보내기();
  assert.equal(값, null, '늦은 답이 로그아웃 뒤 제목을 넣었습니다');
}

/* A 의 늦은 답이 B 자리에 안 들어감 */
{
  const A답 = 붙잡기();
  const 차례 = [A답.p, Promise.resolve('B글')];
  let 값 = null;
  const 자리 = 인기글자리(() => 차례.shift(), (v) => { 값 = v; });
  자리.바꿈('A');
  자리.바꿈('B');
  await 흘려보내기();
  A답.풀기('A글');
  await 흘려보내기();
  assert.deepEqual(값, { 열쇠: 'B', 제목: 'B글' });
}

/* 값을 비우기 전 한 번의 그림에도 제목이 안 나감 · 없음과 실패를 가름 */
assert.equal(인기글줄(null, { 열쇠: 'A', 제목: '글' }, '설명'), '설명');
assert.equal(인기글줄('B', { 열쇠: 'A', 제목: '글' }, '설명'), '설명');
assert.equal(인기글줄('A', { 열쇠: 'A', 제목: null }, '설명'), '아직 이번 주 글이 없어요');
{
  let 값 = '안정함';
  const 자리 = 인기글자리(async () => { throw new Error('시험'); }, (v) => { 값 = v; });
  자리.바꿈('A');
  await 흘려보내기();
  assert.equal(값, null);
  assert.equal(인기글줄('A', 값, '설명'), '설명');
}

/* 회원 조회의 모양 — 전과 같은 표·기간·차례 */
{
  const 기록 = [];
  const 답 = (data, error = null) => {
    const 고리 = {
      select: (c) => { 기록.push(['select', c]); return 고리; },
      gte: (k, v) => { 기록.push(['gte', k, v]); return 고리; },
      order: (k, o) => { 기록.push(['order', k, o.ascending]); return 고리; },
      limit: async (n) => { 기록.push(['limit', n]); return { data, error }; },
    };
    return 고리;
  };
  const 가짜 = (data, error) => ({ from: (이름) => { 기록.push(['from', 이름]); return 답(data, error); } });
  assert.equal(await 회원인기글읽기(가짜([{ title: '제목', body: '본문' }]), '2026-11-01'), '제목');
  assert.deepEqual(기록, [
    ['from', '공개글'], ['select', 'id,title,body'], ['gte', 'created_at', '2026-11-01'],
    ['order', 'view_count', false], ['limit', 1],
  ]);
  assert.equal(await 회원인기글읽기(가짜([{ title: null, body: 'ㄱ'.repeat(40) }]), 'x'), 'ㄱ'.repeat(30));
  assert.equal(await 회원인기글읽기(가짜([]), 'x'), null);
  await assert.rejects(회원인기글읽기(가짜(null, { message: '오류' }), 'x'));
}

console.log(`home-hot 통과 — 첫 화면 호출 ${호출.length}건 글 조회 0 · 조회여부 ${표.length} · 늦은 답 실행 2 · 비움 · 실패 닫힘 · 조회 모양`);
