/* 게시판건강.mjs 회귀 시험 — 오프라인 · 의존성 없음 (node:test)
 *
 *   node --test tools/hosp/게시판건강.test.mjs
 *
 * 실제 요청은 0 입니다 — sites.mjs 의 사이트줄() 을 부르되 globalThis.fetch 를 가짜로 바꿉니다
 * (failure-report.test.mjs 와 같은 꼴). 강진의료원 설정은 tools/hosp/hosp-sites.json 의 실제 줄을 읽고,
 * 응답은 저장소의 실제 모양 고정본(fixtures/list-observation/gangjin-9.html)을 씁니다.
 * 주소는 a.example.invalid — 인증서 길·느슨한 파서 길로 새지 않게 합니다.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 사이트줄 } from './sites.mjs';
import {
  도메인, 실패유형, 쉴초, 관측하기, 바퀴정리, 건너뛸까, 차단풀기, 아침가르기, 아침줄, 빈기록, 유형, 때말,
} from './게시판건강.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 읽기 = (...길) => fs.readFileSync(path.join(여기, ...길), 'utf8');
const 강진설정 = (() => {
  const s = JSON.parse(읽기('hosp-sites.json')).사이트.find((x) => /강진의료원/.test(x.name));
  const { note, ...나머지 } = s;   // 긴 메모는 뺍니다
  return { ...나머지, url: 'https://a.example.invalid/bbs/board.php?bo_table=notice3' };
})();
const 강진글 = 읽기('fixtures', 'list-observation', 'gangjin-9.html');
const 표지 = 'Zephyr 코끼리방화벽 010-1234-5678';   // 응답 글이 밖으로 새면 이것이 보입니다

async function 받기(s, 응답) {
  const 진짜 = globalThis.fetch;
  let 부름 = 0;
  globalThis.fetch = async () => {
    부름++;
    if (응답 instanceof Error) throw 응답;
    return new Response(응답.body, { status: 응답.status, headers: 응답.headers || { 'Content-Type': 'text/html' } });
  };
  try { return { g: await 사이트줄(s), 부름 }; } finally { globalThis.fetch = 진짜; }
}
const 지금 = Date.parse('2026-11-18T07:30:00+09:00');
const 분 = 60e3, 시간 = 3600e3, 하루 = 86400e3;

describe('도메인 · 실패 유형', () => {
  test('등록 도메인으로 묶습니다 (리크루터 채용관은 한 플랫폼)', () => {
    assert.equal(도메인({ host: 'https://sev.recruiter.co.kr' }), 'recruiter.co.kr');
    assert.equal(도메인({ host: 'https://bumin.recruiter.co.kr' }), 'recruiter.co.kr');
    assert.equal(도메인({ url: 'https://www.gjmed.or.kr/bbs/board.php?bo_table=notice3' }), 'gjmed.or.kr');
    assert.equal(도메인({ url: 'http://hospital.example.com/a' }), 'example.com');
    assert.equal(도메인({ url: 'http://10.0.0.1/a' }), '10.0.0.1');
    assert.equal(도메인({}), null);
    assert.equal(도메인({ url: '주소 아님' }), null);
  });

  test('멘토 지시문4 표 그대로', () => {
    const 표 = [
      [{ http: 403 }, 유형.차단], [{ http: 401 }, 유형.차단],
      [{ http: 200, 서명: 'BLOCK_SCREEN' }, 유형.차단], [{ http: 200, 서명: 'LOGIN_SCREEN' }, 유형.차단],
      [{ http: 429 }, 유형.속도],
      [{ http: 500 }, 유형.일시], [{ http: 503 }, 유형.일시], [{ http: 504 }, 유형.일시],
      [{ 왜: 'ETIMEDOUT' }, 유형.일시], [{ 왜: 'TIMEOUT' }, 유형.일시], [{ 왜: 'ENOTFOUND' }, 유형.일시],
      [{ 왜: 'EAI_AGAIN' }, 유형.일시], [{ 왜: 'ECONNRESET' }, 유형.일시], [{ 왜: 'TimeoutError' }, 유형.일시],
      [{ http: 404 }, 유형.우리], [{ http: 200 }, 유형.우리], [{ http: 301 }, 유형.우리],
      [{ 왜: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' }, 유형.우리], [{ 왜: '주소가 아닙니다' }, 유형.우리],
    ];
    for (const [입력, 답] of 표) assert.equal(실패유형(입력), 답, JSON.stringify(입력));
  });

  test('Retry-After — 초 · HTTP 날짜 · 가린 값', () => {
    assert.equal(쉴초('120', 지금), 120);
    assert.equal(쉴초(new Date(지금 + 90e3).toUTCString(), 지금), 90);
    assert.equal(쉴초('‹가림›', 지금), null);
    assert.equal(쉴초(null, 지금), null);
  });
});

describe('관측하기 — 사이트줄() 실제 결과로 (가짜 fetch · 요청 0)', () => {
  test('강진의료원 실제 모양 목록 — 모든 글 14 · 가장 최근 2026-10-19 · 우리 직군 수를 나란히', async () => {
    const { g, 부름 } = await 받기(강진설정, { status: 200, body: 강진글 });
    assert.equal(부름, 1);
    assert.equal(g.err, undefined);
    assert.equal(g.전체, 14);
    assert.equal(g.전체최근, '2026-10-19');
    const o = 관측하기(강진설정, g, 2, 지금);
    assert.deepEqual(o, { 이름: '전라남도 강진의료원', 도메인: 'example.invalid', 때: 지금, 상태: '받음', 유형: null,
      http: null, 전체: 14, 우리: 2, 최근: '2026-10-19', 쉴초: null });
  });

  test('403 — 차단 · 응답 글은 관측에 안 들어갑니다', async () => {
    const { g } = await 받기(강진설정, { status: 403, body: '<h1>Forbidden</h1> ' + 표지 });
    const o = 관측하기(강진설정, g, null, 지금);
    assert.equal(o.상태, '실패');
    assert.equal(o.유형, 유형.차단);
    assert.equal(o.http, 403);
    for (const m of ['Zephyr', '코끼리', '010-']) assert.ok(!JSON.stringify(o).includes(m), m);
  });

  test('429 + Retry-After — 속도 제한 · 쉴 초', async () => {
    const { g } = await 받기(강진설정, { status: 429, body: 'too many requests', headers: { 'Retry-After': '120', 'Content-Type': 'text/plain' } });
    const o = 관측하기(강진설정, g, null, 지금);
    assert.equal(o.유형, 유형.속도);
    assert.equal(o.쉴초, 120);
  });

  test('503 · 연결 끊김 — 일시 장애', async () => {
    assert.equal(관측하기(강진설정, (await 받기(강진설정, { status: 503, body: 'x'.repeat(400) })).g, null, 지금).유형, 유형.일시);
    const e = new TypeError('fetch failed'); e.cause = { code: 'ECONNRESET' };
    const 마이다스 = { type: 'appsite', name: '합성기관', host: 'https://a.example.invalid' };
    const o = 관측하기(마이다스, (await 받기(마이다스, e)).g, null, 지금);
    assert.equal(o.상태, '실패');
    assert.equal(o.유형, 유형.일시);
  });

  test('200 인데 Cloudflare 확인 화면 — 글 0개 + 서명으로 차단', async () => {
    const 화면 = '<!DOCTYPE html><html><head><title>Just a moment...</title></head><body>'
      + '<div>Checking your browser before accessing. ' + 표지 + '</div>' + ' '.repeat(400) + '</body></html>';
    const { g } = await 받기(강진설정, { status: 200, body: 화면 });
    assert.equal(g.err, undefined);
    assert.equal(g.전체, 0);
    assert.equal(g.서명, 'BLOCK_SCREEN');
    const o = 관측하기(강진설정, g, 0, 지금);
    assert.equal(o.상태, '실패');
    assert.equal(o.유형, 유형.차단);
    assert.ok(!JSON.stringify(o).includes('Zephyr'));
  });

  test('200 인데 행이 하나도 안 잡힘 — 고장 · 우리 쪽 고장 (게시판 꼴이 바뀐 것)', async () => {
    const { g } = await 받기(강진설정, { status: 200, body: '<html><body><table><tr><td>새 스킨</td></tr></table>' + ' '.repeat(400) + '</body></html>' });
    const o = 관측하기(강진설정, g, 0, 지금);
    assert.equal(o.상태, '실패');
    assert.equal(o.유형, 유형.우리);
    assert.equal(o.전체, 0);
  });

  test('마이다스 — 접수중 0건이어도 게시판 글이 있으면 고장이 아닙니다 (모든 글 수로 봅니다)', async () => {
    const 마이다스 = { type: 'appsite', name: '합성기관', host: 'https://a.example.invalid' };
    const 목록 = { list: [
      { jobnoticeName: '2026년 물리치료사 채용', jobnoticeSn: 1, receiptState: '마감', applyStartDate: { time: Date.parse('2026-11-02T00:00:00+09:00') } },
      { jobnoticeName: '간호사 채용', jobnoticeSn: 2, receiptState: '마감', applyStartDate: { time: Date.parse('2026-10-01T00:00:00+09:00') } },
    ], pageUtil: { recordCount: 2 } };
    const { g } = await 받기(마이다스, { status: 200, body: JSON.stringify(목록), headers: { 'Content-Type': 'application/json' } });
    assert.deepEqual(g.rows, []);
    assert.equal(g.전체, 2);
    assert.equal(g.전체최근, '2026-11-02');
    assert.equal(관측하기(마이다스, g, 0, 지금).상태, '받음');
  });

  test('json · cmc · cha · schmc · greeting 도 모든 글 수를 냅니다', async () => {
    const 경우 = [
      [{ type: 'json', name: 'x', url: 'https://a.example.invalid/d', 날짜열쇠: 'REG_DATE' },
        { list: [{ title: '가', url: 'u1', REG_DATE: '2026-11-01' }, { title: '', url: '', REG_DATE: '2026-11-05' }] }, 2, '2026-11-05'],
      [{ type: 'cmc', name: 'x', url: 'https://a.example.invalid/d', base: 'https://a.example.invalid' },
        [{ title: '가', articleNo: 1, createdDt: Date.parse('2026-11-03T00:00:00+09:00'), recruitStatus: '마감' }], 1, '2026-11-03'],
      [{ type: 'cha', name: 'x', host: 'https://a.example.invalid' },
        { recruitAnnouncementListMain: [{ recrNm: '가', recrId: 1, rcritStaDt: '2026-11-04 09:00', closYn: 'Y' }] }, 1, '2026-11-04'],
      [{ type: 'schmc', name: 'x', host: 'https://a.example.invalid', dept: 1 },
        [{ jobtitle: '가', sdate: '2026.11.06', isclosed: '1' }], 1, '2026-11-06'],
    ];
    for (const [s, 몸, 수, 날] of 경우) {
      const { g } = await 받기(s, { status: 200, body: JSON.stringify(몸), headers: { 'Content-Type': 'application/json' } });
      assert.equal(g.전체, 수, s.type);
      assert.equal(g.전체최근, 날, s.type);
    }
    const 그리팅 = '<script id="__NEXT_DATA__" type="application/json">' + JSON.stringify({ props: { pageProps: { dehydratedState: { queries: [
      { queryKey: ['openings'], state: { data: [{ title: '가', openingId: 1, openDate: '2026-11-07T00:00:00Z' }] } }] } } } }) + '</script>';
    const { g } = await 받기({ type: 'greeting', name: 'x', url: 'https://a.example.invalid/d', host: 'https://a.example.invalid' }, { status: 200, body: 그리팅 });
    assert.equal(g.전체, 1);
    assert.equal(g.전체최근, '2026-11-07');
  });
});

/* 관측 줄을 손으로 만듭니다 — 위에서 사이트줄() 이 실제로 내는 꼴과 같습니다 */
const 실패 = (이름, d, t, 때, 더 = {}) => ({ 이름, 도메인: d, 때, 상태: '실패', 유형: t, http: null, 전체: null, 우리: null, 최근: null, 쉴초: null, ...더 });
const 받음 = (이름, d, 때, 전체 = 10, 최근 = '2026-11-17') => ({ 이름, 도메인: d, 때, 상태: '받음', 유형: null, http: null, 전체, 우리: 1, 최근, 쉴초: null });

