/* node web/lib/job-state.test.mjs

   마감 판단이 틀리면 둘 중 하나가 납니다 —
   멀쩡한 공고에 「마감」 띠가 붙거나, 끝난 공고를 계속 지원하러 보냅니다. */
import assert from 'node:assert/strict';
import { isClosed, todayKst, nowTimeKst, 시각말 } from './job-state.ts';

/* ① 마감일이 빈 공고는 마감이 아닙니다.
      인수인계 원칙 — 「마감일이 비어 있으면 잘못 읽은 것」입니다.
      우리 자료에 81건 있습니다. 전부 막히면 큰일입니다 */
{
  assert.equal(isClosed(null, '2026-09-20'), false);
  assert.equal(isClosed(undefined, '2026-09-20'), false);
  assert.equal(isClosed('', '2026-09-20'), false);
  /* 날짜 모양이 아니면 판단하지 않습니다 */
  assert.equal(isClosed('상시채용', '2026-09-20'), false);
  assert.equal(isClosed('채용시 마감', '2026-09-20'), false);
}

/* ② 마감일 당일은 아직 열린 것입니다. 그날 자정까지 받는 곳이 많습니다 */
{
  assert.equal(isClosed('2026-09-20', '2026-09-20'), false);
  assert.equal(isClosed('2026-09-21', '2026-09-20'), false);
  assert.equal(isClosed('2026-09-19', '2026-09-20'), true);
  assert.equal(isClosed('2025-01-01', '2026-09-20'), true);
}

/* ③ 시각이 붙어 와도 앞의 날짜만 봅니다 */
assert.equal(isClosed('2026-09-19T23:59:00+09:00', '2026-09-20'), true);
assert.equal(isClosed('2026-09-20T00:00:00Z', '2026-09-20'), false);

/* ④ 한국 시간으로 셉니다.
      한국이 9월 20일 오전 8시일 때 UTC 는 아직 9월 19일입니다.
      UTC 로 재면 그 아홉 시간 동안 하루 늦게 판단합니다 */
{
  const 한국_20일_아침 = new Date('2026-09-19T23:00:00Z');   // KST 2026-09-20 08:00
  assert.equal(todayKst(한국_20일_아침), '2026-09-20');
  assert.notEqual(todayKst(한국_20일_아침), 한국_20일_아침.toISOString().slice(0, 10));

  /* 그 시각에 19일 마감 공고는 이미 끝난 것입니다 */
  assert.equal(isClosed('2026-09-19', todayKst(한국_20일_아침)), true);
}

/* ⑤ 오늘을 안 넘기면 진짜 오늘을 봅니다 */
assert.match(todayKst(), /^\d{4}-\d{2}-\d{2}$/);

/* ⑥ 마감 시각 (2026-10-08). DB 의 마감지났나() 와 같은 기준이어야 합니다 */
{
  const 오늘 = "2026-10-08";
  /* 시각이 없으면 그날 종일 — 밤 11시 59분에도 열려 있습니다 */
  assert.equal(isClosed("2026-10-08", 오늘, null, "23:59:00"), false);
  /* 17:30 마감 — 17:29 에는 열려 있고 17:31 에는 닫힙니다 */
  assert.equal(isClosed("2026-10-08", 오늘, "17:30:00", "17:29:00"), false);
  assert.equal(isClosed("2026-10-08", 오늘, "17:30:00", "17:30:00"), false);
  assert.equal(isClosed("2026-10-08", 오늘, "17:30:00", "17:31:00"), true);
  /* 어제·내일은 시각과 무관합니다 */
  assert.equal(isClosed("2026-10-07", 오늘, "23:59:59", "00:01:00"), true);
  assert.equal(isClosed("2026-10-09", 오늘, "00:00:01", "23:59:00"), false);
  /* 09:00 마감 (중앙보훈병원) — 저녁에는 닫혀 있어야 합니다 */
  assert.equal(isClosed("2026-10-08", 오늘, "09:00:00", "08:59:00"), false);
  assert.equal(isClosed("2026-10-08", 오늘, "09:00:00", "19:00:00"), true);
}

/* ⑦ 시각을 사람 말로 */
{
  assert.equal(시각말("09:00:00"), "오전 9시");
  assert.equal(시각말("17:30:00"), "오후 5시 30분");
  assert.equal(시각말("12:00:00"), "오후 12시");
  assert.equal(시각말("23:59:59"), "밤 12시");
  assert.equal(시각말(null), null);
  assert.match(nowTimeKst(), /^\d{2}:\d{2}:\d{2}$/);
}

console.log('마감 판단 통과 — 7가지');
