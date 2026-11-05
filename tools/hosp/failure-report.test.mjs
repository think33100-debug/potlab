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
import https from 'node:https';
import { EventEmitter } from 'node:events';
import { fileURLToPath } from 'node:url';
import { 실패기록, 안전글, 목록실패줄, 상세실패표, 본문길이 } from './failure-report.mjs';
import { 사이트줄 } from './sites.mjs';
import { 글받기 } from '../certs/index.mjs';

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

  test('Content-Type — 아는 MIME · charset 만 남기고 모르는 값은 가립니다', () => {
    const 값 = (v) => 실패기록({ code: 500, text: '', headers: 머리({ 'Content-Type': v }) }).contentType;
    assert.equal(값('Text/HTML; Charset=UTF-8'), 'text/html; charset=utf-8');
    assert.equal(값('text/html; charset="EUC-KR"'), 'text/html; charset=euc-kr');
    assert.equal(값('application/json'), 'application/json');
    assert.equal(값('application/synthetic.person.echo'), '‹가림›');
    assert.equal(값('synthetic/QK111; charset=utf-8'), '‹가림›');
    assert.equal(값('text/plain; charset=synthetic-person'), 'text/plain; charset=‹가림›');
    assert.equal(값('text/plain; x-charset=QK111'), 'text/plain');
    assert.equal(값('text/html,QK111'), '‹가림›');
  });

  test('JSON 항목 이름 — 아는 진단 칸만 남기고 모르는 이름은 가립니다', () => {
    const r = 실패기록({ code: 500, text: JSON.stringify({
      SyntheticPerson: 1, synthetic_person: 2, QK111: 3, status: 4, list: [], Status: 5, constructor: 6,
    }) });
    assert.deepEqual(r.항목이름, ['‹칸›', '‹칸›', '‹칸›', 'status', 'list', '‹칸›', '‹칸›']);
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
    /* 공개로 갈 수 있는 칸은 전과 같이 다 가립니다. 비공개앞글은 Q66 대로 호스트와 자유 글 속 이름이 남고 비밀만 가립니다 */
    const { 비공개앞글, ...공개칸 } = g.실패;
    for (const m of ['QK111', '010-', '합성이름', 'example']) {
      assert.ok(!g.err.includes(m), 'err: ' + g.err);
      assert.ok(!JSON.stringify(공개칸).includes(m), '실패: ' + JSON.stringify(공개칸));
    }
    for (const m of ['QK111', '010-', 'serviceKey']) assert.ok(!비공개앞글.includes(m), '비공개앞글: ' + 비공개앞글);
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

  test('html · greeting 갈래 — 글받기 를 거쳐도 응답 머리 셋이 그대로 남고 요청은 한 번입니다', async () => {
    for (const [s, err] of [
      [{ type: 'html', name: '합성기관', url: 'https://a.example.invalid/list' }, 'HTTP 403 · 18자'],
      [{ type: 'greeting', name: '합성기관', url: 'https://a.example.invalid/list', host: 'https://a.example.invalid' }, 'HTTP 403'],
    ]) {
      const { g, 부름 } = await 돌리기({ status: 403, body: '<h1>Forbidden</h1>', headers: 머리셋 }, s);
      assert.equal(부름.length, 1, s.type);
      assert.equal(g.err, err, s.type);
      assert.equal(g.실패.http, 403, s.type);
      assert.equal(g.실패.앞글, '<h1>Forbidden</h1>', s.type);
      assert.equal(g.실패.머리받음, true, s.type);
      assert.equal(g.실패.retryAfter, '30', s.type);
      assert.equal(g.실패.server, 'nginx', s.type);
      assert.equal(g.실패.contentType, 'text/html', s.type);
    }
  });

  test('글받기 — 머리를 그대로 넘기고 못 받은 때의 꼴은 전과 같습니다', async () => {
    const 진짜 = globalThis.fetch;
    let 부름 = 0;
    globalThis.fetch = async () => { 부름++; return new Response('error', { status: 200, headers: 머리셋 }); };
    try {
      const g = await 글받기('https://a.example.invalid/list', {});
      assert.equal(부름, 1);
      assert.equal(g.headers.get('server'), 'nginx');
      assert.deepEqual(Object.keys(g).sort(), ['buf', 'code', 'cs', 'headers', 'html', '바이트'].sort());
      assert.deepEqual(await 글받기('주소 아님', {}), { 왜: '주소가 아닙니다' });
    } finally { globalThis.fetch = 진짜; }
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

describe('비공개앞글 — 원문 앞 1200자 · 찍어서 가리기', () => {
  const 비공개 = (글) => 실패기록({ code: 503, text: 글 }).비공개앞글;
  const 없다 = (글, ...말들) => { for (const m of 말들) assert.ok(!글.includes(m), m + ' 가 남았습니다: ' + 글); };

  test('처음 보는 진단 문구가 남고 비밀은 가립니다 — 옛 앞글은 여전히 아는 낱말만입니다', () => {
    const 글 = 'Zephyr gateway refused: quota bucket drained 코끼리방화벽 규칙 7번 token=QK111 '
      + 'synthetic.person@example.invalid 010-0000-0000\n담당자: 합성이름\n'
      + 'see https://usr1:pw1@host1.example.invalid/block/page?serviceKey=QK222#fragsecret end';
    const r = 실패기록({ code: 503, text: 글 });
    for (const m of ['Zephyr gateway refused', 'quota bucket drained', '코끼리방화벽 규칙 7번', 'host1.example.invalid/block/page', 'end']) {
      assert.ok(r.비공개앞글.includes(m), m + ' 가 사라졌습니다: ' + r.비공개앞글);
    }
    없다(r.비공개앞글, 'QK111', 'QK222', 'synthetic.person', '010-', '합성이름', 'usr1', 'pw1', 'fragsecret');
    없다(r.앞글, 'Zephyr', 'quota', '코끼리방화벽');
  });

  test('값만 가리고 뒤따르는 진단은 남깁니다', () => {
    const 글 = 비공개('{"token":"QK111","count":123456,"token2":123456,"message":"quota drained"}');
    없다(글, 'QK111');
    assert.ok(글.includes('"message":"quota drained"'), 글);
    assert.ok(글.includes('"token":‹가림›'), 글);
    없다(비공개('{"token":123456,"message":"quota drained"}'), '123456');
    assert.ok(비공개('{"token":123456,"message":"quota drained"}').includes('quota drained'));
  });

  test('1200자에서 자릅니다', () => {
    assert.equal([...비공개('error '.repeat(400))].length, 1200);
    assert.equal(비공개('짧은 문구'), '짧은 문구');
    assert.equal(실패기록({ code: 500, text: 'error '.repeat(400) }).본문자수, 2400);
  });

  test('가린 뒤에 자릅니다 — 가려서 줄어든 만큼 뒤 글이 들어오고 경계에 걸친 값은 앞조각도 안 남습니다', () => {
    const 글 = 비공개('token="' + 'Q'.repeat(3000) + '" 문구끝');
    assert.ok(글.includes('문구끝'), 글);
    없다(글, 'QQQ');
    for (const [값, ...조각] of [
      ['010-0000-0000', '010', '0000'],
      ['token=1234567', '123'],
      ['https://usr1:pw1@h.example.invalid/p?serviceKey=QK111', 'usr1', 'pw1', 'QK', 'serviceKey'],
      ['a.b@example.invalid', 'a.b', 'example'],
      ['Bearer AbC123xyz', 'AbC'],
      ['{"password":"QK111"}', 'QK'],
      ['담당자: 합성이름', '합성'],
      ['000000-0000000', '000000'],
    ]) {
      for (let 자리 = 1175; 자리 < 1200; 자리++) {
        const 나온것 = 비공개('e'.repeat(자리) + ' ' + 값);
        assert.ok([...나온것].length <= 1200);
        없다(나온것, ...조각);
      }
    }
  });

  test('앞자르기(32,000자)에 걸친 값도 안 샙니다 · 큰 응답에서도 끝납니다', () => {
    없다(비공개('token="' + 'Q'.repeat(31980) + '" 010 0000 0000 tail'), '010', 'QQQ');
    assert.equal([...비공개('x'.repeat(100000))].length, 1200);
  });

  test('꼴을 바꾼 비밀 — 엔티티 · 이스케이프 · 전각 · 숨은 입력칸 · 표 칸 · 긴 토큰', () => {
    없다(비공개('&#48;&#49;&#48;-0000-0000'), '010', '0000', '&#48');
    없다(비공개('a&#64;example.invalid'), 'example');
    없다(비공개('{&quot;token&quot;:&quot;QK111&quot;}'), 'QK111');
    없다(비공개('{\\"token\\":\\"QK111\\",\\"x\\":1}'), 'QK111');
    없다(비공개('\\u0074oken=QK111'), 'QK111');
    없다(비공개('０１０-００００-００００'), '０１０', '010');
    없다(비공개('<input type="hidden" name="csrf_token" value="QK111">'), 'QK111');
    없다(비공개('<input value="QK111" id="user_tel">'), 'QK111');
    없다(비공개('<meta name="csrf-token" content="QK111">'), 'QK111');
    없다(비공개('JSESSIONID=9f8e7d; Path=/'), '9f8e7d');
    없다(비공개('eyJhbGciOi.eyJzdWIi.sigpart'), 'eyJ', 'sigpart');
    없다(비공개('10.0.0.1'), '10.0.0.1');
    const 표 = 비공개('<th>담당자</th><td>합성이름</td>');
    없다(표, '합성이름');
    assert.ok(표.includes('담당자'));
    const 긴것 = 비공개('trace a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4 end');
    없다(긴것, 'a1b2c3');
    assert.ok(긴것.includes('trace') && 긴것.includes('end'));
  });

  test('주소 — 호스트 · 경로는 남기고 사용자정보 · 쿼리 · 조각 · 경로 인자는 가립니다', () => {
    assert.equal(비공개('https://host1.example.invalid/waf/block'), 'https://host1.example.invalid/waf/block');
    assert.equal(비공개('https://usr1:pw1@host1.example.invalid/waf;jsessionid=QK1?serviceKey=QK111#frag'),
      'https://host1.example.invalid/waf‹가림›');
  });

  test('XML 태그 칸 — 비밀·이름·연락처·주소 값을 가립니다 (안에 태그가 있어도 · 안 닫혀도)', () => {
    assert.equal(비공개('<error><token>QK111</token></error>'), '<error><token>‹가림›</token></error>');
    for (const 글 of [
      '<accessToken>QK111</accessToken>',
      '<ns:api_key>QK111</ns:api_key>',
      '<Cookie>a=QK111; b=QK111</Cookie>',
      '<password kind="x">QK111</password>',
      '<token value="QK111"/>',
      '<token><value>QK111</value><x>QK111</x></token>',
      '<token><![CDATA[QK111]]></token>',
      '<error><token><value>QK111</value>',
      '<token>QK111',
      '<secret>\nQK111\n</secret>',
      '&lt;token&gt;QK111&lt;/token&gt;',
      '<name>QK111</name>',
      '<userName>QK111</userName>',
      '<contactName>QK111</contactName>',
      '<email>QK111</email>',
      '<phone>QK111</phone>',
      '<tel>QK111</tel>',
      '<address>QK111</address>',
      '<담당자>QK111</담당자>',
      '<연락처>QK111</연락처>',
    ]) 없다(비공개(글), 'QK111');
  });

  test('XML 태그 칸 — 진단 글과 보통 태그는 그대로이고 옛 요약은 안 바뀝니다', () => {
    assert.equal(비공개('<Error><Code>AccessDenied</Code><Message>Zephyr quota drained</Message><hostname>gw1</hostname></Error>'
      + '<token>QK111</token><Detail>뒤 문구</Detail>'),
    '<Error><Code>AccessDenied</Code><Message>Zephyr quota drained</Message><hostname>gw1</hostname></Error>'
      + '<token>‹가림›</token><Detail>뒤 문구</Detail>');
    assert.equal(비공개('<aside>Zephyr</aside><section>막힘</section><token/><p>끝</p>'),
      '<aside>Zephyr</aside><section>막힘</section><token/><p>끝</p>');
    assert.equal(안전글('<error><token>QK111</token></error>'), '<error><‹영문›>‹값›</‹영문›></error>');
  });

  test('진단에 쓸 태그 속성은 남깁니다', () => {
    const 글 = 비공개('<meta name="description" content="Zephyr WAF block"><h1 class="x">막힘</h1>');
    assert.ok(글.includes('name="description"') && 글.includes('Zephyr WAF block') && 글.includes('막힘'), 글);
  });

  test('★ 자유 글 속 이름은 못 가립니다 — 그래서 비공개 칸입니다 (이 시험이 한계를 못 박습니다)', () => {
    assert.ok(비공개('문의는 합성사람 선생님께 부탁드립니다').includes('합성사람'));
  });

  test('망가진 입력에도 던지지 않고 글을 냅니다', () => {
    const 나쁜값 = Object.create(null);
    for (const 입력 of [undefined, null, 7, 'x', {}, { code: 'abc', text: 나쁜값 }, { code: 99999, text: 12, headers: 1 }]) {
      assert.equal(typeof 실패기록(입력).비공개앞글, 'string');
    }
    assert.equal(실패기록({ code: 200, buf: Buffer.from('Zephyr') }).비공개앞글, 'Zephyr');
    assert.equal(비공개('&#99999999;'), '&#99999999;');
  });
});

describe('★ 비공개앞글은 공개 자리로 못 갑니다', () => {
  const 표지 = 'Zephyr 코끼리방화벽 quota drained';
  const 머리셋 = { 'Retry-After': '30', Server: 'nginx', 'Content-Type': 'text/html' };
  const 받기 = async (s, 응답) => {
    const 진짜 = globalThis.fetch;
    globalThis.fetch = async () => new Response(응답.body, { status: 응답.status, headers: 머리셋 });
    try { return await 사이트줄(s); } finally { globalThis.fetch = 진짜; }
  };
  const 없다 = (글, ...말들) => { for (const m of 말들) assert.ok(!글.includes(m), m + ' 가 남았습니다: ' + 글); };
  const 읽기 = (...길) => fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), ...길), 'utf8');

  test('옛 요약(err · 왜) · 곳별 · 상세표에는 안 들어가고 실패 칸에만 있습니다', async () => {
    for (const s of [
      { type: 'appsite', name: '합성기관', host: 'https://a.example.invalid' },
      { type: 'html', name: '합성기관', url: 'https://a.example.invalid/list' },
      { type: 'json', name: '합성기관', url: 'https://a.example.invalid/d' },
    ]) {
      const g = await 받기(s, { status: 503, body: 표지 + ' token=QK111' });
      assert.ok(g.실패.비공개앞글.includes(표지), s.type);
      없다(g.err, 'Zephyr', '코끼리방화벽', 'quota', 'QK111');
      const 줄 = 목록실패줄(s.name, g);
      없다(줄.왜, 'Zephyr', '코끼리방화벽', 'quota');
      없다(JSON.stringify({ 이름: s.name, 왜: g.err }), 'Zephyr', '코끼리방화벽', 'quota');        // 곳별 줄 — 아래 시험이 꼴을 못 박습니다
      없다(JSON.stringify(상세실패표([{ 이름: s.name, 왜: g.err }])), 'Zephyr', '코끼리방화벽', 'quota');
      없다(줄.실패.앞글, 'Zephyr', '코끼리방화벽', 'quota');
    }
  });

  test('옛 요약의 글은 전과 같습니다 — 안전글 · 본문길이 · 기록 칸', () => {
    assert.equal(안전글('Zephyr gateway refused 403'), '‹영문› gateway ‹영문› 403');
    assert.equal(본문길이, 800);
    const 칸 = Object.keys(실패기록({ code: 500, text: 'x' }));
    for (const k of ['http', '왜', 'retryAfter', 'server', 'contentType', '머리받음', '본문자수', '앞글', '항목이름']) assert.ok(칸.includes(k), k);
  });

  test('collect-hosp — 곳별 · 콘솔 · DB 보류사유 · 박동이 실패 칸을 안 집습니다', () => {
    const 수집 = 읽기('..', 'collect-hosp.mjs');
    assert.ok(수집.includes('곳별.push({ 이름: s.name, 왜: g.err });'));
    assert.ok(수집.includes("x.상세왜 = g.왜 || ('HTTP ' + g.code);"));
    assert.ok(수집.includes("보류사유: x.갈래.갈래 === '보류함' ? (x.상세왜 ? x.갈래.왜 + ' · 상세 ' + x.상세왜 : x.갈래.왜) : '',"));
    assert.ok(수집.includes("못받은곳.slice(0, 12).forEach((x) => console.log('    ✗ ' + x.이름.slice(0, 24).padEnd(26) + x.왜.slice(0, 56)));"));
    없다(수집, '비공개', '.실패', '실패기록', '안전글(');
    /* 못받은곳 을 쓰는 줄이 늘면 이 시험이 먼저 멈춥니다 — 새 줄이 어디로 내보내는지 보십시오 */
    const 쓰는줄 = 수집.split(/\r?\n/).filter((l) => l.includes('못받은곳')).map((l) => l.trim());
    assert.deepEqual(쓰는줄, [
      'const 못받은곳 = [];',
      '못받은곳.push(목록실패줄(s.name, g));',
      'if (못받은곳.length) {',
      "못받은곳.slice(0, 12).forEach((x) => console.log('    ✗ ' + x.이름.slice(0, 24).padEnd(26) + x.왜.slice(0, 56)));",
      "if (못받은곳.length > 12) console.log('    … 그리고 ' + (못받은곳.length - 12) + '곳 더');",
      'JSON.stringify({ 잰날: 오늘, 셈, 곳별, 못받은곳, 상세실패: 상세실패표(상세실패) }, null, 1), \'utf8\');',
    ]);
  });

  test('sites 는 비공개 칸을 이름으로 안 집고, 보고 파일은 저장소에 안 올라갑니다', () => {
    없다(읽기('sites.mjs'), '비공개');
    assert.ok(읽기('..', '..', '.gitignore').split(/\r?\n/).includes('tools/hosp/reports/collect-hosp.json'));
  });
});

describe('인증서 길(붙여받기) — 진짜 https.request 자리를 가짜로 바꿔 돌립니다 (실제 요청 0)', () => {
  /* 느슨한 파서 호스트는 fetch 를 건너뛰고 곧장 https.request 로 갑니다. fetch 를 부르면 시험이 깨집니다 */
  const 곳 = 'https://www.kunmed.or.kr';
  async function 돌리기(대본, 일) {
    const 진짜요청 = https.request;
    const 진짜fetch = globalThis.fetch;
    const 부름 = [];
    https.request = (opt, cb) => {
      const n = 부름.push(opt);
      const req = new EventEmitter();
      req.setTimeout = () => req;
      req.destroy = () => {};
      req.end = () => { setImmediate(() => 대본({ req, 응답: (status, headers, ...덩이) => {
        const res = new EventEmitter();
        Object.assign(res, { statusCode: status, headers, resume() {} });
        cb(res);
        for (const d of 덩이) res.emit('data', d);
        res.emit('end');
      } }, n)); };
      return req;
    };
    globalThis.fetch = async () => { throw new Error('fetch 를 부르면 안 됩니다'); };
    try { return { g: await 일(), 부름 }; } finally { https.request = 진짜요청; globalThis.fetch = 진짜fetch; }
  }

  test('html 갈래 — 상태 · 머리 셋 · EUC-KR 본문이 실패 칸까지 옵니다 · 요청은 한 번 · 검증은 켠 채', async () => {
    const 차단 = Buffer.from([0xC2, 0xF7, 0xB4, 0xDC]);   // EUC-KR 「차단」
    const { g, 부름 } = await 돌리기(({ 응답 }) => 응답(503, {
      'retry-after': '120', server: 'nginx/1.18.0', 'content-type': 'text/html; charset=euc-kr',
    }, Buffer.from('Zephyr gateway '), 차단, Buffer.from(' token=QK111 010-0000-0000')),
    () => 사이트줄({ type: 'html', name: '합성기관', url: 곳 + '/list?x=1' }));
    assert.equal(부름.length, 1);
    assert.equal(부름[0].method, 'GET');
    assert.equal(부름[0].path, '/list?x=1');
    assert.equal(부름[0].rejectUnauthorized, true);
    assert.match(g.err, /^HTTP 503 · \d+자$/);
    assert.equal(g.실패.http, 503);
    assert.equal(g.실패.retryAfter, '120');
    assert.equal(g.실패.server, 'nginx/1.18.0');
    assert.equal(g.실패.contentType, 'text/html; charset=euc-kr');
    assert.equal(g.실패.머리받음, true);
    assert.ok(g.실패.비공개앞글.startsWith('Zephyr gateway 차단 token='), g.실패.비공개앞글);
    for (const m of ['QK111', '010-']) assert.ok(!JSON.stringify(g.실패).includes(m), m);
    assert.ok(!g.실패.앞글.includes('Zephyr'));
    assert.ok(!g.err.includes('Zephyr'));
  });

  test('머리가 없으면 null 입니다 — 받았지만 응답에 없음', async () => {
    const { g } = await 돌리기(({ 응답 }) => 응답(500, {}, Buffer.from('x')),
      () => 사이트줄({ type: 'html', name: '합성기관', url: 곳 + '/list' }));
    assert.equal(g.실패.http, 500);
    assert.equal(g.실패.머리받음, true);
    assert.equal(g.실패.retryAfter, null);
    assert.equal(g.실패.server, null);
    assert.equal(g.실패.contentType, null);
  });

  test('json GET 갈래 — buf 만 있는 응답도 본문이 옵니다', async () => {
    const { g, 부름 } = await 돌리기(({ 응답 }) => 응답(429, { 'retry-after': '5', server: 'nginx', 'content-type': 'application/json' },
      Buffer.from('{"message":"quota drained","token":"QK111"}')),
    () => 사이트줄({ type: 'json', 방식: 'GET', name: '합성기관', url: 곳 + '/d' }));
    assert.equal(부름.length, 1);
    assert.equal(g.실패.http, 429);
    assert.equal(g.실패.retryAfter, '5');
    assert.ok(g.실패.비공개앞글.includes('quota drained'));
    assert.ok(!g.실패.비공개앞글.includes('QK111'));
    assert.deepEqual(g.실패.항목이름, ['message', '‹칸›']);
  });

  test('자리 옮김은 전처럼 한 번 따라가고 마지막 응답을 기록합니다', async () => {
    const { g, 부름 } = await 돌리기(({ 응답 }, n) => (n === 1
      ? 응답(302, { location: '/next' })
      : 응답(403, { server: 'nginx' }, Buffer.from('<h1>Forbidden</h1>')))
    , () => 사이트줄({ type: 'html', name: '합성기관', url: 곳 + '/list' }));
    assert.equal(부름.length, 2);
    assert.equal(부름[1].path, '/next');
    assert.equal(g.실패.http, 403);
    assert.equal(g.실패.server, 'nginx');
  });

  test('인증서 오류 — 코드를 까닭으로 남기고 다시 부르지 않습니다', async () => {
    const { g, 부름 } = await 돌리기(({ req }) => req.emit('error', Object.assign(new Error('certificate has expired'), { code: 'CERT_HAS_EXPIRED' })),
      () => 사이트줄({ type: 'html', name: '합성기관', url: 곳 + '/list' }));
    assert.equal(부름.length, 1);
    assert.equal(g.err, '못 받음 · CERT_HAS_EXPIRED');
    assert.equal(g.실패.왜, 'CERT_HAS_EXPIRED');
    assert.equal(g.실패.http, null);
    assert.equal(g.실패.머리받음, false);
    assert.equal(g.실패.비공개앞글, '');
  });
});