describe('바퀴정리 — 한 번은 관찰 · 두 번이면 확정 · 도메인으로', () => {
  test('같은 유형이 연달아 두 바퀴면 확정 → 다음 바퀴부터 안 두드립니다', () => {
    const 기 = 빈기록();
    const s = { name: '가병원', url: 'https://www.ga.or.kr/list' };
    바퀴정리(기, [실패('가병원', 'ga.or.kr', 유형.차단, 지금 - 30 * 분)], 지금 - 30 * 분);
    assert.equal(기.도메인['ga.or.kr'].확정, false);
    assert.equal(건너뛸까(기, s, 지금), null, '한 번은 관찰만 — 다시 받습니다');
    const r = 바퀴정리(기, [실패('가병원', 'ga.or.kr', 유형.차단, 지금)], 지금);
    assert.equal(기.도메인['ga.or.kr'].확정, true);
    assert.equal(기.도메인['ga.or.kr'].연속, 2);
    assert.equal(기.도메인['ga.or.kr'].시작, 지금 - 30 * 분, '시작은 첫 실패 때');
    assert.deepEqual(r.확정, ['ga.or.kr 차단']);
    assert.match(건너뛸까(기, s, 지금 + 분), /^차단 확정 · 손확인 \(ga\.or\.kr · 11\/18 07:00부터\)$/);
    /* 사람이 풀면 다시 받습니다 */
    assert.equal(차단풀기(기, 'GA.or.kr'), true);
    assert.equal(건너뛸까(기, s, 지금 + 분), null);
    assert.equal(차단풀기(기, 'ga.or.kr'), false);
  });

  test('유형이 바뀌면 다시 한 번부터 · 일시 장애 확정은 건너뛰지 않습니다', () => {
    const 기 = 빈기록();
    바퀴정리(기, [실패('가', 'ga.or.kr', 유형.일시, 1)], 1);
    바퀴정리(기, [실패('가', 'ga.or.kr', 유형.차단, 2)], 2);
    assert.equal(기.도메인['ga.or.kr'].연속, 1);
    assert.equal(기.도메인['ga.or.kr'].시작, 1, '실패가 이어지는 동안 시작은 그대로');
    바퀴정리(기, [실패('가', 'ga.or.kr', 유형.일시, 3)], 3);
    바퀴정리(기, [실패('가', 'ga.or.kr', 유형.일시, 4)], 4);
    assert.equal(기.도메인['ga.or.kr'].확정, true);
    assert.equal(건너뛸까(기, { name: '가', url: 'https://ga.or.kr/' }, 5), null);
  });

  test('한 곳이라도 받으면 도메인은 산 것 — 기록을 지웁니다', () => {
    const 기 = 빈기록();
    바퀴정리(기, [실패('가', 'cmc.or.kr', 유형.우리, 1), 받음('나', 'cmc.or.kr', 1)], 1);
    assert.equal(기.도메인['cmc.or.kr'], undefined);
    assert.equal(기.곳['가'].끝.at(-1).상태, '실패', '곳 기록에는 남습니다');
  });

  test('같은 플랫폼 3곳이 한 바퀴에 함께 실패 → 차단 · 다 일시 장애면 일시 장애', () => {
    const 기 = 빈기록();
    바퀴정리(기, [실패('가', 'recruiter.co.kr', 유형.우리, 1), 실패('나', 'recruiter.co.kr', 유형.일시, 1),
      실패('다', 'recruiter.co.kr', 유형.우리, 1)], 1);
    assert.equal(기.도메인['recruiter.co.kr'].유형, 유형.차단);
    const 기2 = 빈기록();
    바퀴정리(기2, ['가', '나', '다'].map((n) => 실패(n, 'recruiter.co.kr', 유형.일시, 1)), 1);
    assert.equal(기2.도메인['recruiter.co.kr'].유형, 유형.일시);
  });

  test('속도 제한 — Retry-After 만큼 · 없으면 1분 → 5분 → 30분', () => {
    const 기 = 빈기록();
    const s = { name: '가', url: 'https://ga.or.kr/' };
    바퀴정리(기, [실패('가', 'ga.or.kr', 유형.속도, 지금, { 쉴초: 120 })], 지금);
    assert.match(건너뛸까(기, s, 지금 + 분), /^속도 제한 · 11\/18 07:32까지 쉼/);
    assert.equal(건너뛸까(기, s, 지금 + 3 * 분), null);
    const 기2 = 빈기록();
    바퀴정리(기2, [실패('가', 'ga.or.kr', 유형.속도, 0)], 0);
    assert.equal(기2.도메인['ga.or.kr'].쉬기끝, 60e3);
    바퀴정리(기2, [실패('가', 'ga.or.kr', 유형.속도, 100e3)], 100e3);
    assert.equal(기2.도메인['ga.or.kr'].쉬기끝, 100e3 + 300e3);
    바퀴정리(기2, [실패('가', 'ga.or.kr', 유형.속도, 500e3)], 500e3);
    assert.equal(기2.도메인['ga.or.kr'].쉬기끝, 500e3 + 1800e3);
  });

  test('오래 안 본 곳은 빠지고 · 차단 확정 도메인은 사람이 풀 때까지 남습니다 · 곳마다 최근 10개', () => {
    const 기 = 빈기록();
    바퀴정리(기, [실패('가', 'ga.or.kr', 유형.차단, 0), 받음('나', 'na.or.kr', 0)], 0);
    바퀴정리(기, [실패('가', 'ga.or.kr', 유형.차단, 1)], 1);
    바퀴정리(기, [], 20 * 하루);
    assert.equal(기.곳['나'], undefined);
    assert.equal(기.도메인['ga.or.kr'].확정, true);
    const 기2 = 빈기록();
    for (let i = 0; i < 15; i++) 바퀴정리(기2, [받음('가', 'ga.or.kr', i)], i);
    assert.equal(기2.곳['가'].끝.length, 10);
  });

  test('깨진 기록도 받아 줍니다', () => {
    for (const 깨짐 of [null, [], { 곳: 3, 도메인: 'x' }, '글']) {
      const r = 바퀴정리(깨짐, [받음('가', 'ga.or.kr', 1)], 1);
      assert.equal(r.기록.곳['가'].끝.length, 1);
    }
  });
});

