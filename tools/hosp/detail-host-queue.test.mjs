/* 상세 요청 host 큐 시험 — 네트워크·타이머 없이 통제 Promise 로 동시성만 봅니다.
 *   node --test tools/hosp/detail-host-queue.test.mjs
 * 간격·대기 시간·실제 HTTP 수는 이 시험 범위가 아닙니다. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 호스트별실행, 호스트열쇠, 상세요청열쇠 } from './detail-host-queue.mjs';

const 틱 = () => new Promise((r) => setImmediate(r));
/* 통제 Promise: 시험이 직접 끝낸다 */
function 통제() {
  const d = {};
  d.p = new Promise((res, rej) => { d.ok = res; d.fail = rej; });
  return d;
}
/* 항목마다 통제 Promise 를 달아 시작/동시수를 기록하는 작업 */
function 판(항목들) {
  const 시작 = [], 열린 = new Map();
  let 지금 = 0, 최대 = 0;
  const 통제맵 = new Map(항목들.map((x) => [x.id, 통제()]));
  const 작업 = async (x) => {
    시작.push(x.id); 지금++; 최대 = Math.max(최대, 지금);
    try { await 통제맵.get(x.id).p; } finally { 지금--; }
  };
  return { 시작, 통제맵, 작업, 최대: () => 최대, 열린 };
}
const 열쇠 = (x) => x.h;

test('같은 host 는 동시에 1개', async () => {
  const 항 = [{ id: 'a1', h: 'A' }, { id: 'a2', h: 'A' }];
  const t = 판(항);
  const done = 호스트별실행(항, 6, 열쇠, t.작업);
  await 틱();
  assert.deepEqual(t.시작, ['a1']);
  t.통제맵.get('a1').ok(); await 틱();
  assert.deepEqual(t.시작, ['a1', 'a2']);
  t.통제맵.get('a2').ok(); await done;
  assert.equal(t.최대(), 1);
});

test('다른 host 는 병렬', async () => {
  const 항 = [{ id: 'a1', h: 'A' }, { id: 'b1', h: 'B' }];
  const t = 판(항);
  const done = 호스트별실행(항, 6, 열쇠, t.작업);
  await 틱();
  assert.deepEqual(t.시작, ['a1', 'b1']);
  t.통제맵.forEach((d) => d.ok()); await done;
});

test('동시 상한을 넘지 않는다', async () => {
  const 항 = [{ id: 'a', h: 'A' }, { id: 'b', h: 'B' }, { id: 'c', h: 'C' }];
  const t = 판(항);
  const done = 호스트별실행(항, 2, 열쇠, t.작업);
  await 틱();
  assert.deepEqual(t.시작, ['a', 'b']);
  t.통제맵.get('a').ok(); await 틱();
  assert.deepEqual(t.시작, ['a', 'b', 'c']);
  t.통제맵.forEach((d) => d.ok()); await done;
  assert.equal(t.최대(), 2);
});

test('같은 host 대기 작업이 다른 host 자리를 선점하지 않는다', async () => {
  const 항 = [{ id: 'a1', h: 'A' }, { id: 'a2', h: 'A' }, { id: 'b1', h: 'B' }];
  const t = 판(항);
  const done = 호스트별실행(항, 2, 열쇠, t.작업);
  await 틱();
  assert.deepEqual(t.시작, ['a1', 'b1']);   /* a2 는 건너뛰고 b1 이 자리를 얻는다 */
  t.통제맵.forEach((d) => d.ok()); await done;
  assert.deepEqual(t.시작, ['a1', 'b1', 'a2']);
});

test('입력 순서대로 시작하고 x 객체 변경은 보존된다', async () => {
  const 항 = [{ id: 'a1', h: 'A' }, { id: 'a2', h: 'A' }, { id: 'a3', h: 'A' }];
  const 원 = 항.slice();
  const 순서 = [];
  await 호스트별실행(항, 6, 열쇠, async (x) => { 순서.push(x.id); x.본문 = x.id + '!'; });
  assert.deepEqual(순서, ['a1', 'a2', 'a3']);
  assert.deepEqual(항, 원);
  assert.ok(항.every((x, i) => x === 원[i] && x.본문 === x.id + '!'));
});

