/* 홈 랜딩의 글.

   관리자가 /admin/texts 에서 고칩니다 — 배포가 필요 없습니다.
   DB(home_texts)에 값이 있으면 그걸 쓰고, 없거나 못 읽으면 여기 기본값을 씁니다.
   기본값을 DB 에만 두면 DB 가 한 번 안 열릴 때 홈이 통째로 빕니다.

   여기 안 넣는 것 —
     · 가는 곳(href) · 탭 이름 — DB 에 엉뚱한 주소가 들어가면 404 가 납니다
       (lib/routes.ts 가 아는 주소만 통과시킵니다)
     · 아이콘 이름 — 오타가 나면 화면이 점 하나로 떨어집니다
     · DB 가 세어 주는 숫자 — 박아두면 다음 달에 틀린 화면이 됩니다
     · 「화면 예시입니다」 안의 가짜 값(○○재활병원 · 막대 높이) — 글이 아니라 그림입니다

   줄바꿈은 \n 으로 적고 화면에서 whitespace-pre-line 으로 그립니다.
   관리자 화면에서도 여러 줄로 보입니다 (multiline). */

export type TextRow = {
  key: string;
  area: string;
  label: string;
  value: string;
  multiline?: boolean;
};

export const HOME_TEXT: TextRow[] = [
  /* ── 히어로 ── */
  { key: 'hero.eyebrow', area: '히어로', label: '눈썹', value: '작업치료사 · 물리치료사' },
  { key: 'hero.title', area: '히어로', label: '큰 제목', multiline: true,
    value: '치료사 급여는\n어느 통계에도\n없습니다' },
  { key: 'hero.title.red', area: '히어로', label: '큰 제목 중 빨갛게 쓸 마지막 줄', value: '없습니다' },
  { key: 'hero.lead', area: '히어로', label: '설명', multiline: true,
    value: '물어보기도 민망하고, 물어봐도 결국 한 사람 얘기죠.\n그래서 그냥 저희가 모으기로 했어요.' },
  { key: 'hero.cta1', area: '히어로', label: '빨간 단추', value: '내 연봉 어디쯤인지 보기' },
  { key: 'hero.cta2', area: '히어로', label: '테두리 단추', value: '공고부터 둘러보기' },
  { key: 'hero.stat.ot', area: '히어로', label: '숫자 칸 — 작업치료사', value: '작업치료사 중위' },
  { key: 'hero.stat.joined', area: '히어로', label: '숫자 칸 — 참여', value: '지금까지 참여' },
  { key: 'hero.stat.hosp', area: '히어로', label: '숫자 칸 — 병원', value: '등록된 병원' },

  /* ── 참여 현황 ── */
  { key: 'joined.title', area: '참여 현황', label: '제목', value: '지금까지 모인 것' },
  { key: 'joined.tail', area: '참여 현황', label: '아래 설명', multiline: true,
    value: '{min}명이 안 되면 안 보여드려요.\n통계가 아니라 그냥 누구 한 명 얘기가 되니까요.' },

  /* ── 급여 ── */
  { key: 'pay.eyebrow', area: '급여', label: '눈썹', value: '주 기능 · 급여' },
  { key: 'pay.title', area: '급여', label: '제목', multiline: true, value: '내 연봉을\n숫자로 확인합니다' },
  { key: 'pay.lead', area: '급여', label: '설명',
    value: '작업치료사랑 물리치료사는 따로 집계해요. 섞으면 의미가 없거든요.' },
  { key: 'pay.f01.title', area: '급여', label: '01 제목', value: '내 위치' },
  { key: 'pay.f01.body', area: '급여', label: '01 설명', multiline: true,
    value: '같은 직군, 같은 연차, 같은 병원유형에서 내가 상위 몇 %인지.\n상여까지 넣어 연 단위로 환산한 기준입니다.' },
  { key: 'pay.f02.title', area: '급여', label: '02 제목', value: '이직하면 얼마나 달라질까' },
  { key: 'pay.f02.body', area: '급여', label: '02 설명', multiline: true,
    value: '병원유형이나 지역을 바꾸면 중위값이 얼마나 달라지는지 봐요.\n월로도 보고 연으로도 봅니다.' },
  { key: 'pay.f03.title', area: '급여', label: '03 제목', value: '진짜 시급' },
  { key: 'pay.f03.body', area: '급여', label: '03 설명', multiline: true,
    value: '당직이랑 주말까지 넣어서 계산합니다.\n월급은 위인데 시급은 아래인 경우, 여기서 드러나요.' },
  { key: 'pay.f04.title', area: '급여', label: '04 제목', value: '세전 · 세후 계산기' },
  { key: 'pay.f04.body', area: '급여', label: '04 설명',
    value: '2026년 요율 기준입니다. 공제 내역까지 하나씩 보여드려요.' },
  { key: 'pay.f05.title', area: '급여', label: '05 제목', value: '결과 카드' },
  { key: 'pay.f05.body', area: '급여', label: '05 설명',
    value: '내 위치를 카드 이미지로 저장하거나, 링크로 친구한테 보낼 수 있어요.' },

  /* ── 취업 · 이직 ── */
  { key: 'job.eyebrow', area: '취업 · 이직', label: '눈썹', value: '취업 · 이직' },
  { key: 'job.title', area: '취업 · 이직', label: '제목', multiline: true,
    value: '이직 준비 중이시라면\n여기부터 보세요' },
  { key: 'job.dark.lead', area: '취업 · 이직', label: '어두운 카드 — 위', value: '작업치료사 · 물리치료사를 위해' },
  { key: 'job.dark.tail', area: '취업 · 이직', label: '어두운 카드 — 아래', value: '의 자료를 모았어요' },
  { key: 'job.dark.source', area: '취업 · 이직', label: '어두운 카드 — 출처', value: '건강보험심사평가원 기준' },
  { key: 'job.lead', area: '취업 · 이직', label: '설명', multiline: true,
    value: '인력이랑 병상, 진료과목을 병원 한 곳 단위로 다시 묶었습니다.\n치료사한테 필요한 것만 남겼어요.' },
  { key: 'job.f06.title', area: '취업 · 이직', label: '06 제목', value: '병원 뜯어보기' },
  { key: 'job.f06.body', area: '취업 · 이직', label: '06 설명',
    value: '치료사 인원, 병상 수, 재활의학과 전문의까지 한 화면에서 봅니다.' },
  { key: 'job.f07.title', area: '취업 · 이직', label: '07 제목', value: '얼마나 바쁜 곳인지' },
  { key: 'job.f07.body', area: '취업 · 이직', label: '07 설명', multiline: true,
    value: '치료사 한 명이 몇 명을 맡는지, 재활 환자가 많은 병원인지 따져봐요.\n바쁜 곳인지 여유로운 곳인지 알려드립니다.' },
  { key: 'job.f08.title', area: '취업 · 이직', label: '08 제목', value: '두 곳 비교' },
  { key: 'job.f08.body', area: '취업 · 이직', label: '08 설명',
    value: '고민되는 병원 두 곳을 나란히 놓고 봐요. 분점도 다 나옵니다.' },
  { key: 'job.f09.title', area: '취업 · 이직', label: '09 제목', value: '지역별 병원 찾기' },
  { key: 'job.f09.body', area: '취업 · 이직', label: '09 설명', multiline: true,
    value: '내 지역에서 치료사가 일하는 병원 목록입니다.\n공고가 없어도 미리 봐두세요.' },

  /* ── 함께 만듭니다 ── */
  { key: 'together.title', area: '함께 만듭니다', label: '제목', multiline: true,
    value: '한 명이 더 넣을수록\n정확해집니다' },
  { key: 'together.steps', area: '함께 만듭니다', label: '눈금 — 한 줄에 「숫자 | 설명」', multiline: true,
    value: '5명 | 참고만\n30명 | 연차별\n100명 | 지역·유형별\n300명 | 세부 조건까지' },
  { key: 'together.tail', area: '함께 만듭니다', label: '아래 한 줄',
    value: '내가 넣은 숫자 하나가 다음 사람의 기준이 돼요.' },

  /* ── 익명 ── */
  { key: 'anon.title', area: '익명', label: '제목', value: '이름은 안 물어봐요' },
  { key: 'anon.no.title', area: '익명', label: '왼쪽 카드 제목', value: '받지 않는 것' },
  { key: 'anon.no.items', area: '익명', label: '왼쪽 카드 — 한 줄에 하나씩', multiline: true,
    value: '이름 · 연락처 · 이메일\n다니는 병원 이름\n생년월일 · 상세 주소' },
  { key: 'anon.yes.title', area: '익명', label: '오른쪽 카드 제목', value: '받는 것' },
  { key: 'anon.yes.items', area: '익명', label: '오른쪽 카드 — 한 줄에 하나씩', multiline: true,
    value: '닉네임 (본명 아니어도 됩니다)\n권역 · 출생연도\n연차 · 병원유형 · 급여' },

  /* ── 이용 방법 ── */
  { key: 'how.title', area: '이용 방법', label: '제목', value: '3분이면 끝나요' },
  { key: 'how.s1.t', area: '이용 방법', label: '1단계 제목', value: '카카오 · 네이버로 로그인' },
  { key: 'how.s1.d', area: '이용 방법', label: '1단계 설명', value: '이름이나 연락처는 안 넘어옵니다' },
  { key: 'how.s2.t', area: '이용 방법', label: '2단계 제목', value: '내 정보 등록' },
  { key: 'how.s2.d', area: '이용 방법', label: '2단계 설명', value: '연차, 병원유형, 급여. 3분쯤 걸려요' },
  { key: 'how.s3.t', area: '이용 방법', label: '3단계 제목', value: '단톡방 입장' },
  { key: 'how.s3.d', area: '이용 방법', label: '3단계 설명',
    value: '가입하신 분만 들어갑니다. 새 공고를 제일 먼저 받아보세요' },

  /* ── 마지막 CTA ── */
  { key: 'cta.eyebrow', area: '마지막 CTA', label: '눈썹', value: 'POTJOB' },
  { key: 'cta.title', area: '마지막 CTA', label: '제목', multiline: true,
    value: '치료사의 숫자는\n치료사가 만듭니다' },
  { key: 'cta.button', area: '마지막 CTA', label: '단추', value: '지금 시작하기' },
  { key: 'cta.source', area: '마지막 CTA', label: '출처 한 줄', multiline: true,
    value: '건강보험심사평가원 병원 자료, 공공기관 채용공시, 회원이 직접 등록한 급여입니다.\n{min}명이 안 되는 조건은 안 보여드립니다.' },
];

/** 기본값 표. DB 에 값이 없을 때 씁니다 */
export const HOME_TEXT_DEFAULT: Record<string, string> =
  Object.fromEntries(HOME_TEXT.map((r) => [r.key, r.value]));

export type Texts = Record<string, string>;

/** 한 줄 꺼내기. DB → 기본값 순서. {min} 같은 자리는 부르는 쪽이 채웁니다 */
export function tx(m: Texts | undefined, key: string, fill?: Record<string, string | number>): string {
  let v = m?.[key] ?? HOME_TEXT_DEFAULT[key] ?? '';
  if (fill) for (const [k, val] of Object.entries(fill)) v = v.split(`{${k}}`).join(String(val));
  return v;
}

/** 여러 줄짜리를 줄 단위로 (목록에 쓰는 자리) */
export const txLines = (m: Texts | undefined, key: string): string[] =>
  tx(m, key).split('\n').map((s) => s.trim()).filter(Boolean);
