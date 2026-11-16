/* 공고 한 건 + 기관 표 한 줄 → 릴스 한 편에 들어갈 글 (2026-11-16)

   지키는 것 (CLAUDE.md 0-0 · 15절)
   · 확신 없는 값은 넣지 않습니다 — 비면 「공고문 확인」. 숫자를 만들지 않습니다
   · 기관 소개는 **기관 표·심평원 공식 값만** 씁니다 (10-3 · 이름으로 짐작하지 않음)
   · 조교·연구·행정 갈래는 「○○치료사 채용」으로 말하지 않습니다 (치료사 채용으로 오해)
   · 마감이 지났거나 오늘이면 만들지 않습니다 (null) — 릴스는 하루 넘게 피드에 남습니다

   공고   job_posts_pub 한 줄 + 분류(공고분류() 결과 배열)
   기관   기관 표 + hira_detail + hira_org 를 이은 한 줄 (없으면 null) */

const 요일 = ['일', '월', '화', '수', '목', '금', '토'];

/* 한국 시각 오늘 (YYYY-MM-DD) */
export function 오늘KST(now = new Date()) {
  return new Date(now.getTime() + 9 * 3600e3).toISOString().slice(0, 10);
}

function 날수(from, to) {
  return Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86400e3);
}

function 날짜말(ymd, 시각, 오늘 = null) {
  const d = new Date(ymd + 'T00:00:00Z');
  const 해 = 오늘 && 오늘.slice(0, 4) !== ymd.slice(0, 4) ? `${ymd.slice(0, 4)}년 ` : '';
  let s = `${해}${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일(${요일[d.getUTCDay()]})`;
  if (시각) s += ' ' + String(시각).slice(0, 5);
  return s;
}

/* 1층 분류만 칩으로 · 차례는 앱의 기관태그차례와 같게 · 대학병원이면 종합병원은 안 겹쳐 붙임 */
const 칩차례 = ['대학병원', '공공기관', '종합병원'];
export function 칩(분류 = [], 기관 = null) {
  const 상급 = 기관?.상급종합인가 === true;
  const 들 = 칩차례.filter((k) => 분류.includes(k) && !(k === '종합병원' && (분류.includes('대학병원') || 상급)));
  if (상급) 들.splice(들.includes('대학병원') ? 1 : 0, 0, '상급종합');
  return 들.slice(0, 3);
}

export function 일층인가(분류 = []) {
  return 분류.some((k) => 칩차례.includes(k));
}

/* 지역 — 심평원 hira_org 값 그대로. 시군구 이름이 시도를 품고 있으면(「광주동구」) 그것만 씁니다 */
function 지역말(기관) {
  const 시도 = 기관?.sido_nm || null;
  const 구 = 기관?.sggu_nm || null;
  if (구 && 시도 && (구.startsWith(시도.slice(0, 2)) || 시도.includes(구.slice(0, 2)))) return 구;
  return [시도, 구].filter(Boolean).join(' ') || null;
}

export function 릴스자료(공고, 기관 = null, { 오늘 = 오늘KST(), 사이트 = null } = {}) {
  const 분류 = 공고.분류 || [];
  if (!일층인가(분류)) return { 건너뜀: '1층(공공·종합·대학) 아님' };
  if (!공고.apply_to) return { 건너뜀: '마감일 없음 — 공고문 확인 대상이라 릴스에 안 냅니다' };
  const 남은날 = 날수(오늘, 공고.apply_to);
  if (남은날 < 1) return { 건너뜀: `마감 ${공고.apply_to} — 오늘이거나 지남` };

  const 갈래 = 공고.조교연구 || null;                         /* 조교 · 연구 · 행정 */
  const 직군 = 공고.job_group && 공고.job_group !== '공통' ? 공고.job_group : '물리·작업치료사';
  const 직군말 = 갈래 ? `${직군} 지원 가능 · ${갈래}` : 직군;

  /* 기관 소개 — 공식 값이 있는 것만 */
  const 메타 = [];
  if (기관?.종별이름) 메타.push(기관.종별이름 === '상급종합' ? '상급종합병원' : 기관.종별이름);
  /* 「개인」은 「종합병원 · 개인 · 순천시」로 어색하게 읽혀 뺍니다 (값을 바꾸지 않고 안 보일 뿐) */
  if (기관?.설립구분이름 && 기관.설립구분이름 !== '개인') 메타.push(기관.설립구분이름);
  const 지역 = 지역말(기관); if (지역) 메타.push(지역);
  const 숫자 = [];
  if (기관?.perm_sbd > 0) 숫자.push({ 이름: '허가 병상', 값: 기관.perm_sbd, 단위: '병상' });
  if (기관?.estb_dd) 숫자.push({ 이름: '개설 연도', 값: Number(String(기관.estb_dd).slice(0, 4)), 단위: '년', 연도: true });
  if (기관?.pt > 0) 숫자.push({ 이름: '근무 중인 물리치료사', 값: 기관.pt, 단위: '명' });
  if (기관?.ot > 0) 숫자.push({ 이름: '근무 중인 작업치료사', 값: 기관.ot, 단위: '명' });
  /* 홀수면 마지막 칸을 넓게 */
  if (숫자.length % 2 === 1) 숫자[숫자.length - 1].넓게 = true;
  const 출처 = 숫자.length ? '건강보험심사평가원 공개자료 기준' : '';

  /* 공고 내용 — 비면 화면이 「공고문 확인」 */
  const 마감글 = 날짜말(공고.apply_to, 공고.apply_to_time, 오늘);
  const 줄 = [
    { 이름: '직군', 값: 직군말 },
    { 이름: '고용형태', 값: 공고.employ_type || null },
    { 이름: '모집인원', 값: 공고.모집인원글 || (공고.headcount != null ? `${공고.headcount}명` : null) },
    { 이름: '접수마감', 값: 마감글, 강조: true },
  ];

  const 기관이름 = 기관?.이름 || 공고.org_name;
  const 훅 = 걸기글({ 기관이름, 직군, 갈래, 남은날, 기관 });
  return {
    id: 공고.id,
    기관: 기관이름,
    직군,
    /* 첫 장면 큰 글 — 갈래(조교·연구·행정)는 「채용」이라 하지 않습니다 (치료사 채용으로 오해) */
    걸기: 갈래 ? `${직군} 지원 가능` : `${직군} 채용`,
    한줄: 갈래 ? `${갈래} 자리 · 원문 제목 그대로 확인하세요` : (메타[0] ? `${메타[0]} 정식 공고` : '공고가 올라왔어요'),
    훅,
    분류: 칩(분류, 기관),
    새공고: '새 공고',
    소개: { 메타, 숫자, 출처 },
    공고: { 고용형태: 공고.employ_type || null, 줄 },
    마감: { 큰글: `D-${남은날}`, 작은글: `${마감글} 마감` },
    링크글: '프로필 링크 → RAPO',
    원문제목: 공고.원문제목 || 공고.title,
    캡션: 캡션(공고, 기관이름, 직군말, 마감글, 분류, 사이트),
  };
}

