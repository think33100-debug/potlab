'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth';
import { browserSupabase } from '@/lib/supabase-browser';
import { MAX_POST_IMAGES } from '@/lib/image';

/* 채용·교육 담당자 신청 (2026-10-09 · 뼈대 5·7절).
 *
 * ── 아직 숨겨 둡니다 ─────────────────────────────────────────
 * 관리자·마스터에게만 보입니다. 세중님이 눌러 보고 괜찮다 하시면 엽니다.
 *
 * ── 무엇을 받나 ──────────────────────────────────────────────
 *   채용 담당자        사업자등록증 + (사원증 또는 재직증명서)
 *   교육 담당자(기관)   사업자등록증 또는 고유번호증
 *   교육 담당자(개인)   활동 이력 하나 이상 (지난 교육 자료 · 강의 사진 ·
 *                      예전 모집 공고 링크 · 학회 강사 소개)
 *                      면허증은 선택 — 확인되면 「면허 확인 강사」 배지
 *
 * ── 주민등록번호는 안 받습니다 ───────────────────────────────
 * 올리는 화면에 적어 두고, 확인할 때 보이면 반려합니다.
 */

type 자료갈래 = '사업자등록증' | '고유번호증' | '사원증' | '재직증명서' | '활동이력' | '면허증';

const 필요한것: Record<string, { 갈래: 자료갈래[]; 설명: string }> = {
  채용담당자: {
    갈래: ['사업자등록증', '사원증', '재직증명서'],
    설명: '사업자등록증과, 사원증 또는 재직증명서를 올려 주세요.',
  },
  교육담당자기관: {
    갈래: ['사업자등록증', '고유번호증'],
    설명: '사업자등록증이나 고유번호증을 올려 주세요 (학회·협회는 고유번호증).',
  },
  교육담당자개인: {
    갈래: ['활동이력', '면허증'],
    설명: '지난 교육 자료·강의 사진·예전 모집 공고처럼 활동을 보여 주는 것 하나면 돼요. '
        + '치료사 면허증은 선택이고, 확인되면 「면허 확인 강사」 배지가 붙어요.',
  },
};

type 신청 = {
  id: number; 갈래: string; 기관번호: string | null; 교육기관: string | null;
  상태: string; 사업자번호: string | null; 사업자상태: string | null;
  반려까닭: string | null; 신청때: string;
  자료: { 갈래: string; 올린때: string }[];
};

