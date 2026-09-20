/* node web/lib/signup-fields.test.mjs

   등록한 줄을 다시 화면 모양으로 펴는 toDraft 만 봅니다.
   여기가 틀리면 마이페이지에서 고칠 때 값이 빈 칸으로 보이고,
   그대로 저장하면 원래 적으신 게 날아갑니다. */
import assert from 'node:assert/strict';
import { toDraft, NONE , payAs , emptyLang, langError, langsPayload, OPIC_LEVELS , EXAMS } from './signup-fields.ts';

/* ① 현직 — 담을 때 짧게 줄인 병원 유형이 고르는 칸의 긴 이름으로 돌아와야 합니다 */
{
  const { f, rows } = toDraft(
    {
      hired_year: 2021, current_hired_year: 2024, region: '서울',
      hospital_type: '공공기관(비병원)', employ_type: '정규직',
      net_monthly: 250, extra_pay: true, gender: '여', birth_year: 1997, note: null,
    },
    {
      school_type: '서울·경기 4년제', gpa: 3.8, gpa_scale: 4.5, lang_score: 800,
      licenses: ['운전면허'], trainings: ['보바스 - 작업치료 기본강좌'],
      career: [{ hospital: '대학병원(사립)', region: '서울', months: '24' }],
    },
  );
  assert.equal(f.hospital_type, '공공기관(비병원) — 건보공단·심평원·도로교통공단 등 심사·행정');
  assert.equal(f.net_monthly, '250');
  assert.equal(f.pay_unsure, '');
  assert.equal(f.note, '');            // null 은 빈 칸으로
  assert.equal(f.rows_none, undefined);
  assert.deepEqual(rows, [{ hospital: '대학병원(사립)', region: '서울', months: '24' }]);
}

/* ② 「없음」을 골랐던 사람 — 빈 목록이 다시 「없음」으로 보여야 합니다.
      안 그러면 고치기 화면이 열리자마자 「위 칸을 채워 주세요」로 잠깁니다 */
{
  const { f, certs, courses } = toDraft(
    { hired_year: 2021, hospital_type: '대학병원(국립)', pay_basis: 'estimated' },
    { licenses: [], trainings: [], career: [] },
  );
  assert.equal(f.pay_unsure, 'Y');   // 세후로 적어 계산했던 분
  assert.equal(f.rows_none, 'Y');
  assert.deepEqual(certs, [NONE]);
  assert.deepEqual(courses, [NONE]);
  /* 사립·국립은 짧은 이름과 고르는 이름이 같아서 그대로 남아야 합니다 */
  assert.equal(f.hospital_type, '대학병원(국립)');
}

/* ③ 학생 — 실습이 경력 자리로 들어오고 희망 칸이 살아 있어야 합니다 */
{
  const { f, rows } = toDraft(null, {
    grade: '4학년', school_type: '지방 3년제',
    practice: [{ hospital: '요양병원', region: '강원', months: '2' }],
    want_type: '종합병원', want_region: '강원',
    licenses: ['사회복지사 - 2급'], trainings: [],
  });
  assert.equal(f.grade, '4학년');
  assert.equal(f.want_type, '종합병원');
  assert.equal(f.pay_unsure, '');       // 급여 줄이 없으면 비어 있어야 합니다
  assert.deepEqual(rows, [{ hospital: '요양병원', region: '강원', months: '2' }]);
}

/* ④ 아직 아무것도 등록 안 한 사람 — 「없음」이 멋대로 찍히면 안 됩니다 */
{
  const { f, certs, rows } = toDraft(null, null);
  assert.equal(f.lang_none, undefined);
  assert.equal(f.rows_none, undefined);
  assert.deepEqual(certs, []);
  assert.deepEqual(rows, []);
}

console.log('signup-fields 통과 — 4가지');

