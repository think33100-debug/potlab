'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth';
import { browserSupabase } from '@/lib/supabase-browser';

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

  if (loading) return <main className="mx-auto w-full max-w-2xl px-6 py-8"><p className="text-lg text-mute">잠시만요…</p></main>;

  if (!isAdmin && !마스터) {
    return (
      <main className="mx-auto w-full max-w-2xl px-6 py-8 md:px-7">
        <p className="break-keep text-h3 font-bold">아직 준비 중이에요</p>
        <Link href="/" className="mt-7 inline-block rounded-md border border-gray-200 px-6 py-4
                                  text-lg font-medium text-gray-600 hover:bg-gray-50">홈으로</Link>
      </main>
    );
  }

  const 지금 = 줄들.find((r) => r.상태 === '심사중' || r.상태 === '확인');

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-8 pb-[88px] md:px-7 md:pb-8">
      <p className="rounded-sm bg-badge-teal-bg px-4 py-2 text-sm text-teal-strong">
        숨겨 둔 화면이에요 — 관리자와 마스터에게만 보입니다
      </p>
      <h1 className="mt-5 break-keep text-h1 font-bold">재직 인증</h1>
      <p className="mt-2 break-keep text-lg text-mute">
        재직증명서나 사원증을 올려 주시면 확인하고 <b>「재직 확인」 배지</b>를 달아드려요.
      </p>

      <p className="mt-5 break-keep rounded-sm border border-warning p-4 text-lg">
        확인이 끝나면 <b>올려 주신 파일을 바로 지웁니다.</b> 배지만 남아요.
        주민등록번호 뒷자리는 가리고 올려 주세요.
      </p>

      {탈 && <p className="mt-4 text-lg text-brand-red-dark">{탈}</p>}

      {지금?.상태 === '확인' ? (
        <p className="mt-7 break-keep text-lg">
          <b className="rounded-full bg-badge-teal-bg px-3 py-1 text-teal-strong">재직 확인</b>
          {' '}배지가 붙어 있어요.
        </p>
      ) : 지금?.상태 === '심사중' ? (
        <p className="mt-7 break-keep text-lg">확인하고 있어요. 끝나면 알림으로 알려드릴게요.</p>
      ) : (
        <section className="mt-7 rounded-sm border border-gray-200 p-5">
          <input value={병원} onChange={(e) => set병원(e.target.value)}
            placeholder="일하시는 곳 이름"
            className="w-full rounded-sm border border-gray-200 px-5 py-4 text-lg" />
          <input type="file" accept="image/*,application/pdf"
            onChange={(e) => set파일(e.target.files?.[0] ?? null)}
            className="mt-3 w-full text-lg" />
          <button type="button" onClick={내기} disabled={도는중}
            className="mt-4 w-full rounded-md bg-brand-red px-6 py-5 text-btn font-bold text-white
                       hover:bg-brand-red-dark disabled:opacity-50">
            올리기
          </button>
        </section>
      )}

      {줄들.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-bold">지난 신청</h2>
          <ul className="mt-3 space-y-2">
            {줄들.map((r) => (
              <li key={r.id} className="rounded-sm border border-gray-200 p-4">
                <p className="flex flex-wrap items-center gap-2">
                  <b className="text-lg">{r.상태}</b>
                  <span className="text-sm text-mute">{r.병원이름 ?? ''}</span>
                </p>
                {r.반려까닭 && (
                  <p className="mt-1 break-keep text-lg text-brand-red-dark">{r.반려까닭}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