describe('아침가르기 · 아침줄 — 고장 n · 의심 n · 정상 n + 고장 목록', () => {
  function 하루치() {
    const 기 = 빈기록();
    /* 어제부터 오늘 아침까지 네 바퀴 */
    const 바퀴 = [지금 - 25 * 시간, 지금 - 2 * 시간, 지금 - 1 * 시간, 지금];
    바퀴.forEach((t, i) => 바퀴정리(기, [
      실패('차단병원', 'block.or.kr', 유형.차단, t),
      i >= 2 ? 실패('바뀐병원', 'skin.or.kr', 유형.우리, t) : 받음('바뀐병원', 'skin.or.kr', t),
      i === 3 ? 실패('한번병원', 'once.or.kr', 유형.일시, t) : 받음('한번병원', 'once.or.kr', t),
      받음('묵은병원', 'old.or.kr', t, 5, '2026-08-01'),
      받음('줄어든병원', 'few.or.kr', t, i === 3 ? 3 : 30),
      받음('새글병원', 'new.or.kr', t, 8, '2026-11-18'),
      받음('조용병원', 'calm.or.kr', t, 8, '2026-11-02'),
    ].filter((o) => !(o.이름 === '차단병원' && i >= 2)), t));   // 차단 확정 뒤로는 안 두드립니다
    바퀴정리(기, [받음('못본병원', 'far.or.kr', 지금 - 3 * 하루)], 지금 - 3 * 하루);
    /* 바퀴 기록은 오늘 것으로 */
    기.바퀴.때 = 지금;
    return 기;
  }

  test('곳마다 마지막 결과로 가릅니다', () => {
    const 가름 = 아침가르기(하루치(), 지금);
    assert.deepEqual(가름.고장.map((x) => [x.이름, x.유형, x.확정, 때말(x.시작)]), [
      ['차단병원', 유형.차단, true, 때말(지금 - 25 * 시간)],
      ['바뀐병원', 유형.우리, true, 때말(지금 - 시간)],
      ['한번병원', 유형.일시, false, 때말(지금)],
    ]);
    assert.deepEqual(가름.의심.map((x) => [x.이름, x.까닭]).sort(), [
      ['못본병원', '이틀 넘게 못 봄'], ['묵은병원', '최근 글 60일 넘음'], ['줄어든병원', '글 수가 평소보다 크게 적음'],
    ].sort());
    assert.equal(가름.정상, 2);
    assert.equal(가름.새글, 1);
    assert.equal(가름.곳수, 8);
  });

  test('아침 메일 줄 — 한 줄 셈과 고장 목록(기관 · 유형 · 시작)', () => {
    const 줄 = 아침줄(아침가르기(하루치(), 지금));
    assert.match(줄[0], /^■ 병원 게시판 — 고장 3 · 의심 3 · 정상 2 \(그중 어제·오늘 새 글 있는 곳 1\)/);
    const 글 = 줄.join('\n');
    assert.match(글, /고장을 도메인으로 묶으면 3곳/);
    assert.match(글, /✗ 차단병원\s+차단\(확정\)\s+11\/17 06:30/);
    assert.match(글, /✗ 바뀐병원\s+우리 쪽 고장\(확정\)\s+11\/18 06:30/);
    assert.match(글, /✗ 한번병원\s+일시 장애\(한 번 · 관찰\)\s+11\/18 07:30/);
    assert.match(글, /의심 — .*최근 글 60일 넘음 1/);
  });

  test('기록이 없으면 그렇다고 한 줄 · 깨진 기록에도 안 죽습니다', () => {
    assert.deepEqual(아침줄(null), ['■ 병원 게시판 — 아직 기록이 없습니다 (수집기가 새 판으로 한 바퀴 돈 뒤부터 나옵니다)']);
    assert.deepEqual(아침줄(아침가르기({}, 지금)), 아침줄(null));
    assert.equal(아침가르기({ 곳: { 가: { 끝: 'x' } } }, 지금).곳수, 0);
  });

  test('같은 플랫폼 고장은 도메인 한 줄로 묶어 보입니다', () => {
    const 기 = 빈기록();
    for (const t of [1, 2]) 바퀴정리(기, ['가', '나'].map((n) => 실패(n + '병원', 'recruiter.co.kr', 유형.일시, t)), t);
    assert.match(아침줄(아침가르기(기, 3)).join('\n'), /고장을 도메인으로 묶으면 1곳 — recruiter\.co\.kr 2곳/);
  });
});

