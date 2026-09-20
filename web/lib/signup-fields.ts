/* 가입할 때 받는 칸 — 옛 앱에서 그대로 옮긴 것입니다.

   원본 자리
     선택지     index.html 2646~2895 (1단계 급여 카드 · 2단계 스펙 카드)
     자격증·교육 index.html 3305~3341 (CERTS · COURSES_OT · COURSES_PT)
     병원유형   index.html 3343 (HOSPITALS)
     필수 여부   index.html 8475 (submit 의 req 배열)

   칸 이름·선택지·필수 여부를 바꾸면 옛 자료와 못 섞입니다. 손대지 마세요. */

export const REGIONS = [
  '서울', '경기·인천', '대전·충청', '대구·경북',
  '부산·울산·경남', '광주·전라', '강원', '제주',
] as const;

/* 고르는 칸에 보이는 긴 이름. 저장할 때는 ' —' 앞만 남깁니다 (옛 submit 과 같게).

   대학병원은 사립·국립을 나눕니다 — 급여 차이가 커서 한 덩어리로 두면
   중위값이 둘 사이 어중간한 값이 되어 양쪽 다 못 씁니다. */
export const HOSPITAL_TYPES = [
  '대학병원(사립)', '대학병원(국립)',
  '종합병원', '의료원(지방의료원 등)', '재활병원', '요양병원', '병(의)원',
  '장애인복지관', '복지관·센터', '아동·발달센터',
  '공공기관(병원) — 건보공단 일산병원, 보훈병원 등',
  '공공기관(비병원) — 건보공단·심평원·도로교통공단 등 심사·행정',
  '기타',
] as const;

export const shortType = (v: string) => v.split(' —')[0];

/* 희망 유형·경력/실습 줄에서 쓰는 짧은 목록 (옛 HOSPITALS) */
export const HOSPITALS = [
  '대학병원(사립)', '대학병원(국립)',
  '종합병원', '의료원', '재활병원', '요양병원', '병(의)원',
  '복지관·센터', '아동·발달센터', '공공기관(병원)', '공공기관(비병원)', '기타',
] as const;

export const EMPLOYMENTS = ['정규직', '무기계약직', '계약직', '인턴', '프리랜서'] as const;

export const GRADES = ['1학년', '2학년', '3학년', '4학년', '졸업예정', '졸업(취준)'] as const;

export const SCHOOLS: { group: string; items: string[] }[] = [
  { group: '전문학사 (3년제)', items: ['서울·경기 3년제', '지방 3년제'] },
  { group: '학사 (4년제)', items: ['서울·경기 4년제', '지방 4년제'] },
  { group: '전공심화', items: ['서울·경기 전공심화', '지방 전공심화'] },
  { group: '대학원', items: ['석사', '박사'] },
];

/* 「고르지 않음」 은 뺐습니다 — 남녀 급여 차이를 보려면 빈 줄이 많으면 안 됩니다 */
export const GENDERS = ['남', '여'] as const;

/* 「없음」 도 답입니다. 빈칸으로 두면 안 적은 건지 없는 건지 구분이 안 됩니다 */
export const NONE = '없음';

/* 자격증·교육 — n 은 묶음 이름, s 는 그 안의 항목.
   s 가 비면 묶음 이름 자체가 하나의 값입니다.
   저장하는 값은 옛 chips() 와 같게 '묶음 - 항목' 입니다 */
export type ChipGroup = { n: string; s: string[] };

export const CERTS: ChipGroup[] = [
  { n: '컴퓨터활용능력', s: ['1급', '2급'] },
  { n: '한국사능력검정', s: ['1급', '2급', '3급'] },
  { n: '사회복지사', s: ['1급', '2급'] },
  { n: '보조공학사', s: [] },
  { n: '요양보호사', s: [] },
  { n: '운전면허', s: [] },
];

