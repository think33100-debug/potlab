/* 목록마감.mjs 회귀 시험 — 오프라인 · 의존성 없음 (node:test)
 *   멘토-추가-지시문5 「안동형 숨김」: 마감일은 상세·첨부에서만 · 목록 날짜는 게시일
 *
 *   node --test tools/hosp/list-deadline.test.mjs
 *
 * 견본 HTML 은 합성입니다 (example.invalid). 안동 꼴은 2026-11-06 저장본의 **줄 모양**만 따랐습니다.
 * 통과가 뜻하는 것은 「이 입력에서 이 값이 나온다」뿐입니다 — 운영 DB 의 숨김을 풀지는 않습니다.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { 목록마감믿는곳, 목록날짜고르기 } from './목록마감.mjs';

const require = createRequire(import.meta.url);
const { hospParseHtml } = require('./hs_test.js');
const 여기 = path.dirname(fileURLToPath(import.meta.url));

/* 날짜 하나짜리 카드 게시판 (합성) */
const 카드 = (날) => '<div class="c"><a href="/v?id=1"><b>물리치료사 채용(상시)</b></a><span>' + 날 + '</span></div>';
const 카드규칙 = { row: '<div class="c">[\\s\\S]*?<\\/div>', title: '<b>([\\s\\S]*?)<\\/b>', link: 'href="([^"]+)"',
  base: 'https://h.example.invalid', date: '(20\\d{2}\\.\\d{2}\\.\\d{2})' };

describe('설정이 증명 못 한 「목록 날짜 = 마감」', () => {
  test('메모에 마감 칸 근거가 없는 곳 — 지난 날짜는 게시일로 옮기고 마감은 비웁니다', () => {
    const s = { ...카드규칙, name: '창원한마음병원', single: 'deadline' };
    const [r0] = hospParseHtml(카드('2026.11.02'), s);
    assert.equal(r0.to, '2026.11.02');                     // 파서는 그대로 (gas 와 같은 함수)
    const r = 목록날짜고르기(r0, s, '2026-11-18');
    assert.equal(r.to, '');
    assert.equal(r.posted, '2026.11.02');
    assert.equal(r.목록날짜, '2026.11.02');
    assert.match(r.목록날짜뜻, /게시일로/);
    assert.equal(r.title, r0.title);
    assert.equal(r.url, r0.url);
  });

  test('앞날이면 게시일로도 안 씁니다 (지어내지 않음) · 마감도 비움', () => {
    const s = { ...카드규칙, name: '합성병원', single: 'deadline' };
    const r = 목록날짜고르기(hospParseHtml(카드('2026.12.31'), s)[0], s, '2026.11.18');
    assert.equal(r.to, '');
    assert.equal(r.posted, '');
    assert.equal(r.목록날짜, '2026.12.31');
  });

  test('오늘 날짜는 지난날 쪽(게시일)입니다', () => {
    const s = { ...카드규칙, name: '합성병원', single: 'deadline' };
    const r = 목록날짜고르기(hospParseHtml(카드('2026.11.18'), s)[0], s, '2026-11-18');
    assert.equal(r.posted, '2026.11.18');
    assert.equal(r.to, '');
  });
});

describe('바뀌지 않는 것', () => {
  test('메모가 마감 칸이라고 밝힌 곳은 목록 날짜를 마감으로 둡니다 (같은 객체)', () => {
    const s = { ...카드규칙, name: '가톨릭대학교인천성모병원', single: 'deadline' };
    const r0 = hospParseHtml(카드('2026.11.08'), s)[0];
    assert.equal(목록날짜고르기(r0, s, '2026-11-18'), r0);
    assert.equal(r0.to, '2026.11.08');
  });

  test('날짜 둘(시작~마감)은 건드리지 않습니다', () => {
    const s = { ...카드규칙, name: '합성병원', single: 'deadline' };
    const r0 = hospParseHtml(카드('2026.11.01 ~ 2026.11.10'), s)[0];
    assert.equal(r0.from, '2026.11.01');
    assert.equal(목록날짜고르기(r0, s, '2026-11-18'), r0);
  });

  test('single 이 posted(기본)면 그대로입니다', () => {
    const s = { ...카드규칙, name: '합성병원' };
    const r0 = hospParseHtml(카드('2026.11.02'), s)[0];
    assert.equal(r0.posted, '2026.11.02');
    assert.equal(목록날짜고르기(r0, s, '2026-11-18'), r0);
  });

  test('안동 꼴 — 「2026-11-02 00:00 ~ / 채용시까지」 는 게시일만 차고 마감은 빕니다', () => {
    const 안동 = JSON.parse(fs.readFileSync(path.join(여기, 'cfgs', 'andonghospital.json'), 'utf8'));
    const html = '<tr><td class="td_tit"><a href="javascript: page_move( \'view\', { no: 249 } )"><span class="t"> 물리치료사 채용 </span></a></td>'
      + '<td><span class="nowrap"> 2026-11-02 00:00 ~ </span><span class="nowrap"> 채용시까지 </span></td></tr>';
    const [r0] = hospParseHtml(html, 안동);
    assert.equal(r0.to, '');
    assert.equal(r0.posted, '2026.11.02');
    assert.equal(목록날짜고르기(r0, 안동, '2026-11-18'), r0);
  });
});

describe('표와 설정이 맞나', () => {
  const 구운 = JSON.parse(fs.readFileSync(path.join(여기, 'hosp-sites.json'), 'utf8')).사이트;
  const 마감설정 = 구운.filter((x) => x.single === 'deadline').map((x) => x.name);

  test('믿는 곳 이름은 모두 hosp-sites.json 의 single:deadline 곳입니다 (이름이 어긋나면 조용히 거둡니다)', () => {
    for (const 이름 of 목록마감믿는곳.keys()) assert.ok(마감설정.includes(이름), '설정에 없음: ' + 이름);
  });

  test('single:deadline 인데 믿는 곳이 아닌 곳은 창원한마음병원 하나입니다', () => {
    assert.deepEqual(마감설정.filter((x) => !목록마감믿는곳.has(x)), ['창원한마음병원']);
  });

  test('cfgs 쪽도 같습니다', () => {
    const 터 = path.join(여기, 'cfgs');
    const cfg마감 = fs.readdirSync(터).filter((f) => f.endsWith('.json'))
      .map((f) => JSON.parse(fs.readFileSync(path.join(터, f), 'utf8')))
      .filter((c) => c.single === 'deadline').map((c) => c.name).sort();
    assert.deepEqual(cfg마감, [...마감설정].sort());
  });

  test('수집기가 목록 줄마다 이 함수를 지나게 합니다', () => {
    const 수집 = fs.readFileSync(path.join(여기, '..', 'collect-hosp.mjs'), 'utf8');
    assert.ok(수집.includes("import { 목록날짜고르기 } from './hosp/목록마감.mjs';"));
    assert.ok(수집.includes('const r = 목록날짜고르기(r0, s, 오늘);'));
    assert.ok(수집.includes('목록날짜: x.목록날짜'));
  });
});
