/* 기준공고.mjs 회귀 시험 — 오프라인 · 의존성 없음 (node:test) · 멘토-1.15-2
 *
 *   node --test tools/hosp/기준공고.test.mjs
 *
 * 실제 요청은 0 입니다 — 사이트줄() 을 부를 때는 globalThis.fetch 를 가짜로 바꿉니다(게시판건강.test.mjs 와 같은 꼴).
 * 강진의료원 설정·응답은 저장소의 실제 줄(hosp-sites.json)과 실제 모양 고정본(fixtures/list-observation/gangjin-9.html).
 * 주소는 a.example.invalid — 실제 병원 주소·세션 값을 시험 파일에 안 남깁니다.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 사이트줄 } from './sites.mjs';
import {
  주소꼴, 제목꼴, 쪽열쇠, 기준보기, 기준정리, 기준가르기, 기준줄, 못찾음가르기, 판정날수,
} from './기준공고.mjs';
import { 아침가르기, 아침줄, 바퀴정리, 빈기록, 기준까닭 } from './게시판건강.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 읽기 = (...길) => fs.readFileSync(path.join(여기, ...길), 'utf8');
const 시간 = 3600e3, 하루 = 86400e3;
const 처음 = Date.parse('2026-11-18T07:30:00+09:00');

/* 게시판 한 쪽 — 위가 새 글. 번호가 클수록 새 글 */
const 글 = (n, 더 = {}) => ({ title: '2026년 ' + n + '번 직원 채용 공고', url: 'https://a.example.invalid/bbs/view.php?wr_id=' + n + '&page=1', ...더 });
const 쪽 = (번호들, 더) => ({ rows: 번호들.map((n) => 글(n, 더 && 더(n))), raw: '' });
const 게시판 = { name: '가병원', type: 'html', url: 'https://a.example.invalid/bbs' };
const 내림 = (위, 아래) => Array.from({ length: 위 - 아래 + 1 }, (_, i) => 위 - i);   // [위 … 아래]

describe('열쇠 — 운영 DB 에서 본 꼴 그대로', () => {
  test('주소 — 세션 값 · 쪽 번호 · www · http · 끝 / · 빈 값은 같은 글', () => {
    /* 희명병원 꼴: 같은 글인데 PHPSESSID 만 바퀴마다 바뀜 (쓰레기통 449벌) */
    const 희명 = (sid) => 'https://a.example.invalid:41329/new/sub/sub07-08.php?act=view&bbs_data=aWR4PTEyODkz||&PHPSESSID=' + sid;
    assert.equal(주소꼴(희명('00619d91')), 주소꼴(희명('ffe743d5')));
    /* 동수원병원 꼴: page=1 ↔ page= */
    assert.equal(주소꼴('https://a.example.invalid/support/recruit.php?ptype=view&idx=147377&page=1&code=recruit_board'),
      주소꼴('https://a.example.invalid/support/recruit.php?ptype=view&idx=147377&page=&code=recruit_board'));
    /* www 없는 꼴로 바뀜 (숨긴 공고 5건의 까닭) */
    assert.equal(주소꼴('https://www.a.example.invalid/board/view.do?no=18'), 주소꼴('http://a.example.invalid/board/view.do?no=18/'.replace(/\/$/, '')));
    assert.equal(주소꼴('https://a.example.invalid/x;jsessionid=ABC?seq=3'), 주소꼴('https://a.example.invalid/x?seq=3'));
    /* 다른 글은 다른 열쇠 · 차병원 꼴 해시(#/…/번호)는 남깁니다 */
    assert.notEqual(주소꼴('https://a.example.invalid/v?wr_id=1'), 주소꼴('https://a.example.invalid/v?wr_id=2'));
    assert.notEqual(주소꼴('https://a.example.invalid/page.ckd#/recruit/announcement/7'), 주소꼴('https://a.example.invalid/page.ckd#/recruit/announcement/8'));
    assert.equal(주소꼴(''), null);
  });

  test('제목 — 상태 딱지 · 띄어쓰기 · 부호는 빼고 봅니다', () => {
    assert.equal(제목꼴('[마감] 2026년 물리치료사 채용'), 제목꼴('2026년  물리치료사 채용 (접수중)'));
    assert.equal(제목꼴('2026년 물리치료사 채용【채용완료】'), 제목꼴('2026년 물리치료사 채용'));
    assert.notEqual(제목꼴('2026년 물리치료사 채용'), 제목꼴('2026년 작업치료사 채용'));
    assert.equal(제목꼴('공지'), null);
  });

  test('쪽에서 하나뿐인 열쇠만 씁니다 (순천향 꼴 — 모든 줄 주소가 같음)', () => {
    const k = 쪽열쇠([{ title: '간호사 채용', url: 'https://a.example.invalid/?departmentidx=1' },
      { title: '물리치료사 채용', url: 'https://a.example.invalid/?departmentidx=1' }]);
    assert.equal(k[0][0], null);
    assert.equal(k[1][0], null);
    assert.ok(k[0][1] && k[1][1] && k[0][1] !== k[1][1]);
  });
});

