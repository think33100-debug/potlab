/* list-observation.mjs 회귀 시험 — 오프라인 · 의존성 없음 (node:test)
 *
 *   node --test tools/hosp/list-observation.test.mjs
 *
 * 2026-11-04 최소 관측으로 축소한 계약을 고정합니다. 전체 글 수·최근 등록일은 **측정하지 않으므로**
 * 예전 반례(숨김 CSS·숨긴 칸·마감일·주석 숫자·다른 게시판 총수)는 전부 null 로 남아야 합니다.
 *
 * fixture 넷은 캐시 원문의 **발췌·가공**, gwangju-1-synthetic 은 합성입니다. 파일 안 HTML 도 합성입니다.
 * 통과가 뜻하는 것은 「이 입력에서 이 코드가 나온다」뿐이고, 실제 운영 쪽의 오류 화면을 다 안다는 뜻이 아닙니다.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { observeList, STATE, UNKNOWN_REASON, ERROR_SIGNATURE, NOT_MEASURED, MAX_ROW_COUNT, MAX_HTML_CHARS } from './list-observation.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const fx = (name) => fs.readFileSync(path.join(여기, 'fixtures', 'list-observation', name), 'utf8');

const OUTPUT_KEYS = ['boardTotal', 'boardTotalState', 'errorSignature', 'httpStatus', 'latestPosted', 'latestPostedState', 'networkError', 'rowCount', 'state', 'unknownReason'];
const ENUMS = new Set([...Object.values(STATE), ...Object.values(UNKNOWN_REASON), ...Object.values(ERROR_SIGNATURE), NOT_MEASURED]);

/** 출력 계약 — 칸은 고정 · 값은 null / 불리언 / 정수 / 고정 코드뿐 · 미측정 칸은 언제나 null */
function assertContract(r) {
  assert.deepEqual(Object.keys(r).sort(), OUTPUT_KEYS);
  for (const [k, v] of Object.entries(r)) {
    const ok = v === null || typeof v === 'boolean' || Number.isInteger(v) || (typeof v === 'string' && ENUMS.has(v));
    assert.ok(ok, k + ' 칸에 고정 코드가 아닌 값');
  }
  assert.equal(r.boardTotal, null);
  assert.equal(r.boardTotalState, NOT_MEASURED);
  assert.equal(r.latestPosted, null);
  assert.equal(r.latestPostedState, NOT_MEASURED);
}
const observe = (input) => { const r = observeList(input); assertContract(r); return r; };