export const COURSES_OT: ChipGroup[] = [
  { n: '대한연하재활학회', s: ['연하재활 기능적전기자극치료', '연하재활전문가과정(성인기본)', '성인연하-심화', '소아연하-기본', '소아연하-심화', '구강운동촉진기술 OMPT'] },
  { n: '대한연하장애학회', s: ['전문치료과정 기초', '전문치료과정 심화'] },
  { n: '대한인지재활학회', s: ['전문인지재활치료사 기본(Basic)', '성인 심화강좌', '성인 전문가과정', '아동 기본강좌', '아동 심화강좌', '아동 전문가과정'] },
  { n: '대한뇌신경재활학회', s: ['치매와 인지장애의 인지재활 전문가 과정'] },
  { n: '한국운전재활학회', s: ['운전재활전문가과정'] },
  { n: '대한지역사회작업치료학회', s: ['AMPS 인정평가자 양성과정'] },
  { n: '보바스', s: ['작업치료 기본강좌', '작업치료 심화강좌'] },
  { n: '기타', s: ['감각통합치료', '아동발달'] },
];

export const COURSES_PT: ChipGroup[] = [
  { n: '한국보바스협회', s: ['보바스(Bobath) 기본강좌'] },
  { n: '대한재활의학회', s: ['중추신경계발달치료(NDT)'] },
  { n: '국제의과학아카데미', s: ['통합중추신경계발달치료(INDT)'] },
  { n: '대한고유수용성신경근촉진법학회', s: ['고유수용성신경근촉진법(PNF, IPNF)'] },
  { n: '대한정형도수물리치료학회', s: ['대한정형도수물리치료(OMPT)'] },
  { n: '칼텐본-에비언스학회', s: ['칼텐본-에비언스(OMT)'] },
  { n: '대한기능도수물리치료학회', s: ['대한기능도수물리치료(FMT)'] },
  { n: '국제수중치료협회', s: ['할리윅(Halliwick)', '바드라가즈(Bad Ragaz Ring Method)'] },
  { n: '기타', s: ['스포츠물리치료', '심폐물리치료', '도수치료', '소아물리치료'] },
];

export const coursesFor = (job: string) => (job === '물리치료사' ? COURSES_PT : COURSES_OT);

/* 실습·경력 한 줄. 최대 5개 (옛 addRow).
   지역을 같이 받습니다 — 어느 지역에서 몇 년 일하고 어디로 옮기는지 보려면 필요합니다 */
export const MAX_ROWS = 5;
export type WorkRow = { hospital: string; region: string; months: string };

/* ── 등록한 줄 → 화면 모양 ──

   마이페이지에서 고칠 때 씁니다. 화면이 안 끼어 있어서 따로 시험할 수 있습니다
   (node lib/signup-fields.test.mjs) */
export type Form = Record<string, string>;
export type Draft = { f: Form; certs: string[]; courses: string[]; rows: WorkRow[] };

export function toDraft(
  salary: Record<string, unknown> | null,
  spec: Record<string, unknown> | null,
): Draft {
  const s = (v: unknown) => (v === null || v === undefined ? '' : String(v));
  const f: Form = {};
  for (const [k, v] of Object.entries(salary ?? {})) f[k] = s(v);

  /* 담을 때는 ' —' 앞만 남겼으니 고르는 칸의 긴 이름으로 되돌립니다 */
  f.hospital_type = HOSPITAL_TYPES.find((t) => shortType(t) === f.hospital_type) ?? f.hospital_type;
  f.extra_pay = salary ? (salary.extra_pay ? 'Y' : 'N') : '';

  for (const k of ['school_type', 'grade', 'gpa', 'gpa_scale', 'lang_score', 'want_type', 'want_region']) {
    f[k] = s(spec?.[k]);
  }
  /* 등록은 했는데 비어 있으면 「없음」을 골랐던 것입니다 */
  if (spec && !f.lang_score) f.lang_none = 'Y';

  const raw = (spec?.career ?? spec?.practice ?? []) as WorkRow[];
  const rows = Array.isArray(raw)
    ? raw.map((r) => ({ hospital: s(r.hospital), region: s(r.region), months: s(r.months) }))
    : [];
  if (spec && rows.length === 0) f.rows_none = 'Y';

  const list = (v: unknown) => {
    const xs = Array.isArray(v) ? (v as string[]) : [];
    return spec && xs.length === 0 ? [NONE] : xs;
  };
  return { f, certs: list(spec?.licenses), courses: list(spec?.trainings), rows };
}

