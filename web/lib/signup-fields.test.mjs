/* node web/lib/signup-fields.test.mjs

   등록한 줄을 다시 화면 모양으로 펴는 toDraft 만 봅니다.
   여기가 틀리면 마이페이지에서 고칠 때 값이 빈 칸으로 보이고,
   그대로 저장하면 원래 적으신 게 날아갑니다. */
import assert from 'node:assert/strict';
import { toDraft, NONE } from './signup-fields.ts';

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
  assert.equal(f.extra_pay, 'Y');
  assert.equal(f.note, '');            // null 은 빈 칸으로
  assert.equal(f.lang_none, undefined); // 점수가 있으면 「없음」이 아닙니다
  assert.equal(f.rows_none, undefined);
  assert.deepEqual(rows, [{ hospital: '대학병원(사립)', region: '서울', months: '24' }]);
}

/* ② 「없음」을 골랐던 사람 — 빈 목록이 다시 「없음」으로 보여야 합니다.
      안 그러면 고치기 화면이 열리자마자 「위 칸을 채워 주세요」로 잠깁니다 */
{
  const { f, certs, courses } = toDraft(
    { hired_year: 2021, hospital_type: '대학병원(국립)', extra_pay: false },
    { licenses: [], trainings: [], career: [], lang_score: null },
  );
  assert.equal(f.extra_pay, 'N');
  assert.equal(f.lang_none, 'Y');
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
  assert.equal(f.extra_pay, '');        // 급여 줄이 없으면 비어 있어야 합니다
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