/* ── 상태 표 ───────────────────────────────────────────────── */
describe('상태 계약', () => {
  test('200 + 0행 → 정상 0 도 고장도 아닌 미정', () => {
    const r = observe({ status: 200, rowCount: 0, html: '<table></table>' });
    assert.equal(r.state, STATE.ZERO_ROWS_UNCONFIRMED);
    assert.equal(r.unknownReason, UNKNOWN_REASON.ZERO_ROWS_CAUSE_UNKNOWN);
    assert.equal(r.rowCount, 0);
    assert.equal(r.httpStatus, 200);
    assert.equal(r.errorSignature, null);
  });
  test('200 + 양수 → 행 수만 기록 · 미정 사유 없음', () => {
    const r = observe({ status: 200, rowCount: 7, html: '<table></table>', networkError: false });
    assert.equal(r.state, STATE.ROWS_PARSED);
    assert.equal(r.rowCount, 7);
    assert.equal(r.networkError, false);
    assert.equal(r.unknownReason, null);
  });
  test('빈 본문 + 0행도 미정 — 빈 게시판으로 확정하지 않음', () => {
    assert.equal(observe({ status: 200, rowCount: 0, html: '' }).state, STATE.ZERO_ROWS_UNCONFIRMED);
  });
  for (const status of [403, 404, 500, 301, 204]) {
    test('HTTP ' + status + ' → HTTP_NOT_OK · 그 숫자만 기록', () => {
      const r = observe({ status, rowCount: 0, html: '<p>본문</p>' });
      assert.equal(r.state, STATE.HTTP_NOT_OK);
      assert.equal(r.httpStatus, status);
      assert.equal(r.unknownReason, null);
      assert.equal(r.errorSignature, null);
    });
  }
  test('네트워크 오류 → NETWORK_ERROR · 받은 응답이 없으니 행 수 null', () => {
    const r = observe({ networkError: true, rowCount: 0 });
    assert.equal(r.state, STATE.NETWORK_ERROR);
    assert.equal(r.networkError, true);
    assert.equal(r.httpStatus, null);
    assert.equal(r.rowCount, null, '호출자의 기본값 0 을 0행으로 남기면 안 됨');
    assert.equal(r.errorSignature, null);
  });
  test('네트워크 오류인데 status 도 있으면 모순 → 미정', () => {
    const r = observe({ networkError: true, status: 200, rowCount: 3, html: '' });
    assert.equal(r.state, STATE.UNDETERMINED);
    assert.equal(r.unknownReason, UNKNOWN_REASON.CONFLICTING_INPUT);
  });
  test('networkError 는 true/false 만 — 오류 객체·글자는 반사 없이 미정', () => {
    for (const v of ['ECONNRESET', new Error('SECRET-MSG'), 1, {}]) {
      const r = observe({ networkError: v, status: 200, rowCount: 1, html: '' });
      assert.equal(r.networkError, null);
      assert.equal(r.state, STATE.UNDETERMINED);
      assert.equal(r.unknownReason, UNKNOWN_REASON.NETWORK_STATE_INVALID);
      assert.ok(!JSON.stringify(r).includes('SECRET-MSG'));
    }
  });
  test('HTTP 실패(200 아님)는 호출자 rowCount 를 남기지 않음 — 0 도 양수도 null', () => {
    for (const status of [100, 204, 301, 403, 404, 500, 599]) {
      for (const rowCount of [0, 5]) {
        const r = observe({ status, rowCount, html: '<p>본문</p>' });
        assert.equal(r.state, STATE.HTTP_NOT_OK, String(status));
        assert.equal(r.rowCount, null, status + '/' + rowCount);
      }
    }
  });
  test('networkError 비정상이면 rowCount 도 null (명시)', () => {
    for (const v of ['ECONNRESET', new Error('x'), 1, 0, {}, []]) {
      for (const rowCount of [0, 5]) {
        const r = observe({ networkError: v, status: 200, rowCount, html: '' });
        assert.equal(r.rowCount, null);
        assert.equal(r.unknownReason, UNKNOWN_REASON.NETWORK_STATE_INVALID);
      }
    }
  });
  test('정상 200 경계 회귀 — 양수와 0행은 기존 의미 그대로', () => {
    assert.equal(observe({ status: 200, rowCount: 5, html: '', networkError: false }).rowCount, 5);
    assert.equal(observe({ status: 200, rowCount: 5, html: '' }).state, STATE.ROWS_PARSED);
    const z = observe({ status: 200, rowCount: 0, html: '' });
    assert.equal(z.rowCount, 0);
    assert.equal(z.state, STATE.ZERO_ROWS_UNCONFIRMED);
  });
  test('입력이 아예 없으면 미정 · null 입력에도 죽지 않음', () => {
    for (const input of [undefined, null, 'x', 7, []]) {
      const r = observe(input);
      assert.equal(r.state, STATE.UNDETERMINED);
      assert.equal(r.unknownReason, UNKNOWN_REASON.STATUS_MISSING);
    }
  });
  test('status null/없음 → STATUS_MISSING', () => {
    for (const status of [null, undefined]) {
      const r = observe({ status, rowCount: 0, html: '' });
      assert.equal(r.state, STATE.UNDETERMINED);
      assert.equal(r.unknownReason, UNKNOWN_REASON.STATUS_MISSING);
    }
  });
  test('rowCount null/없음 → 200 이어도 미정 (0 으로 메우지 않음)', () => {
    for (const rowCount of [null, undefined]) {
      const r = observe({ status: 200, rowCount, html: '' });
      assert.equal(r.rowCount, null);
      assert.equal(r.state, STATE.UNDETERMINED);
      assert.equal(r.unknownReason, UNKNOWN_REASON.ROW_COUNT_MISSING);
    }
  });
  test('옛 입력 이름 parsedRows 는 안 읽음 — 호환되지 않음을 고정', () => {
    const r = observe({ status: 200, parsedRows: 5, html: '' });
    assert.equal(r.rowCount, null);
    assert.equal(r.unknownReason, UNKNOWN_REASON.ROW_COUNT_MISSING);
  });
  test('200 인데 html 이 글이 아니면 오류 서명을 봤다고 할 수 없음 → 미정', () => {
    for (const html of [undefined, null, 12, {}]) {
      const r = observe({ status: 200, rowCount: 3, html });
      assert.equal(r.state, STATE.UNDETERMINED);
      assert.equal(r.unknownReason, UNKNOWN_REASON.HTML_MISSING);
      assert.equal(r.rowCount, 3);
    }
  });
  test('본문 상한 초과 → 읽지 않고 미정', () => {
    const r = observe({ status: 200, rowCount: 0, html: 'x'.repeat(MAX_HTML_CHARS + 1) });
    assert.equal(r.state, STATE.UNDETERMINED);
    assert.equal(r.unknownReason, UNKNOWN_REASON.HTML_TOO_LARGE);
  });
  test('끝이 잘린 문서 → 끝까지 못 읽었으니 미정', () => {
    for (const html of ['<!-- 안 닫힘', '<script>안 닫힘', '<a href="안 닫힘', '<p>글</p', '<div class=x']) {
      const r = observe({ status: 200, rowCount: 3, html });
      assert.equal(r.state, STATE.UNDETERMINED, html);
      assert.equal(r.unknownReason, UNKNOWN_REASON.HTML_TRUNCATED, html);
    }
  });
});