/* ── 숫자 칸 검사 ── */
{
  const { fieldError, anyError } = await import('./signup-fields.ts');
  const Y = 2026;                       // 해가 바뀌어도 시험이 흔들리지 않게 넣어 줍니다

  /* ⑤ 세중님이 잡은 버그 — 입사연도 5555 가 통과했습니다 */
  assert.match(fieldError('hired_year', '5555', {}, Y), /첫 입사연도는 1970 ~ 2026/);
  assert.equal(fieldError('hired_year', '2021', {}, Y), null);
  assert.match(fieldError('hired_year', '1969', {}, Y), /1970 ~ 2026/);
  assert.equal(fieldError('hired_year', '2026', {}, Y), null);   // 올해는 됩니다

  /* ⑥ 지금 병원이 첫 입사보다 빠를 수 없습니다 */
  assert.match(fieldError('current_hired_year', '2019', { hired_year: '2021' }, Y),
    /빠를 수 없어요/);
  assert.equal(fieldError('current_hired_year', '2021', { hired_year: '2021' }, Y), null);
  assert.equal(fieldError('current_hired_year', '2024', { hired_year: '2021' }, Y), null);

  /* ⑦ 학점은 만점을 넘을 수 없습니다 */
  assert.match(fieldError('gpa', '4.8', { gpa_scale: '4.5' }, Y), /만점\(4\.5\)보다/);
  assert.equal(fieldError('gpa', '4.5', { gpa_scale: '4.5' }, Y), null);

  /* ⑧ 나머지 숫자 칸도 범위를 봅니다 */
  assert.match(fieldError('net_monthly', '99999', {}, Y), /1 ~ 2000/);
  assert.match(fieldError('duty_count', '40', {}, Y), /0 ~ 31/);
  assert.match(fieldError('weekend_count', '20', {}, Y), /0 ~ 10/);
  assert.match(fieldError('bonus_yearly', '-5', {}, Y), /0 ~ 9999/);
  assert.match(fieldError('birth_year', '2025', {}, Y), /1940 ~ 2011/);  // 최소 나이 15
  assert.match(fieldError('hired_year', '2021.5', {}, Y), /정수로/);

  /* ⑨ 빈 칸은 여기서 안 봅니다 — 「필수」가 따로 봅니다 */
  assert.equal(fieldError('hired_year', '', {}, Y), null);
  assert.equal(fieldError('hired_year', undefined, {}, Y), null);

  /* ⑩ 화면 단위로 묶어 보기 */
  assert.equal(anyError(['hired_year', 'region'], { hired_year: '5555' }, Y), true);
  assert.equal(anyError(['hired_year', 'region'], { hired_year: '2021' }, Y), false);
}

console.log('숫자 칸 검사 통과 — 6가지');

/* ⑤ payAs — DB 의 salary_estimated_needs_net 에 걸리지 않게 셋이 늘 같이 움직이나
   (2026-09-20 실제로 난 오류: pay_basis 만 estimated 로 남았습니다) */
{
  const est = { pay_basis: 'estimated', pay_unsure: 'Y', net_monthly: '220', dependents: '1' };
  assert.deepEqual(payAs(est), { pay_basis: 'estimated', net_monthly: 220, dependents: 1 });

  /* 토글만 끈 경우 — 예전에 저장이 막히던 자리입니다 */
  assert.deepEqual(payAs({ ...est, pay_unsure: '', net_monthly: '', dependents: '' }),
    { pay_basis: 'gross', net_monthly: null, dependents: null });

  /* 칸만 지운 경우도 마찬가지로 gross 로 떨어져야 합니다 */
  assert.deepEqual(payAs({ ...est, net_monthly: '' }),
    { pay_basis: 'gross', net_monthly: null, dependents: null });
  assert.deepEqual(payAs({ ...est, dependents: '' }),
    { pay_basis: 'gross', net_monthly: null, dependents: null });

  /* 세전을 직접 적은 보통의 경우 */
  assert.deepEqual(payAs({ pay_basis: 'gross', base_monthly: '250' }),
    { pay_basis: 'gross', net_monthly: null, dependents: null });

  /* estimated 로 나온 줄은 언제나 DB 규칙을 만족해야 합니다 */
  for (const f of [est, { ...est, dependents: '4' }]) {
    const r = payAs(f);
    assert.ok(r.pay_basis !== 'estimated' || (r.net_monthly != null && r.dependents != null));
  }
}

console.log('payAs 통과 — 6가지');