export default function Partner() {
  const { loading, session, isAdmin } = useAuth();
  const [마스터, set마스터] = useState(false);
  const [내것, set내것] = useState<신청[]>([]);
  const [갈래, set갈래] = useState('채용담당자');
  const [사업자번호, set사업자번호] = useState('');
  const [교육기관, set교육기관] = useState('');
  const [탈, set탈] = useState<string | null>(null);
  const [도는중, set도는중] = useState(false);

  const 읽기 = useCallback(async () => {
    const sb = browserSupabase();
    const [a, b] = await Promise.all([sb.rpc('내페르소나'), sb.rpc('내담당자신청')]);
    set마스터(!a.error && (a.data as { 마스터?: boolean } | null)?.마스터 === true);
    if (!b.error) set내것((b.data ?? []) as 신청[]);
  }, []);

  useEffect(() => { if (session) 읽기(); }, [session, 읽기]);

  if (loading) return <main className="mx-auto w-full max-w-2xl px-6 py-8"><p className="text-lg text-mute">잠시만요…</p></main>;

  /* 아직 숨겨 둔 화면입니다 */
  if (!isAdmin && !마스터) {
    return (
      <main className="mx-auto w-full max-w-2xl px-6 py-8 md:px-7">
        <p className="break-keep text-h3 font-bold">아직 준비 중이에요</p>
        <p className="mt-3 break-keep text-lg text-mute">곧 열어 드릴게요.</p>
        <Link href="/" className="mt-7 inline-block rounded-md border border-gray-200 px-6 py-4
                                  text-lg font-medium text-gray-600 hover:bg-gray-50">홈으로</Link>
      </main>
    );
  }

  const 내기 = async () => {
    set도는중(true); set탈(null);
    const { data, error } = await browserSupabase().rpc('담당자신청', {
      p_갈래: 갈래,
      p_기관번호: null,
      p_교육기관: 갈래 === '교육담당자기관' ? (교육기관.trim() || null) : null,
      p_사업자번호: 사업자번호.replace(/-/g, '').trim() || null,
    });
    set도는중(false);
    if (error) { set탈(error.message); return; }
    void data;
    set사업자번호(''); set교육기관('');
    await 읽기();
  };

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-8 pb-[88px] md:px-7 md:pb-8">
      <p className="rounded-sm bg-badge-teal-bg px-4 py-2 text-sm text-teal-strong">
        숨겨 둔 화면이에요 — 관리자와 마스터에게만 보입니다
      </p>

      <h1 className="mt-5 break-keep text-h1 font-bold">채용 · 교육 담당자 신청</h1>
      <p className="mt-2 break-keep text-lg text-mute">
        소속을 확인한 뒤 공고를 올리거나 교육을 열 수 있어요.
      </p>

      <section className="mt-7 rounded-sm border border-gray-200 p-5">
        <h2 className="text-lg font-bold">어느 쪽이신가요</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {Object.keys(필요한것).map((k) => (
            <button
              key={k} type="button" onClick={() => set갈래(k)}
              className={'rounded-full px-4 py-2 text-lg ' +
                (갈래 === k ? 'bg-[#14181C] text-white' : 'border border-gray-200 text-gray-600')}>
              {k === '채용담당자' ? '병원 채용 담당'
                : k === '교육담당자기관' ? '교육 기관 · 학회' : '개인 강사'}
            </button>
          ))}
        </div>
        <p className="mt-4 break-keep text-lg text-mute">{필요한것[갈래].설명}</p>

        {갈래 !== '교육담당자개인' && (
          <input
            value={사업자번호} onChange={(e) => set사업자번호(e.target.value)}
            inputMode="numeric" placeholder="사업자등록번호 (숫자 10자리)"
            className="mt-4 w-full rounded-sm border border-gray-200 px-5 py-4 text-lg" />
        )}
        {갈래 === '교육담당자기관' && (
          <input
            value={교육기관} onChange={(e) => set교육기관(e.target.value)}
            placeholder="교육기관 이름 (교육 화면에 적힌 그대로)"
            className="mt-3 w-full rounded-sm border border-gray-200 px-5 py-4 text-lg" />
        )}

        <p className="mt-4 break-keep rounded-sm border border-warning p-4 text-lg">
          <b>주민등록번호는 받지 않아요.</b> 서류에 뒷자리가 보이면 가리고 올려 주세요 —
          보이면 반려하고 다시 부탁드립니다.
        </p>
        <p className="mt-3 break-keep text-sm text-mute">
          올려 주신 자료는 소속 확인에만 씁니다. 「기관 회원 승인」 권한을 가진 운영진만
          볼 수 있고, 열어 본 기록이 남습니다. 탈퇴하시면 지웁니다
          (신고·분쟁이 진행 중이면 끝난 뒤에 지웁니다). 사진·PDF 는 {MAX_POST_IMAGES}장까지.
        </p>

        <button
          type="button" onClick={내기} disabled={도는중}
          className="mt-5 w-full rounded-md bg-brand-red px-6 py-5 text-btn font-bold text-white
                     hover:bg-brand-red-dark active:scale-[0.98] disabled:opacity-50">
          신청하기
        </button>
        {탈 && <p className="mt-3 text-lg text-brand-red-dark">{탈}</p>}
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-bold">내 신청</h2>
        {내것.length === 0
          ? <p className="mt-3 text-lg text-mute">아직 없어요.</p>
          : (
            <ul className="mt-3 space-y-3">
              {내것.map((q) => (
                <li key={q.id} className="rounded-sm border border-gray-200 p-5">
                  <p className="flex flex-wrap items-center gap-2">
                    <b className="text-lg">{q.갈래}</b>
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-[13px] dark:bg-gray-800">
                      {q.상태}
                    </span>
                    {q.사업자상태 && <span className="text-sm text-mute">{q.사업자상태}</span>}
                  </p>
                  {q.교육기관 && <p className="mt-1 text-lg">{q.교육기관}</p>}
                  <p className="mt-1 text-sm text-mute">자료 {q.자료.length}장</p>
                  {q.반려까닭 && (
                    <p className="mt-2 break-keep text-lg text-brand-red-dark">{q.반려까닭}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
      </section>
    </main>
  );
}