/* ── 입력 검증 ─────────────────────────────────────────────── */
describe('숫자 입력 검증', () => {
  test('rowCount 음수·소수·NaN·Infinity·글자·너무 큰 값 → null + ROW_COUNT_INVALID', () => {
    for (const v of [-1, 1.5, NaN, Infinity, -Infinity, '3', '0', true, {}, [], MAX_ROW_COUNT + 1, Number.MAX_SAFE_INTEGER, 1e21]) {
      const r = observe({ status: 200, rowCount: v, html: '' });
      assert.equal(r.rowCount, null, String(v));
      assert.equal(r.state, STATE.UNDETERMINED, String(v));
      assert.equal(r.unknownReason, UNKNOWN_REASON.ROW_COUNT_INVALID, String(v));
    }
  });
  test('rowCount 경계 — 0 과 상한은 받음 · -0 은 0', () => {
    assert.equal(observe({ status: 200, rowCount: MAX_ROW_COUNT, html: '' }).rowCount, MAX_ROW_COUNT);
    assert.ok(Object.is(observe({ status: 200, rowCount: -0, html: '' }).rowCount, 0));
  });
  test('status 비정상 → null + STATUS_INVALID · 글자 200 을 200 으로 읽지 않음', () => {
    for (const v of ['200', 99, 600, 99999, 200.5, NaN, Infinity, -200, true, {}]) {
      const r = observe({ status: v, rowCount: 1, html: '' });
      assert.equal(r.httpStatus, null, String(v));
      assert.equal(r.state, STATE.UNDETERMINED, String(v));
      assert.equal(r.unknownReason, UNKNOWN_REASON.STATUS_INVALID, String(v));
    }
  });
  test('status 경계 100·599 는 받음', () => {
    assert.equal(observe({ status: 100, rowCount: 0, html: '' }).httpStatus, 100);
    assert.equal(observe({ status: 599, rowCount: 0, html: '' }).httpStatus, 599);
  });
});

