/* 아침 메일 맨 위 다섯 줄 — 멘토 양식 (2026-11-18 · 멘토-추가-지시문7)
 *
 *   1. 어제 운영에 올린 것 (없으면 「없음」)
 *   2. 보안 경고 수 (전날 대비)
 *   3. 수집: 고장 n · 의심 n · 정상 n, 새 공고 n건
 *   4. 내가 판단할 것 (보류함 건수, 답을 기다리는 질문)
 *   5. 비용: 외부 API 호출 수 (토큰은 서버가 모릅니다 — 뺍니다)
 *
 * 숫자는 **이미 메일이 재는 것**을 다시 씁니다 (hold-digest.mjs 가 모아서 넘김 · 지침 6절).
 * 모르는 칸은 0 으로 메우지 않고 「모름」이라고 적습니다 (지침 15절).
 * 순수 함수만 — 네트워크·파일·시계 없음. git 출력도 부르는 쪽이 넘깁니다.
 */

export const 나눔 = '\x1e';   // git log --format 의 줄 끝
export const 칸나눔 = '\x1f';

/**
 * `git log --first-parent --since=… --format=%s%x1f%b%x1e` 출력 → 제목 목록.
 * 「Merge pull request #227 from 누구/가지」 는 「#227 본문 첫 줄(PR 제목)」 로 바꿉니다 — 가지 이름은 안 싣습니다.
 * @returns {string[]|null} 출력이 null 이면 null (git 을 못 읽음)
 */
export function 올린것제목(출력) {
  if (출력 == null) return null;
  return String(출력).split(나눔).map((x) => x.replace(/^\s+/, '')).filter(Boolean).map((x) => {
    const [제목, 본문 = ''] = x.split(칸나눔);
    const m = String(제목).match(/^Merge pull request (#\d+)\b/);
    if (!m) return String(제목).trim();
    const 첫줄 = String(본문).split(/\r?\n/).map((l) => l.trim()).find(Boolean);
    return m[1] + (첫줄 ? ' ' + 첫줄 : '');
  });
}

const 모름 = '모름';
const 수말 = (n, 꼬리 = '') => (Number.isFinite(n) ? n + 꼬리 : 모름);
const 바뀜말 = (지금, 앞) => (Number.isFinite(지금) && Number.isFinite(앞)
  ? ' (전날 ' + 앞 + ' → ' + 지금 + (지금 === 앞 ? ' · 같음' : 지금 > 앞 ? ' · ★ 늘었음' : ' · 줄었음') + ')'
  : ' (전날 기록 없음)');

/**
 * @param x {
 *   올린것: string[]|null,
 *   보안: { 밖합:number, 못봄수:number }|null, 보안전날: number|null,
 *   게시판: 아침가르기() 결과|null, 새공고: number|null,
 *   보류: number|null, 새보류: number|null, 승인: number|null,
 *   고용24: { 오늘:{목록,상세,합}, 어제:{목록,상세,합}|null }|null,
 *   한도: [{ 서비스, 쓴양, 한도 }]|null,
 * }
 */
export function 다섯줄(x = {}) {
  const 줄 = ['■ 아침 다섯 줄 (멘토 양식)'];

  /* 1 */
  const 올 = x.올린것;
  줄.push('1. 어제 운영에 올린 것 — ' + (올 == null ? 모름 + ' (서버 저장소의 git 기록을 못 읽음)'
    : !올.length ? '없음'
      : 올.length + '건: ' + 올.slice(0, 4).map((t) => t.slice(0, 50)).join(' · ') + (올.length > 4 ? ' … 외 ' + (올.length - 4) + '건' : '')
        + '  (서버 저장소 main · 24시간)'));

  /* 2 */
  const 보 = x.보안;
  줄.push('2. 보안 경고 — ' + (보 && Number.isFinite(보.밖합)
    ? '허용 목록 밖 열린 창구 ' + 보.밖합 + '건' + 바뀜말(보.밖합, x.보안전날)
      + (보.못봄수 ? ' · 점검 못 한 칸 ' + 보.못봄수 : '')
    : '허용 목록 밖 열린 창구 ' + 모름 + ' (점검을 못 돌림)')
    + ' · Security Advisor 는 대시보드에서 확인');

  /* 3 */
  const 게 = x.게시판;
  줄.push('3. 수집 — ' + (게 && 게.곳수
    ? '고장 ' + 게.고장.length + ' · 의심 ' + 게.의심.length + ' · 정상 ' + 게.정상
    : '고장·의심·정상 ' + 모름 + ' (게시판 기록 없음)')
    + ', 새 공고 ' + 수말(x.새공고, '건') + (Number.isFinite(x.새공고) ? ' (24시간 · 보류 포함 · 전 출처)' : ''));

  /* 4 */
  줄.push('4. 판단할 것 — 보류함 ' + 수말(x.보류, '건')
    + (Number.isFinite(x.새보류) ? ' (그중 24시간 새로 ' + x.새보류 + '건)' : '')
    + ' · 승인 기다리는 것 ' + 수말(x.승인, '개')
    + ' · 질문함은 서버에 없어 못 셈');

  /* 5 */
  const 고 = x.고용24;
  const 한 = (x.한도 || []).filter((h) => h && h.서비스 != null);
  줄.push('5. 비용 — 외부 API 호출: 고용24 ' + (고 && 고.어제
    ? '어제 ' + 고.어제.합 + '번(목록 ' + 고.어제.목록 + ' · 상세 ' + 고.어제.상세 + ')'
    : '어제 ' + 모름) + (고 && 고.오늘 ? ' · 오늘 지금까지 ' + 고.오늘.합 + '번' : '')
    + (한.length ? ' · 공공데이터 ' + 한.slice(0, 4).map((h) => h.서비스 + ' ' + h.쓴양 + '/' + h.한도).join(' · ') : '')
    + ' · 토큰은 서버가 몰라 뺌');
  줄.push('');
  return 줄;
}
