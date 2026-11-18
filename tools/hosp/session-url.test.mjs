/* 세션 값 떼기 — collect-hosp.mjs 의 세션값떼기() (2026-11-18 · 희명병원 쓰레기통 800줄)
   node --test tools/hosp/session-url.test.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';

/* collect-hosp.mjs 는 불러오면 수집을 시작하므로 함수 본문을 같은 글자로 둡니다 — 두 곳이 어긋나면 아래 맞대기가 잡습니다 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 원문 = fs.readFileSync(path.join(여기, '..', 'collect-hosp.mjs'), 'utf8');
const 시작 = 원문.indexOf('export function 세션값떼기(u) {');
const 끝 = 원문.indexOf('\n}', 시작) + 2;
const 본문 = 원문.slice(시작, 끝).replace('export function', 'function');
const 세션값떼기 = new Function(본문 + '\nreturn 세션값떼기;')();

test('희명병원 꼴 — 끝의 PHPSESSID 만 떼고 bbs_data 글자는 그대로', () => {
  const 앞 = 'https://hmhp.co.kr:41329/new/sub/sub07-08.php?act=view&bbs_data=aWR4PTEyODkzJnN0YXJ0UGFnZT0mbGlzdE5vPSZ0YWJsZT0mY29kZT1ib2FyZDEyJnNlcj0=||';
  assert.equal(세션값떼기(앞 + '&PHPSESSID=02c02fade846295f97acf4677e2be7b0'), 앞);
  assert.equal(세션값떼기(앞 + '&PHPSESSID=ffffffffffffffffffffffffffffffff'), 앞);
});

test('가운데·맨 앞·대소문자', () => {
  assert.equal(세션값떼기('https://a.example/v.php?PHPSESSID=x1&no=3'), 'https://a.example/v.php?no=3');
  assert.equal(세션값떼기('https://a.example/v.php?no=3&phpsessid=x1&p=2'), 'https://a.example/v.php?no=3&p=2');
  assert.equal(세션값떼기('https://a.example/v.php?PHPSESSID=x1'), 'https://a.example/v.php');
  assert.equal(세션값떼기('https://a.example/v.do;jsessionid=AB12?no=3'), 'https://a.example/v.do?no=3');
});

test('세션 칸이 없으면 글자 하나 안 바뀜', () => {
  for (const u of ['https://a.example/v.php?no=3&sid=7', 'https://a.example/', 'https://a.example/b?x=1=2||']) {
    assert.equal(세션값떼기(u), u);
  }
});
