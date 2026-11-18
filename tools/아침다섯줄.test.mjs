/* 아침다섯줄.mjs 회귀 시험 — 오프라인 (node:test)
 *
 *   node --test tools/아침다섯줄.test.mjs
 *
 * git 출력은 hold-digest 가 부르는 명령(`git log --first-parent --format=%s%x1f%b%x1e`) 꼴 그대로 합성하고,
 * 이 저장소의 실제 git 기록으로도 한 번 돌려 봅니다(읽기만).
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { 다섯줄, 올린것제목, 나눔, 칸나눔 } from './아침다섯줄.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));

describe('1. 어제 운영에 올린 것', () => {
  test('병합 커밋은 「#번호 PR 제목」 — 가지 이름은 안 실음 · 바로 올린 커밋은 제목 그대로', () => {
    const 출력 = 'Merge pull request #227 from 누구/ai/claude-1118-mentor-collector' + 칸나눔 + '\n수집기 멘토 항목 셋\n\n자세히' + 나눔 + '\n'
      + '수집 설정: 가톨릭 계열 6곳' + 칸나눔 + '' + 나눔 + '\n';
    assert.deepEqual(올린것제목(출력), ['#227 수집기 멘토 항목 셋', '수집 설정: 가톨릭 계열 6곳']);
    assert.deepEqual(올린것제목(''), []);
    assert.equal(올린것제목(null), null);
  });
  test('이 저장소의 실제 git 기록으로도 꼴이 맞습니다 (읽기만)', () => {
    const 출력 = execFileSync('git', ['-C', path.join(여기, '..'), 'log', '--first-parent', '-n', '3',
      '--format=%s' + 칸나눔 + '%b' + 나눔, 'HEAD'], { encoding: 'utf8' });
    const 제목 = 올린것제목(출력);
    assert.equal(제목.length, 3);
    for (const t of 제목) assert.ok(t && !t.includes(칸나눔) && !/from \S+\/\S+/.test(t), t);
  });
  test('줄 — 없음 · 모름 · 건수와 제목', () => {
    assert.match(다섯줄({ 올린것: [] })[1], /^1\. 어제 운영에 올린 것 — 없음$/);
    assert.match(다섯줄({ 올린것: null })[1], /— 모름 \(서버 저장소의 git 기록을 못 읽음\)/);
    assert.match(다섯줄({ 올린것: ['#1 가', '#2 나', '#3 다', '#4 라', '#5 마'] })[1], /— 5건: #1 가 · #2 나 · #3 다 · #4 라 … 외 1건/);
  });
});

describe('2~5', () => {
  const 가득 = {
    올린것: ['#227 수집기 멘토 항목 셋'],
    보안: { 밖합: 2, 못봄수: 1 }, 보안전날: 0,
    게시판: { 곳수: 200, 고장: [{}, {}, {}], 의심: [{}], 정상: 196, 새글: 40 },
    새공고: 37, 보류: 12, 새보류: 3, 승인: 2,
    고용24: { 오늘: { 목록: 3, 상세: 10, 합: 13 }, 어제: { 목록: 30, 상세: 120, 합: 150 } },
    한도: [{ 서비스: '알리오', 쓴양: 400, 한도: 1000 }],
  };
  test('다섯 줄이 차례대로 · 맨 위 머리 한 줄 · 끝에 빈 줄', () => {
    const 줄 = 다섯줄(가득);
    assert.equal(줄.length, 7);
    assert.equal(줄[0], '■ 아침 다섯 줄 (멘토 양식)');
    assert.deepEqual(줄.slice(1, 6).map((l) => l.slice(0, 2)), ['1.', '2.', '3.', '4.', '5.']);
    assert.equal(줄[6], '');
    assert.equal(줄[2], '2. 보안 경고 — 허용 목록 밖 열린 창구 2건 (전날 0 → 2 · ★ 늘었음) · 점검 못 한 칸 1 · Security Advisor 는 대시보드에서 확인');
    assert.equal(줄[3], '3. 수집 — 고장 3 · 의심 1 · 정상 196, 새 공고 37건 (24시간 · 보류 포함 · 전 출처)');
    assert.equal(줄[4], '4. 판단할 것 — 보류함 12건 (그중 24시간 새로 3건) · 승인 기다리는 것 2개 · 질문함은 서버에 없어 못 셈');
    assert.equal(줄[5], '5. 비용 — 외부 API 호출: 고용24 어제 150번(목록 30 · 상세 120) · 오늘 지금까지 13번 · 공공데이터 알리오 400/1000 · 토큰은 서버가 몰라 뺌');
  });
  test('모르는 칸은 0 이 아니라 「모름」', () => {
    const 줄 = 다섯줄({});
    assert.match(줄[2], /허용 목록 밖 열린 창구 모름 \(점검을 못 돌림\) · Security Advisor 는 대시보드에서 확인/);
    assert.match(줄[3], /고장·의심·정상 모름 \(게시판 기록 없음\), 새 공고 모름$/);
    assert.match(줄[4], /보류함 모름 · 승인 기다리는 것 모름/);
    assert.match(줄[5], /고용24 어제 모름/);
    assert.ok(!줄.slice(1).some((l) => /\b0건\b/.test(l)));
  });
});

describe('연결', () => {
  test('hold-digest — 조용한 아침(아침글)과 긴 메일(글로) 둘 다 맨 위에 · 글 만들기 전에 잼', () => {
    const 요약 = fs.readFileSync(path.join(여기, 'hold-digest.mjs'), 'utf8');
    assert.equal(요약.split('줄.push(...다섯);').length - 1, 2);
    const 글로 = 요약.indexOf('function 글로(');
    assert.ok(요약.indexOf('줄.push(...다섯);', 글로) - 글로 < 200, '글로() 첫 줄 가까이');
    const 아침 = 요약.indexOf("줄.push('피오티잡 아침 숫자 — '");
    assert.ok(요약.indexOf('줄.push(...다섯);', 아침) - 아침 < 300, '아침글() 머리 바로 밑');
    assert.ok(요약.indexOf('다섯 = await 다섯줄만들기(') < 요약.indexOf('const 짧은본문 = 아침글('));
  });
  test('다섯줄 모듈은 순수합니다', () => {
    const 모듈 = fs.readFileSync(path.join(여기, '아침다섯줄.mjs'), 'utf8');
    assert.deepEqual(모듈.match(/^\s*import\s.*$/gm) || [], []);
    assert.ok(!/\bfetch\s*\(|process\.|readFileSync|execFileSync|Date\.now/.test(모듈));
  });
});
