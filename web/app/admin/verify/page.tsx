'use client';

import { useCallback, useEffect, useState } from 'react';
import { browserSupabase } from '@/lib/supabase-browser';
import { RapoAdminHeader } from '@/components/rapo/rapo-admin';
import { AdminBadge, AdminTabs, 관 } from '@/components/rapo/rapo-admin-ui';

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

    /* ★ 2026-10-11 — **정말로 바로 지웁니다.**
       전에는 창구가 칸만 비우고 파일은 저장소에 남았습니다.
       clean_orphan_files.js 가 치운다고 적혀 있었지만 그 스크립트는
       크론에 없었고 proofs 통을 보지도 않았습니다 — **아무도 안 지웠습니다.**
       SQL 로는 못 지웁니다 (storage.protect_delete). 그래서 검토하는
       사람이 Storage API 로 지웁니다 (정책 「인증자료는 검토한 사람이
       바로 지웁니다」).
       **칸을 비우기 전에** 지웁니다 — 비운 뒤에는 경로를 못 읽습니다. */
    let 지움 = '파일 없음';
    try {
      const { data: 자료 } = await browserSupabase()
        .rpc('admin_재직인증열기', { p_id: r.id });
      const 경로 = (자료 as { 경로?: string } | null)?.경로;
      if (경로) {
        const { error: 탈1 } = await browserSupabase().storage.from('proofs').remove([경로]);
        지움 = 탈1 ? '못 지웠습니다 — ' + 탈1.message : '지웠습니다';
      }
    } catch (e) {
      지움 = '못 지웠습니다 — ' + (e as Error).message;
    }

    const { error } = await browserSupabase()
      .rpc('admin_재직인증정하기', { p_id: r.id, p_상태: 새상태, p_까닭: 까닭 });
    if (error) { set탈(error.message); return; }
    /* 못 지웠으면 **조용히 넘어가지 않습니다** — 개인정보라 사람이 알아야 합니다 */
    if (지움.startsWith('못')) set탈('증빙 ' + 지움 + ' (관리자에게 알려 주세요)');
    set다시((n) => n + 1);
  };

  /* 2026-11-19 — 새 관리자 디자인(상태 탭 · 흰 목록 카드)으로 다시 입혔습니다 */
  return (
    <div className="max-w-[1100px]">
      <RapoAdminHeader title="재직 확인" />
      <p className={관.muted + ' -mt-[16px] mb-[24px] break-keep'}>
        확인하거나 반려하면 <b className="text-[#112231]">파일이 바로 지워집니다</b>. 배지만 남아요.
        여는 순간 개인정보 접속기록에 남습니다.
      </p>

      {탈 && <p className={관.error + ' mb-[16px]'}>{탈}</p>}

      <AdminTabs label="확인 상태" value={상태} onChange={set상태}
        tabs={['심사중', '확인', '반려'].map((s) => ({ key: s, label: s }))} />

      {줄들 === null ? <p className={관.muted + ' mt-[16px]'}>잠시만요…</p>
        : 줄들.length === 0 ? <p className={관.cardTight + ' ' + 관.empty + ' mt-[16px]'}>없어요.</p>
          : (
            <ul className={관.list + ' mt-[16px]'}>
              {줄들.map((r) => (
                <li key={r.id} className={관.row}>
                  <p className="flex flex-wrap items-center gap-[8px]">
                    <b className={관.h3}>{r.닉네임}</b>
                    <AdminBadge tone={r.상태 === '확인' ? 'ok' : r.상태 === '반려' ? 'coral' : 'warn'}>{r.상태}</AdminBadge>
                    <span className={관.sub}>
                      회원번호 {r.회원번호} · {r.직군 ?? '직군 안 정함'} · {날(r.신청때)}
                    </span>
                  </p>
                  <p className={관.body + ' mt-[6px]'}>{r.병원이름 ?? '(병원 안 적힘)'}</p>
                  <div className="mt-[12px] flex flex-wrap gap-[8px]">
                    {r.파일있나 && (
                      <button type="button" onClick={() => 열기(r)}
                        className={관.btnLine}>
                        서류 열기
                      </button>
                    )}
                    {r.상태 === '심사중' && (
                      <>
                        <button type="button" onClick={() => 정하기(r, '확인')}
                          className={관.btn}>
                          확인
                        </button>
                        <button type="button" onClick={() => 정하기(r, '반려')}
                          className={관.btnDanger}>
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