/* ── 오류 서명 ─────────────────────────────────────────────── */
describe('확실한 화면만 — 의심이지 고장 확정이 아님', () => {
  const titled = (t, body = '') => `<html><head><title>${t}</title></head><body>${body}</body></html>`;
  test('합성 PHP Fatal + 200 → 의심 · 경로·연락처 안 나감', () => {
    const r = observe({ html: fx('gwangju-1-synthetic.html'), status: 200, rowCount: 0 });
    assert.equal(r.state, STATE.HTML_ERROR_SUSPECT);
    assert.equal(r.errorSignature, ERROR_SIGNATURE.APP_ERROR_TRACE);
    assert.equal(r.unknownReason, UNKNOWN_REASON.ERROR_SIGNATURE_UNCONFIRMED);
    const out = JSON.stringify(r);
    for (const leak of ['synthetic', 'mysqli', 'Stack', 'example.invalid', '010-0000']) assert.ok(!out.includes(leak), leak);
  });
  test('HTML 형식 PHP 오류(<b> 로 갈린 꼴)도 잡음', () => {
    const r = observe({ html: '<br />\n<b>Fatal error</b>:  Uncaught Error in <b>/x/y.php</b>:3\n thrown in <b>/x/y.php</b> on line <b>3</b><br />', status: 200, rowCount: 0 });
    assert.equal(r.errorSignature, ERROR_SIGNATURE.APP_ERROR_TRACE);
  });
  test('DB 오류 구문', () => {
    for (const html of ["You have an error in your SQL syntax near 'x'", 'SQLSTATE[42S02]: Base table', 'ORA-00942: table', "Server Error in '/' Application."]) {
      const r = observe({ html, status: 200, rowCount: 0 });
      assert.equal(r.state, STATE.HTML_ERROR_SUSPECT, html);
    }
  });
  test('제목 전체가 차단/오류 화면 문구', () => {
    for (const [t, sig] of [
      ['403 Forbidden', ERROR_SIGNATURE.BLOCK_SCREEN], ['Access Denied', ERROR_SIGNATURE.BLOCK_SCREEN], ['접근 권한이 없습니다', ERROR_SIGNATURE.BLOCK_SCREEN],
      ['500 Internal Server Error', ERROR_SIGNATURE.ERROR_SCREEN], ['503 Service Unavailable', ERROR_SIGNATURE.ERROR_SCREEN], ['404 Not Found', ERROR_SIGNATURE.ERROR_SCREEN], ['오류가 발생했습니다', ERROR_SIGNATURE.ERROR_SCREEN],
    ]) {
      const r = observe({ html: titled(t), status: 200, rowCount: 0 });
      assert.equal(r.errorSignature, sig, t);
      assert.equal(r.state, STATE.HTML_ERROR_SUSPECT, t);
    }
  });
  test('로그인 화면 — 제목 전체 + 보이는 비밀번호 칸 둘 다 있어야 함', () => {
    const pw = '<form><input type="password" name="p"></form>';
    assert.equal(observe({ html: titled('로그인', pw), status: 200, rowCount: 0 }).errorSignature, ERROR_SIGNATURE.LOGIN_SCREEN);
    assert.equal(observe({ html: titled('Member Login', pw), status: 200, rowCount: 0 }).errorSignature, ERROR_SIGNATURE.LOGIN_SCREEN);
    assert.equal(observe({ html: titled('로그인', '<p>안내</p>'), status: 200, rowCount: 0 }).errorSignature, null, '비밀번호 칸 없음');
    assert.equal(observe({ html: titled('채용공고', pw), status: 200, rowCount: 3 }).errorSignature, null, '옆 로그인 상자가 있는 정상 게시판');
    assert.equal(observe({ html: titled('로그인', '<div hidden><input type="password"></div>'), status: 200, rowCount: 0 }).errorSignature, null, '숨긴 칸');
  });
  test('403 본문에 차단 화면이 보이면 서명도 함께 · 상태는 HTTP 가 먼저', () => {
    const r = observe({ html: titled('403 Forbidden'), status: 403, rowCount: 0 });
    assert.equal(r.state, STATE.HTTP_NOT_OK);
    assert.equal(r.errorSignature, ERROR_SIGNATURE.BLOCK_SCREEN);
  });
  test('양수 행이어도 오류 후보가 보이면 의심 · 행 수는 그대로 기록', () => {
    const r = observe({ html: 'Fatal error: x in /a.php on line 3 <table></table>', status: 200, rowCount: 4 });
    assert.equal(r.state, STATE.HTML_ERROR_SUSPECT);
    assert.equal(r.rowCount, 4);
  });

  /* 오탐 — 낱말이 있다고 오류가 아닙니다 */
  test('공고 본문·제목의 「오류」 낱말은 오류가 아님', () => {
    const html = titled('채용공고 - 게시판', '<table><tr><td>전산 오류 대응 인력 채용</td><td>오류가 발생했습니다</td><td>500 Internal Server Error 대응 교육</td><td>403 Forbidden 안내</td><td>로그인</td></tr></table>');
    const r = observe({ html, status: 200, rowCount: 1 });
    assert.equal(r.errorSignature, null);
    assert.equal(r.state, STATE.ROWS_PARSED);
  });
  test('제목에 낱말이 들어 있어도 전체가 그 문구가 아니면 아님', () => {
    for (const t of ['오류 신고 게시판', '로그인 안내', '403 Forbidden 해결 방법', '채용 오류가 발생했습니다 공지']) {
      assert.equal(observe({ html: titled(t, '<input type="password">'), status: 200, rowCount: 0 }).errorSignature, null, t);
    }
  });
  test('구조 없는 「Fatal error」 낱말은 서명 아님 (on line 없음)', () => {
    for (const body of ['<p>Fatal error</p>', '<td>Fatal error: Uncaught 대응 교육 안내</td>', '<p>mysql 기반 Warning: 비밀번호 주의</p>', '<p>Warning: include(/a.php): failed on line 3</p>']) {
      const r = observe({ html: body, status: 200, rowCount: 1 });
      assert.equal(r.errorSignature, null, body);
      assert.equal(r.state, STATE.ROWS_PARSED, body);
    }
  });
  test('링크 안의 게시글 제목은 안 읽음', () => {
    const html = '<a href="/v/1">Fatal error: Uncaught x in /a.php on line 3 대응</a><a href="/v/2">SQLSTATE[42S02]: 전산 담당자 모집</a>';
    assert.equal(observe({ html, status: 200, rowCount: 2 }).errorSignature, null);
  });
  test('JS·HTML 주석·스크립트 문자열·style·textarea·숨긴 요소의 오류 문구는 안 읽음', () => {
    const TRACE = 'Fatal error: Uncaught x in /a.php on line 3';
    for (const html of [
      `<!-- ${TRACE} -->`,
      `<script>// ${TRACE}\n</script>`,
      `<script>/* ${TRACE} */ var a = 1;</script>`,
      `<script>var m = "${TRACE}"; alert("로그인이 필요합니다");</script>`,
      `<script type="text/x">document.write("<title>403 Forbidden</title>")</script>`,
      `<style>.x::after { content: "${TRACE}"; }</style>`,
      `<textarea>${TRACE}</textarea>`,
      `<template>${TRACE}</template>`,
      `<noscript>${TRACE}</noscript>`,
      `<div hidden>${TRACE}</div>`,
      `<div hidden="false"><div>${TRACE}</div></div>`,
      `<div style="DISPLAY : none !important">${TRACE}</div>`,
      `<div style="visibility:hidden">${TRACE}</div>`,
      '<!-- <title>403 Forbidden</title> -->',
      '<svg><title>Not Found</title></svg>',
    ]) {
      const r = observe({ html, status: 200, rowCount: 0 });
      assert.equal(r.errorSignature, null, html);
      assert.equal(r.state, STATE.ZERO_ROWS_UNCONFIRMED, html);
    }
  });
  test('같은 문구가 보이는 본문에 있으면 잡음 — 스크립트와 구분', () => {
    const TRACE = 'Fatal error: Uncaught x in /a.php on line 3';
    assert.equal(observe({ html: `<script>var a;</script><div>${TRACE}</div>`, status: 200, rowCount: 0 }).errorSignature, ERROR_SIGNATURE.APP_ERROR_TRACE);
    assert.equal(observe({ html: `<div hidden>가림</div><div>${TRACE}</div>`, status: 200, rowCount: 0 }).errorSignature, ERROR_SIGNATURE.APP_ERROR_TRACE, '숨김이 닫힌 뒤');
    assert.equal(observe({ html: `<a href="#">글</a><p>${TRACE}</p>`, status: 200, rowCount: 0 }).errorSignature, ERROR_SIGNATURE.APP_ERROR_TRACE, '링크가 닫힌 뒤');
    assert.equal(observe({ html: `<div data-x="a > b <a href='#'>"></div><p>${TRACE}</p>`, status: 200, rowCount: 0 }).errorSignature, ERROR_SIGNATURE.APP_ERROR_TRACE, '따옴표 안의 태그 꼴');
  });
});

