/* 공고수정 → edited_fields · job_post_edits 로 옮기는 규칙을 시험합니다.
 *
 *   node tools/copy_jobs_test.js
 *
 * 2026-09-18 현재 「공고수정」 시트가 0줄이라 실제 자료로는 확인할 수가 없습니다.
 * 나중에 관리자가 공고를 손으로 고치기 시작하면 이 규칙이 그대로 돕니다.
 *
 * 규칙
 *   · 빈 칸은 「안 고침」 — 건드리지 않습니다
 *   · 원본과 값이 같으면 수정으로 안 셉니다 (edited_fields 가 「진짜 손댄 칸」만 담게)
 *   · 본문(job_posts)을 직접 고치고, 옛값→새값을 job_post_edits 에 남깁니다
 *   · 근무지를 고치면 sido·sgg 도 다시 계산합니다
 *   · 원본 공고가 없는 수정 줄은 버리고 셉니다
 */
'use strict';
const { mergeFixes } = require('./copy_jobs.js');

let bad = 0;
function check(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) bad++;
  console.log((ok ? '  ✓ ' : '  ✗ ') + label + (ok ? '' : '\n      나온 것: ' + JSON.stringify(got)
                                                   + '\n      바란 것: ' + JSON.stringify(want)));
}

/* 「공고수정」 시트를 흉내 냅니다 */
const XCOLS = ['공고ID','기관명','공고명','채용구분','고용형태','근무지','학력','인원',
               '접수시작','접수마감','링크','직군','형태','수정일시'];
function sheet(rows) {
  const idx = {}; XCOLS.forEach((h, i) => { idx[h] = i; });
  return { rows, get: (r, name) => (idx[name] === undefined ? '' : r[idx[name]]) };
}
function row(o) { return XCOLS.map((c) => (o[c] === undefined ? '' : o[c])); }

/* 원본 공고 하나 */
function post() {
  return { id: 'HS1', org_name: '가나병원', title: '작업치료사 모집', hire_type: '신입',
           employ_type: '정규직', work_place: '서울특별시 종로구', sido: '서울특별시', sgg: '종로구',
           edu: '학력무관', headcount: 1, apply_from: '2026-09-01', apply_to: '2026-09-10',
           url: 'https://a.example', job_group: '작업치료사', form: null,
           edited_fields: [] };
}

console.log('① 고친 칸만 잡히나');
{
  const p = post(), byId = { HS1: p };
  const r = mergeFixes(byId, sheet([row({
    '공고ID': 'HS1',
    '공고명': '작업치료사 2명 모집',     // 바뀜
    '고용형태': '',                      // 빈 칸 = 안 고침
    '채용구분': '신입',                  // 원본과 같음 = 수정 아님
    '인원': '2',                         // 바뀜 (숫자로)
    '수정일시': '2026-09-15'
  })]));
  check('edited_fields 는 진짜 바뀐 둘만', p.edited_fields.sort(), ['headcount', 'title']);
  check('본문이 새 값으로', [p.title, p.headcount], ['작업치료사 2명 모집', 2]);
  check('안 건드린 칸은 그대로', [p.employ_type, p.hire_type], ['정규직', '신입']);
  check('이력 2줄', r.edits.length, 2);
  check('고친 공고 1건', r.fixedPosts, 1);
  const t = r.edits.find((e) => e.field === 'title');
  check('옛값 → 새값', [t.old_value, t.new_value], ['작업치료사 모집', '작업치료사 2명 모집']);
  check('수정일시가 이력에', t.edited_at, '2026-09-15T00:00:00+09:00');
}

console.log('② 근무지를 고치면 시도·시군구도 다시');
{
  const p = post(), byId = { HS1: p };
  mergeFixes(byId, sheet([row({ '공고ID': 'HS1', '근무지': '부산광역시 해운대구' })]));
  check('시도·시군구 다시 계산', [p.sido, p.sgg], ['부산광역시', '해운대구']);
  check('edited_fields 에 work_place', p.edited_fields, ['work_place']);
}

console.log('③ 날짜는 형을 맞춰 비교');
{
  const p = post(), byId = { HS1: p };
  const r = mergeFixes(byId, sheet([row({
    '공고ID': 'HS1',
    '접수시작': '2026.09.01',      // 모양만 다르고 같은 날 = 수정 아님
    '접수마감': '2026.09.20'       // 진짜 바뀜
  })]));
  check('같은 날은 수정 아님', p.edited_fields, ['apply_to']);
  check('마감이 바뀜', p.apply_to, '2026-09-20');
  check('이력 1줄', r.edits.length, 1);
}

console.log('④ 원본이 없는 수정 줄');
{
  const r = mergeFixes({}, sheet([row({ '공고ID': '없는ID', '공고명': '아무거나' })]));
  check('버리고 셉니다', [r.edits.length, r.orphanFix, r.fixedPosts], [0, 1, 0]);
}

console.log('⑤ 아무것도 안 고친 수정 줄');
{
  const p = post(), byId = { HS1: p };
  const r = mergeFixes(byId, sheet([row({ '공고ID': 'HS1', '기관명': '가나병원' })]));
  check('edited_fields 비어 있음', p.edited_fields, []);
  check('이력 없음 · 고친 공고 0건', [r.edits.length, r.fixedPosts], [0, 0]);
}

console.log(bad ? '\n어긋난 것 ' + bad + '개' : '\n다 통과했습니다.');
process.exit(bad ? 1 : 0);
