import type { RapoJob } from './rapo-job-list';

/* Figma 「U01 · 홈 · 비회원 · 기본」의 견본 공고 넷 — 글자 그대로 옮겼습니다.
   ★ 실제 공고가 아닙니다. 미리보기(app/design-preview)에서만 씁니다.
   기관 이름·숫자는 디자이너가 지은 것이고, id 가 없어 저장·이동이 잠깁니다. */
export const 견본공고: RapoJob[] = [
  { order: 0, org: '가온재활병원', orgArt: '01', title: '성인 재활 작업치료사 모집',
    pay: { text: '이용 권한 확인 후 공개', kind: 'value' }, tags: ['서울 마포', '신입과 경력 지원 가능', '주 5일'],
    likes: 12, views: 318, deadline: '11.15 마감', deadlineSort: 1115 },
  { order: 1, org: '다온재활센터', orgArt: '06', title: '아동 작업치료사 채용',
    pay: { text: '급여 확인 필요', kind: 'check' }, tags: ['서울 마포', '신입과 경력 지원 가능', '주 5일'],
    likes: 8, views: 246, deadline: '마감일 확인 필요', deadlineSort: null },
  { order: 2, org: '가온재활병원', orgArt: '01', title: '물리치료사 모집',
    pay: { text: '이용 권한 확인 후 공개', kind: 'value' }, tags: ['서울 마포', '경력 2년 이상', '주 5일'],
    likes: 6, views: 195, deadline: '11.20 마감', deadlineSort: 1120 },
  { order: 3, org: '새봄재활병원', orgArt: '03', title: '작업치료사 정규직 채용',
    pay: { text: '이용 권한 확인 후 공개', kind: 'value' }, tags: ['서울 강서', '신입과 경력 지원 가능', '주 5일'],
    likes: 4, views: 127, deadline: '11.18 마감', deadlineSort: 1118 },
];