/* ⑥ 어학 — 한 사람이 여러 줄. DB 의 spec_langs 규칙과 어긋나면 저장이 막힙니다 */
{
  const row = (o) => ({ ...emptyLang(), ...o });

  /* 시험마다 만점이 다릅니다 (DB 의 spec_langs_score_range 와 같은 숫자) */
  assert.equal(langError(row({ exam: '토익', score: '990' })), null);
  assert.ok(langError(row({ exam: '토익', score: '1200' })));
  assert.equal(langError(row({ exam: '텝스', score: '600' })), null);
  assert.ok(langError(row({ exam: '텝스', score: '700' })));
  assert.ok(langError(row({ exam: '토익스피킹', score: '210' })));

  /* 덜 채운 줄은 잘못이 아니라 그냥 버립니다 — 어학은 필수가 아닙니다 */
  assert.equal(langError(row({ exam: '토익' })), null);
  assert.deepEqual(langsPayload([row({ exam: '토익' })]), []);

  /* 보내는 모양 — 시험마다 채워지는 칸이 다릅니다 */
  assert.deepEqual(langsPayload([row({ exam: '토익', score: '850' })]),
    [{ exam: '토익', score: 850, level: null }]);
  assert.deepEqual(langsPayload([row({ exam: '오픽', level: 'IH' })]),
    [{ exam: '오픽', score: null, level: 'IH' }]);

  /* 시험은 넷입니다. 「기타」는 뺐습니다 (DB 의 spec_langs_exam_ok 가 최종) */
  assert.deepEqual(EXAMS.map((e) => e.name), ['토익', '텝스', '토익스피킹', '오픽']);
  assert.deepEqual(langsPayload([row({ exam: '기타', score: '100' })]), []);
  assert.deepEqual(langsPayload([row({ exam: '아이엘츠', score: '7' })]), []);

  /* 오픽은 공식 9등급만. AM·AH·Superior 는 OPI 것이라 여기 없습니다 */
  assert.deepEqual(OPIC_LEVELS, ['NL','NM','NH','IL','IM1','IM2','IM3','IH','AL']);
  assert.deepEqual(langsPayload([row({ exam: '오픽', level: 'AH' })]), []);

  /* 같은 시험 두 줄은 앞의 것만 (DB 의 spec_langs_one_per_exam 이 최종) */
  assert.deepEqual(
    langsPayload([row({ exam: '토익', score: '850' }), row({ exam: '토익', score: '700' })]),
    [{ exam: '토익', score: 850, level: null }]);

  /* 5줄 상한 — 시험이 넷이라 네 줄이 한계지만, 상한 자체는 살아 있어야 합니다 */
  const many = ['토익','텝스','토익스피킹','오픽','토익','텝스']
    .map((e) => row({ exam: e, score: '100', level: 'IH' }));
  assert.equal(langsPayload(many).length, 4);
}

console.log('어학 통과 — 7가지');

/* ⑦ 조사 — 「텝스은」이 나왔던 자리입니다. 받침 없는 이름은 「는」 */
assert.match(langError({ ...emptyLang(), exam: '텝스', score: '700' }), /텝스는/);
assert.match(langError({ ...emptyLang(), exam: '토익', score: '1200' }), /토익은/);
console.log('어학 조사 통과 — 2가지');

/* ⑧ 마이페이지에서 고칠 때 — 등록해 둔 어학이 화면 모양으로 펴져야 합니다.
      안 펴지면 고치기만 해도 어학이 통째로 날아갑니다 */
{
  const { langs } = toDraft(null, { licenses: [], trainings: [], career: [] }, [
    { exam: '토익', score: 850, level: null },
    { exam: '오픽', score: null, level: 'IH' },
  ]);
  assert.deepEqual(langs, [
    { exam: '토익', score: '850', level: '' },
    { exam: '오픽', score: '', level: 'IH' },
  ]);
  /* 편 것을 그대로 다시 보내면 원래 값이어야 합니다 — 한 바퀴 돌아도 안 상해야 합니다 */
  assert.deepEqual(langsPayload(langs), [
    { exam: '토익', score: 850, level: null },
    { exam: '오픽', score: null, level: 'IH' },
  ]);
  /* 어학을 안 넣었던 사람 */
  assert.deepEqual(toDraft(null, {}, []).langs, []);
}

console.log('어학 불러오기 통과 — 3가지');
