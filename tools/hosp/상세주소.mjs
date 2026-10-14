/* 본문을 받아오는 주소가 **목록 주소와 다른 곳** — 2026-10-14
 *
 * 규칙은 여기 **한 자리**입니다 (지침 6절). 쓰는 곳 —
 *   tools/collect-hosp.mjs            상세를 받을 때
 *   tools/㉮상세받기_마른실행.mjs       재 볼 때
 *
 * 따로 떼어 둔 까닭 — `collect-hosp.mjs` 는 **부르면 바로 수집을 시작하는 글**
 * 이라 거기서 `import` 하면 수집기가 통째로 돕니다.
 */

/* ── 인크루트 채용관 ──────────────────────────────────────────
 * 강동경희대(`khnmc`) · 경희대(`khmc`)의 상세 페이지는 **자바스크립트로
 * 그립니다.** 태그를 걷으면 244자뿐이고 모집부문·자격조건·급여가 없습니다.
 * 본문은 **iframe 으로 끼우는 다른 HTML** 에 있고, 주소는 `/job/` 을
 * **`/jobcont/`** 로 바꾼 것입니다.
 *
 * ⚠ **짐작으로 만든 주소가 아닙니다** (지침 3절). playwright-cli 의 네트워크
 *   기록 29번째 줄에서 찾았습니다 — `docs/인크루트_상세_1014.md` 에 그대로
 *   적어 두었습니다. 로그인·쿠키·헤드리스 없이 `fetch` 로 받아집니다 —
 *     /khnmc/jobcont/2610120006  →  637자
 *       「다. 모집인원 : O명  라. 자격조건 - 물리치료사 면허 소지자 …
 *         마. 근무조건 - 급여 : 연 4,110만원 ~ 4,210만원」
 *     /khmc/jobcont/2610080006   →  689자
 */
const 인크루트 = /^https?:\/\/recruit\.incruit\.com\/[^/]+\/job\/\d+/;

/* 다른 곳이 생기면 **여기에** 보탭니다. 짐작으로 만들지 말고,
   네트워크 기록에서 찾아 문서에 적고 나서 보탭니다 */
export function 상세주소(u) {
  const s = String(u || '');
  if (인크루트.test(s)) return s.replace('/job/', '/jobcont/');
  return s;
}

/* 자기점검 — `node tools/hosp/상세주소.mjs` */
if (process.argv[1]?.endsWith('상세주소.mjs')) {
  const 어겼나 = [];
  const 봐 = (말, 참) => { if (!참) 어겼나.push(말); };
  봐('강동경희대 /job/ → /jobcont/',
    상세주소('https://recruit.incruit.com/khnmc/job/2610120006')
      === 'https://recruit.incruit.com/khnmc/jobcont/2610120006');
  봐('경희대 /job/ → /jobcont/',
    상세주소('https://recruit.incruit.com/khmc/job/2610080006')
      === 'https://recruit.incruit.com/khmc/jobcont/2610080006');
  봐('그누보드 주소는 그대로',
    상세주소('https://www.cjmc.or.kr/bbs/board.php?bo_table=recurit_new&wr_id=648')
      === 'https://www.cjmc.or.kr/bbs/board.php?bo_table=recurit_new&wr_id=648');
  봐('남의 /job/ 은 안 건드립니다',
    상세주소('https://example.com/job/123') === 'https://example.com/job/123');
  봐('번호 없는 인크루트 주소는 그대로',
    상세주소('https://recruit.incruit.com/khmc/job/')
      === 'https://recruit.incruit.com/khmc/job/');
  봐('빈 값은 빈 글', 상세주소('') === '' && 상세주소(null) === '');
  if (어겼나.length) { console.error('✗ 자기 점검 실패 — ' + 어겼나.join(' · ')); process.exit(1); }
  console.log('○ 상세주소() 자기 점검 통과 — 6가지');
}
