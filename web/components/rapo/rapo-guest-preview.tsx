import { Hit } from '@/components/hit';
import { RapoShell } from './rapo-shell';
import { RapoButton, RapoDivider } from './rapo-ui';

/* 비회원 맛보기 화면 — 커뮤니티 · 교육·학술 · 병원 찾기 (2026-11-13 세중님
   「우리가 채용공고 보여주는 것처럼 만들자. 자세한 내용 보고 싶으면 회원가입」).

   왜 — 네이버·구글은 **로그인 없이 열리는 화면**만 읽습니다. 전에는 이 셋이 로그인으로 넘어가서
   검색 결과의 메뉴 줄(사이트링크)에 「채용공고」 하나만 붙을 수 있었습니다(lib/seo.ts 색인길).

   ★ 진짜 자료를 내려보내지 않습니다. 흐린 줄은 「○○」로 가린 **견본 글자**이고 링크도 없습니다 —
     특히 커뮤니티는 익명으로 쓴 글이라 제목 한 줄도 내보내지 않습니다(CLAUDE.md 목표 2 — 가장 두려운 사고).
     공고 목록의 가입 권유(rapo-job-guest-wall.tsx)와 같은 꼴입니다.
   ★ 소개 글은 **지금 실제로 되는 것만** 적습니다. 숫자는 비회원에게 열린 셈 창구로 받은 것만 씁니다(지어내지 않음). */

type 견본줄 = { 위: string; 제목: string; 아래: string };
export type 맛보기갈래 = 'community' | 'edu' | 'orgs';

const 내용: Record<맛보기갈래, {
  current: string; hit: 'community' | 'orgs' | 'other'; 이름: string; 제목: string; 소개: string; 할수있는것: string[]; 줄: 견본줄[]; 권유: string; 가입말: string;
}> = {
  community: {
    current: '/community', hit: 'community', 이름: '커뮤니티',
    제목: '치료사끼리 묻고 답하는 커뮤니티',
    소개: '물리치료사·작업치료사가 병원 분위기, 급여와 처우, 이직, 임상 고민을 닉네임으로 편하게 나누는 곳이에요.',
    할수있는것: ['직군별(물리치료사·작업치료사)로 글 모아 보기', '병원마다 자유토론과 근무 후기 보기', '궁금한 것을 글로 묻고 댓글로 답하기'],
    줄: [
      { 위: '작업치료사 · ○분 전', 제목: '○○병원 신입 분위기 어떤가요?', 아래: '댓글 ○ · 좋아요 ○' },
      { 위: '물리치료사 · ○시간 전', 제목: '○○ 지역 재활병원 연봉 이 정도면 괜찮나요', 아래: '댓글 ○○ · 좋아요 ○' },
      { 위: '작업치료사 · ○시간 전', 제목: '○○○ 평가 도구 추천 부탁드려요', 아래: '댓글 ○ · 좋아요 ○○' },
      { 위: '물리치료사 · ○일 전', 제목: '○○대학교병원 계약직 면접 후기', 아래: '댓글 ○○ · 좋아요 ○○' },
    ],
    권유: '동료들의 이야기가 이어지고 있어요', 가입말: '가입하면 커뮤니티 글을\n모두 볼 수 있어요!',
  },
  edu: {
    current: '/edu', hit: 'other', 이름: '교육·학술',
    제목: '학회 교육과 학술대회 일정',
    소개: '물리치료·작업치료 학회와 협회의 교육과정, 학술대회 일정을 직군별로 한자리에 모았어요. 신청은 각 학회에서 해요.',
    할수있는것: ['학회·협회별 교육과정과 학술대회 일정 보기', '내 직군에 맞는 교육만 골라 보기', '교육 날짜와 장소를 한눈에 확인하기'],
    줄: [
      { 위: '대한○○○○학회 · 교육과정', 제목: '○○○ 재활 실기 워크숍', 아래: '2026.○○.○○ · ○○' },
      { 위: '한국○○○○협회 · 학술대회', 제목: '2026 ○○ 학술대회', 아래: '2026.○○.○○ · ○○' },
      { 위: '대한○○○○학회 · 교육과정', 제목: '○○○○ 평가와 중재 기초', 아래: '2026.○○.○○ · 온라인' },
      { 위: '○○○ 협회 · 교육과정', 제목: '○○○○ 인증 과정 ○기', 아래: '2026.○○.○○ · ○○' },
    ],
    권유: '교육 일정이 더 있어요', 가입말: '가입하면 교육·학술 일정을\n모두 볼 수 있어요!',
  },
  orgs: {
    current: '/', hit: 'orgs', 이름: '병원 찾기',
    제목: '치료사가 일하는 병원 정보',
    소개: '병원마다 물리치료사·작업치료사 인원, 병상 수, 공시된 연봉, 지난 채용 경쟁률을 공개 자료로 모았어요.',
    할수있는것: ['이름·종별·지역으로 병원 찾기', '병원별 치료사 인원과 병상 수 보기(심평원 신고 자료)', '공공병원 연봉과 지난 채용 경쟁률 보기(알리오 등 공시 자료)'],
    줄: [
      { 위: '상급종합 · 서울 ○○구', 제목: '○○대학교병원', 아래: '물리치료사 ○○명 · 작업치료사 ○○명' },
      { 위: '종합병원 · 경기 ○○시', 제목: '○○○ 의료원', 아래: '물리치료사 ○○명 · 작업치료사 ○명' },
      { 위: '병원 · 부산 ○○구', 제목: '○○ 재활병원', 아래: '물리치료사 ○○명 · 작업치료사 ○○명' },
      { 위: '종합병원 · 대전 ○○구', 제목: '○○○ 병원', 아래: '물리치료사 ○○명 · 작업치료사 ○명' },
    ],
    권유: '병원 정보가 더 있어요', 가입말: '가입하면 병원 정보를\n모두 볼 수 있어요!',
  },
};