describe('고르기 — 하루 넘게 두 번 본 글 중 맨 위', () => {
  test('첫 바퀴는 적어 두기만 · 20시간 안은 기다림 · 그 뒤 맨 위 글', () => {
    const 기 = {};
    assert.deepEqual(기준보기(기, 게시판, 쪽(내림(20, 11)), 처음), { 일: '기다림' });
    assert.deepEqual(기준보기(기, 게시판, 쪽(내림(20, 11)), 처음 + 2 * 시간), { 일: '기다림' });
    /* 그 사이 새 글 21 이 올라옴 — 21 은 처음 쪽에 없었으니 후보가 아닙니다 */
    assert.deepEqual(기준보기(기, 게시판, 쪽(내림(21, 12)), 처음 + 21 * 시간), { 일: '고름' });
    const 곳 = 기.기준['가병원'];
    assert.equal(곳.기준.제목, '2026년 20번 직원 채용 공고');
    assert.equal(곳.기준.앞.length, 1);
    assert.equal(곳.기준.뒤.length, 8);
    assert.ok(곳.기준.열쇠[0] && 곳.기준.열쇠[1], '주소·제목 열쇠 둘 다');
  });

  test('주소가 바퀴마다 바뀌는 곳(세션 값 · 희명 꼴)은 제목 열쇠만 남깁니다', () => {
    const 기 = {};
    let 바퀴 = 0;
    const 세션쪽 = () => ({ rows: 내림(5, 1).map((n) => ({ title: n + '번 간호조무사 모집', url: 'https://a.example.invalid/v?idx=' + n + '&sess=' + (++바퀴) })) });
    const 희명 = { name: '희명꼴', type: 'html' };
    기준보기(기, 희명, 세션쪽(), 처음);
    assert.deepEqual(기준보기(기, 희명, 세션쪽(), 처음 + 21 * 시간), { 일: '고름' });
    assert.equal(기.기준['희명꼴'].기준.열쇠[0], null, '바뀐 주소 열쇠는 버림');
    assert.ok(기.기준['희명꼴'].기준.열쇠[1]);
    assert.deepEqual(기준보기(기, 희명, 세션쪽(), 처음 + 22 * 시간), { 일: '찾음' });
  });

  test('하루 넘게 이어진 글이 없으면 쪽을 새로 적고 다음에', () => {
    const 기 = {};
    기준보기(기, 게시판, 쪽(내림(10, 1)), 처음);
    assert.deepEqual(기준보기(기, 게시판, 쪽(내림(40, 31)), 처음 + 21 * 시간), { 일: '기다림' });
    assert.equal(기.기준['가병원'].쪽.때, 처음 + 21 * 시간);
    assert.deepEqual(기준보기(기, 게시판, 쪽(내림(40, 31)), 처음 + 42 * 시간), { 일: '고름' });
  });

  test('실패 · 줄 0 · 이름 없음은 아무것도 안 합니다', () => {
    const 기 = {};
    assert.equal(기준보기(기, 게시판, { err: 'HTTP 500', 실패: {} }, 처음), null);
    assert.equal(기준보기(기, 게시판, { rows: [] }, 처음), null);
    assert.equal(기준보기(기, {}, 쪽([1]), 처음), null);
    assert.equal(기준보기(null, 게시판, 쪽([1]), 처음), null);
    assert.deepEqual(기, {});
  });
});

