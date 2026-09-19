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

/* 고르는 칸에 보이는 긴 이름. 저장할 때는 ' —' 앞만 남깁니다 (옛 submit 과 같게) */
export const HOSPITAL_TYPES = [
  '대학병원', '종합병원', '의료원(지방의료원 등)', '재활병원', '요양병원', '병(의)원',
  '장애인복지관', '복지관·센터', '아동·발달센터',
  '공공기관(병원) — 건보공단 일산병원, 보훈병원 등',
  '공공기관(비병원) — 건보공단·심평원 등 심사·행정',
  '기타',
] as const;

export const shortType = (v: string) => v.split(' —')[0];

/* 희망 유형·경력/실습 줄에서 쓰는 짧은 목록 (옛 HOSPITALS) */
export const HOSPITALS = [
  '대학병원', '종합병원', '의료원', '재활병원', '요양병원', '병(의)원',
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

export const GENDERS = ['남', '여'] as const;

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

/* 실습·경력 한 줄. 최대 5개 (옛 addRow) */
export const MAX_ROWS = 5;
export type WorkRow = { hospital: string; months: string };

/* 금액을 보고 한 번 되묻는 기준 (옛 OUTLIER).
   막지는 않습니다 — 야간전담처럼 진짜로 높은 경우가 있어서 특이사항에 적게 합니다 */
export const SALARY_LOW = 180;
export const SALARY_HIGH = 400;
