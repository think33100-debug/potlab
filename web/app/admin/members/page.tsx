'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { browserSupabase } from '@/lib/supabase-browser';
import { RapoAdminHeader } from '@/components/rapo/rapo-admin';
import { AdminBadge, AdminSearchField, AdminSection, 관 } from '@/components/rapo/rapo-admin-ui';

/* 회원 목록 (2026-10-01).
 *
 * ── 급여·스펙은 「넣었나 / 안 넣었나」 만 보여줍니다 ──────────
 * 목록을 열 때마다 모두의 급여가 딸려 나오면 「필요한 만큼만 본다」가
 * 깨집니다. 값을 봐야 하면 admin_회원정보보기() 로 한 사람씩 엽니다 —
 * 그때 접속기록이 남습니다.
 *
 * ── 이 화면을 여는 것도 기록에 남습니다 ──────────────────────
 * 개인정보의 안전성 확보조치 기준 제8조. 「개인정보 접속기록」 화면에서 봅니다.
 *
 * ── 회원번호 ─────────────────────────────────────────────────
 * #00001 부터 가입 순서대로. 한 번 나간 번호는 다시 안 나옵니다.
 * 회원 화면에는 안 보입니다.
 */

type 줄 = {
  회원번호: string; 닉네임: string; 직군: string; 역할: string;
  가입일: string; 탈퇴일: string | null;
  글: number; 댓글: number;
  급여넣음: boolean; 스펙넣음: boolean; 알림받음: boolean;
  동의판: string | null; 동의시각: string | null;
  id: string;
};

const 날 = (s: string | null) =>
  s ? new Date(s).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' }) : '-';