/* 고른 상태까지 — 쪽 [20 … 11] 에서 20 을 고름 */
function 고른기록() {
  const 기 = {};
  기준보기(기, 게시판, 쪽(내림(20, 11)), 처음);
  기준보기(기, 게시판, 쪽(내림(20, 11)), 처음 + 21 * 시간);
  return 기;
}
const 고른때 = 처음 + 21 * 시간;

describe('밀려 빠짐 ↔ 규칙 의심 — 바로 앞 바퀴와 견줌', () => {
  test('새 글에 밀려 첫 쪽에서 빠짐 → 경보 없이 새로 고름', () => {
    const 기 = 고른기록();
    /* 새 글 21~29 가 차례로 올라와 20 이 맨 아래까지 내려감 */
    assert.deepEqual(기준보기(기, 게시판, 쪽(내림(29, 20)), 고른때 + 시간), { 일: '찾음' });
    assert.equal(기.기준['가병원'].기준.뒤.length, 0);
    /* 30 이 올라와 20 이 빠짐 — 위 글은 남고 새 글이 생김 */
    const r = 기준보기(기, 게시판, 쪽(내림(30, 21)), 고른때 + 2 * 시간);
    assert.equal(r.일, '밀림');
    assert.match(r.까닭, /^맨 끝 줄이 새 글에 밀림/);
    assert.equal(기.기준['가병원'].놓침, null);
  });

  test('아래 글이 남는데 이 글만 없음 → 놓침(규칙 의심)', () => {
    const 기 = 고른기록();
    const r = 기준보기(기, 게시판, 쪽([21, 19, 18, 17, 16, 15, 14, 13, 12, 11]), 고른때 + 시간);
    assert.deepEqual(r, { 일: '놓침', 까닭: '아래 글은 남았는데 이 글만 없음' });
  });

  test('쪽 글이 전부 바뀜 (규칙이 다른 줄을 읽음) → 놓침', () => {
    const 기 = 고른기록();
    const 딴쪽 = { rows: 내림(10, 1).map((n) => ({ title: '진료 안내 공지 ' + n, url: 'https://a.example.invalid/notice?no=' + n })) };
    assert.deepEqual(기준보기(기, 게시판, 딴쪽, 고른때 + 시간), { 일: '놓침', 까닭: '쪽 글이 전부 바뀜' });
  });

  test('글 하나뿐인 쪽(상무병원 고정본 꼴)에서 글이 바뀜 → 놓침이지만 까닭을 따로', () => {
    const 기 = {};
    기준보기(기, 게시판, 쪽([7]), 처음);
    기준보기(기, 게시판, 쪽([7]), 처음 + 21 * 시간);
    assert.deepEqual(기준보기(기, 게시판, 쪽([8]), 처음 + 22 * 시간),
      { 일: '놓침', 까닭: '글 하나뿐인 쪽에서 글이 바뀜(병원이 바꿔 달았을 수 있음)' });
  });

  test('주소 꼴만 바뀜 (우리가 링크 규칙을 고침 · 서울성모 꼴) → 제목으로 찾음', () => {
    const 기 = 고른기록();
    const 새꼴 = { rows: 내림(20, 11).map((n) => ({ title: 글(n).title, url: 'https://a.example.invalid/recruit?articleNo=' + n })) };
    assert.deepEqual(기준보기(기, 게시판, 새꼴, 고른때 + 시간), { 일: '찾음' });
  });

  test('제목에 [마감] 이 붙음 → 주소로 찾음', () => {
    const 기 = 고른기록();
    assert.deepEqual(기준보기(기, 게시판, 쪽(내림(20, 11), (n) => (n === 20 ? { title: '[마감] ' + 글(n).title } : {})), 고른때 + 시간), { 일: '찾음' });
  });

  test('덜 받은 쪽(글 수 절반 미만)은 견주지 않습니다', () => {
    const 기 = 고른기록();
    assert.deepEqual(기준보기(기, 게시판, 쪽([15, 14, 13, 12]), 고른때 + 시간), { 일: '견주지않음' });
    assert.equal(기.기준['가병원'].놓침, null);
  });

  test('새 글 없이 이 글과 아래 글만 없어짐 → 놓침', () => {
    const 기 = 고른기록();
    기준보기(기, 게시판, 쪽(내림(25, 16)), 고른때 + 시간);   // 20 은 가운데
    assert.deepEqual(못찾음가르기(게시판, 기.기준['가병원'].기준, 쪽열쇠(쪽(내림(25, 21)).rows), '2026-11-19'),
      { 놓침: '새 글 없이 이 글이 없어짐' });
  });
});

