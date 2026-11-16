'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/app/auth';
import { NoticeFiles } from '@/components/notice-files';
import { RapoAppBar } from '@/components/rapo/rapo-me';
import { RapoButton } from '@/components/rapo/rapo-ui';
import { setAfterLogin } from '@/lib/after-login';
import { browserSupabase } from '@/lib/supabase-browser';
import { TERMS_VERSION } from '@/lib/terms';

/* 교육 회차 한 건 — 피그마 「13 · 교육 과정과 회차 신청」 U13 (2026-11-15 세중님 「피그마댓글 대로」).
   원본: 회차 상세 1447:17478 · 신청 완료/입금 확인 중 1447:17608 · 참여 확정 1416:32228 · 후기 작성 가능 1416:32243 · 무료 회차 1416:32350.

   흐름 (DB 가 정합니다 · 금고 SQL_1113/ZQ)
     유료  신청 → 바로 「입금 확인 중」 → 담당자가 입금 확인 → 참여 확정 → 수강 완료 → 후기
     무료  신청 → 「신청 접수」 → 담당자가 확인 → 참여 확정 → 수강 완료 → 후기
   ★ 「내 신청」 상자는 제목 바로 아래에 두고 색으로 강조합니다 (세중님 「내 상태가 더 강조 · 상단」).
   ★ 참여 후기는 신청 단추 **위**에 (세중님 「사람들은 후기를 보고 나서 신청」).
   ★ 계좌는 신청한 사람에게만 — 화면이 가리는 게 아니라 교육회차보기() 가 안 줍니다. 결제는 RAPO 가 받지 않습니다.
   ★ 피그마의 「교육 담당자 문의」 단추는 담당자 연락처 칸이 아직 없어 글로만 안내합니다. */

export type 회차 = {
  회차id: number; 과정id: number; 제목: string; 소개: string | null; 주최: string | null; 직군: string | null; 회차순번: number | null;
  시작: string; 끝: string | null; 장소: string | null;
  정원: number; 확정수: number; 접수시작: string; 접수끝: string;
  수강료: number | null; 상태: string; 환불규정: string | null; 결제링크: string | null;
  내상태: string | null; 리뷰가능: boolean;
  계좌: { 은행: string | null; 계좌번호: string | null; 예금주: string | null; 입금기한: string | null; 입금자명규칙: string | null } | null;
};
export type 리뷰 = { 리뷰id: number; 닉네임: string; 별점: number; 글: string; 쓴때: string; 고친때: string | null; 답글: string | null };

const 요일 = ['일', '월', '화', '수', '목', '금', '토'];
/* 「11.28 (토)」 — 날짜 글자만으로 요일을 셉니다(시간대 영향 없음) */
const 날 = (s: string | null) => { if (!s) return ''; const [y, m, d] = s.split('-').map(Number); const w = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); return `${m}.${String(d).padStart(2, '0')} (${요일[w]})`; };
const 돈 = (n: number | null) => (n == null ? '공고문 확인' : n === 0 ? '무료' : n.toLocaleString('ko-KR') + '원');

/* 내 신청 상자 — 상태마다 색·글 */
const 내상태판: Record<string, { 글: string; 설명: string; 바탕: string; 글색: string; 표: string }> = {
  입금대기: { 글: '입금 확인 중', 설명: '입금·수강 문의는 교육 담당자에게, 서비스 오류는 내 정보의 문의하기로 알려주세요.', 바탕: 'bg-(--rapo-color-bg-informative-weak)', 글색: 'text-(color:--rapo-color-fg-informative)', 표: '◷' },
  신청함: { 글: '신청 접수', 설명: '담당자가 신청을 확인하면 참여가 확정돼요.', 바탕: 'bg-(--rapo-color-bg-informative-weak)', 글색: 'text-(color:--rapo-color-fg-informative)', 표: '◷' },
  참여확정: { 글: '참여 확정', 설명: '교육 일시와 장소를 다시 확인해 주세요.', 바탕: 'bg-(--rapo-color-bg-positive-weak)', 글색: 'text-(color:--rapo-color-fg-positive)', 표: '✓' },
  수강완료: { 글: '참여 완료', 설명: '참여한 회차의 후기를 남길 수 있어요.', 바탕: 'bg-(--rapo-color-bg-positive-weak)', 글색: 'text-(color:--rapo-color-fg-positive)', 표: '✓' },
  미선정: { 글: '미선정', 설명: '이번 회차는 함께하지 못하게 됐어요. 다음 회차를 확인해 주세요.', 바탕: 'bg-(--rapo-color-bg-neutral-weak)', 글색: 'text-(color:--rapo-color-fg-neutral)', 표: '·' },
};

