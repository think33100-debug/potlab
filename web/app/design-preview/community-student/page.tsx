import { notFound } from 'next/navigation';
import { StudentSpaceView } from '@/components/rapo/rapo-student-space';
import type { 직군탭값 } from '@/components/rapo/rapo-community';

/* 학생·취준생 공간 미리보기 (2026-11-15 · 피그마 1649:5467) — 개발 서버에서만. 견본 글(실제 글 아님) */
export default function DesignPreviewStudent() {
  if (process.env.NODE_ENV === 'production') notFound();
  const 사람 = (n: string) => ({ nickname: n, avatar: '🦦|#FED7AA', erased_at: null });
  return (
    <StudentSpaceView 탭="전체" 정렬="new" 주소={(t: 직군탭값) => `?job=${t}`} 학생 탈={false}
      보일글={[
        { id: 1, title: '첫 면접에서 연봉은 언제 물어보셨어요?', body: '공고에는 회사 내규라고만 적혀 있어요. 마지막에 궁금한 점 있냐고 하실 때 여쭤봐도 괜찮을까요?',
          created_at: new Date(Date.now() - 5 * 60_000).toISOString(), comment_count: 2, 글쓴이: 사람('차분한 수달'), job_group: '첫직장',
          댓글: { 글쓴이: 사람('씩씩한 여우'), body: '저는 근무 조건 설명하실 때 같이 물어봤어요.' } },
        { id: 2, title: '첫 실습 가방에 뭘 챙겨 가세요?', body: '학교 안내문엔 실습복이랑 명찰만 적혀 있네요. 다녀오신 분들, 챙겨 가서 잘 쓴 게 있나요?',
          created_at: new Date(Date.now() - 12 * 60_000).toISOString(), comment_count: 2, 글쓴이: 사람('씩씩한 여우'), job_group: '학교생활',
          댓글: { 글쓴이: 사람('차분한 수달'), body: '비밀 댓글입니다.' } },
      ]} />
  );
}