/* ── 예전 추정의 반례 — 전부 null ───────────────────────────── */
describe('전체 글 수·최근 등록일은 언제나 미측정', () => {
  const H = '<table><thead><tr><th>번호</th><th>제목</th><th>등록일</th></tr></thead><tbody>';
  const R = '<tr><td>1</td><td><a href="#">글</a></td><td>2026-10-01</td></tr>';
  const T = '</tbody></table>';
  const CASES = {
    '화면 총수 + 등록일 칸(가장 쉬운 꼴)도 안 읽음': '<p>전체 362건</p>' + H + R + T,
    '숨김 CSS 총수': '<style>.gone{display:none}</style><div class="gone">전체 123건</div>' + H + R + T,
    '숨긴 등록일 칸이 마감일': '<table><thead><tr><th>제목</th><th style="display:none">등록일</th><th>마감</th></tr></thead><tbody><tr><td><a href="#">글</a></td><td style="display:none">2049-12-31</td><td>2026-11-30</td></tr>' + T,
    'class 숨김 칸': '<table><thead><tr><th>제목</th><th class="hidden">등록일</th></tr></thead><tbody><tr><td><a href="#">글</a></td><td class="hidden">2049-12-31</td></tr>' + T,
    '마감일 칸만': '<table><thead><tr><th>제목</th><th>접수마감</th></tr></thead><tbody><tr><td><a href="#">글</a></td><td class="date">2049-12-31</td></tr>' + T,
    '주석 숫자': '<!-- Total : 999건 2049-12-31 -->' + H + R + T,
    '다른 게시판 총수': '<section><div>Total : 0건</div><table><tr><td>위젯</td></tr></table></section><section>' + H + R + T + '</section>',
    '푸터 총수·날짜': H + R + T + '<footer>Total : 0건 Copyright 2049-12-31</footer>',
    '시계 아이콘 날짜': '<div class="tbl_head01"><table><tbody><tr><td class="td_subject"><a href="#">글</a><i class="fa fa-clock-o"></i> 2030-01-01</td></tr></tbody></table></div>',
  };
  for (const [name, html] of Object.entries(CASES)) {
    test(name, () => {
      const r = observe({ html, status: 200, rowCount: 1 });
      assert.equal(r.state, STATE.ROWS_PARSED);
      const out = JSON.stringify(r);
      for (const n of ['362', '123', '999', '2049', '2030', '2026']) assert.ok(!out.includes(n), name + ' · ' + n);
    });
  }
  test('발췌 fixture 넷 — 예전 값(362·460·09-30·10-19·주석 총수 2)이 안 나옴 · 행 수는 호출자 값만', () => {
    for (const name of ['hyundae-2.html', 'gangjin-9.html', 'sangmoo-5.html', 'yeonggwang-6.html']) {
      for (const rowCount of [0, 3]) {
        const r = observe({ html: fx(name), status: 200, rowCount });
        assert.equal(r.rowCount, rowCount, name + ' — HTML 에서 행을 다시 세면 안 됨');
        assert.equal(r.errorSignature, null, name);
        assert.equal(r.state, rowCount ? STATE.ROWS_PARSED : STATE.ZERO_ROWS_UNCONFIRMED, name);
        const out = JSON.stringify(r);
        for (const n of ['362', '460', '2026-', '2019-', '2049']) assert.ok(!out.includes(n), name + ' · ' + n);
      }
    }
  });
  test('호출자 행 수가 HTML 과 달라도 고치지 않음 — 모듈은 행을 세지 않음', () => {
    const html = H + R + R + R + T;
    assert.equal(observe({ html, status: 200, rowCount: 0 }).rowCount, 0);
    assert.equal(observe({ html, status: 200, rowCount: 99 }).rowCount, 99);
  });
  test('호출자가 총수·날짜를 넣어도 안 받음', () => {
    const r = observe({ html: '', status: 200, rowCount: 1, boardTotal: 362, latestPosted: '2026-09-30' });
    assert.equal(r.boardTotal, null);
    assert.equal(r.latestPosted, null);
  });
});