describe('주 1회 판정 → 아침 메일', () => {
  test('놓친 채 일주일 → 「기준 공고 못 찾음 — 규칙 의심」 · 게시판 의심 줄에 · 두 주 연속이면 새로 고름', () => {
    const 기 = 고른기록();
    const 놓친쪽 = 쪽([21, 19, 18, 17, 16, 15, 14, 13, 12, 11]);
    기준보기(기, 게시판, 놓친쪽, 고른때 + 시간);
    /* 일주일이 안 됐으면 판정 없음 */
    assert.equal(기준보기(기, 게시판, 놓친쪽, 고른때 + 6 * 하루).일, '놓침');
    const r = 기준보기(기, 게시판, 놓친쪽, 고른때 + 판정날수 * 하루);
    assert.deepEqual(r, { 일: '판정못찾음', 까닭: '아래 글은 남았는데 이 글만 없음' });
    const 판 = 기.기준['가병원'].판정;
    assert.equal(판.결과, '못찾음');
    assert.equal(판.연속, 1);
    assert.equal(판.놓친때, 고른때 + 시간);

    /* 게시판 건강 기록과 한 파일 — 바퀴정리가 기준 칸을 지우지 않고, 아침가르기가 의심으로 셉니다 */
    const 지금 = 고른때 + 판정날수 * 하루;
    바퀴정리(기, [{ 이름: '가병원', 도메인: 'example.invalid', 때: 지금, 상태: '받음', 유형: null, http: null, 전체: 10, 우리: 1, 최근: '2026-11-25', 쉴초: null }], 지금);
    assert.ok(기.기준['가병원'], '바퀴정리 뒤에도 기준 칸이 남음');
    const 가름 = 아침가르기(기, 지금);
    assert.equal(가름.정상, 0);
    assert.deepEqual(가름.의심.map((x) => x.까닭), [기준까닭]);
    assert.match(아침줄(가름).join('\n'), /의심 — 기준 공고 못 찾음 — 규칙 의심 1/);
    const 줄 = 기준줄(기준가르기(기, 지금)).join('\n');
    assert.match(줄, /^ {3}기준 공고\(주 1회\) — 찾음 0 · 못 찾음 1 · 판정 전 0 · 고르는 중 0/);
    assert.match(줄, /\? 가병원 「2026년 20번 직원 채용 공고」 · 아래 글은 남았는데 이 글만 없음 · 11\/19 05:30부터/);

    /* 다음 주에도 없음 → 두 주 연속 · 그 글은 놓고 새로 고름 (판정 줄은 남음) */
    const r2 = 기준보기(기, 게시판, 놓친쪽, 고른때 + 2 * 판정날수 * 하루);
    assert.equal(r2.일, '판정못찾음');
    assert.equal(기.기준['가병원'].판정.연속, 2);
    assert.equal(기.기준['가병원'].기준, null);
    assert.match(기준줄(기준가르기(기, 고른때 + 2 * 판정날수 * 하루)).join('\n'), /2주 연속\(새로 고름\)/);
    /* 다음 바퀴에 새로 고릅니다 (쪽은 일주일 넘어 새로 적힌 것과 견줌) */
    assert.equal(기준보기(기, 게시판, 놓친쪽, 고른때 + 2 * 판정날수 * 하루 + 21 * 시간).일, '고름');
  });

  test('한 바퀴 놓쳤다 다시 보이면 놓침을 지우고 · 판정은 찾음', () => {
    const 기 = 고른기록();
    기준보기(기, 게시판, 쪽([21, 19, 18, 17, 16, 15, 14, 13, 12, 11]), 고른때 + 시간);
    assert.equal(기준보기(기, 게시판, 쪽(내림(21, 12)), 고른때 + 2 * 시간).일, '찾음');
    assert.deepEqual(기준보기(기, 게시판, 쪽(내림(21, 12)), 고른때 + 판정날수 * 하루), { 일: '판정찾음' });
    const 가름 = 기준가르기(기, 고른때 + 판정날수 * 하루);
    assert.equal(가름.찾음, 1);
    assert.deepEqual(가름.못찾음, []);
  });

  test('자주 밀리는 곳도 판정 날짜는 처음 고른 때부터', () => {
    const 기 = 고른기록();
    기준보기(기, 게시판, 쪽(내림(29, 20)), 고른때 + 시간);
    assert.equal(기준보기(기, 게시판, 쪽(내림(30, 21)), 고른때 + 2 * 시간).일, '밀림');
    /* 후보 쪽([20…11] · 23시간 묵음)과 겹치는 글이 없어 쪽을 새로 적고 다음 날 고릅니다 */
    assert.equal(기.기준['가병원'].기준, null);
    assert.equal(기준보기(기, 게시판, 쪽(내림(31, 22)), 고른때 + 23 * 시간).일, '고름');
    assert.equal(기.기준['가병원'].기준.제목, '2026년 30번 직원 채용 공고', '그때도 있던 글 중 맨 위 (31 은 새 글)');
    /* 판정은 처음 고른 때에서 7일 — 새 기준으로 */
    assert.deepEqual(기준보기(기, 게시판, 쪽(내림(31, 22)), 고른때 + 판정날수 * 하루), { 일: '판정찾음' });
    assert.equal(기.기준['가병원'].판정.제목, '2026년 30번 직원 채용 공고');
  });

  test('판정 전 · 고르는 중 줄 · 기록 없음', () => {
    const 기 = 고른기록();
    기준보기(기, { name: '나병원', type: 'html' }, 쪽(내림(5, 1)), 처음);
    const 가름 = 기준가르기(기, 고른때);
    assert.equal(가름.판정전, 1);
    assert.equal(가름.고르는중, 1);
    assert.match(기준줄(가름)[0], /판정 전 1 · 고르는 중 1 \(첫 판정 11\/26부터\)$/);
    assert.deepEqual(기준줄(기준가르기({}, 고른때)), ['   기준 공고(주 1회) — 아직 고른 곳 없음 (하루 넘게 두 번 본 글에서 고릅니다)']);
    assert.equal(기준가르기({ 기준: 'x' }, 고른때).곳수, 0);
  });

  test('오래 안 받은 곳은 뺍니다 (14일)', () => {
    const 기 = 고른기록();
    assert.equal(기준정리(기, 고른때 + 13 * 하루), 0);
    assert.equal(기준정리(기, 고른때 + 15 * 하루), 1);
    assert.deepEqual(기.기준, {});
  });
});

