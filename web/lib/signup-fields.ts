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

/* 경력·실습 줄의 규칙 한 곳 — **전부 쓰거나, 전부 안 쓰거나** (2026-09-25).

   전에는 「한 줄이라도 다 채웠으면 통과」였습니다. 그러면 옆의 반쯤 쓴 줄이
   그대로 넘어가고, 저장할 때 조용히 버려졌습니다. 적어놓은 게 없어지는 것보다
   넘어가기 전에 막는 편이 낫습니다.

   아무것도 안 쓴 분은 그냥 넘어갑니다 — 막 졸업해서 경력이 없는 분입니다.
   화면과 저장이 **같은 규칙**을 써야 합니다. 두 벌이 되면 화면은 통과시키고
   저장은 버리는 사이가 생깁니다 */
export const rowStarted = (r: WorkRow) => !!(r.hospital || r.region || r.months);
export const rowFull    = (r: WorkRow) => !!(r.hospital && r.region && r.months);

/** 반쯤 쓴 줄. 비어 있는 줄은 안 셉니다 */
export const rowsHalf = (rows: WorkRow[]) => rows.filter((r) => rowStarted(r) && !rowFull(r));

/** 다음으로 넘어갈 수 있나. 개월수 범위까지 봅니다 */
export const rowsReady = (rows: WorkRow[]) =>
  rowsHalf(rows).length === 0
  && !rows.some((r) => rowFull(r) && fieldError('months', r.months, {}) !== null);

/** 저장할 줄 — 화면이 통과시킨 것만 남습니다 */
export const rowsToSave = (rows: WorkRow[]) => rows.filter(rowFull);

/* ───────── 어학 ─────────

   한 사람이 토익도 오픽도 넣을 수 있어서 줄이 여러 개입니다 (표 spec_langs).
   시험·점수·등급을 따로 둡니다 — 「토익 850」처럼 글자로 합치면 나중에
   시험별로 셀 수가 없습니다. */
export const LANG_MAX = 5;
export type LangRow = { exam: string; score: string; level: string };

/* 시험은 넷입니다. 「기타」는 뺐습니다 — 무슨 시험인지 모르면
   시험별로 셀 수도, 점수를 매길 수도 없었습니다.
   만점은 각 시험 공식 기준입니다. DB 의 spec_langs_score_range 와 같은 숫자여야 합니다 */
export const EXAMS: { name: string; max?: number; ph?: string }[] = [
  { name: '토익', max: 990, ph: '850' },
  { name: '텝스', max: 600, ph: '400' },
  { name: '토익스피킹', max: 200, ph: '140' },
  { name: '오픽' },
];

/* opic.or.kr 공식 안내에서 확인했습니다 —
   「OPIc은 IM등급을 세분화하여 제공합니다 (IM3 > IM2 > IM1)」, 범위는 Novice Low ~ Advanced Low.
   AM·AH·Superior 는 OPI 것이라 여기 넣으면 안 됩니다 */
export const OPIC_LEVELS = ['NL', 'NM', 'NH', 'IL', 'IM1', 'IM2', 'IM3', 'IH', 'AL'];

export const emptyLang = (): LangRow => ({ exam: '', score: '', level: '' });

/* 이 줄이 저장할 만큼 채워졌나. 안 채워진 줄은 그냥 버립니다 —
   어학은 필수가 아니라서 덜 채웠다고 막지 않습니다 */
export function langDone(r: LangRow): boolean {
  const e = EXAMS.find((x) => x.name === r.exam);
  if (!e) return false;
  if (r.exam === '오픽') return OPIC_LEVELS.includes(r.level);
  const n = Number(r.score);
  return r.score.trim() !== '' && Number.isInteger(n) && n >= 0 && n <= (e.max ?? 0);
}

/* 채운 줄에 잘못이 있으면 알려줍니다. 빈 줄은 잘못이 아닙니다 */
export function langError(r: LangRow): string | null {
  const e = EXAMS.find((x) => x.name === r.exam);
  if (!e) return null;
  if (r.exam === '오픽') return null;
  if (r.score.trim() === '') return null;
  const n = Number(r.score);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return '숫자만 넣을 수 있어요';
  if (n < 0 || n > (e.max ?? 0)) return `${eun(r.exam)} 0 ~ ${e.max} 사이로 넣어 주세요`;
  return null;
}

/* DB 로 보낼 모양. 덜 채운 줄은 버리고, 같은 시험이 겹치면 앞의 것만 남깁니다
   (화면에서도 막지만 DB 의 spec_langs_one_per_exam 이 최종입니다) */