/* 첫 장면 걸기 — 공식 값에서만 고릅니다. 지어낸 형용사(「꿀직장」「연봉 높은」)를 쓰지 않습니다
   차례: 갈래 → 마감 3일 안 → 500병상 이상 → 기본.  강조 = 형광펜이 지나갈 낱말 */
export function 걸기글({ 기관이름, 직군, 갈래, 남은날, 기관 }) {
  const 짧은 = 기관이름.replace(/^(학교법인|의료법인|사회복지법인|재단법인)\s*/, '');
  if (갈래) return { 작은: 짧은, 큰: `${직군}\n지원 가능한 ${갈래} 자리`, 강조: `${직군}` };
  if (남은날 <= 3) return { 작은: `마감까지 ${남은날}일`, 큰: `${짧은}\n${직군} 채용`, 강조: 직군 };
  if (기관?.perm_sbd >= 500 && 기관?.종별이름) {
    const 종별 = 기관.종별이름 === '상급종합' ? '상급종합병원' : 기관.종별이름;
    return { 작은: `${Number(기관.perm_sbd).toLocaleString('ko-KR')}병상 ${종별}`, 큰: `${짧은}\n${직군} 채용`, 강조: 직군 };
  }
  return { 작은: '새 공고', 큰: `${짧은}\n${직군} 채용`, 강조: 직군 };
}

/* 인스타 글 — 해시태그 5개까지 (2025-12 인스타 변경 · 77번 자료) */
export function 캡션(공고, 기관이름, 직군말, 마감글, 분류, 사이트) {
  const 태그 = ['#물리치료사', '#작업치료사', '#치료사채용'];
  if (분류.includes('대학병원')) 태그.push('#대학병원채용');
  else if (분류.includes('공공기관')) 태그.push('#공공기관채용');
  else 태그.push('#종합병원채용');
  태그.push('#RAPO');
  const 줄 = [
    `${기관이름} ${직군말} 채용`,
    '',
    `· 고용형태 ${공고.employ_type || '공고문 확인'}`,
    `· 모집인원 ${공고.모집인원글 || (공고.headcount != null ? 공고.headcount + '명' : '공고문 확인')}`,
    `· 접수마감 ${마감글}`,
    '',
    '마감·자격은 바뀔 수 있어요. 지원 전에 꼭 원문 공고를 확인하세요.',
    사이트 ? `원문 공고 → 프로필 링크 (${사이트}/jobs/${공고.id})` : '원문 공고 → 프로필 링크',
    '',
    태그.slice(0, 5).join(' '),
  ];
  return 줄.join('\n');
}

/* 같은 공고문이 직군별 두 줄(…-PT · …-OT)이면 한 편으로 묶습니다 — 같은 공고 릴스가 두 번 나가지 않게.
   열쇠는 (기관 이름 · 원문 제목 · 마감일). 직군은 「물리치료사·작업치료사」, 인원은 직군별로 적습니다 */
export function 같은공고묶기(줄들) {
  const 묶음 = new Map();
  for (const 줄 of 줄들) {
    const 열쇠 = [줄.org_name, 줄.원문제목 || 줄.title, 줄.apply_to].join('|');
    if (!묶음.has(열쇠)) 묶음.set(열쇠, []);
    묶음.get(열쇠).push(줄);
  }
  return [...묶음.values()].map((같은) => {
    if (같은.length === 1) return 같은[0];
    const 차례 = ['물리치료사', '작업치료사'];
    같은.sort((a, b) => 차례.indexOf(a.job_group) - 차례.indexOf(b.job_group));
    const 직군들 = [...new Set(같은.map((x) => x.job_group))];
    const 인원 = 같은.every((x) => x.headcount != null)
      ? 같은.map((x) => `${x.job_group.replace('치료사', '')} ${x.headcount}명`).join(' · ') : null;
    const 같은갈래 = new Set(같은.map((x) => x.조교연구 || '')).size === 1;
    return { ...같은[0], id: 같은.map((x) => x.id).join('+'), 묶은id: 같은.map((x) => x.id),
      job_group: 직군들.join('·'), headcount: null, 모집인원글: 인원,
      조교연구: 같은갈래 ? 같은[0].조교연구 : null,
      employ_type: new Set(같은.map((x) => x.employ_type)).size === 1 ? 같은[0].employ_type : null };
  });
}
