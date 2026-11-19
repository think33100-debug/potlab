'use client';

import { useCallback, useEffect, useState } from 'react';
import { browserSupabase } from '@/lib/supabase-browser';
import { RapoAdminHeader } from '@/components/rapo/rapo-admin';
import { AdminBadge, AdminTabs, 관 } from '@/components/rapo/rapo-admin-ui';

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
    const sb = browserSupabase();
    const { data, error } = await sb.rpc('admin_담당자정하기', {
      p_자격id: q.id, p_상태: 새상태, p_까닭: 까닭 ?? null,
    });
    /* 2026-11-16 약관 확정 — 승인·반려로 확인이 끝나면 서류를 바로 파기합니다.
       창구가 표에 지운때를 적고 경로를 돌려주면, 여기서 저장소(proofs)의 파일을 지웁니다 (SQL 로는 못 지웁니다 · admin/verify 와 같은 길) */
    const 지울 = ((data as { 지울경로?: string[] } | null)?.지울경로 ?? []).filter(Boolean);
    if (!error && 지울.length > 0) {
      const { error: 탈1 } = await sb.storage.from('proofs').remove(지울);
      if (탈1) set탈(`상태는 바꿨지만 서류 파일 ${지울.length}개를 못 지웠어요 — ${탈1.message}`);
    }
    set도는중(false);
    if (error) { set탈(error.message); return; }
    읽기();
  };

  /* 2026-11-19 — 새 관리자 디자인(상태 탭 · 흰 목록 카드)으로 다시 입혔습니다 */
  return (
    <div className="max-w-[1100px]">
      <RapoAdminHeader title="담당자 승인" />
      <p className={관.muted + ' -mt-[16px] mb-[24px] break-keep'}>
        소속을 확인하고 승인합니다. 자료를 열면 <b className="text-[#112231]">열람 기록이 남습니다</b>.
        서류에 주민등록번호가 보이면 반려해 주세요.
      </p>

      {탈 && <p className={관.error + ' mb-[16px]'}>{탈}</p>}

      <AdminTabs label="신청 상태" value={상태} onChange={set상태}
        tabs={['심사중', '승인', '반려', '정지'].map((s) => ({ key: s, label: s }))} />

      {줄들 === null ? <p className={관.muted + ' mt-[16px]'}>잠시만요…</p>
        : 줄들.length === 0 ? <p className={관.cardTight + ' ' + 관.empty + ' mt-[16px]'}>없어요.</p>
          : (
            <ul className={관.list + ' mt-[16px]'}>
              {줄들.map((q) => (
                <li key={q.id} className={관.row}>
                  <p className="flex flex-wrap items-center gap-[8px]">
                    <b className={관.h3}>{q.닉네임}</b>
                    <AdminBadge tone="neutral">{q.갈래}</AdminBadge>
                    <span className={관.sub}>회원번호 {q.회원번호} · {날(q.신청때)}</span>
                  </p>
                  <p className={관.body + ' mt-[6px]'}>
                    {q.기관이름 ?? q.교육기관 ?? '(소속 안 적힘)'}
                    {q.사업자번호 ? ` · 사업자 ${q.사업자번호}` : ''}
                    {q.사업자상태 ? ` (${q.사업자상태})` : ' (수동 확인)'}
                  </p>
                  <p className={관.sub + ' mt-[4px]'}>올린 자료 {q.자료수}장</p>

                  <div className="mt-[12px] flex flex-wrap gap-[8px]">
                    <button type="button" disabled={도는중 || q.상태 === '승인'}
                      onClick={() => 정하기(q, '승인')}
                      className={관.btn}>
                      승인
                    </button>
                    <button type="button" disabled={도는중}
                      onClick={() => 정하기(q, '반려', prompt('반려 까닭', 주민번호반려) ?? undefined)}
                      className={관.btnDanger}>
                      반려
                    </button>
                    <button type="button" disabled={도는중 || q.상태 !== '승인'}
                      onClick={() => 정하기(q, '정지')}
                      className={관.btnLine}>
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
