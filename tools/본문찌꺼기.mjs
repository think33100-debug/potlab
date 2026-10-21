/* 본문이 **CSS·JS 찌꺼기**인가 — 판정 한 자리 (2026-10-22)
 *
 *   node tools/본문찌꺼기.mjs --자기점검
 *
 * 왜 따로 뗐나 — 처음엔 `직군바로잡기.mjs` 안에 두고 다른 도구가 import 했는데,
 * 그 파일은 **스크립트**라서 가져오기만 해도 **통째로 돌았습니다** (목록 도구를
 * 돌렸더니 직군 판정이 찍혔습니다). 판정은 돌지 않는 모듈에 둡니다 (지침 6절).
 *
 * 왜 필요한가 — 강진의료원 공고의 본문이 2,306자 **CSS 한 줄**
 *   (`/* bxSlider … *‍/ .bx-wrapper { -moz-box-shadow: none !important …`) 이고,
 *   그 글자로 직군이 붙었습니다. 쪽에서 본문 영역을 못 잘라 스타일이 들어온 것입니다.
 *
 * 보는 법 — **앞 200자**만 봅니다. 공고문은 앞머리가 CSS 가 아닙니다.
 *   뒤에 쪽 글자가 섞여 있어서 「공고말이 있나」로 보면 빠져나갑니다.
 */
export function 찌꺼기본문(글) {
  const t = String(글 || '').trim();
  if (!t) return false;
  const 앞머리 = t.slice(0, 200);
  const 표 = [
    /!important/,
    /\{[^}]{0,80}:[^}]{0,80};/,
    /function\s*\(/,
    /<style/i,
    /<script/i,
    /\bvar\s+\w+\s*=/,
    /px\s*;/,
    /-webkit-|-moz-/,
    /^\s*\/\*/,
  ];
  return 표.filter((re) => re.test(앞머리)).length >= 2;
}

if (process.argv[1] && process.argv[1].endsWith('본문찌꺼기.mjs')) {
  let 틀림 = 0;
  const 봐 = (이름, 참) => { if (!참) { 틀림++; console.error('✗ ' + 이름); } };
  봐('CSS 한 줄은 찌꺼기',
    찌꺼기본문('/* bxSlider 기본 래퍼 스타일 초기화 */ .bx-wrapper { -moz-box-shadow: none !important; '
      + '-webkit-box-shadow: none; padding: 0px; } 채용공고 물리치료사 모집 접수기간 2026-10-01'));
  봐('공고문은 찌꺼기가 아님',
    !찌꺼기본문('강진의료원 직원 채용 공고 1. 모집분야 및 인원 물리치료사 1명 2. 접수기간 2026. 10. 1. ~ 10. 10.'));
  봐('빈 글은 찌꺼기가 아님', !찌꺼기본문(''));
  봐('스크립트 토막도 찌꺼기',
    찌꺼기본문('<script>var x = 1; function go(){} </script> 채용 안내'));
  console.log(틀림 ? '★ 자기 점검 ' + 틀림 + '가지 실패' : '○ 자기 점검 통과 — 찌꺼기 판정 4가지');
  process.exit(틀림 ? 1 : 0);
}
