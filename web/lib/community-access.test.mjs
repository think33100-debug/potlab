/* node web/lib/community-access.test.mjs

   비회원은 공고 전부, 가입 회원은 커뮤니티.
   실제 계정·DB·네트워크 없이 규칙과 코드 차례만 봅니다.
   ※ 브라우저로 눌러 본 시험이 아닙니다. DB 권한도 여기서 못 봅니다. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { 문표시, 커뮤니티문확인 } from './community-access.ts';

const 가짜DB = (답 = {}) => {
  const 호출 = [];
  return {
    호출,
    rpc(이름) {
      호출.push(`rpc:${이름}`);
      const r = 답[이름] ?? { data: null, error: null };
      return { maybeSingle: async () => r, then: (ok) => ok(r) };
    },
    from(이름) { 호출.push(`from:${이름}`); throw new Error(`조회 금지: ${이름}`); },
  };
};
const 줄 = (data) => ({ data, error: null });
const 오류 = { data: null, error: { message: '시험 오류' } };

/* ① 비회원·확인 중 — 조회 0 */
for (const [who, 상태] of [['비회원', '로그인필요'], ['모름', '확인중']]) {
  const sb = 가짜DB();
  assert.deepEqual(await 커뮤니티문확인(sb, who), { 상태, 역할: null });
  assert.equal(sb.호출.length, 0, `${who} 인데 조회가 나갔습니다`);
}

/* ② 가입 회원 — 재직 인증·설문 없이 열립니다 */
for (const 프로필 of [
  { role: '현직', survey_at: '2026-11-05T00:00:00Z' },
  { role: '학생', survey_at: null },
  { role: null, survey_at: null },
]) {
  const sb = 가짜DB({ 내프로필: 줄(프로필) });
  assert.deepEqual(await 커뮤니티문확인(sb, '회원'), { 상태: '열림', 역할: 프로필.role });
  assert.deepEqual(sb.호출, ['rpc:내프로필']);
}

/* ③ 못 읽음과 줄 없음을 가릅니다 */
assert.equal((await 커뮤니티문확인(가짜DB({ 내프로필: 오류 }), '회원')).상태, '확인중');
assert.equal((await 커뮤니티문확인(가짜DB({ is_admin: 줄(false) }), '회원')).상태, '가입필요');
assert.equal((await 커뮤니티문확인(가짜DB({ is_admin: 줄(true) }), '회원')).상태, '열림');
assert.equal((await 커뮤니티문확인(가짜DB({ is_admin: 오류 }), '회원')).상태, '확인중');

/* ④ 화면 표 — 12칸. 세션 확인 중은 로딩, 로그아웃하면 내용을 치웁니다 */
const 표 = [
  ['열림', '모름', '로딩', '/login', false],
  ['로그인필요', '모름', '로딩', '/login', false],
  ['가입필요', '모름', '로딩', '/login', false],
  ['확인중', '모름', '로딩', '/login', false],
  ['열림', '비회원', '잠김', '/login', true],
  ['로그인필요', '비회원', '잠김', '/login', false],
  ['가입필요', '비회원', '잠김', '/login', false],
  ['확인중', '비회원', '잠김', '/login', false],
  ['열림', '회원', '내용', '/login', false],
  ['로그인필요', '회원', '잠김', '/login', true],
  ['가입필요', '회원', '잠김', '/welcome', false],
  ['확인중', '회원', '로딩', '/login', true],
];
for (const [서버, who, 표시, 가는곳, 새로고침] of 표) {
  assert.deepEqual(문표시(서버, who), { 표시, 가는곳, 새로고침 }, `${서버}/${who}`);
}

