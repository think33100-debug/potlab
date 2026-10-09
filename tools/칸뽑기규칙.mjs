/* 칸뽑기규칙 — 공고문 **글자**에서 일곱 칸 중 다섯을 뽑습니다.
 *
 * 기준을 한 곳에 둡니다 (작업지침 6절). tools/공고칸채우기.mjs 와
 * tools/칸채우기미리보기.mjs 가 쓰던 규칙을 여기로 모으고 넓혔습니다.
 *
 * ── 지키는 것 ───────────────────────────────────────────────
 *   · 값마다 **근거 원문 한 줄**을 함께 돌려줍니다. 근거가 없으면 안 씁니다
 *   · 「내규에 따름」·「협의」는 **말 그대로** 씁니다. 숫자를 만들지 않습니다
 *   · 모집인원은 **우리 직군 줄**에서만 셉니다. 통합 공고의 전체 인원을
 *     우리 인원으로 쓰지 않습니다 (작업지침 15절)
 *   · 못 찾으면 **null**. 「공고에 없음」이라고 적지 않습니다
 *
 * ── 2026-10-10 에 넓힌 것 (전에는 놓치던 표현) ──────────────
 *   모집인원  「○명」 말고 「○ 명」·「0명 내외」·「약간명」·「O명」
 *             표 칸(`| 작업치료사 | 2 |`)도 봅니다
 *   접수마감  「~ 2026. 10. 24.(금) 18:00 까지」 처럼 **기간 꼴**
 *   지원자격  「자격요건」·「응시자격」·「지원요건」·「필수조건」
 *   예상연봉  「보수」·「처우」·「급여」·「임금」 + 「공무원 보수규정」
 */