/* 가짜 fetch 로 사이트줄() 을 부릅니다 — 요청 0 */
async function 받기(s, 응답) {
  const 진짜 = globalThis.fetch;
  globalThis.fetch = async () => new Response(응답.body, { status: 응답.status, headers: 응답.headers || { 'Content-Type': 'text/html' } });
  try { return await 사이트줄(s); } finally { globalThis.fetch = 진짜; }
}

describe('사이트줄() 실제 결과로', () => {
  test('강진의료원 실제 모양 목록 — 두 번 받아 맨 위 글을 고르고, 다음 바퀴에 찾음', async () => {
    const s0 = JSON.parse(읽기('hosp-sites.json')).사이트.find((x) => /강진의료원/.test(x.name));
    const { note, ...나머지 } = s0;
    const s = { ...나머지, url: 'https://a.example.invalid/bbs/board.php?bo_table=notice3' };
    const 몸 = 읽기('fixtures', 'list-observation', 'gangjin-9.html');
    const g = await 받기(s, { status: 200, body: 몸 });
    assert.equal(g.rows.length, 14);
    const 기 = {};
    assert.deepEqual(기준보기(기, s, g, 처음), { 일: '기다림' });
    assert.deepEqual(기준보기(기, s, await 받기(s, { status: 200, body: 몸 }), 처음 + 21 * 시간), { 일: '고름' });
    const 기준 = 기.기준[s.name].기준;
    assert.equal(기준.제목, g.rows[0].title.slice(0, 60));
    assert.equal(기준.뒤.length, 10);
    assert.deepEqual(기준보기(기, s, await 받기(s, { status: 200, body: 몸 }), 처음 + 22 * 시간), { 일: '찾음' });
  });

  test('마이다스(열린 것만) — 상시 없으면 마감이 가장 먼 글 · 마감 지나 빠지면 새로 고름 · 마감 전에 빠지면 놓침', async () => {
    const s = { type: 'appsite', name: '합성기관', host: 'https://a.example.invalid' };
    const 줄 = (sn, 끝) => ({ jobnoticeName: sn + '번 물리치료사 채용', jobnoticeSn: sn, receiptState: '접수중',
      applyStartDate: { time: Date.parse('2026-11-10T00:00:00+09:00') }, applyEndDate: { time: Date.parse(끝 + 'T00:00:00+09:00') } });
    const 몸 = (list) => ({ status: 200, body: JSON.stringify({ list, pageUtil: { recordCount: list.length } }), headers: { 'Content-Type': 'application/json' } });
    const 셋 = [줄(1, '2026-11-20'), 줄(2, '2026-12-05'), 줄(3, '2026-11-25')];
    const 기 = {};
    기준보기(기, s, await 받기(s, 몸(셋)), 처음);
    assert.equal(기준보기(기, s, await 받기(s, 몸(셋)), 처음 + 21 * 시간).일, '고름');
    assert.equal(기.기준['합성기관'].기준.제목, '2번 물리치료사 채용');
    assert.equal(기.기준['합성기관'].기준.마감, '2026-12-05');
    /* 마감 전에 목록에서 빠짐 → 놓침 */
    assert.deepEqual(기준보기(기, s, await 받기(s, 몸([셋[0], 셋[2]])), 처음 + 2 * 하루),
      { 일: '놓침', 까닭: '마감 전인데 목록에서 빠짐' });
    /* 마감 뒤 빠짐 → 밀림 (경보 없음) */
    const 기2 = {};
    기준보기(기2, s, await 받기(s, 몸(셋)), 처음);
    기준보기(기2, s, await 받기(s, 몸(셋)), 처음 + 21 * 시간);
    const r = 기준보기(기2, s, await 받기(s, 몸([줄(4, '2026-12-20'), 셋[0]])), Date.parse('2026-12-06T09:00:00+09:00'));
    assert.equal(r.일, '밀림');
    assert.match(r.까닭, /^마감 지나 목록에서 빠짐/);
  });
});