export default function AdminMembers() {
  const [rows, setRows] = useState<줄[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [연사람, set연사람] = useState<string | null>(null);
  const [속내용, set속내용] = useState<Record<string, unknown> | null>(null);

  /* ★ 한 번에 100줄만 옵니다 — Supabase 가 거기서 자릅니다 (오류도 안 납니다).
     회원이 101명이 되는 날 조용히 안 보이기 시작합니다.
     그래서 100줄씩 쪽을 넘겨 받습니다.

     ⚠ `p_page` 를 **반드시 넘겨야** 합니다. 안 넘기면 PostgREST 가
       인자 없는 옛 판을 부릅니다 (2026-10-04 · 옛 판은 지웠습니다). */
  const load = useCallback(async () => {
    const 쪽크기 = 100;
    const 모두: 줄[] = [];
    for (let 쪽 = 0; 쪽 < 50; 쪽++) {
      const { data, error } = await browserSupabase().rpc('admin_회원목록', { p_page: 쪽 });
      if (error) { setErr(error.message); setRows(모두); return; }
      const 받은것 = (data ?? []) as 줄[];
      모두.push(...받은것);
      if (받은것.length < 쪽크기) break;
    }
    setErr(null);
    setRows(모두);
  }, []);

  useEffect(() => { load(); }, [load]);

  const 보일것 = useMemo(() => {
    const k = q.trim();
    if (!k || !rows) return rows ?? [];
    return rows.filter((r) => (r.회원번호 + ' ' + r.닉네임 + ' ' + r.직군).includes(k));
  }, [rows, q]);

  const 살아있음 = (rows ?? []).filter((r) => !r.탈퇴일).length;
  const 나감 = (rows ?? []).filter((r) => r.탈퇴일).length;

  /* 한 사람의 급여·스펙을 엽니다. 여는 순간 접속기록이 남습니다 */
  const 열기 = async (id: string) => {
    if (연사람 === id) { set연사람(null); set속내용(null); return; }
    set연사람(id); set속내용(null);
    const { data, error } = await browserSupabase().rpc('admin_회원정보보기', { p_profile_id: id });
    set속내용(error ? { 오류: error.message } : (data as Record<string, unknown>));
  };

  /* 2026-11-19 — 새 디자인 「회원 관리 · PC UI」 1406:640 꼴로 다시 입혔습니다 (검색칸 → 회원 목록 표) */
  return (
    <div className="max-w-[1100px]">
      <RapoAdminHeader title="회원 관리" />

      {/* ★ 예시에 **실제 회원의 번호·닉네임**을 적어 두었었습니다 (2026-10-10 캡처
          검사에서 찾았습니다). 안내문은 지어낸 값으로 씁니다.
          주석을 **속성 자리**에 두면 빌드가 깨집니다 — 태그 밖에 둡니다 */}
      <AdminSearchField value={q} onChange={setQ} label="찾기 (회원번호·닉네임·직군)"
        placeholder="예: #00001 · 닉네임 · 물리치료사" />

      <div className={관.info + ' mt-[16px] break-keep'}>
        <p>
          쓰는 중 <b className="num tabular-nums text-[#112231]">{살아있음}</b>명 ·
          탈퇴 <b className="num tabular-nums text-[#112231]">{나감}</b>명
          <span className="ml-[8px] text-[#555d6d]">회원번호는 가입 순서대로 붙고 바뀌지 않아요. 회원 화면에는 안 보여요</span>
        </p>
        <p className="mt-[4px] text-[13px] text-[#555d6d]">이 화면을 연 것도 「개인정보 접속기록」 에 남습니다</p>
      </div>

      <AdminSection title="회원 목록" className="mt-[32px]">
        {err && (
          <p role="alert" className={관.error}>못 불러왔어요 — {err}</p>
        )}
        {rows === null && <p className={관.muted}>잠시만요…</p>}

        {보일것.length > 0 && (
          <div className={관.tableWrap}>
            <table className={관.table + ' min-w-[880px]'}>
              <thead className={관.thead}>
                <tr>
                  <th className={관.th}>회원</th>
                  <th className={관.th}>직군 · 역할</th>
                  <th className={관.th}>가입 상태</th>
                  <th className={관.th}>가입일</th>
                  <th className={관.th}>활동</th>
                  <th className={관.th}>동의</th>
                  <th className={관.th}><span className="sr-only">급여·스펙</span></th>
                </tr>
              </thead>
              <tbody>
                {보일것.map((r) => (
                  <Fragment key={r.id}>
                    <tr className={관.tr + (r.탈퇴일 ? ' bg-[#f6f8f9]' : '')}>
                      <td className={관.tdMain}>
                        <span className="num tabular-nums">{r.회원번호}</span>
                        <span className="ml-[8px]">{r.닉네임}</span>
                      </td>
                      <td className={관.td + ' break-keep'}>{r.직군} · {r.역할}</td>
                      <td className={관.td}>
                        {r.탈퇴일
                          ? <AdminBadge tone="neutral">탈퇴 {날(r.탈퇴일)}</AdminBadge>
                          : <AdminBadge tone="ok">이용 중</AdminBadge>}
                      </td>
                      <td className={관.td + ' whitespace-nowrap'}>{날(r.가입일)}</td>
                      <td className={관.td + ' text-[13px]'}>
                        글 <span className="num tabular-nums">{r.글}</span> ·
                        댓글 <span className="num tabular-nums">{r.댓글}</span>
                        <span className="block">
                          급여 {r.급여넣음 ? '넣음' : '안 넣음'} ·
                          스펙 {r.스펙넣음 ? '넣음' : '안 넣음'} ·
                          알림 {r.알림받음 ? '받음' : '안 받음'}
                        </span>
                      </td>
                      <td className={관.td + ' text-[13px]'}>
                        {r.동의판 ?? '(기록 없음)'}
                        {r.동의시각 && <span className="block">{날(r.동의시각)}</span>}
                      </td>
                      <td className={관.td}>
                        {(r.급여넣음 || r.스펙넣음) && !r.탈퇴일 && (
                          <button type="button" onClick={() => 열기(r.id)} className={관.btnSm + ' whitespace-nowrap'}>
                            {연사람 === r.id ? '닫기' : '급여·스펙 열기 (기록 남아요)'}
                          </button>
                        )}
                      </td>
                    </tr>
                    {연사람 === r.id && (
                      <tr className={관.tr}>
                        <td colSpan={7} className="px-[18px] py-[12px]">
                          <pre className="overflow-x-auto rounded-[8px] bg-[#f1f5f8] p-[16px] text-[13px] text-[#112231]">
                            {속내용 ? JSON.stringify(속내용, null, 1) : '여는 중…'}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {rows !== null && 보일것.length === 0 && (
          <p className={관.cardTight + ' ' + 관.empty}>찾는 회원이 없어요</p>
        )}
      </AdminSection>
    </div>
  );
}