export function langsPayload(rows: LangRow[]) {
  const seen = new Set<string>();
  const out = [];
  for (const r of rows) {
    if (!langDone(r) || seen.has(r.exam)) continue;
    seen.add(r.exam);
    out.push({
      exam: r.exam,
      score: r.exam === '오픽' ? null : Number(r.score),
      level: r.exam === '오픽' ? r.level : null,
    });
    if (out.length >= LANG_MAX) break;
  }
  return out;
}

/* ── 등록한 줄 → 화면 모양 ──

   마이페이지에서 고칠 때 씁니다. 화면이 안 끼어 있어서 따로 시험할 수 있습니다
   (node lib/signup-fields.test.mjs) */
export type Form = Record<string, string>;
export type Draft = { f: Form; certs: string[]; courses: string[]; rows: WorkRow[]; langs: LangRow[] };

/* 빈 칸은 0 이 아니라 '안 적음' 입니다 */
const num = (v: string | undefined) => (v && v.trim() !== '' ? Number(v) : null);

/* 급여를 세전으로 직접 적었는지, 세후로 적어 계산했는지.

   DB 의 salary_estimated_needs_net 이 「estimated 면 net_monthly 와 dependents 가
   둘 다 있어야 한다」고 막습니다. 예전에는 세 칸을 따로 판단해서 어긋났습니다 —
   세후로 계산해 넣은 뒤 「세전을 모르겠어요」를 다시 끄면 pay_basis 만
   estimated 로 남아 저장이 통째로 막혔습니다. 한 번만 판단하고 셋을 여기서 갈라 씁니다 */
export function payAs(f: Form) {
  const est = f.pay_basis === 'estimated' && f.pay_unsure === 'Y'
    && num(f.net_monthly) != null && num(f.dependents) != null;
  return {
    pay_basis: est ? 'estimated' : 'gross',
    net_monthly: est ? num(f.net_monthly) : null,
    dependents: est ? num(f.dependents) : null,
  };
}

export function toDraft(
  salary: Record<string, unknown> | null,
  spec: Record<string, unknown> | null,
  langs: Record<string, unknown>[] | null = null,
): Draft {
  const s = (v: unknown) => (v === null || v === undefined ? '' : String(v));
  const f: Form = {};
  for (const [k, v] of Object.entries(salary ?? {})) f[k] = s(v);

  /* 담을 때는 ' —' 앞만 남겼으니 고르는 칸의 긴 이름으로 되돌립니다 */
  f.hospital_type = HOSPITAL_TYPES.find((t) => shortType(t) === f.hospital_type) ?? f.hospital_type;
  /* 세후로 적어 계산했던 분은 그 상태 그대로 열어 줍니다 */
  f.pay_unsure = salary?.pay_basis === 'estimated' ? 'Y' : '';

  for (const k of ['school_type', 'grade', 'gpa', 'gpa_scale', 'want_type', 'want_region']) {
    f[k] = s(spec?.[k]);
  }

  const raw = (spec?.career ?? spec?.practice ?? []) as WorkRow[];
  const rows = Array.isArray(raw)
    ? raw.map((r) => ({ hospital: s(r.hospital), region: s(r.region), months: s(r.months) }))
    : [];
  if (spec && rows.length === 0) f.rows_none = 'Y';

  const list = (v: unknown) => {
    const xs = Array.isArray(v) ? (v as string[]) : [];
    return spec && xs.length === 0 ? [NONE] : xs;
  };
  /* 등록해 둔 어학을 화면 모양으로 폅니다 */
  const ls = (langs ?? []).map((r) => ({
    exam: s(r.exam), score: s(r.score), level: s(r.level),
  }));
  return { f, certs: list(spec?.licenses), courses: list(spec?.trainings), rows, langs: ls };
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
  base_monthly:       { min: 1, max: 2000, int: true, label: '고정 월급' },
  extra_pay_monthly:  { min: 0, max: 2000, int: true, label: '추가 수당' },
  duty_pay:           { min: 0, max: 200, label: '당직 수당' },
  weekend_pay:        { min: 0, max: 200, label: '주말근무 수당' },
  dependents:         { min: 1, max: 15, int: true, label: '부양가족 수' },
  bonus_yearly:       { min: 0, max: 9999, int: true, label: '연간 상여' },
  duty_count:         { min: 0, max: 31, int: true, label: '당직 횟수' },
  duty_hours:         { min: 0, max: 24, label: '당직 시간' },
  weekend_count:      { min: 0, max: 10, int: true, label: '주말근무 횟수' },
  weekend_hours:      { min: 0, max: 24, label: '주말근무 시간' },
  gpa:                { min: 0, max: 100, label: '학점' },
  gpa_scale:          { min: 1, max: 100, label: '만점 기준' },
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