describe('연결 — 부르는 곳이 있고, 모듈은 순수합니다', () => {
  test('collect-hosp — 받은 곳마다 기준보기 · 바퀴 끝에 기준정리 (기록은 게시판 건강 기록과 함께 씀)', () => {
    const 수집 = 읽기('..', 'collect-hosp.mjs');
    for (const 줄 of [
      "import { 기준보기, 기준정리 } from './hosp/기준공고.mjs';",
      'const 기준일 = 기준보기(건강기록, s, g, Date.now());',
      'const 뺀곳 = 기준정리(건강기록, Date.now());',
    ]) assert.ok(수집.includes(줄), 줄);
    /* 받기 뒤 · 기록 쓰기(바퀴정리) 앞 */
    assert.ok(수집.indexOf('const g = await 사이트줄(s);') < 수집.indexOf('const 기준일 = 기준보기('));
    assert.ok(수집.indexOf('const 뺀곳 = 기준정리(') < 수집.indexOf('const 정리 = 바퀴정리(건강기록, 관측들, Date.now());'));
  });

  test('hold-digest — 게시판 줄 아래에 기준 공고 줄', () => {
    const 요약 = 읽기('..', 'hold-digest.mjs');
    assert.ok(요약.includes("import { 기준가르기, 기준줄 } from './hosp/기준공고.mjs';"));
    assert.ok(요약.includes('기준가름 = 기준가르기(기록, Date.now());'));
    assert.ok(요약.includes('...(게시판 && 게시판.곳수 ? 기준줄(기준가름) : [])'));
  });

  test('기준공고.mjs 는 네트워크·파일·시계·환경을 안 씁니다', () => {
    const 모듈 = 읽기('기준공고.mjs');
    assert.deepEqual(모듈.match(/^\s*import\s.*$/gm) || [], []);
    assert.ok(!/\bfetch\s*\(|process\.|readFileSync|writeFileSync|require\s*\(|Date\.now|Math\.random/.test(모듈));
  });

  test('빈 기록에서 바퀴정리와 기준보기를 같이 써도 서로 안 지웁니다', () => {
    const 기 = 빈기록();
    기준보기(기, 게시판, 쪽(내림(5, 1)), 처음);
    바퀴정리(기, [], 처음);
    assert.ok(기.기준['가병원'].쪽);
  });
});