/* ── 입력 반사 ─────────────────────────────────────────────── */
describe('입력을 돌려주지 않음 — 고정 코드와 정수뿐', () => {
  const MARK = 'REFLECT-sk-FAKE-hong@example.invalid-010-1234-5678';
  const RICH = {
    url: 'https://example.invalid/board?token=' + MARK, orgName: '병원' + MARK, memberId: MARK, errorMessage: MARK,
    boardKey: MARK, observedAt: MARK, unobservedReason: MARK,
  };
  test('어느 갈래에서도 반사 없음', () => {
    const bodies = [`<title>${MARK}</title><p>${MARK}</p>`, `Fatal error: ${MARK} in /a.php on line 3`, `<title>로그인</title><input type="password" value="${MARK}">`];
    const inputs = [
      ...bodies.map((html) => ({ ...RICH, html, status: 200, rowCount: 0 })),
      ...bodies.map((html) => ({ ...RICH, html, status: 500, rowCount: 1 })),
      { ...RICH, networkError: true },
      { ...RICH, networkError: MARK, status: MARK, rowCount: MARK, html: MARK },
      { ...RICH, status: 200, rowCount: MARK, html: MARK },
      { ...RICH, status: 200, rowCount: 1 },
    ];
    for (const input of inputs) {
      const out = JSON.stringify(observe(input));
      for (const leak of ['REFLECT', 'example.invalid', '010-1234', 'token']) assert.ok(!out.includes(leak), leak);
    }
  });
  test('입력을 고치지 않음 · 같은 입력이면 같은 출력', () => {
    const input = Object.freeze({ status: 200, rowCount: 2, html: '<p>글</p>' });
    assert.deepEqual(observeList(input), observeList(input));
  });
});

