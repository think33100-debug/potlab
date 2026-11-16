'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth';
import { browserSupabase } from '@/lib/supabase-browser';
import { RapoPageFrame, RapoWait, 틀 } from '@/components/rapo/rapo-frame';

/* 재직 인증 신청 — 치료사 본인이 올립니다 (2026-10-09 · 뼈대 ⑪).
 *
 * ── 확인하면 파일을 바로 지웁니다 ────────────────────────────
 * 담당자 인증 자료와 다릅니다. 그쪽은 소속을 되짚어야 해서 탈퇴할 때까지
 * 보관하지만, 재직 인증은 **확인하는 순간 경로를 비웁니다.** 배지만 남습니다.
 * 그 말을 화면에 적어 둡니다 — 올리는 분이 알아야 합니다.
 *
 * ── 아직 숨겨 둡니다 ─────────────────────────────────────────
 * 관리자·마스터에게만 보입니다.
 */

type 내것 = {
  id: number; 상태: string; 병원이름: string | null;
  신청때: string; 반려까닭: string | null;
};

export default function Verify() {
  const { loading, session, isAdmin } = useAuth();
  const [마스터, set마스터] = useState(false);
  const [줄들, set줄들] = useState<내것[]>([]);
  const [병원, set병원] = useState('');
  const [파일, set파일] = useState<File | null>(null);
  const [탈, set탈] = useState<string | null>(null);
  const [도는중, set도는중] = useState(false);
  const [다시, set다시] = useState(0);

  useEffect(() => {
    if (!session) return;
    let 살아있나 = true;
    const sb = browserSupabase();
    Promise.all([sb.rpc('내페르소나'), sb.rpc('내재직인증')]).then(([a, b]) => {
      if (!살아있나) return;
      set마스터(!a.error && (a.data as { 마스터?: boolean } | null)?.마스터 === true);
      if (!b.error) set줄들((b.data ?? []) as 내것[]);
    });
    return () => { 살아있나 = false; };
  }, [session, 다시]);

  const 내기 = useCallback(async () => {
    if (!파일) { set탈('서류를 골라 주세요'); return; }
    set도는중(true); set탈(null);
    const sb = browserSupabase();
    const { data: u } = await sb.auth.getUser();
    /* ★ 저장소 경로에 한글을 쓰면 InvalidKey 입니다 (작업지침 6-2b).
       「재직-」 때문에 재직 증빙이 한 번도 안 올라갔습니다 — proofs 에
       제가 넣은 견본 말고는 한 장도 없습니다. 영문 앞머리로 바꿉니다. */
    const 경로 = `${u.user?.id}/proof-${Date.now()}-${파일.name.replace(/[^\w.]/g, '_')}`;
    const { error: 올림 } = await sb.storage.from('proofs').upload(경로, 파일);
    if (올림) { set도는중(false); set탈(올림.message); return; }
    const { error } = await sb.rpc('재직인증신청', { p_경로: 경로, p_병원: 병원.trim() || null });
    set도는중(false);
    if (error) { set탈(error.message); return; }
    set파일(null); set병원('');
    set다시((n) => n + 1);
  }, [파일, 병원]);

  /* 2026-11-16 세중님 테스터 점검 — 후기 쓰기 「근무 인증하기」·내 정보에서 들어오는데 옛 위쪽 줄(POTJOB 로고)이었습니다.
     새 틀(components/rapo/rapo-frame.tsx)로 옮겼습니다. 올리기·읽기·안내 글은 그대로입니다 */
  if (loading) return <RapoPageFrame title="재직 인증" back="/me"><RapoWait /></RapoPageFrame>;

  /* ★ 2026-10-11 — 회원에게 열었습니다 (세중님 결정).
     재직 인증 — 회원이 증빙을 올리고 관리자가 확인합니다.
     막는 자리는 화면이 아니라 창구입니다 (docs/인계/05_부록.md 2절) */

  const 지금 = 줄들.find((r) => r.상태 === '심사중' || r.상태 === '확인');

  return (
    <RapoPageFrame title="재직 인증" back="/me">
      <section className="flex flex-col gap-(--rapo-dimension-x2)">
        <p className={틀.흐린글}>
          재직증명서나 사원증을 올려 주시면 확인하고 <b>「재직 확인」 배지</b>를 달아드려요.
        </p>
      </section>

      <p className={틀.주의칸}>
        확인이 끝나면 <b>올려 주신 파일을 바로 지웁니다.</b> 배지만 남아요.
        주민등록번호 뒷자리는 가리고 올려 주세요.
      </p>

      {/* 개인정보처리방침 — 증빙 파일을 받는 화면이라 이 자리에 링크를 둡니다
          (세중님 2026-11-02 · docs/약관점검_1025.md 7절 ④).
          꼬리말·문의·내 정보·가입 첫 화면과 **같은 주소**입니다 */}
      <p className={틀.흐린글}>
        <Link href="/terms/privacy" className={틀.링크}>개인정보처리방침</Link>
        {' '}에서 무엇을 받고 언제 지우는지 보실 수 있어요.
      </p>

      {탈 && <p role="alert" className={틀.오류}>{탈}</p>}

      {지금?.상태 === '확인' ? (
        <p className={틀.글}>
          <span className="rapo-type-t3-bold rounded-(--rapo-radius-full) bg-(--rapo-color-bg-positive-weak) px-(--rapo-dimension-x3) py-(--rapo-dimension-x1) text-(color:--rapo-color-fg-positive-contrast)">재직 확인</span>
          {' '}배지가 붙어 있어요.
        </p>
      ) : 지금?.상태 === '심사중' ? (
        <p className={틀.글}>확인하고 있어요. 끝나면 알림으로 알려드릴게요.</p>
      ) : (
        <section className={틀.카드 + ' flex flex-col gap-(--rapo-dimension-x3)'}>
          <input value={병원} onChange={(e) => set병원(e.target.value)}
            placeholder="일하시는 곳 이름" aria-label="일하시는 곳 이름"
            className={틀.입력} />
          <input type="file" accept="image/*,application/pdf" aria-label="증빙 파일"
            onChange={(e) => set파일(e.target.files?.[0] ?? null)}
            className="rapo-type-t4-regular w-full min-w-0 text-(color:--rapo-color-fg-neutral)" />
          <button type="button" onClick={내기} disabled={도는중} className={틀.큰단추}>
            올리기
          </button>
        </section>
      )}

      {줄들.length > 0 && (
        <section className="flex flex-col gap-(--rapo-dimension-x3)">
          <h2 className={틀.소제목}>지난 신청</h2>
          <ul className="flex flex-col gap-(--rapo-dimension-x2)">
            {줄들.map((r) => (
              <li key={r.id} className={틀.카드 + ' flex flex-col gap-(--rapo-dimension-x1)'}>
                <p className="flex flex-wrap items-center gap-(--rapo-dimension-x2)">
                  <span className={틀.표}>{r.상태}</span>
                  <span className={틀.작은글}>{r.병원이름 ?? ''}</span>
                </p>
                {r.반려까닭 && <p className={틀.오류}>{r.반려까닭}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </RapoPageFrame>
  );
}