/* ⑤ 코드 차례 — 주석을 걷고 봅니다 */
const 원문 = (길) => readFileSync(new URL(`../${길}`, import.meta.url), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');
const 앞서나 = (글, 앞, 뒤, 이름) => {
  const a = 글.indexOf(앞);
  const b = 글.indexOf(뒤);
  assert.ok(a >= 0 && b >= 0, `${이름}: ${앞} 또는 ${뒤} 가 없습니다`);
  assert.ok(a < b, `${이름}: ${앞} 가 ${뒤} 보다 뒤에 있습니다`);
};

/* 문 판정이 첫 커뮤니티 조회보다 앞서고, 닫히면 그 자리에서 돌아갑니다 */
for (const [길, 첫조회] of [
  ['app/community/page.tsx', "sb.from('공개글')"],
  ['app/community/[ch]/page.tsx', "sb.rpc('방에쓸수있나'"],
  ['app/post/[id]/page.tsx', 'await getPost(sb, id)'],
]) {
  const 글 = 원문(길);
  const 본문 = 글.slice(글.indexOf('export default async function'));
  앞서나(본문, '커뮤니티문확인(sb', "if (문.상태 !== '열림') return", 길);
  앞서나(본문, "if (문.상태 !== '열림') return", 첫조회, 길);
  assert.ok(본문.includes('<CommunityDoor 서버="열림">'), `${길}: 문 안에 안 들어 있습니다`);
}

/* 글 주소의 미리보기는 글을 안 읽습니다 */
const 글쪽 = 원문('app/post/[id]/page.tsx');
assert.ok(!글쪽.includes('generateMetadata'));
assert.ok(!글쪽.includes('await getPost(supabase'));
assert.ok(!글쪽.includes('siteUrl'));

/* 대화방은 문이 열려야 창구를 부르는 안쪽 부품이 그려집니다 */
assert.ok(원문('app/talk/page.tsx').includes('<CommunityDoor 서버="열림"><TalkList /></CommunityDoor>'));
assert.ok(원문('app/talk/[room]/page.tsx').includes('<CommunityDoor 서버="열림"><TalkRoomInner /></CommunityDoor>'));

/* 문은 「내용」 일 때만 children 을 그리고, 로그아웃은 화면 자료를 비웁니다 */
const 문글 = 원문('components/community-door.tsx');
assert.equal(문글.split('{children}').length - 1, 1);
앞서나(문글, "판.표시 === '내용'", '{children}', '문');
const 인증글 = 원문('app/auth.tsx');
앞서나(인증글.slice(인증글.lastIndexOf('signOut: async')), "router.push('/')", 'router.refresh()', '로그아웃');
/* 늦은 응답 차단은 lib/auth-flow.test.mjs 가 실제로 돌려 봅니다. 여기서는 연결만 봅니다 */
for (const 낱말 of ['흐름.시작()', '흐름.로그아웃(', '흐름.다시읽기()', '로그아웃알림: () => router.refresh()']) {
  assert.ok(인증글.includes(낱말), `app/auth.tsx 에 ${낱말} 이 없습니다`);
}
assert.ok(!인증글.includes('.then('), 'app/auth.tsx 에 흐름 밖 비동기가 남았습니다');
assert.equal(인증글.split('setSession').length - 1, 2, '세션을 정하는 자리가 늘었습니다');

/* ⑥ 첫 화면 — 응답에 커뮤니티 글이 없습니다. 공고 숫자는 그대로입니다 */
const 홈 = 원문('lib/home.ts');
for (const 낱말 of ['공개글', "from('posts')", 'hotRow', 'HOT_DAYS', 'hot:']) {
  assert.ok(!홈.includes(낱말), `lib/home.ts 에 ${낱말} 이 남았습니다`);
}
assert.ok(홈.includes("supabase.rpc('job_totals')"));
const 첫화면 = 원문('app/page.tsx');
assert.ok(!첫화면.includes('공개글'));
assert.ok(!첫화면.includes('metrics.hot'));
assert.ok(첫화면.includes('<MemberHotLine'), '회원 인기 글 줄이 빠졌습니다');

/* ⑦ 공고 — 비회원 길에 커뮤니티 문을 걸지 않았습니다 */
for (const 길 of ['app/jobs/page.tsx', 'app/jobs/[id]/page.tsx']) {
  const 글 = 원문(길);
  assert.ok(!글.includes('CommunityDoor'), `${길} 에 커뮤니티 문이 걸렸습니다`);
  assert.ok(!글.includes('커뮤니티문확인'), `${길} 에 커뮤니티 문이 걸렸습니다`);
}

console.log(`community-access 통과 — 비회원·확인중 2 · 회원 3 · 못읽음 4 · 화면표 ${표.length} · 코드차례 포함`);