export function RapoGuestPreview({ 갈래, 셈 }: { 갈래: 맛보기갈래; 셈?: string | null }) {
  const c = 내용[갈래];
  const 다음 = `/login?next=${encodeURIComponent(c.current === '/' ? '/orgs' : c.current)}`;
  return (
    <RapoShell who="비회원" current={c.current}>
      <Hit kind={c.hit} />
      <section className="flex flex-col gap-(--rapo-dimension-x4) p-(--rapo-dimension-x5)">
        <p className="rapo-type-t4-bold text-(color:--rapo-color-fg-brand-contrast)">{c.이름}</p>
        <h1 className="rapo-type-t11-bold break-keep text-(color:--rapo-color-fg-neutral)">{c.제목}</h1>
        <p className="rapo-type-article-body break-keep text-(color:--rapo-color-fg-neutral)">{c.소개}</p>
        {셈 && <p className="rapo-type-t5-bold text-(color:--rapo-color-fg-neutral)">{셈}</p>}
        <ul className="flex flex-col gap-(--rapo-dimension-x2)">
          {c.할수있는것.map((t) => (
            <li key={t} className="rapo-type-t5-regular flex items-start gap-(--rapo-dimension-x2) text-(color:--rapo-color-fg-neutral)">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d8372b" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="mt-[1px] shrink-0">
                <path d="M5 12.5 10 17.5 19 7" />
              </svg>
              <span className="break-keep">{t}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* 가입 권유 카드는 흐린 줄 위로 **흐름 안에서** 끌어올립니다(-mt). 절대 위치로 두면 글이 길어질 때 카드가 칸 밖으로 잘렸습니다(360 폭) */}
      <section aria-labelledby="rapo-guest-preview" className="relative px-(--rapo-dimension-x5) pb-(--rapo-dimension-x6)">
        {/* 흐린 견본 줄 — 읽는 도구에는 숨기고, 누를 수 없습니다 */}
        <ul aria-hidden className="pointer-events-none flex select-none flex-col blur-[4px]">
          {c.줄.map((j, i) => (
            <li key={i}>
              <RapoDivider />
              <div className="flex flex-col gap-(--rapo-dimension-x1) py-(--rapo-dimension-x4)">
                <span className="rapo-type-t3-regular text-(color:--rapo-color-fg-neutral-muted)">{j.위}</span>
                <span className="rapo-type-t6-bold text-(color:--rapo-color-fg-neutral)">{j.제목}</span>
                <span className="rapo-type-t3-regular text-(color:--rapo-color-fg-neutral-muted)">{j.아래}</span>
              </div>
            </li>
          ))}
        </ul>
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-linear-to-b from-transparent from-30% to-(--rapo-color-bg-layer-default)" />

        <div className="relative -mt-[256px] flex flex-col gap-(--rapo-dimension-x3)
                        rounded-(--rapo-radius-r4) bg-(--rapo-color-bg-layer-default) p-(--rapo-dimension-x6) text-center shadow-(--rapo-shadow-s2)">
          <p className="rapo-type-t4-bold text-(color:--rapo-color-fg-brand-contrast)">{c.권유}</p>
          <h2 id="rapo-guest-preview" className="rapo-type-t8-bold whitespace-pre-line break-keep text-(color:--rapo-color-fg-neutral)">{c.가입말}</h2>
          <RapoButton href={다음} tone="deep-coral" full>무료로 가입하기</RapoButton>
          <p className="rapo-type-t3-regular text-(color:--rapo-color-fg-neutral-muted)">이미 회원이라면 같은 단추로 로그인돼요</p>
        </div>
      </section>
    </RapoShell>
  );
}
