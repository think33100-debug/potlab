/* 워크넷 **상세 API 응답에서 칸을 뽑습니다** (2026-10-19 세중님 1번)
 *
 * 쓰는 곳 — `없어진공고찾기.mjs`(정찰 범위 · 하루 1번) · `collect-worknet.mjs`(새 공고)
 * **기준은 이 파일 한 자리입니다** (지침 6절).
 *
 * ── 왜 ───────────────────────────────────────────────────────────
 * 워크넷 **목록** API 는 제목을 30자로 자르고 칸도 적게 줍니다.
 * **상세** API(`callTp=D`)에는 2026-10-19 에 찍어 본 항목이 35개 있고,
 * 그중 우리 일곱 칸에 바로 쓰이는 것이 여섯입니다 —
 *
 *   wantedTitle      온전한 제목           「화성시장애아동재활센터 … (대체인력/긴급)」
 *   empTpNm          고용형태를 **글로**   「기간의 정함이 있는 근로계약11 개월/ …」
 *   receiptCloseDt   접수마감              「20261031」
 *   salTpNm          급여                  「월급2,350,000원 이상 ~ 2,500,000원 이하,」
 *   certificate·eduNm 지원자격             「물리치료사」 · 「대졸(2~3년)」
 *   workRegion       근무지                「경기 화성시」
 *
 * ★ **한도를 모릅니다.** 이 API 는 `x-ratelimit-*` 헤더를 **안 줍니다**
 *   (2026-10-19 에 상세·목록 둘 다 헤더를 전부 찍어 확인했습니다).
 *   그래서 **호출을 늘리지 않는 쪽**으로 씁니다 — 정찰이 이미 부르는 그
 *   응답에서 칸을 함께 받습니다(추가 호출 0). 고용24 신청 화면의 「일일
 *   트래픽」 을 알게 되면 더 적극적으로 부를 수 있습니다 (지침 3·4절).
 */

