'use client';

import { useCallback, useEffect, useState } from 'react';
import { browserSupabase } from '@/lib/supabase-browser';

/* 채용·교육 담당자 승인 — 권한 「기관승인」 이 있어야 합니다 (2026-10-09).
 *
 * ── 파일 경로는 목록에 안 실립니다 ───────────────────────────
 * 목록 창구는 **몇 장인지만** 셉니다. 경로를 같이 내보내면 열람 기록 없이
 * 파일을 열 수 있습니다. 한 장씩 「열기」를 누를 때 창구가 경로를 주고,
 * 그때 인증자료열람 과 개인정보접속기록에 한 줄씩 남습니다.
 *
 * ── 주민등록번호가 보이면 반려합니다 ─────────────────────────
 * 반려 까닭에 그 말을 기본으로 넣어 두었습니다 — 누르면 바로 보낼 수 있습니다.
 */

type 신청 = {
  id: number; 회원번호: number; 닉네임: string; 갈래: string;
  기관이름: string | null; 교육기관: string | null;
  사업자번호: string | null; 사업자상태: string | null;
  상태: string; 신청때: string; 자료수: number;
};

const 날 = (s: string) => new Date(s).toLocaleString('ko-KR',
  { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

const 주민번호반려 = '서류에 주민등록번호 뒷자리가 보입니다. 가리고 다시 올려 주세요.';

export default function AdminPartners() {
  const [상태, set상태] = useState('심사중');
  const [줄들, set줄들] = useState<신청[] | null>(null);
  const [탈, set탈] = useState<string | null>(null);
  const [도는중, set도는중] = useState(false);

  /* effect 안에서 바로 setState 하지 않습니다 — 한 번 더 그려집니다.
     응답이 온 뒤에만 담고, 떠난 화면이면 버립니다 */
  const [다시, set다시] = useState(0);
  const 읽기 = useCallback(() => set다시((n) => n + 1), []);

  useEffect(() => {
    let 살아있나 = true;
    browserSupabase().rpc('admin_담당자신청', { p_상태: 상태 || null })
      .then(({ data, error }) => {
        if (!살아있나) return;
        if (error) { set탈(error.message); return; }
        set탈(null);
        set줄들((data ?? []) as 신청[]);
      });
    return () => { 살아있나 = false; };
  }, [상태, 다시]);

  const 정하기 = async (q: 신청, 새상태: string, 까닭?: string) => {
    if (!confirm(`${q.닉네임} 님의 신청을 「${새상태}」 로 합니다.`)) return;
    set도는중(true);
    const { error } = await browserSupabase().rpc('admin_담당자정하기', {
      p_자격id: q.id, p_상태: 새상태, p_까닭: 까닭 ?? null,
    });
    set도는중(false);
    if (error) { set탈(error.message); return; }
    읽기();
  };

  return (
    <div className="mt-6">
      <h1 className="text-h2 font-bold text-[#14181C]">담당자 승인</h1>
      <p className="mt-2 text-lg text-mute">
        소속을 확인하고 승인합니다. 자료를 열면 <b>열람 기록이 남습니다</b>.
        서류에 주민등록번호가 보이면 반려해 주세요.
      </p>

      {탈 && <p className="mt-4 rounded-sm border border-brand-red p-4 text-lg text-brand-red-dark">{탈}</p>}

      <div className="mt-5 flex flex-wrap gap-2">
        {['심사중', '승인', '반려', '정지'].map((s) => (
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
              {줄들.map((q) => (
                <li key={q.id} className="rounded-sm border border-gray-200 p-5">
                  <p className="flex flex-wrap items-center gap-2">
                    <b className="text-lg">{q.닉네임}</b>
                    <span className="text-sm text-mute">회원번호 {q.회원번호} · {날(q.신청때)}</span>
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-[13px] dark:bg-gray-800">
                      {q.갈래}
                    </span>
                  </p>
                  <p className="mt-1 text-lg">
                    {q.기관이름 ?? q.교육기관 ?? '(소속 안 적힘)'}
                    {q.사업자번호 ? ` · 사업자 ${q.사업자번호}` : ''}
                    {q.사업자상태 ? ` (${q.사업자상태})` : ' (수동 확인)'}
                  </p>
                  <p className="mt-1 text-sm text-mute">올린 자료 {q.자료수}장</p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button type="button" disabled={도는중 || q.상태 === '승인'}
                      onClick={() => 정하기(q, '승인')}
                      className="rounded-md bg-brand-red px-5 py-2 text-lg font-bold text-white
                                 hover:bg-brand-red-dark disabled:opacity-40">
                      승인
                    </button>
                    <button type="button" disabled={도는중}
                      onClick={() => 정하기(q, '반려', prompt('반려 까닭', 주민번호반려) ?? undefined)}
                      className="rounded-md border border-gray-200 px-5 py-2 text-lg text-gray-600
                                 hover:bg-gray-50 disabled:opacity-40">
                      반려
                    </button>
                    <button type="button" disabled={도는중 || q.상태 !== '승인'}
                      onClick={() => 정하기(q, '정지')}
                      className="rounded-md border border-gray-200 px-5 py-2 text-lg text-gray-600
                                 hover:bg-gray-50 disabled:opacity-40">
                      정지
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
    </div>
  );
}
