'use client';

import { useCallback, useEffect, useState } from 'react';
import { browserSupabase } from '@/lib/supabase-browser';

/* 치료사 재직 확인 — 권한 「회원 관리」 (2026-10-09 · 뼈대 ⑪).
 *
 * ── 담당자 인증 자료와 다릅니다 ──────────────────────────────
 *   담당자 자료   탈퇴할 때까지 보관 (소속을 되짚어야 합니다)
 *   재직 인증     **확인하는 순간 파일을 비웁니다.** 배지만 남습니다
 * 일반 회원의 서류를 들고 있을 까닭이 없습니다.
 *
 * ── API 자동 확인은 이번 범위가 아닙니다 ─────────────────────
 * 나중에 같은 자리에 끼울 수 있게 창구 이름을 그대로 둡니다.
 */

type 줄 = {
  id: number; 회원번호: number; 닉네임: string; 직군: string | null;
  병원이름: string | null; 상태: string; 신청때: string; 파일있나: boolean;
};

const 날 = (s: string) => new Date(s).toLocaleString('ko-KR',
  { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function AdminVerify() {
  const [상태, set상태] = useState('심사중');
  const [줄들, set줄들] = useState<줄[] | null>(null);
  const [탈, set탈] = useState<string | null>(null);
  const [다시, set다시] = useState(0);

  useEffect(() => {
    let 살아있나 = true;
    browserSupabase().rpc('admin_재직인증', { p_상태: 상태 || null })
      .then(({ data, error }) => {
        if (!살아있나) return;
        if (error) { set탈(error.message); return; }
        set탈(null);
        set줄들((data ?? []) as 줄[]);
      });
    return () => { 살아있나 = false; };
  }, [상태, 다시]);

  const 열기 = useCallback(async (r: 줄) => {
    const { data, error } = await browserSupabase()
      .rpc('admin_재직인증열기', { p_id: r.id });
    if (error) { set탈(error.message); return; }
    const 경로 = (data as { 경로?: string } | null)?.경로;
    if (!경로) return;
    const { data: 링크 } = await browserSupabase().storage
      .from('proofs').createSignedUrl(경로, 60);
    if (링크?.signedUrl) window.open(링크.signedUrl, '_blank', 'noopener,noreferrer');
  }, []);

  const 정하기 = async (r: 줄, 새상태: string) => {
    const 까닭 = 새상태 === '반려'
      ? prompt('반려 까닭', '서류를 알아볼 수 없어요. 다시 올려 주세요.') : null;
    if (새상태 === '반려' && 까닭 === null) return;
    if (!confirm(`${r.닉네임} 님을 「${새상태}」 로 합니다. 파일은 바로 지워집니다.`)) return;
    const { error } = await browserSupabase()
      .rpc('admin_재직인증정하기', { p_id: r.id, p_상태: 새상태, p_까닭: 까닭 });
    if (error) { set탈(error.message); return; }
    set다시((n) => n + 1);
  };

  return (
    <div className="mt-6">
      <h1 className="text-h2 font-bold text-[#14181C]">재직 확인</h1>
      <p className="mt-2 text-lg text-mute">
        확인하거나 반려하면 <b>파일이 바로 지워집니다</b>. 배지만 남아요.
        여는 순간 개인정보 접속기록에 남습니다.
      </p>

      {탈 && <p className="mt-4 rounded-sm border border-brand-red p-4 text-lg text-brand-red-dark">{탈}</p>}

      <div className="mt-5 flex flex-wrap gap-2">
        {['심사중', '확인', '반려'].map((s) => (
          <button key={s} type="button" onClick={() => set상태(s)}
            className={'rounded-full px-4 py-2 text-sm ' +
              (상태 === s ? 'bg-[#14181C] text-white' : 'border border-gray-200 text-gray-600')}>
            {s}
          </button>
        ))}
      </div>

      {줄들 === null ? <p className="mt-6 text-lg text-mute">잠시만요…</p>
        : 줄들.length === 0 ? <p className="mt-6 text-lg text-mute">없어요.</p>
          : (
            <ul className="mt-5 space-y-3">
              {줄들.map((r) => (
                <li key={r.id} className="rounded-sm border border-gray-200 p-5">
                  <p className="flex flex-wrap items-center gap-2">
                    <b className="text-lg">{r.닉네임}</b>
                    <span className="text-sm text-mute">
                      회원번호 {r.회원번호} · {r.직군 ?? '직군 안 정함'} · {날(r.신청때)}
                    </span>
                  </p>
                  <p className="mt-1 text-lg">{r.병원이름 ?? '(병원 안 적힘)'}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {r.파일있나 && (
                      <button type="button" onClick={() => 열기(r)}
                        className="rounded-md border border-gray-200 px-5 py-2 text-lg text-gray-600 hover:bg-gray-50">
                        서류 열기
                      </button>
                    )}
                    {r.상태 === '심사중' && (
                      <>
                        <button type="button" onClick={() => 정하기(r, '확인')}
                          className="rounded-md bg-brand-red px-5 py-2 text-lg font-bold text-white hover:bg-brand-red-dark">
                          확인
                        </button>
                        <button type="button" onClick={() => 정하기(r, '반려')}
                          className="rounded-md border border-gray-200 px-5 py-2 text-lg text-gray-600 hover:bg-gray-50">
                          반려
                        </button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
    </div>
  );
}
