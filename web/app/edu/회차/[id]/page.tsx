'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/app/auth';
import { browserSupabase } from '@/lib/supabase-browser';

/* 교육 회차 한 건 (2026-10-09 · 뼈대 5절).
 *
 * ── 계좌는 신청한 뒤에 보입니다 ──────────────────────────────
 * 교육회차보기() 가 부른 사람을 보고 계좌 칸을 넣거나 뺍니다.
 * 화면이 가리는 게 아니라 **창구가 안 줍니다.**
 *
 * ── 결제는 POTJOB 이 안 받습니다 ─────────────────────────────
 * 계좌 안내만 전합니다. 그 말을 화면에 적어 둡니다 (home_texts 의 edu.pay).
 */

type 회차 = {
  회차id: number; 과정id: number; 제목: string;
  시작: string; 끝: string | null; 장소: string | null;
  정원: number; 확정수: number; 접수시작: string; 접수끝: string;
  수강료: number | null; 상태: string; 환불규정: string; 결제링크: string | null;
  내상태: string | null; 리뷰가능: boolean;
  계좌: { 은행: string | null; 계좌번호: string | null; 예금주: string | null;
          입금기한: string | null; 입금자명규칙: string | null } | null;
};
type 리뷰 = {
  리뷰id: number; 닉네임: string; 별점: number; 글: string;
  쓴때: string; 고친때: string | null; 답글: string | null; 답글쓴때: string | null;
};

const 날 = (s: string | null) => (!s ? '' : s.replace(/^\d{4}-/, '').replace('-', '월 ') + '일');
const 돈 = (n: number | null) => (n == null ? '안 적힘' : n.toLocaleString('ko-KR') + '원');