/** XML 엔티티를 **두 번** 풉니다 — 이 API 가 `&amp;amp;` 로 겹쳐 보냅니다 */
export function 엔티티풀기(s) {
  return String(s ?? '')
    .replace(/&amp;/g, '&').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#38;/g, '&')
    .replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

const 집기 = (xml, 이름) => {
  const m = String(xml || '').match(new RegExp('<' + 이름 + '>([\\s\\S]*?)</' + 이름 + '>'));
  return m ? 엔티티풀기(m[1]) : '';
};

/** 「20261031」 → 「2026-10-31」. 꼴이 아니면 null */
export function 날짜8(v) {
  const s = String(v || '').replace(/\D/g, '');
  if (s.length !== 8) return null;
  const [y, m, d] = [s.slice(0, 4), s.slice(4, 6), s.slice(6, 8)];
  if (+m < 1 || +m > 12 || +d < 1 || +d > 31) return null;
  return y + '-' + m + '-' + d;
}

/* 금액꼴 — `web/lib/job-state.ts` 의 `금액꼴`(숫자 뒤에 「원」)과 같은 뜻입니다.
   2026-10-14 세중님 — 「금액이 있으면 그대로, 없으면 내규에 따름」 */
const 금액꼴 = /[0-9][0-9,.\s]*(?:만|천|억)?\s*원/;
const 내규말 = /내규|보수\s*규정|협의|추후\s*결정|면접\s*후|공고문\s*참조|회사\s*기준/;

/** 급여 글 → 예상연봉 칸. 금액이 있으면 **그 글 그대로**, 내규말이면 「내규에 따름」 */
export function 급여칸(salTpNm) {
  const s = 엔티티풀기(salTpNm).replace(/,\s*$/, '');
  if (!s) return null;
  if (금액꼴.test(s)) return s.slice(0, 120);
  if (내규말.test(s)) return '내규에 따름';
  return null;        /* 「2년」·「9급」 같은 것은 금액이 아닙니다 (지침 — 숫자를 만들지 않습니다) */
}

/** 고용형태 글(empTpNm) — `고용형태판정()` 에 **글로** 넘길 것을 돌려줍니다.
 *  「기간의 정함이 **있는** 근로계약11 개월」 → 기간이 정해진 임용이므로 계약직 쪽
 *  판정 자체는 `공고문읽기.mjs` 한 자리에서 합니다 — 여기서는 **글만** 다듬습니다. */
export function 고용형태글(empTpNm) {
  const s = 엔티티풀기(empTpNm);
  if (!s) return '';
  /* 판정이 읽을 수 있게 우리 말로 한 마디 붙입니다 — 「기간의 정함이 있는」은
     그 자체로는 판정 규칙에 없는 말이라서입니다. 글은 그대로 남깁니다 */
  if (/기간의\s*정함이\s*있는/.test(s)) return s + ' (기간제)';
  if (/기간의\s*정함이\s*없는/.test(s)) return s + ' (정규직)';
  return s;
}

/**
 * 상세 API XML → 우리 칸.
 * 돌려주는 것 { 제목, 고용형태글, 접수마감, 예상연봉, 지원자격, 근무지, 근거 }
 * **빈 것은 null 입니다** — 부르는 쪽이 「빈 값으로 덮지 않기」를 지킬 수 있게.
 */
export function 워크넷상세칸(xml) {
  const t = String(xml || '');
  const 낸것 = { 제목: null, 고용형태글: null, 접수마감: null, 예상연봉: null,
    지원자격: null, 근무지: null, 근거: {} };

  const 제목 = 집기(t, 'wantedTitle');
  if (제목) { 낸것.제목 = 제목.slice(0, 300); 낸것.근거.제목 = '상세 API wantedTitle'; }

  const 고용 = 고용형태글(집기(t, 'empTpNm'));
  if (고용) { 낸것.고용형태글 = 고용; 낸것.근거.고용형태 = '상세 API empTpNm — ' + 고용.slice(0, 80); }

  const 마감 = 날짜8(집기(t, 'receiptCloseDt'));
  if (마감) { 낸것.접수마감 = 마감; 낸것.근거.접수마감 = '상세 API receiptCloseDt'; }

  const 급여 = 급여칸(집기(t, 'salTpNm'));
  if (급여) { 낸것.예상연봉 = 급여; 낸것.근거.예상연봉 = '상세 API salTpNm — ' + 집기(t, 'salTpNm').slice(0, 80); }

  /* 지원자격 — 자격증이 가장 또렷하고, 없으면 학력 */
  const 자격 = 집기(t, 'certificate');
  const 학력 = 집기(t, 'eduNm');
  const 둘 = [자격 && '자격 ' + 자격, 학력 && '학력 ' + 학력].filter(Boolean).join(' · ');
  if (둘) { 낸것.지원자격 = 둘.slice(0, 300); 낸것.근거.지원자격 = '상세 API certificate·eduNm'; }

  const 지역 = 집기(t, 'workRegion');
  if (지역) { 낸것.근무지 = 지역.slice(0, 80); 낸것.근거.근무지 = '상세 API workRegion'; }

  return 낸것;
}

/* ── 스스로 하는 검사 — node tools/워크넷상세칸.mjs --자기점검 ───
   `import.meta.url === process.argv[1]` 꼴로 가리려 했더니 Windows 경로에서
   안 맞아 **조용히 안 돌았습니다.** 다른 도구와 같은 플래그 꼴로 둡니다 */
if (process.argv.includes('--자기점검')) {
  const 어긴것 = [];
  const 봐 = (말, 참) => { if (!참) 어긴것.push(말); };

  /* 2026-10-19 에 **실제로 받은 응답**을 줄여 쓴 것입니다 (지침 2절) */
  const 견본 = ['<wantedDtl><wanted>',
    '<wantedAuthNo>K180012610190008</wantedAuthNo>',
    '<corpNm>화성시장애아동재활센터</corpNm>',
    '<wantedTitle>화성시장애아동재활센터 물리치료사 채용공고(대체인력/긴급)</wantedTitle>',
    '<jobsNm>물리치료사(306501)</jobsNm>',
    '<receiptCloseDt>20261031</receiptCloseDt>',
    '<empTpNm>기간의 정함이 있는 근로계약11 개월/ 파견근로 비희망/ 대체인력채용 희망</empTpNm>',
    '<salTpNm>월급2,281,800원 이상,</salTpNm>',
    '<eduNm>대졸(2~3년)</eduNm>',
    '<certificate>물리치료사</certificate>',
    '<workRegion>경기 화성시</workRegion>',
    '</wanted></wantedDtl>'].join('');
  const r = 워크넷상세칸(견본);
  봐('제목이 온전하다', r.제목 === '화성시장애아동재활센터 물리치료사 채용공고(대체인력/긴급)');
  봐('접수마감 20261031 → 2026-10-31', r.접수마감 === '2026-10-31');
  봐('급여는 금액 그대로', r.예상연봉 === '월급2,281,800원 이상');
  봐('지원자격에 자격·학력', /물리치료사/.test(r.지원자격) && /대졸/.test(r.지원자격));
  봐('근무지', r.근무지 === '경기 화성시');
  봐('고용형태 글에 (기간제) 를 붙인다', /\(기간제\)$/.test(r.고용형태글));
  봐('근거가 칸마다 있다', Object.keys(r.근거).length === 6);

  /* 엔티티 겹침 — 실제로 본 꼴 */
  const 겹침 = '<wantedDtl><wantedTitle>전주 삼남재활의학과병원에서 신입 &amp;amp; 경력 (작업치료사)선생님을 모집합니다.</wantedTitle></wantedDtl>';
  봐('&amp;amp; 를 두 번 풀어 & 하나로',
    워크넷상세칸(겹침).제목 === '전주 삼남재활의학과병원에서 신입 & 경력 (작업치료사)선생님을 모집합니다.');

  /* 빈 것은 null — 「빈 값으로 덮지 않기」를 부르는 쪽이 지킬 수 있게 */
  const 빈것 = 워크넷상세칸('<wantedDtl></wantedDtl>');
  봐('빈 응답이면 전부 null',
    빈것.제목 === null && 빈것.접수마감 === null && 빈것.예상연봉 === null
    && 빈것.지원자격 === null && 빈것.근무지 === null);
  봐('빈 응답이면 근거도 없다', Object.keys(빈것.근거).length === 0);

  /* 날짜 꼴이 아니면 null */
  봐('날짜 8자리가 아니면 null', 날짜8('2026-10') === null && 날짜8('') === null);
  봐('말도 안 되는 달이면 null', 날짜8('20261331') === null);

  /* 급여 — 금액이 없으면 내규말만 인정하고, 그 밖은 null */
  봐('내규말은 「내규에 따름」', 급여칸('회사 내규에 따름') === '내규에 따름');
  봐('「2년」 은 금액이 아니다', 급여칸('2년') === null);
  봐('「9급」 도 금액이 아니다', 급여칸('9급 상당') === null);
  봐('연봉 금액은 그대로', /3,000만\s*원/.test(급여칸('연봉 3,000만 원') || ''));

  /* 고용형태 글 — 「없는」 쪽 */
  봐('기간의 정함이 없는 → (정규직)',
    /\(정규직\)$/.test(고용형태글('기간의 정함이 없는 근로계약/ 파견근로 비희망')));

  if (어긴것.length) {
    console.error('✗ 워크넷상세칸 자기점검 실패 ' + 어긴것.length + '가지');
    for (const x of 어긴것) console.error('   · ' + x);
    process.exit(1);
  }
  console.log('○ 워크넷상세칸 자기점검 통과 — 17가지 (API 를 두드리지 않았습니다)');
}
