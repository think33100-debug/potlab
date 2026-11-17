/* 리크루터(마이다스) 「접수 예정」 줄 담기 회귀 시험 — 오프라인 (node:test · 진짜 fetch 대신 가짜)
 *   정답지 1차 고장 가르기 3번 — 접수 예정 글이 접수가 열리는 날에야 들어와 24시간 반영이 늦음
 *
 *   node --test tools/hosp/recruiter-state.test.mjs
 *
 * ★ 상태 글자는 **합성**입니다. 예정 줄의 receiptState 원값을 아직 못 봤습니다(저장소·노트에 원응답 없음).
 *   그래서 「접수예정」·「접수 예정」 두 꼴을 다 넣어 봅니다. 주소는 example.invalid 입니다.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 사이트줄, 마이다스담을것 } from './sites.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const ms = (y, m, d) => ({ time: Date.UTC(y, m - 1, d, 0, 0, 0) });   /* KST 09시 — 날짜가 밀리지 않습니다 */
const 줄 = (sn, 상태, 시작, 끝) => ({ jobnoticeSn: sn, jobnoticeName: '물리치료사 채용 ' + sn, recruitClassName: '합성',
  systemKindCode: 'MRS2', receiptState: 상태, applyStartDate: 시작, applyEndDate: 끝 });
const 목록 = [
  줄(1, '접수중', ms(2026, 11, 10), ms(2026, 11, 25)),
  줄(2, '접수예정', ms(2026, 11, 20), ms(2026, 11, 30)),
  줄(3, '접수 예정', ms(2026, 11, 21), ms(2026, 12, 1)),
  줄(4, '마감', ms(2026, 10, 1), ms(2026, 10, 10)),
  줄(5, '접수마감', ms(2026, 10, 1), ms(2026, 10, 10)),
  줄(6, '결과발표', ms(2026, 10, 1), ms(2026, 10, 10)),
  줄(7, '마감예정', ms(2026, 11, 1), ms(2026, 11, 19)),
  줄(8, '', ms(2026, 11, 1), ms(2026, 11, 19)),
];

describe('마이다스담을것 — receiptState 로 고르기', () => {
  test('접수중은 전과 같고 · 예정 두 꼴이 더해지고 · 닫힌 줄과 모르는 상태는 안 담습니다', () => {
    const g = 마이다스담을것(목록);
    assert.deepEqual(g.접수중.map((x) => x.jobnoticeSn), [1]);
    assert.deepEqual(g.예정.map((x) => x.jobnoticeSn), [2, 3]);
    /* 「마감예정」은 닫힘 말이 있어 담지 않습니다 (좁게) · 빈 상태는 모르는 것으로 셉니다 */
    assert.deepEqual([...g.모름.entries()], [['(빈칸)', 1]]);
  });
  test('빈 목록·이상한 값에도 던지지 않습니다', () => {
    assert.deepEqual(마이다스담을것(null).접수중, []);
    assert.deepEqual(마이다스담을것([null, {}]).예정, []);
  });
});

describe('사이트줄 — list.json 길 (가짜 fetch · 요청 1번)', () => {
  async function 돌리기(응답, s) {
    const 진짜 = globalThis.fetch;
    const 부름 = [];
    globalThis.fetch = async (url, opt) => {
      부름.push({ url: String(url), method: opt?.method || 'GET' });
      const r = 응답[부름.length - 1];
      return new Response(r.body, { status: r.status || 200, headers: { 'Content-Type': r.type || 'application/json' } });
    };
    try { return { g: await 사이트줄(s), 부름 }; } finally { globalThis.fetch = 진짜; }
  }

  test('예정 줄이 시작일·마감일을 그대로 싣고 「접수상태: 예정」을 답니다', async () => {
    const { g, 부름 } = await 돌리기([{ body: JSON.stringify({ list: 목록, pageUtil: { recordCount: 8 } }) }],
      { type: 'appsite', name: '합성기관', host: 'https://a.example.invalid' });
    assert.equal(부름.length, 1);
    assert.equal(부름[0].url, 'https://a.example.invalid/app/jobnotice/list.json');
    assert.deepEqual(g.rows.map((x) => x.url.split('=').pop()), ['1', '2', '3']);
    const [중, 예정2, 예정3] = g.rows;
    assert.equal(중.접수상태, undefined);
    assert.equal(예정2.접수상태, '예정');
    assert.equal(예정2.from, '2026.11.20');
    assert.equal(예정2.to, '2026.11.30');
    assert.equal(예정3.from, '2026.11.21');
    assert.equal(예정3.to, '2026.12.01');
    /* 앞꼴 「전체 n건 중 접수중 m건」은 그대로 · 뒤에 예정·모르는 상태 */
    assert.match(g.raw, /^전체 8건 중 접수중 1건 · 접수 예정 2건도 담음 · 모르는 상태\(안 담음\) \(빈칸\) 1 · /);
  });

  test('getMainView 길도 같은 고르기를 씁니다 (상세막힘 그대로)', async () => {
    const { g, 부름 } = await 돌리기([
      { type: 'text/html', body: '<input type="hidden" id="appsiteSn" value="123"><input name="settingType" value="C">' },
      { body: JSON.stringify({ data: { jobnoticeInProgressList: 목록.slice(0, 4) } }) },
    ], { type: 'appsite', name: '합성기관', host: 'https://a.example.invalid', 길: 'getMainView' });
    assert.equal(부름.length, 2);
    assert.deepEqual(g.rows.map((x) => x.접수상태 || '중'), ['중', '예정', '예정']);
    assert.ok(g.rows.every((x) => x.상세막힘));
    assert.match(g.raw, /^getMainView 진행중 4건 중 접수중 1건 · 접수 예정 2건도 담음/);
  });
});

describe('수집기 쪽', () => {
  const 수집 = fs.readFileSync(path.join(여기, '..', 'collect-hosp.mjs'), 'utf8');
  test('예정 줄은 앞날 시작일을 게시일로 안 보냅니다 · 시작일은 apply_from 으로 갑니다', () => {
    assert.ok(수집.includes("posted_at: x.접수상태 === '예정' ? null : 날(x.from || x.posted),"));
    assert.ok(수집.includes('apply_from: 날(x.from),'));
    assert.ok(수집.includes('...(x.접수상태 ? { 접수상태: x.접수상태 } : {}),'));
  });
  test('마감이 앞날인 예정 줄은 「마감 지난 것」 거름에 안 걸립니다 (거름은 r.to < 오늘 뿐)', () => {
    assert.ok(수집.includes('const 살아있는것 = 모은것.filter((r) => !(r.to && r.to < 오늘점) && !옛글인가(r));'));
  });
});
