/* failure-report.mjs 회귀 시험 — 오프라인 · 의존성 없음 (node:test)
 *
 *   node --test tools/hosp/failure-report.test.mjs
 *
 * 견본은 전부 합성입니다 (사람·연락처·실제 주소 없음 · example.invalid).
 * 통과가 뜻하는 것은 「이 입력에서 이 코드가 나온다」뿐입니다.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 실패기록, 안전글, 목록실패줄, 상세실패표, 본문길이 } from './failure-report.mjs';
import { 사이트줄 } from './sites.mjs';

const 머리 = (o) => new Headers(o);

describe('목록 실패 한 건', () => {
  test('상태 · 머리 셋 · 앞글을 남기고 앞글은 지침 2절 범위 안에서 자릅니다', () => {
    const r = 실패기록({
      code: 503,
      text: 'error '.repeat(400),
      headers: 머리({ 'Retry-After': '120', Server: 'nginx/1.18.0', 'Content-Type': 'text/html; charset=utf-8' }),
    });
    assert.equal(r.http, 503);
    assert.equal(r.retryAfter, '120');
    assert.equal(r.server, 'nginx/1.18.0');
    assert.equal(r.contentType, 'text/html; charset=utf-8');
    assert.equal(r.머리받음, true);
    assert.equal(r.본문자수, 2400);
    assert.ok(본문길이 >= 500 && 본문길이 <= 1200);
    assert.equal([...r.앞글].length, 본문길이);
  });
});

describe('가리기', () => {
  const 안에없다 = (글, ...말들) => { for (const m of 말들) assert.ok(!글.includes(m), m + ' 가 남았습니다: ' + 글); };

  test('주소 — 쿼리 · 사용자정보 · 경로 · 조각이 안 남습니다', () => {
    const 글 = 안전글('see https://usr1:pw1@host1.example.invalid/pathsecret/x?serviceKey=QK111#fragsecret end');
    안에없다(글, 'usr1', 'pw1', 'host1', 'pathsecret', 'serviceKey', 'QK111', 'fragsecret');
    assert.ok(글.includes('‹주소›'));
  });

  test('본문에 비친 Authorization · Cookie · 토큰이 안 남습니다', () => {
    const 글 = 안전글([
      'Authorization: Bearer AbC123xyz',
      'Cookie: JSESSIONID=9f8e7d; other=1234',
      'Set-Cookie: sid=1234',
      'X-Api-Key: 1234',
      'access_token=1234',
      '{"password":"error"}',
      'bearer 1234',
    ].join('\n'));
    안에없다(글, 'AbC123xyz', '9f8e7d', '1234', 'JSESSIONID');
  });

  test('메일 · 전화 · 주민번호 꼴 · 표시 달린 이름 · 맨 이름이 안 남습니다', () => {
    const 글 = 안전글([
      'synthetic.person@example.invalid',
      '010-0000-0000 / 02)000-0000 / +82 10 0000 0000 / 1500-0000 / 01000000000 / ０１０',
      '000000-0000000',
      '담당자: 합성이름',
      '성명 : 가나다',
      '{"name":"error"}',
      '합성사람 드림 Synthetic Person',
      '10.0.0.1',
    ].join('\n'));
    안에없다(글, 'synthetic', 'example', '000-', '0000', '합성이름', '가나다', '합성사람', 'Synthetic', 'Person', '10.0.0.1', '０１０');
  });

  test('자리값과 속성 · 스크립트 · 엔티티로 새지 않습니다', () => {
    const 글 = 안전글('<a href="mailto:x@example.invalid" data-u="합성이름">차단</a><script>var k="s3cret"</script>'
      + '<!-- 합성주석 -->&#48;&#49;&#48; ‹합성이름›');
    안에없다(글, 'mailto', 'data-u', '합성이름', 's3cret', '합성주석', '&#48');
    assert.ok(글.includes('<a>차단</a>'));
  });

  test('진단에 쓸 글은 남습니다', () => {
    const 글 = 안전글('<html><head><title>403 Forbidden</title></head><body><h1>접근이 차단되었습니다</h1><hr><center>nginx</center></body></html>');
    assert.equal(글, '<html><head><title>403 Forbidden</title></head><body><h1>접근이 차단되었습니다</h1><hr><center>nginx</center></body></html>');
  });

  test('자르기 경계에 걸친 값도 앞조각이 안 남습니다 — 가린 뒤에 자릅니다', () => {
    const 앞 = 'error '.repeat(132) + 'err ';                     // 796자 — 경계가 값 안에 떨어집니다
    for (const 값 of ['010-0000-0000', 'token=1234567', 'https://h.example.invalid/qqq', 'a.b@example.invalid']) {
      const 글 = 안전글(앞 + 값);
      assert.ok([...글].length <= 본문길이);
      안에없다(글, '010', '1234', 'token', 'https', 'example', 'a.b');
    }
    const 뒤 = 'x'.repeat(40000) + ' 010-0000-0000';              // 앞자르기 상한을 넘는 긴 응답
    안에없다(안전글(뒤), '010');
  });

  test('머리값도 가립니다', () => {
    const r = 실패기록({
      code: 429,
      text: '',
      headers: 머리({
        'Retry-After': 'token=1234',
        Server: 'host1.example.invalid usr@example.invalid',
        'Content-Type': 'multipart/form-data; boundary=SECRET123; token=QK111',
      }),
    });
    assert.equal(r.retryAfter, '‹가림›');
    안에없다(r.server, 'host1', 'usr', 'example');
    assert.equal(r.contentType, 'multipart/form-data');
    assert.equal(실패기록({ code: 429, text: '', headers: 머리({ 'Retry-After': 'Fri, 06 Nov 2026 00:00:00 GMT' }) }).retryAfter,
      'Fri, 06 Nov 2026 00:00:00 GMT');
  });

  test('JSON 은 항목 이름을 함께 남기고 값은 가립니다 (지침 2절)', () => {
    const r = 실패기록({ code: 500, text: '{"message":"합성값","token":"QK111","합성칸":1,"a b":2}' });
    assert.deepEqual(r.항목이름, ['message', '‹칸›', '‹칸›', '‹칸›']);
    안에없다(r.앞글, '합성값', 'QK111', '합성칸');
    assert.deepEqual(실패기록({ code: 500, text: '<html>' }).항목이름, []);
  });

  test('망가진 입력에도 던지지 않습니다', () => {
    const 나쁜머리 = { get() { throw new Error('x'); } };
    const 나쁜값 = Object.create(null);
    for (const 입력 of [undefined, null, 7, 'x', {}, { code: 'abc', text: 나쁜값, headers: 나쁜머리 }, { code: 99999, text: 12, headers: 1 }]) {
      const r = 실패기록(입력);
      assert.equal(r.http, null);
      assert.equal(r.머리받음, false);
      assert.equal(typeof r.앞글, 'string');
    }
    assert.equal(실패기록({ code: 200, buf: Buffer.from('error') }).앞글, 'error');
    assert.equal(실패기록({ code: 200, html: 'error' }).앞글, 'error');
    assert.equal(안전글(null), '');
    assert.equal(안전글(나쁜값), '');
  });
});

describe('상세 실패 모으기', () => {
  test('기관별 건수와 까닭별 건수를 많은 차례로 냅니다', () => {
    assert.deepEqual(상세실패표([
      { 이름: '합성기관가', 왜: 'HTTP 404' },
      { 이름: '합성기관나', 왜: 'ECONNRESET' },
      { 이름: '합성기관나', 왜: 'HTTP 500' },
      { 이름: '합성기관나', 왜: 'HTTP 500' },
    ]), [
      { 이름: '합성기관나', 건수: 3, 까닭: [{ 왜: 'HTTP 500', 건수: 2 }, { 왜: 'ECONNRESET', 건수: 1 }] },
      { 이름: '합성기관가', 건수: 1, 까닭: [{ 왜: 'HTTP 404', 건수: 1 }] },
    ]);
    assert.deepEqual(상세실패표([]), []);
  });

  test('까닭의 비밀은 가리고, 망가진 줄에도 던지지 않습니다', () => {
    const 표 = 상세실패표([{ 이름: 'x', 왜: 'connect to https://h.example.invalid/?serviceKey=QK111 failed' }, null, {}]);
    assert.ok(!JSON.stringify(표).includes('QK111'));
    assert.ok(!JSON.stringify(표).includes('example'));
    assert.equal(표.reduce((n, x) => n + x.건수, 0), 3);
  });

  test('collect-hosp 에 연결돼 있고, 새 모듈은 네트워크를 안 탑니다', () => {
    const 여기 = path.dirname(fileURLToPath(import.meta.url));
    const 수집 = fs.readFileSync(path.join(여기, '..', 'collect-hosp.mjs'), 'utf8');
    assert.ok(수집.includes('못받은곳.push(목록실패줄(s.name, g));'));
    assert.ok(수집.includes('상세실패.push({ 이름: x.곳.name, 왜: x.상세왜 });'));
    assert.ok(수집.includes('상세실패: 상세실패표(상세실패)'));
    const 모듈 = fs.readFileSync(path.join(여기, 'failure-report.mjs'), 'utf8');
    assert.ok(!/\bfetch\s*\(|https?\.request|\bimport\b.*from/.test(모듈));
  });
});

describe('목록 보고 연결 — 사이트줄', () => {
  const 시크릿 = 'https://h.example.invalid/p?serviceKey=QK111 010-0000-0000 합성이름';
  /* 진짜 fetch 대신 부른 횟수를 셉니다. 네트워크를 타지 않습니다 */
  async function 돌리기(응답, s) {
    const 진짜 = globalThis.fetch;
    const 부름 = [];
    globalThis.fetch = async (url, opt) => {
      부름.push({ url: String(url), method: opt?.method || 'GET', body: opt?.body });
      if (응답 instanceof Error) throw 응답;
      return new Response(응답.body, { status: 응답.status, headers: 응답.headers });
    };
    try { return { g: await 사이트줄(s), 부름 }; } finally { globalThis.fetch = 진짜; }
  }
  const 머리셋 = { 'Retry-After': '30', Server: 'nginx', 'Content-Type': 'text/html' };
  const 마이다스 = { type: 'appsite', name: '합성기관', host: 'https://a.example.invalid' };

  test('POST 갈래 — 상태 · 머리 · 앞글을 남기고 요청은 한 번 그대로입니다', async () => {
    const { g, 부름 } = await 돌리기({ status: 503, body: 'Service Unavailable ' + 시크릿, headers: 머리셋 }, 마이다스);
    assert.equal(부름.length, 1);
    assert.equal(부름[0].method, 'POST');
    assert.equal(부름[0].url, 'https://a.example.invalid/app/jobnotice/list.json');
    assert.equal(부름[0].body, 'currentPage=1&pageSize=100&keyword=&recruitClassName=');
    assert.ok(g.err.startsWith('HTTP 503 JSON 아님 · '));
    assert.equal(g.실패.http, 503);
    assert.equal(g.실패.retryAfter, '30');
    assert.equal(g.실패.server, 'nginx');
    assert.equal(g.실패.contentType, 'text/html');
    assert.ok(g.실패.앞글.startsWith('Service Unavailable'));
    for (const m of ['QK111', '010-', '합성이름', 'example']) {
      assert.ok(!g.err.includes(m), 'err: ' + g.err);
      assert.ok(!JSON.stringify(g.실패).includes(m), '실패: ' + JSON.stringify(g.실패));
    }
  });

  test('네트워크 실패 — 까닭을 남기고 다시 부르지 않습니다', async () => {
    const e = new TypeError('fetch failed');
    e.cause = { code: 'ECONNRESET' };
    const { g, 부름 } = await 돌리기(e, 마이다스);
    assert.equal(부름.length, 1);
    assert.equal(g.err, 'HTTP 0 JSON 아님 · ECONNRESET');
    assert.equal(g.실패.http, null);
    assert.equal(g.실패.왜, 'ECONNRESET');
  });

  test('html 갈래 — 상태와 앞글은 남습니다. 글받기 가 머리를 안 돌려주므로 머리받음 false 입니다', async () => {
    const { g, 부름 } = await 돌리기({ status: 403, body: '<h1>Forbidden</h1>', headers: 머리셋 },
      { type: 'html', name: '합성기관', url: 'https://a.example.invalid/list' });
    assert.equal(부름.length, 1);
    assert.equal(g.err, 'HTTP 403 · 18자');
    assert.equal(g.실패.http, 403);
    assert.equal(g.실패.앞글, '<h1>Forbidden</h1>');
    assert.equal(g.실패.머리받음, false);
    assert.equal(g.실패.server, null);
  });

  test('json · cmc · cha · schmc · greeting 갈래도 실패 칸을 냅니다', async () => {
    const 시 = { status: 500, body: 'Internal Server Error', headers: 머리셋 };
    for (const s of [
      { type: 'json', name: 'x', url: 'https://a.example.invalid/d' },
      { type: 'json', name: 'x', url: 'https://a.example.invalid/d', 방식: 'GET' },
      { type: 'cmc', name: 'x', url: 'https://a.example.invalid/d', base: 'https://a.example.invalid' },
      { type: 'cha', name: 'x', host: 'https://a.example.invalid' },
      { type: 'schmc', name: 'x', host: 'https://a.example.invalid', dept: 1 },
      { type: 'greeting', name: 'x', url: 'https://a.example.invalid/d', host: 'https://a.example.invalid' },
    ]) {
      const { g, 부름 } = await 돌리기(시, s);
      assert.equal(부름.length, 1, s.type);
      assert.ok(g.err, s.type);
      assert.equal(g.실패.http, 500, s.type);
      assert.equal(g.실패.앞글, 'Internal Server Error', s.type);
    }
  });

  test('json 갈래 받은 것 글도 가립니다', async () => {
    const { g } = await 돌리기({ status: 200, body: JSON.stringify({ message: 시크릿 }), headers: 머리셋 },
      { type: 'json', name: 'x', url: 'https://a.example.invalid/d' });
    assert.ok(g.err.startsWith('줄경로 「list」 가 배열이 아닙니다 · 받은 것 '));
    assert.ok(!g.err.includes('QK111') && !g.err.includes('010-'));
    assert.deepEqual(g.실패.항목이름, ['message']);
  });

  test('성공은 전과 같습니다 — 실패 칸이 없고 요청은 한 번입니다', async () => {
    const { g, 부름 } = await 돌리기({
      status: 200,
      body: JSON.stringify({ list: [{ title: '합성 공고', url: 'https://a.example.invalid/1' }] }),
      headers: { 'Content-Type': 'application/json' },
    }, { type: 'json', name: 'x', url: 'https://a.example.invalid/d' });
    assert.equal(부름.length, 1);
    assert.deepEqual(g, {
      rows: [{ title: '합성 공고', url: 'https://a.example.invalid/1', from: null, to: null, posted: null, cls: '' }],
      raw: '전체 1건 · 쓸 수 있는 줄 1건',
    });
    assert.deepEqual((await 돌리기({
      status: 200,
      body: JSON.stringify([{ title: '합성', articleNo: 1, content: '본문' }]),
    }, { type: 'cmc', name: 'x', url: 'https://a.example.invalid/d', base: 'https://a.example.invalid' })).g.raw, '배열 1건');
  });

  test('보고 줄 — 이름 · 왜 · 실패를 담고 실패가 없어도 꼴을 지킵니다', () => {
    assert.deepEqual(목록실패줄('합성기관', { err: 'x', 실패: { http: 500 } }), { 이름: '합성기관', 왜: 'x', 실패: { http: 500 } });
    assert.deepEqual(목록실패줄('합성기관', { err: 'y' }), { 이름: '합성기관', 왜: 'y', 실패: null });
  });
});