test('한 건이 실패해도 같은 host 잠금이 풀리고 다음 건이 돈다', async () => {
  const 항 = [{ id: 'a1', h: 'A' }, { id: 'a2', h: 'A' }];
  const 시작 = [];
  const 오류 = new Error('boom');
  await assert.rejects(
    호스트별실행(항, 6, 열쇠, async (x) => { 시작.push(x.id); if (x.id === 'a1') throw 오류; }),
    (e) => e === 오류,
  );
  assert.deepEqual(시작, ['a1', 'a2']);
  const 다시 = [];
  await 호스트별실행([{ id: 'a3', h: 'A' }], 6, 열쇠, async (x) => { 다시.push(x.id); });
  assert.deepEqual(다시, ['a3']);
});

test('실패 직후 같은 host 의 대기 건은 풀려서 시작한다 (바퀴를 안 죽이는 쪽)', async () => {
  const 항 = [{ id: 'a1', h: 'A' }, { id: 'a2', h: 'A' }];
  const t = 판(항);
  const done = 호스트별실행(항, 6, 열쇠, t.작업).catch((e) => e);
  await 틱();
  t.통제맵.get('a1').fail(new Error('x')); await 틱();
  assert.ok(t.시작.includes('a1'));
  t.통제맵.get('a2').ok();
  const r = await done;
  assert.ok(r instanceof Error);
});

test('빈 입력', async () => {
  let n = 0;
  await 호스트별실행([], 6, 열쇠, async () => { n++; });
  assert.equal(n, 0);
});

test('열쇠가 null/오류면 잠그지 않고 기존 길로 간다', async () => {
  const 항 = [{ id: 'n1' }, { id: 'n2' }, { id: 'e1' }];
  const t = 판(항);
  const done = 호스트별실행(항, 6, (x) => { if (x.id === 'e1') throw new Error('bad'); return null; }, t.작업);
  await 틱();
  assert.deepEqual(t.시작, ['n1', 'n2', 'e1']);
  t.통제맵.forEach((d) => d.ok()); await done;
});

test('호스트열쇠: 포트 포함 URL.host, 사이트 이름이 아님, 잘못된 주소는 null', () => {
  assert.equal(호스트열쇠('https://a.example.kr/x/1'), 'a.example.kr');
  assert.equal(호스트열쇠('https://a.example.kr:8443/x'), 'a.example.kr:8443');
  assert.notEqual(호스트열쇠('https://a.example.kr:8443/x'), 호스트열쇠('https://a.example.kr/x'));
  assert.equal(호스트열쇠('javascript:go(3)'), null);
  assert.equal(호스트열쇠('not a url'), null);
  assert.equal(호스트열쇠(''), null);
});

test('공유 host 를 쓰는 다른 사이트는 같은 열쇠(직렬), 다른 포트는 다른 열쇠', async () => {
  const 항 = [
    { id: 's1', 곳: { name: '병원1' }, url: 'https://shared.example.kr/p/1' },
    { id: 's2', 곳: { name: '병원2' }, url: 'https://shared.example.kr/p/2' },
    { id: 'p1', 곳: { name: '병원3' }, url: 'https://shared.example.kr:8080/p/3' },
  ];
  const k = (x) => 상세요청열쇠(x, (u) => u);
  const t = 판(항);
  const done = 호스트별실행(항, 6, k, t.작업);
  await 틱();
  assert.deepEqual(t.시작, ['s1', 'p1']);
  t.통제맵.forEach((d) => d.ok()); await done;
});

test('재사용 본문(x.글)은 요청이 없으니 열쇠 null, 주소는 상세주소 변환 뒤 것을 쓴다', () => {
  const 변환 = (u) => u.replace('/list/', '/detail/');
  assert.equal(상세요청열쇠({ 글: '본문', url: 'https://h.kr/list/1' }, 변환), null);
  assert.equal(상세요청열쇠({ url: 'https://h.kr/list/1' }, 변환), 'h.kr');
  assert.equal(상세요청열쇠({ url: 'https://other.kr/x' }, () => { throw new Error('bad'); }), null);
});

test('collect-hosp.mjs 가 실제로 helper 를 부른다 (독립 모형이 아님)', () => {
  const 여기 = path.dirname(fileURLToPath(import.meta.url));
  const src = fs.readFileSync(path.join(여기, '..', 'collect-hosp.mjs'), 'utf8');
  assert.match(src, /from '\.\/hosp\/detail-host-queue\.mjs'/);
  assert.match(src, /await 호스트별실행\(\s*열것\s*,\s*동시\s*,[\s\S]{0,80}상세요청열쇠\(x,\s*상세주소\)/);
});