/** 글을 줄로 — 공백만 있는 줄은 버립니다 */
export function 줄들(글) {
  return String(글 || '').split(/\r?\n/).map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

const 우리직군 = /작업\s*치료\s*사|물리\s*치료\s*사|작업·?물리|물리·?작업/;
const 남의직군 = /간호|의사|약사|영양|조리|운전|미화|청소|사회복지|임상병리|방사선|치과|응급구조|언어재활|행정직|사무원/;

/* ── ① 모집인원 — **우리 직군 줄에서만** ───────────────── */
export function 모집인원뽑기(글, 직군) {
  const xs = 줄들(글);
  const 재기 = 직군 && 직군 !== '공통' ? new RegExp(직군.replace(/(.)/g, '$1\\s*')) : 우리직군;

  /* ㉮ 우리 직군이 적힌 줄에 숫자가 같이 있는 경우 */
  for (const 줄 of xs) {
    if (!재기.test(줄) && !우리직군.test(줄)) continue;
    if (남의직군.test(줄) && !재기.test(줄)) continue;      /* 남의 직군 줄은 건너뜁니다 */
    const m = 줄.match(/(\d{1,3})\s*명/);
    if (m && Number(m[1]) > 0 && Number(m[1]) < 200) {
      return { 값: m[1] + '명', 근거: 줄.slice(0, 140) };
    }
    const w = 줄.match(/(약간\s*명|○\s*명|O\s*명|\d+\s*명\s*내외)/);
    if (w) return { 값: w[1].replace(/\s+/g, ''), 근거: 줄.slice(0, 140) };
  }

  /* ㉯ 표 꼴 — 「| 작업치료사 | 2 | …」 */
  for (const 줄 of xs) {
    if (!줄.includes('|')) continue;
    if (!재기.test(줄) && !우리직군.test(줄)) continue;
    const 칸 = 줄.split('|').map((s) => s.trim());
    for (const c of 칸) {
      const m = c.match(/^(\d{1,3})\s*(명)?$/);
      if (m && Number(m[1]) > 0 && Number(m[1]) < 200) {
        return { 값: m[1] + '명', 근거: 줄.slice(0, 140) };
      }
    }
  }

  /* ㉰ 「모집 인원」·「채용 인원」 라벨 — 값이 **다음 줄**에 있을 수 있습니다 */
  for (let i = 0; i < xs.length; i++) {
    if (!/모집\s*인원|채용\s*인원|선발\s*인원|인\s*원/.test(xs[i])) continue;
    if (남의직군.test(xs[i]) && !재기.test(xs[i])) continue;
    const v = 라벨값(xs, i, /모집\s*인원|채용\s*인원|선발\s*인원|인\s*원/);
    if (!v) continue;
    const m = v.값.match(/(\d{1,3})\s*명|약간\s*명|○\s*명|O\s*명/);
    if (m) return { 값: (m[1] ? m[1] + '명' : m[0].replace(/\s+/g, '')), 근거: v.근거.slice(0, 140) };
  }
  return null;
}

/* ── ② 접수마감 ─────────────────────────────────────────── */
export function 마감뽑기(글) {
  for (const 줄 of 줄들(글)) {
    if (!/접수\s*기간|원서\s*접수|접수\s*마감|제출\s*기한|지원\s*기간|모집\s*기간|접수기한/.test(줄)) continue;
    /* 「~ 2026. 10. 24.」 처럼 **끝 날짜**를 고릅니다 */
    const 날들 = [...줄.matchAll(/(20\d{2})\s*[.\-년]\s*(\d{1,2})\s*[.\-월]\s*(\d{1,2})/g)];
    if (날들.length) {
      const d = 날들[날들.length - 1];
      return { 값: `${d[1]}-${String(d[2]).padStart(2, '0')}-${String(d[3]).padStart(2, '0')}`,
               근거: 줄.slice(0, 140) };
    }
    if (/채용\s*시|채용\s*완료|상시|수시/.test(줄)) {
      return { 값: '마감일 공고문 확인', 근거: 줄.slice(0, 140) };
    }
  }
  return null;
}

/* ★ 2026-10-10 — 「라벨만 있고 값은 **다음 줄**」인 공고가 많습니다.
   대자인병원 공고가 그랬습니다 —
     근무지
     대자인병원
     대한민국 전라북도 전주시 덕진구 견훤로 390, 대자인병원
   한 줄만 보던 규칙은 이걸 통째로 놓쳤습니다. 라벨 줄에 값이 없으면
   **다음 두 줄**까지 봅니다. */
function 라벨값(xs, i, 라벨꼴) {
  const 이줄 = xs[i].replace(/^[○●□■▶·\-*\s]*/, '').replace(라벨꼴, '').replace(/^[:：]\s*/, '').trim();
  if (이줄.length > 2) return { 값: 이줄, 근거: xs[i] };
  const 다음 = [xs[i + 1], xs[i + 2]].filter(Boolean)
    .filter((l) => l.length > 2 && l.length < 160).join(' ').trim();
  if (다음.length > 2) return { 값: 다음, 근거: xs[i] + ' → ' + 다음.slice(0, 80) };
  return null;
}

/* ── ③ 근무지 ───────────────────────────────────────────── */
export function 근무지뽑기(글) {
  const xs = 줄들(글);
  const 라벨 = /근무\s*지|근무\s*장소|근무\s*부서|소재지|근무처/;
  for (let i = 0; i < xs.length; i++) {
    if (!라벨.test(xs[i])) continue;
    const v = 라벨값(xs, i, /근무\s*지역?|근무\s*장소|근무\s*부서|소재지|근무처/);
    if (v) return { 값: v.값.slice(0, 120), 근거: v.근거.slice(0, 140) };
  }
  return null;
}

/* ── ④ 지원자격 ─────────────────────────────────────────── */
export function 지원자격뽑기(글) {
  const xs = 줄들(글);
  for (let i = 0; i < xs.length; i++) {
    if (!/응시\s*자격|지원\s*자격|자격\s*요건|지원\s*요건|필수\s*조건|응시자격기준|자격\s*기준/.test(xs[i])) continue;
    /* 제목 줄 뒤 네 줄까지 묶습니다 — 표 꼴이면 한 줄에 안 들어옵니다 */
    const 덩이 = xs.slice(i, i + 4).join(' ').replace(/\s+/g, ' ').slice(0, 220);
    return { 값: 덩이, 근거: xs[i].slice(0, 140) };
  }
  for (const 줄 of xs) {
    const m = 줄.match(/.{0,40}(면허|자격증)\s*(소지|취득|보유).{0,60}/);
    if (m) return { 값: m[0].trim().slice(0, 200), 근거: 줄.slice(0, 140) };
  }
  return null;
}

/* ── ⑤ 예상 연봉 — **말 그대로** ───────────────────────── */
export function 연봉뽑기(글) {
  for (const 줄 of 줄들(글)) {
    if (!/보수|급여|연봉|월급|임금|수당|처우|호봉/.test(줄)) continue;
    const w = 줄.match(/(내규에?\s*따름|회사\s*내규|당원\s*내규|협의|공고문\s*참조|보수규정에?\s*따름|예산\s*범위\s*내)/);
    if (w) return { 값: w[1].replace(/\s+/g, ' '), 근거: 줄.slice(0, 140) };
    const m = 줄.match(/([0-9][0-9,]{2,})\s*(원|천원|만원)/);
    if (m) return { 값: m[0], 근거: 줄.slice(0, 140) };
    const h = 줄.match(/(\d+\s*호봉)/);
    if (h) return { 값: h[1], 근거: 줄.slice(0, 140) };
  }
  return null;
}

/** 다섯 칸을 한 번에 */
export function 다섯칸뽑기(글, 직군) {
  return {
    모집인원: 모집인원뽑기(글, 직군),
    접수마감: 마감뽑기(글),
    근무지: 근무지뽑기(글),
    지원자격: 지원자격뽑기(글),
    예상연봉: 연봉뽑기(글),
  };
}

/** 「정말 없음」을 쉽게 붙이지 않으려고 — 관련 낱말이 글에 있나 */
export const 낱말 = {
  모집인원: /인원|명\b|모집\s*인원|채용\s*인원|０명|O명/,
  접수마감: /마감|접수|기간|기한|까지/,
  근무지: /근무|소재지|주소|위치/,
  지원자격: /자격|면허|요건|조건|응시/,
  예상연봉: /보수|급여|연봉|월급|임금|호봉|내규|처우/,
};
export function 낱말훑기(글) {
  const out = {};
  for (const [k, re] of Object.entries(낱말)) {
    const 걸린줄 = 줄들(글).filter((l) => re.test(l)).slice(0, 3);
    out[k] = { 있나: 걸린줄.length > 0, 본보기: 걸린줄.map((l) => l.slice(0, 120)) };
  }
  return out;
}