export default function EduSession() {
  const { id } = useParams<{ id: string }>();
  const 회차번호 = Number(id);
  const { loading, session } = useAuth();
  const [s, setS] = useState<회차 | null>(null);
  const [리뷰들, set리뷰들] = useState<리뷰[]>([]);
  const [탈, set탈] = useState<string | null>(null);
  const [다시, set다시] = useState(0);
  const [별점, set별점] = useState(5);
  const [리뷰글, set리뷰글] = useState('');

  useEffect(() => {
    if (!Number.isFinite(회차번호)) return;
    let 살아있나 = true;
    const sb = browserSupabase();
    Promise.all([
      sb.rpc('교육회차보기', { p_회차: 회차번호 }),
      sb.rpc('교육회차리뷰', { p_회차: 회차번호 }),
    ]).then(([a, b]) => {
      if (!살아있나) return;
      if (a.error) { set탈(a.error.message); return; }
      setS(a.data as 회차);
      if (!b.error) set리뷰들((b.data ?? []) as 리뷰[]);
    });
    return () => { 살아있나 = false; };
  }, [회차번호, 다시]);

  if (loading || !s) {
    return <main className="mx-auto w-full max-w-2xl px-6 py-8"><p className="text-lg text-mute">잠시만요…</p></main>;
  }

  const 부르기 = async (fn: string, 인수: Record<string, unknown>) => {
    const { error } = await browserSupabase().rpc(fn, 인수);
    if (error) { set탈(error.message); return; }
    set탈(null);
    set다시((n) => n + 1);
  };

  /* 「지금 후기를 쓸 수 있나」는 **DB 가 정합니다** (교육회차보기 의 리뷰가능).
     화면이 날짜를 만들면 그릴 때마다 값이 달라지고 규칙이 두 벌이 됩니다 */
  const 리뷰가능 = s.리뷰가능 === true;

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-8 pb-[88px] md:px-7 md:pb-8">
      <Link href="/edu" className="text-lg text-interaction-blue hover:underline">← 교육·학술</Link>

      <h1 className="mt-5 break-keep text-h1 font-bold">{s.제목}</h1>
      <p className="mt-2 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-gray-100 px-3 py-1 text-[13px] dark:bg-gray-800">{s.상태}</span>
        <span className="text-lg text-mute">
          {날(s.시작)}{s.끝 && s.끝 !== s.시작 ? ` ~ ${날(s.끝)}` : ''} · {s.장소 ?? '장소 안 적힘'}
        </span>
      </p>

      {탈 && <p className="mt-4 rounded-sm border border-brand-red p-4 text-lg text-brand-red-dark">{탈}</p>}

      <section className="mt-6 rounded-sm border border-gray-200 p-5">
        <dl className="space-y-2 text-lg">
          <div className="flex gap-3"><dt className="w-24 shrink-0 text-mute">정원</dt>
            <dd><b className="num">{s.확정수}</b> / {s.정원}명</dd></div>
          <div className="flex gap-3"><dt className="w-24 shrink-0 text-mute">접수</dt>
            <dd>{날(s.접수시작)} ~ {날(s.접수끝)}</dd></div>
          <div className="flex gap-3"><dt className="w-24 shrink-0 text-mute">수강료</dt>
            <dd>{돈(s.수강료)}</dd></div>
          {s.내상태 && (
            <div className="flex gap-3"><dt className="w-24 shrink-0 text-mute">내 신청</dt>
              <dd><b>{s.내상태}</b></dd></div>
          )}
        </dl>
      </section>

      {s.계좌 ? (
        <section className="mt-5 rounded-sm border border-warning p-5">
          <p className="text-lg font-bold">입금 안내</p>
          <dl className="mt-3 space-y-2 text-lg">
            <div className="flex gap-3"><dt className="w-24 shrink-0 text-mute">계좌</dt>
              <dd>{s.계좌.은행} {s.계좌.계좌번호} ({s.계좌.예금주})</dd></div>
            <div className="flex gap-3"><dt className="w-24 shrink-0 text-mute">입금 기한</dt>
              <dd>{s.계좌.입금기한 ? 날(s.계좌.입금기한) : '안 적힘'}</dd></div>
            <div className="flex gap-3"><dt className="w-24 shrink-0 text-mute">입금자명</dt>
              <dd>{s.계좌.입금자명규칙 ?? '이름 그대로'}</dd></div>
          </dl>
          <p className="mt-4 break-keep text-lg text-mute">
            결제와 환불은 교육 기관과 신청자 사이의 일이며 POTJOB 은 결제에 관여하지 않습니다.
          </p>
        </section>
      ) : session && (
        <p className="mt-5 break-keep text-lg text-mute">계좌는 신청하시면 보여드려요.</p>
      )}

      <section className="mt-5 rounded-sm border border-gray-200 p-5">
        <p className="text-lg font-bold">환불 규정</p>
        <p className="mt-2 whitespace-pre-line break-keep text-lg">{s.환불규정}</p>
      </section>

      <div className="mt-6 flex flex-wrap gap-2">
        {!session && (
          <Link href="/login" className="rounded-md bg-brand-red px-6 py-4 text-btn font-bold text-white
                                         hover:bg-brand-red-dark">로그인하고 신청</Link>
        )}
        {session && !s.내상태 && s.상태 === '모집중' && (
          <button type="button" onClick={() => 부르기('교육신청하기', { p_회차: s.회차id })}
            className="rounded-md bg-brand-red px-6 py-4 text-btn font-bold text-white hover:bg-brand-red-dark">
            신청하기
          </button>
        )}
        {session && s.내상태 && s.내상태 !== '미선정' && (
          <button type="button" onClick={() => 부르기('교육입금눌렀어요', { p_회차: s.회차id })}
            className="rounded-md border border-gray-200 px-6 py-4 text-lg text-gray-600 hover:bg-gray-50">
            입금했어요
          </button>
        )}
        {s.결제링크 && (
          <a href={s.결제링크} target="_blank" rel="noopener noreferrer"
            className="rounded-md border border-gray-200 px-6 py-4 text-lg text-gray-600 hover:bg-gray-50">
            기관 결제 링크
          </a>
        )}
      </div>

      <section className="mt-9">
        <h2 className="text-h3 font-bold">후기 {리뷰들.length}개</h2>

        {session && (리뷰가능 ? (
          <div className="mt-4 rounded-sm border border-gray-200 p-5">
            <div className="flex flex-wrap items-center gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" onClick={() => set별점(n)}
                  className={'rounded-full px-4 py-2 text-lg ' +
                    (별점 === n ? 'bg-[#14181C] text-white' : 'border border-gray-200 text-gray-600')}>
                  {n}
                </button>
              ))}
            </div>
            <textarea value={리뷰글} onChange={(e) => set리뷰글(e.target.value)}
              rows={3} placeholder="어땠는지 적어 주세요"
              className="mt-3 w-full rounded-sm border border-gray-200 px-5 py-3 text-lg" />
            <button type="button"
              onClick={() => 부르기('교육리뷰쓰기', { p_회차: s.회차id, p_별점: 별점, p_글: 리뷰글 })}
              className="mt-3 rounded-md bg-brand-red px-6 py-3 text-lg font-bold text-white
                         hover:bg-brand-red-dark">
              후기 남기기
            </button>
          </div>
        ) : s.내상태 === '참여확정' ? (
          <p className="mt-3 break-keep text-lg text-mute">
            후기는 첫날 오전 8시부터 쓰실 수 있어요.
          </p>
        ) : null)}

        {리뷰들.length === 0
          ? <p className="mt-4 break-keep text-lg text-mute">아직 후기가 없어요.</p>
          : (
            <ul className="mt-4 space-y-3">
              {리뷰들.map((r) => (
                <li key={r.리뷰id} className="rounded-sm border border-gray-200 p-5">
                  <p className="flex flex-wrap items-center gap-2">
                    <b className="text-lg">{'★'.repeat(r.별점)}</b>
                    <span className="text-lg">{r.닉네임}</span>
                    {r.고친때 && <span className="text-sm text-mute">고침</span>}
                  </p>
                  <p className="mt-2 whitespace-pre-line break-keep text-lg">{r.글}</p>
                  {r.답글 && (
                    <div className="mt-3 rounded-sm bg-gray-50 p-4 dark:bg-gray-900">
                      <p className="text-sm text-mute">주최측 답글</p>
                      <p className="mt-1 whitespace-pre-line break-keep text-lg">{r.답글}</p>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
      </section>
    </main>
  );
}
