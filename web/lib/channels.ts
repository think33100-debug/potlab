/* 커뮤니티 방. gas/wage.js 의 CHANNELS 를 그대로 옮겼습니다 (17702줄).

   학생과 치료사는 관심사가 다릅니다.
   한 곳에 섞으면 학생은 연봉·이직 글만 보이고, 치료사는 시험 글만 보입니다.

   여기 id 가 posts.channel 에 그대로 들어갑니다. 옛 시트 글을 옮겨올 때
   이름이 같아야 하므로 id 를 바꾸지 마세요. */

export type ChannelFor = 'all' | 'pro' | 'stu';

export type Channel = { id: string; name: string; desc: string; for: ChannelFor };

export const CHANNELS: Channel[] = [
  /* ── 둘 다 ── */
  { id: 'free',   name: '자유',        desc: '아무 이야기',              for: 'all' },
  { id: 'life',   name: '인생고민',    desc: '일 말고 사는 이야기',       for: 'all' },
  { id: 'love',   name: '연애',        desc: '썸 · 연애 · 결혼',          for: 'all' },
  /* 보수교육·학회·자격증 과정을 듣고 온 이야기.
     치료사 전용 「자격증·교육」 과 달리 실제로 들어본 교육이 어땠는지 나누는 곳입니다 */
  { id: 'edurv',  name: '교육 후기',   desc: '들어본 교육이 어땠는지',    for: 'all' },

  /* ── 치료사 ── */
  { id: 'clinic', name: '임상',        desc: '치료 · 평가 · 도구',        for: 'pro' },
  { id: 'pay',    name: '급여·처우',   desc: '연봉 · 수당 · 복지',        for: 'pro' },
  { id: 'move',   name: '이직',        desc: '어디로 갈까',              for: 'pro' },
  { id: 'itv',    name: '면접후기',    desc: '이런 걸 물어봤어요',        for: 'pro' },
  { id: 'cert',   name: '자격증·교육', desc: '뭐가 도움 됐는지',          for: 'pro' },
  { id: 'biz',    name: '개원·창업',   desc: '센터 차리기',              for: 'pro' },

  /* ── 학생 ── */
  { id: 'exam',   name: '국가고시',    desc: '공부법 · 기출 · 일정',      for: 'stu' },
  { id: 'prac',   name: '실습',        desc: '어디로 갔는지 · 뭘 했는지', for: 'stu' },
  { id: 'grade',  name: '학점·과제',   desc: '시험 · 조별과제 · 교수님',  for: 'stu' },
  { id: 'first',  name: '첫직장',      desc: '어디로 갈지 · 뭘 봐야 할지', for: 'stu' },
  { id: 'campus', name: '학교생활',    desc: '동아리 · 알바 · 자취',      for: 'stu' },
  { id: 'path',   name: '진로고민',    desc: '아동 갈까 성인 갈까',       for: 'stu' },
];

export const CHANNEL_BY_ID = Object.fromEntries(CHANNELS.map((c) => [c.id, c]));

export const channelName = (id: string | null) =>
  (id && CHANNEL_BY_ID[id]?.name) || id || '';

/* 그 사람에게 보일 방만 골라냅니다.
   옛 코드가 String(role||'')==='학생' 로 갈랐으므로, 비어 있으면 현직으로 봅니다 */
export function channelsFor(role: string | null | undefined): Channel[] {
  const stu = String(role ?? '') === '학생';
  return CHANNELS.filter((c) => c.for === 'all' || c.for === (stu ? 'stu' : 'pro'));
}

export const GROUPS: { title: string; for: ChannelFor }[] = [
  { title: '둘 다', for: 'all' },
  { title: '치료사', for: 'pro' },
  { title: '학생', for: 'stu' },
];
