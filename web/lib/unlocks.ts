/* 「채우면 이런 게 열려요」.

   지어낸 문구가 아니라 옛 화면(index.html 2945~2966줄, pane-unlock)의
   「로그인하면 할 수 있는 것」 10줄을 그대로 옮긴 것입니다.

   다만 옛 앱에 있고 여기엔 아직 없는 것이 섞여 있습니다.
   없는 것을 열린다고 하면 가입하고 나서 속았다고 느낍니다 —
   그래서 지금 되는 것만 앞에 두고 나머지는 soon 으로 밝힙니다. */

export type Unlock = { emoji: string; title: string; desc: string; soon?: boolean };

export const UNLOCKS: Unlock[] = [
  { emoji: '📊', title: '내 연봉이 어디쯤인지',
    desc: '같은 직군·연차·병원유형에서 상위 몇 %인지 숫자로 나와요', soon: true },
  { emoji: '📈', title: '이직하면 얼마나 오를지',
    desc: '병원유형과 지역을 바꿨을 때 중위값 차이를 월·연 단위로', soon: true },
  { emoji: '⏱️', title: '진짜 시급',
    desc: '당직과 주말까지 넣어 계산해요. 월급은 높은데 시급은 낮은 경우가 드러나요', soon: true },
  { emoji: '📢', title: '실시간 채용공고',
    desc: '전국 채용사이트에서 공고를 자동으로 모아요. 마감 지난 건 안 올려요' },
  { emoji: '⭐', title: '담아둔 공고',
    desc: '관심 있는 공고를 담아두고 한자리에서 볼 수 있어요' },
  { emoji: '💬', title: 'POT 커뮤니티',
    desc: '급여를 등록한 치료사끼리만 묻고 답해요' },
  { emoji: '🏥', title: '병원 찾기·비교',
    desc: '전국 병원의 치료사 인원·병상·전문의 수를 나란히 놓고 봐요' },
  { emoji: '🗓️', title: '채용 캘린더',
    desc: '언제부터 언제까지 접수하는지 달력으로. 작년 이맘때 어디서 뽑았는지도', soon: true },
  { emoji: '🧮', title: '계산기 넷',
    desc: '세전↔세후 · 퇴직금 · 연차 · 실업급여', soon: true },
];

/* 칸을 채우는 중에 짧게 띄우는 말.
   「이 칸이 왜 필요한가」에 한 줄로 답하는 자리입니다 */
export const FIELD_HINT: Record<string, string> = {
  hired_year: '연차가 같은 사람끼리 비교해야 순위가 뜻이 있어요',
  region: '지역을 바꿨을 때 얼마나 차이 나는지 볼 수 있어요',
  hospital_type: '같은 유형끼리 비교해요. 요양병원과 대학병원을 섞으면 뜻이 없어요',
  net_monthly: '내 연봉이 몇 등인지 볼 수 있어요',
  bonus_yearly: '상여를 빠뜨리면 실제보다 낮게 나와요',
  duty_count: '당직·주말을 넣어야 진짜 시급이 나와요',
  birth_year: '또래끼리 비교해서 볼 수 있어요',
  school_type: '같은 과정을 나온 사람끼리 비교해요',
  gpa: '합격한 선배들 학점이 몇 점이었는지 볼 수 있어요',
  licenses: '어떤 자격증이 실제로 도움이 됐는지 보여요',
  want_type: '희망 지역·유형에 맞는 공고를 먼저 보여드려요',
  career: '경력이 쌓이면 얼마나 오르는지 선이 그려져요',
  practice: '어디서 실습한 사람이 어디로 갔는지 보여요',
};

/* 화면에 계속 붙여 둡니다. 안 밝히면 아무도 안 적습니다.
   「아무도 못 본다」고 쓰면 거짓말입니다 — 관리자는 볼 수 있습니다(RLS: 급여는 관리자도) */
export const PRIVACY_LINE =
  '급여는 통계로만 씁니다. 다른 회원에게는 누가 얼마 받는지 안 보여요';