/* ── 순수성 · 코드 자체 제거 ───────────────────────────────── */
describe('추정 코드가 없음', () => {
  const src = fs.readFileSync(path.join(여기, 'list-observation.mjs'), 'utf8');
  test('import 0 — 네트워크·env·파일·시계를 쓰지 않음', () => {
    assert.deepEqual(src.match(/^\s*import\s.*$/gm) || [], []);
    assert.ok(!/\bfetch\s*\(|process\.|readFileSync|require\s*\(|Math\.random|new Date|Date\./.test(src));
  });
  test('표 칸 위치·총수·날짜 읽기 코드가 없음', () => {
    for (const re of [/colspan/i, /thead/i, /tbody/i, /cellsOf/, /td_subject/, /tbl_head/, /postedColumn/, /parseDate/, /findBoundTotal/, /commentTotal/, /\\d\{4\}/, /\\d\{1,2\}/, /건의/, /등록일자/]) {
      assert.ok(!re.test(src), String(re));
    }
  });
  test('아주 큰 깨진 입력도 금방 끝남 (입력 제곱 시간 없음)', () => {
    const started = process.hrtime.bigint();
    for (const html of ['<a '.repeat(1_000_000), '<div hidden>'.repeat(300_000), '<script>'.repeat(300_000), '<a>'.repeat(1_000_000), 'Fatal error: '.repeat(200_000), '<!-- '.repeat(600_000)]) {
      assertContract(observeList({ status: 200, rowCount: 0, html }));
    }
    assert.ok(Number(process.hrtime.bigint() - started) / 1e9 < 20, '20초 안에');
  });
});