/* 견본 — 미리보기(/design-preview/edu-session)가 DB 없이 그릴 때만 */
export function EduSessionView({ 견본 }: { 견본?: { s: 회차; 리뷰들: 리뷰[] } }) {
  const { id } = useParams<{ id: string }>();
  const 회차번호 = Number(id);
  const auth = useAuth();
  const loading = 견본 ? false : auth.loading;
  const session = 견본 ? ({} as typeof auth.session) : auth.session;
  const [s, setS] = useState<회차 | null>(견본?.s ?? null);
  const [리뷰들, set리뷰들] = useState<리뷰[]>(견본?.리뷰들 ?? []);
  const [탈, set탈] = useState<string | null>(null);
  const [다시, set다시] = useState(0);
  const [확인, set확인] = useState(false);
  const [제공동의, set제공동의] = useState(false);
  const [쓰기, set쓰기] = useState(false);
  const [별점, set별점] = useState(0);
  const [리뷰글, set리뷰글] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (견본 || !Number.isFinite(회차번호)) return;
    let 살아있나 = true;
    const sb = browserSupabase();
    Promise.all([sb.rpc('교육회차보기', { p_회차: 회차번호 }), sb.rpc('교육회차리뷰', { p_회차: 회차번호 })]).then(([a, b]) => {
      if (!살아있나) return;
      if (a.error) { set탈(a.error.message); return; }
      setS(a.data as 회차);
      if (!b.error) set리뷰들((b.data ?? []) as 리뷰[]);
    });
    return () => { 살아있나 = false; };
  }, [회차번호, 다시, 견본]);

  if (loading || !s) {
    return (
      <div data-rapo className="mx-auto min-h-dvh w-full max-w-3xl bg-(--rapo-color-bg-layer-default)">
        <RapoAppBar title="교육" back="/edu" />
        <p className="rapo-type-t4-regular px-(--rapo-dimension-x5) pt-(--rapo-dimension-x6) text-(color:--rapo-color-fg-neutral-muted)">{탈 ? `불러오지 못했어요 — ${탈}` : '잠시만요…'}</p>
      </div>
    );
  }

  const 부르기 = async (fn: string, 인수: Record<string, unknown>) => {
    setBusy(true);
    const { error } = await browserSupabase().rpc(fn, 인수);
    setBusy(false);
    if (error) { set탈(error.message); return false; }
    set탈(null); set다시((n) => n + 1);
    return true;
  };

  const 유료 = (s.수강료 ?? 0) > 0;
  const 판 = s.내상태 ? 내상태판[s.내상태] : null;
  const 모집글 = s.상태 === '모집중' ? '모집 중' : s.상태 === '마감' ? '모집 마감' : '모집 종료';
  const 평균 = 리뷰들.length ? 리뷰들.reduce((t, r) => t + r.별점, 0) / 리뷰들.length : 0;

  return (
    <div data-rapo className="mx-auto min-h-dvh w-full max-w-3xl bg-(--rapo-color-bg-layer-default)">
      <RapoAppBar title="교육" back="/edu" />
      <main className="flex flex-col gap-(--rapo-dimension-x5) px-(--rapo-dimension-x5) pb-[calc(96px+env(safe-area-inset-bottom))] pt-(--rapo-dimension-x4)">
        <header className="flex flex-col gap-(--rapo-dimension-x2)">
          <p className="rapo-type-t3-bold text-(color:--rapo-color-fg-neutral-muted)">{s.내상태 === '입금대기' || s.내상태 === '신청함' ? '신청 접수 완료' : 모집글}</p>
          <h1 className="rapo-type-t11-bold break-keep text-(color:--rapo-brand-color-navy)">{s.제목}</h1>
          <p className="rapo-type-t5-bold break-keep text-(color:--rapo-color-fg-neutral)">{s.주최 ?? '교육 기관'}{s.회차순번 ? <>&nbsp;&nbsp;/&nbsp;&nbsp;{s.회차순번}회차</> : null}</p>
          {s.직군 && <p className="rapo-type-t3-regular text-(color:--rapo-color-fg-neutral-muted)">{s.직군 === '공통' ? '물리·작업치료사 대상' : `${s.직군} 대상`}</p>}
        </header>

        {탈 && <p role="alert" className="rapo-type-t4-regular rounded-(--rapo-radius-r2) bg-(--rapo-color-bg-critical-weak) p-(--rapo-dimension-x4) text-(color:--rapo-color-fg-critical)">{탈}</p>}

        {/* 내 신청 — 위에 · 강조 */}
        {판 && (
          <section className={'flex flex-col gap-(--rapo-dimension-x2) rounded-(--rapo-radius-r4) p-(--rapo-dimension-x5) ' + 판.바탕}>
            <p className="rapo-type-t3-regular text-(color:--rapo-color-fg-neutral-muted)">내 신청</p>
            <p className={'rapo-type-t9-bold flex items-center gap-(--rapo-dimension-x2) ' + 판.글색}><span aria-hidden>{판.표}</span>{판.글}</p>
            <p className="rapo-type-t4-regular break-keep text-(color:--rapo-color-fg-neutral)">{판.설명}</p>
            {s.리뷰가능 && !쓰기 && <div className="pt-(--rapo-dimension-x2)"><RapoButton full tone="deep-coral" onClick={() => set쓰기(true)}>후기 쓰기</RapoButton></div>}
          </section>
        )}

        {s.소개 && (
          <section className="flex flex-col gap-(--rapo-dimension-x2)">
            <h2 className="rapo-type-t6-bold text-(color:--rapo-color-fg-neutral)">교육 소개</h2>
            <p className="rapo-type-t5-regular whitespace-pre-line break-keep text-(color:--rapo-color-fg-neutral)">{s.소개}</p>
          </section>
        )}

        <dl className="flex flex-col gap-(--rapo-dimension-x4) rounded-(--rapo-radius-r4) bg-(--rapo-color-bg-neutral-weak) p-(--rapo-dimension-x5)">
          {([['교육 일시', `${날(s.시작)}${s.끝 && s.끝 !== s.시작 ? ` – ${날(s.끝)}` : ''}`], ['장소', s.장소 ?? '공고문 확인'], ['수강료', 돈(s.수강료)], ['정원', `${s.정원}명`]] as const).map(([k, v]) => (
            <div key={k} className="flex gap-(--rapo-dimension-x4)">
              <dt className="rapo-type-t4-regular w-[72px] shrink-0 text-(color:--rapo-color-fg-neutral-muted)">{k}</dt>
              <dd className="rapo-type-t5-bold min-w-0 break-keep text-(color:--rapo-color-fg-neutral)">{v}</dd>
            </div>
          ))}
        </dl>

        {!판 && (
          <section className="flex flex-col gap-(--rapo-dimension-x1) rounded-(--rapo-radius-r4) bg-(--rapo-color-bg-informative-weak) p-(--rapo-dimension-x5)">
            <p className="rapo-type-t3-regular text-(color:--rapo-color-fg-neutral-muted)">접수 안내</p>
            <p className="rapo-type-t9-bold text-(color:--rapo-color-fg-informative)">{모집글}</p>
            <p className="rapo-type-t4-regular break-keep text-(color:--rapo-color-fg-neutral)">
              {s.상태 === '모집중' ? `접수 ${날(s.접수시작)} – ${날(s.접수끝)} · 회차 정보와 환불 규정을 확인해 주세요.` : '이 회차는 신청을 받지 않아요.'}
            </p>
          </section>
        )}

        {s.계좌 && 유료 && s.내상태 === '입금대기' && (
          <section className="flex flex-col gap-(--rapo-dimension-x3) rounded-(--rapo-radius-r4) border-(length:--rapo-border-default) border-(color:--rapo-color-stroke-neutral-weak) p-(--rapo-dimension-x5)">
            <h2 className="rapo-type-t6-bold text-(color:--rapo-color-fg-neutral)">입금 안내</h2>
            <p className="rapo-type-t5-bold break-all text-(color:--rapo-color-fg-neutral)">{s.계좌.은행} {s.계좌.계좌번호} ({s.계좌.예금주})</p>
            <p className="rapo-type-t4-regular text-(color:--rapo-color-fg-neutral-muted)">입금 기한 {s.계좌.입금기한 ? 날(s.계좌.입금기한) : '공고문 확인'} · 입금자명 {s.계좌.입금자명규칙 ?? '이름 그대로'}</p>
            {s.결제링크 && <a href={s.결제링크} target="_blank" rel="noopener noreferrer" className="rapo-type-t4-bold text-(color:--rapo-color-fg-brand-contrast)">기관 결제 링크 ›</a>}
            <p className="rapo-type-t3-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">결제와 환불은 교육 기관과 신청자 사이의 일이며 RAPO 는 결제에 관여하지 않아요.</p>
          </section>
        )}

        {s.환불규정 && (
          <section className="flex flex-col gap-(--rapo-dimension-x2) rounded-(--rapo-radius-r4) bg-(--rapo-color-bg-neutral-weak) p-(--rapo-dimension-x5)">
            <h2 className="rapo-type-t5-bold text-(color:--rapo-color-fg-neutral)">환불 규정</h2>
            <p className="rapo-type-t4-regular whitespace-pre-line break-keep text-(color:--rapo-color-fg-neutral-muted)">{s.환불규정}</p>
          </section>
        )}

        <NoticeFiles 갈래="교육" 회차={s.회차id} 고칠수있나={false} />

        {/* 후기 쓰기 — 수강 완료한 사람만 (DB 가 정함) */}
        {쓰기 && s.리뷰가능 && (
          <section className="flex flex-col gap-(--rapo-dimension-x3) rounded-(--rapo-radius-r4) border-(length:--rapo-border-default) border-(color:--rapo-color-stroke-neutral-weak) p-(--rapo-dimension-x5)">
            <h2 className="rapo-type-t6-bold text-(color:--rapo-color-fg-neutral)">참여 후기</h2>
            <div className="flex gap-(--rapo-dimension-x2)" role="radiogroup" aria-label="별점">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" role="radio" aria-checked={별점 === n} aria-label={`${n}점`} onClick={() => set별점(n)}
                  className="flex size-[36px] items-center justify-center text-[28px] leading-none text-(color:--rapo-color-fg-brand-contrast)">{n <= 별점 ? '★' : '☆'}</button>
              ))}
            </div>
            <textarea value={리뷰글} onChange={(e) => set리뷰글(e.target.value.slice(0, 1000))} rows={4} aria-label="후기"
              placeholder="실습 내용, 강의 방식이 어땠는지 적어 주세요."
              className="rapo-type-t5-regular w-full rounded-(--rapo-radius-r3) bg-(--rapo-color-bg-neutral-weak) p-(--rapo-dimension-x4) text-(color:--rapo-color-fg-neutral)" />
            <RapoButton full disabled={!별점 || !리뷰글.trim() || busy}
              onClick={async () => { if (await 부르기('교육리뷰쓰기', { p_회차: s.회차id, p_별점: 별점, p_글: 리뷰글.trim() })) { set쓰기(false); set리뷰글(''); } }}>
              {busy ? '등록하는 중…' : '후기 등록'}
            </RapoButton>
          </section>
        )}

        {/* 참여 후기 — 신청 단추 위 */}
        <section className="flex flex-col gap-(--rapo-dimension-x3)">
          <h2 className="rapo-type-t8-bold text-(color:--rapo-color-fg-neutral)">참여 후기 {리뷰들.length}개</h2>
          {리뷰들.length === 0 ? (
            <p className="rapo-type-t4-regular text-(color:--rapo-color-fg-neutral-muted)">아직 이 회차에 등록된 후기가 없어요.</p>
          ) : (
            <>
              <p className="rapo-type-t6-bold text-(color:--rapo-color-fg-brand-contrast)"><span aria-hidden>{'★'.repeat(Math.round(평균))}</span>&nbsp;&nbsp;{평균.toFixed(1)}</p>
              <ul className="flex flex-col gap-(--rapo-dimension-x4)">
                {리뷰들.map((r) => (
                  <li key={r.리뷰id} className="flex flex-col gap-(--rapo-dimension-x2)">
                    <p className="rapo-type-t3-regular text-(color:--rapo-color-fg-neutral-muted)">{r.닉네임} · {'★'.repeat(r.별점)}{r.고친때 ? ' · 고침' : ''}</p>
                    <p className="rapo-type-t5-regular whitespace-pre-line break-keep text-(color:--rapo-color-fg-neutral)">{r.글}</p>
                    {r.답글 && (
                      <div className="rounded-(--rapo-radius-r3) bg-(--rapo-color-bg-neutral-weak) p-(--rapo-dimension-x4)">
                        <p className="rapo-type-t3-bold text-(color:--rapo-color-fg-neutral)">{s.주최 ?? '주최'} · 주최 측 답글</p>
                        <p className="rapo-type-t4-regular mt-(--rapo-dimension-x1) whitespace-pre-line break-keep text-(color:--rapo-color-fg-neutral-muted)">{r.답글}</p>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </main>

      {/* 아래 고정 — 신청하기 (모집 중 · 아직 신청 안 함) */}
      {!s.내상태 && s.상태 === '모집중' && (
        <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-3xl bg-(--rapo-color-bg-layer-default) px-(--rapo-dimension-x5) pt-(--rapo-dimension-x2) pb-[calc(var(--rapo-dimension-x4)+env(safe-area-inset-bottom))]">
          {session
            ? <RapoButton full tone="deep-coral" onClick={() => set확인(true)}>신청하기</RapoButton>
            : <RapoButton full tone="deep-coral" onClick={() => { setAfterLogin(location.pathname); location.href = '/login'; }}>로그인하고 신청하기</RapoButton>}
        </div>
      )}

      {/* 신청 확인 — 원본 U13 · 신청 확인 1447:17523 / 무료 회차 신청 확인 1416:32350 */}
      {확인 && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label="신청 확인">
          <button type="button" aria-label="닫기" onClick={() => set확인(false)} className="absolute inset-0 cursor-default bg-black/50" />
          <div className="relative flex w-full max-w-[420px] flex-col gap-(--rapo-dimension-x3) rounded-t-(--rapo-radius-r4) bg-(--rapo-color-bg-layer-default) px-(--rapo-dimension-x5) pt-(--rapo-dimension-x6) pb-[calc(var(--rapo-dimension-x5)+env(safe-area-inset-bottom))] sm:rounded-(--rapo-radius-r4)">
            <p className="rapo-type-t8-bold text-(color:--rapo-brand-color-navy)">이 회차를 신청할까요?</p>
            <p className="rapo-type-t4-regular break-keep text-(color:--rapo-color-fg-neutral)">
              {유료 ? `수강료 ${돈(s.수강료)} · 신청하면 입금 안내가 보이고, 담당자가 입금을 확인하면 참여가 확정돼요.` : '무료 교육이에요. 담당자가 신청을 확인하면 참여가 확정돼요.'}
            </p>
            {s.환불규정 && 유료 && <p className="rapo-type-t3-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">환불 규정 · {s.환불규정.split('\n')[0]}</p>}
            {/* 2026-11-16 약관 확정 — 수강 계약은 회원과 교육담당자 사이 · 담당자에게 닉네임과 신청 상태가 보임(처리방침 8항 · 신청 화면에서 동의) */}
            <p className="rapo-type-t3-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">
              이 교육은 {s.주최 ?? '교육담당자'}가 열어요. 수강 계약과 환불은 교육담당자와 직접 하고, 라포는 수강료를 받지 않아요.
            </p>
            <label className="flex cursor-pointer items-start gap-(--rapo-dimension-x2)">
              <input type="checkbox" checked={제공동의} onChange={(e) => set제공동의(e.target.checked)} className="mt-[2px] size-[18px] shrink-0" />
              <span className="rapo-type-t3-regular break-keep text-(color:--rapo-color-fg-neutral)">
                신청을 받기 위해 교육담당자에게 내 닉네임과 신청·입금 확인 상태가 보여요. 교육이 끝난 뒤 1년까지 보관해요. (필수)
              </span>
            </label>
            <RapoButton full tone="deep-coral" disabled={busy || !제공동의}
              onClick={async () => {
                await browserSupabase().rpc('동의남기기', { p_판: TERMS_VERSION, p_문서들: { edu_provide: true } });
                if (await 부르기('교육신청하기', { p_회차: s.회차id })) set확인(false);
              }}>{busy ? '신청하는 중…' : '동의하고 신청하기'}</RapoButton>
            <button type="button" onClick={() => set확인(false)} className="rapo-type-t5-medium py-(--rapo-dimension-x2) text-(color:--rapo-color-fg-neutral)">취소</button>
            <p className="rapo-type-t3-regular text-center text-(color:--rapo-color-fg-neutral-muted)"><Link href="/me/edu" className="underline underline-offset-2">내 교육 관리</Link>에서 신청한 회차를 다시 볼 수 있어요.</p>
          </div>
        </div>
      )}
    </div>
  );
}