/* ── 숫자 칸 검사 ──

   화면에서 안 막으면 DB 의 check 제약에 걸려 영문 오류가 뜹니다.
   여기 범위는 DB 쪽(salary_year_range · salary_net_range 등)과 같아야 합니다.

   올해를 밖에서 넣을 수 있게 둔 이유는 시험 때문입니다 —
   해가 바뀌면 통과하다 말다 하는 시험은 쓸모가 없습니다. */
export const THIS_YEAR = new Date().getFullYear();

/* 「학점은」 과 「연도는」. 조사가 틀리면 대충 만든 티가 납니다 */
export function eun(w: string) {
  const c = w.charCodeAt(w.length - 1);
  const 받침 = c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 !== 0;
  return w + (받침 ? '은' : '는');
}

type Rule = { min: number; max: number; int?: boolean; label: string };

export const RANGE: Record<string, Rule> = {
  hired_year:         { min: 1970, max: 0, int: true, label: '첫 입사연도' },   // max 0 = 올해
  current_hired_year: { min: 1970, max: 0, int: true, label: '지금 병원 입사연도' },
  birth_year:         { min: 1940, max: 0, int: true, label: '출생연도' },
  net_monthly:        { min: 1, max: 2000, int: true, label: '월 실수령액' },
  bonus_yearly:       { min: 0, max: 9999, int: true, label: '연간 상여' },
  duty_count:         { min: 0, max: 31, int: true, label: '당직 횟수' },
  duty_hours:         { min: 0, max: 24, label: '당직 시간' },
  weekend_count:      { min: 0, max: 10, int: true, label: '주말근무 횟수' },
  weekend_hours:      { min: 0, max: 24, label: '주말근무 시간' },
  gpa:                { min: 0, max: 100, label: '학점' },
  gpa_scale:          { min: 1, max: 100, label: '만점 기준' },
  lang_score:         { min: 0, max: 990, int: true, label: '어학 점수' },
  months:             { min: 1, max: 600, int: true, label: '개월' },
};

/* 칸 하나를 봅니다. 문제가 없으면 null.
   f 를 같이 받는 이유는 칸끼리 얽힌 규칙 때문입니다 —
   지금 병원 입사연도는 첫 입사연도보다 빠를 수 없고, 학점은 만점을 넘을 수 없습니다. */
export function fieldError(
  k: string, v: string | undefined, f: Form = {}, thisYear = THIS_YEAR,
): string | null {
  const s = (v ?? '').trim();
  if (s === '') return null;                 // 비어 있는 것은 「필수」가 따로 봅니다

  const r = RANGE[k];
  if (!r) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return `${eun(r.label)} 숫자로 적어 주세요`;
  if (r.int && !Number.isInteger(n)) return `${eun(r.label)} 정수로 적어 주세요`;

  /* 출생연도는 올해까지 열면 갓난아기가 됩니다. 최소 나이를 둡니다 */
  const max = r.max === 0 ? (k === 'birth_year' ? thisYear - 15 : thisYear) : r.max;
  if (n < r.min || n > max) return `${eun(r.label)} ${r.min} ~ ${max} 사이로 적어 주세요`;

  if (k === 'current_hired_year' && f.hired_year) {
    const first = Number(f.hired_year);
    if (Number.isFinite(first) && n < first) {
      return '지금 병원 입사연도가 첫 입사연도보다 빠를 수 없어요';
    }
  }
  if (k === 'gpa' && f.gpa_scale) {
    const scale = Number(f.gpa_scale);
    if (Number.isFinite(scale) && scale > 0 && n > scale) {
      return `학점이 만점(${f.gpa_scale})보다 클 수 없어요`;
    }
  }
  return null;
}

/* 한 화면 안의 칸들을 한꺼번에 봅니다. 하나라도 걸리면 못 넘어갑니다 */
export const anyError = (keys: string[], f: Form, thisYear = THIS_YEAR) =>
  keys.some((k) => fieldError(k, f[k], f, thisYear) !== null);

/* 금액을 보고 한 번 되묻는 기준 (옛 OUTLIER).
   막지는 않습니다 — 야간전담처럼 진짜로 높은 경우가 있어서 특이사항에 적게 합니다 */
export const SALARY_LOW = 180;
export const SALARY_HIGH = 400;