describe('연결 — 부르는 곳이 있고, 모듈은 순수합니다', () => {
  test('collect-hosp — 「봇 금지」 옆에서 건너뛰고 · 곳마다 관측 · 바퀴 끝에 기록 · 모든 글 수를 곳별에', () => {
    const 수집 = 읽기('..', 'collect-hosp.mjs');
    for (const 줄 of [
      'const 쉼말 = 건너뛸까(건강기록, s, Date.now());',
      'if (쉼말) { 셈.차단쉼++; 곳별.push({ 이름: s.name, 건너뜀: 쉼말 }); return; }',
      '관측들.push(관측하기(s, g, null, Date.now()));',
      '관측들.push(관측하기(s, g, 우리직군, Date.now()));',
      'const 정리 = 바퀴정리(건강기록, 관측들, Date.now());',
      '곳별.push({ 이름: s.name, 줄: rows.length, raw: g.raw, 최근글, 전체: g.전체 ?? null, 우리직군 });',
    ]) assert.ok(수집.includes(줄), 줄);
    /* 건너뛰기는 받기(사이트줄) **앞**이어야 다시 요청하지 않습니다 */
    assert.ok(수집.indexOf('const 쉼말 = 건너뛸까(') < 수집.indexOf('const g = await 사이트줄(s);'));
    assert.ok(수집.indexOf("건너뜀: '봇 금지 · 손확인'") < 수집.indexOf('const 쉼말 = 건너뛸까('));
  });

  test('hold-digest — 조용한 아침(아침글)과 긴 메일(글로) 둘 다에 같은 줄', () => {
    const 요약 = 읽기('..', 'hold-digest.mjs');
    assert.equal(요약.split('줄.push(...게시판줄());').length - 1, 2);
    assert.ok(요약.includes("import { 아침가르기, 아침줄 as 게시판아침줄, 기록파일이름, 기록환경이름 } from './hosp/게시판건강.mjs';"));
  });

  test('게시판건강.mjs 는 네트워크·파일·시계·환경을 안 씁니다', () => {
    const 모듈 = 읽기('게시판건강.mjs');
    assert.deepEqual(모듈.match(/^\s*import\s.*$/gm) || [], []);
    assert.ok(!/\bfetch\s*\(|process\.|readFileSync|writeFileSync|require\s*\(|Date\.now|Math\.random|비공개앞글\s*[,})]|\.비공개/.test(모듈));
  });
});
