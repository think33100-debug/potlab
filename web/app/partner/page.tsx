'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth';
import { browserSupabase } from '@/lib/supabase-browser';
import { MAX_POST_IMAGES } from '@/lib/image';
import { KAKAO_CHANNEL } from '@/lib/contact';
import { TERMS_VERSION } from '@/lib/terms';
import { RapoPageFrame, RapoWait, 틀 } from '@/components/rapo/rapo-frame';
import { RapoChip } from '@/components/rapo/rapo-ui';

/* 채용·교육 담당자 신청 (2026-10-09 · 뼈대 5·7절).
 *
 * ── 아직 숨겨 둡니다 ─────────────────────────────────────────
 * 관리자·마스터에게만 보입니다. 세중님이 눌러 보고 괜찮다 하시면 엽니다.
 *
 * ── 무엇을 받나 ──────────────────────────────────────────────
 *   채용 담당자        사업자등록증 + (사원증 또는 재직증명서)
 *   교육 담당자(기관)   활동 이력 하나 (2026-11-15 세중님 「교육기관·학회는 사업자등록증 없어도 돼」)
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
    갈래: ['활동이력'],
    설명: '학회·협회 소개 자료나 지난 교육 안내처럼 활동을 보여 주는 것 하나면 돼요. 사업자등록증은 필요 없어요.',
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
  const { loading, session, me } = useAuth();
  /* 2026-11-16 약관 확정 — 담당자 약관(채용·교육) 동의를 신청 때 받습니다 · 학생회원은 신청할 수 없습니다(DB 담당자신청 도 막음) */
  const [약관동의, set약관동의] = useState(false);
  const [마스터, set마스터] = useState(false);
  const [내것, set내것] = useState<신청[]>([]);
  const [갈래, set갈래] = useState('채용담당자');
  const [사업자번호, set사업자번호] = useState('');
  const [교육기관, set교육기관] = useState('');
  const [탈, set탈] = useState<string | null>(null);
  const [도는중, set도는중] = useState(false);
  /* 국세청 확인 — **보여 주기용**입니다. DB 에 적는 값은 서버가 따로 봅니다
     (web/app/api/biz/route.ts 머리말) */
  const [국세청, set국세청] = useState<string | null>(null);
  const [확인중, set확인중] = useState(false);

  const 읽기 = useCallback(async () => {
    const sb = browserSupabase();
    const [a, b] = await Promise.all([sb.rpc('내페르소나'), sb.rpc('내담당자신청')]);
    set마스터(!a.error && (a.data as { 마스터?: boolean } | null)?.마스터 === true);
    if (!b.error) set내것((b.data ?? []) as 신청[]);
  }, []);

  useEffect(() => { if (session) 읽기(); }, [session, 읽기]);

  /* 2026-11-16 세중님 테스터 점검 — 내 정보 메뉴에서 들어오는데 옛 위쪽 줄(POTJOB 로고)이었습니다.
     새 틀(components/rapo/rapo-frame.tsx)로 옮겼습니다. 신청·국세청 확인·약관 동의 동작은 그대로입니다 */
  if (loading) return <RapoPageFrame title="담당자 신청" back="/me"><RapoWait /></RapoPageFrame>;

  /* 학생회원은 담당자가 될 수 없습니다 (채용·교육 약관 4조) — 막는 화면이라 문의(카카오톡 채널)를 잘 보이게 (11/16 세중님) */
  if (me?.role === '학생' && !마스터) {
    return (
      <RapoPageFrame title="담당자 신청" back="/me">
        <section className="flex flex-col gap-(--rapo-dimension-x3) pt-(--rapo-dimension-x4)">
          <h2 className={틀.큰제목}>학생회원은 담당자를 신청할 수 없어요</h2>
          <p className={틀.흐린글}>
            취업한 뒤 내 정보의 「취업했어요 · 임상가 전환」을 마치면 신청할 수 있어요.
          </p>
        </section>
        <Link href="/me/convert" className={틀.큰단추}>임상가 전환하기</Link>
        <a href={KAKAO_CHANNEL} target="_blank" rel="noopener noreferrer"
          className="rapo-type-t5-bold flex h-[52px] w-full items-center justify-center rounded-(--rapo-radius-r3) bg-[#FEE500] text-[#191919]">
          카카오톡으로 문의하기
        </a>
      </RapoPageFrame>
    );
  }

  /* 아직 숨겨 둔 화면입니다 */
  /* ★ 2026-10-11 — 회원에게 열었습니다 (세중님 결정).
     담당자 신청 — 기관이 신청하고 관리자가 승인합니다.
     막는 자리는 화면이 아니라 창구입니다 (docs/인계/05_부록.md 2절) */

  const 국세청확인 = async () => {
    const b = 사업자번호.replace(/\D/g, '');
    if (b.length !== 10) { set국세청('숫자 10자리를 넣어 주세요'); return; }
    set확인중(true); set국세청(null);
    try {
      const r = await fetch('/api/biz', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ b_no: b }),
      });
      const j = await r.json();
      set국세청(r.ok ? String(j.상태 ?? '모름') : '지금은 확인이 안 돼요 (관리자가 봅니다)');
    } catch {
      set국세청('지금은 확인이 안 돼요 (관리자가 봅니다)');
    }
    set확인중(false);
  };

  const 내기 = async () => {
    if (!약관동의) { set탈('담당자 이용약관에 동의해 주세요'); return; }
    set도는중(true); set탈(null);
    await browserSupabase().rpc('동의남기기', {
      p_판: TERMS_VERSION, p_문서들: { [갈래 === '채용담당자' ? 'recruiter' : 'edu']: true },
    });
    const { data, error } = await browserSupabase().rpc('담당자신청', {
      p_갈래: 갈래,
      p_기관번호: null,
      p_교육기관: 갈래 === '교육담당자기관' ? (교육기관.trim() || null) : null,
      p_사업자번호: 갈래 === '채용담당자' ? (사업자번호.replace(/-/g, '').trim() || null) : null,
    });
    set도는중(false);
    if (error) { set탈(error.message); return; }
    void data;
    set사업자번호(''); set교육기관(''); set국세청(null);
    await 읽기();
  };

  return (
    <RapoPageFrame title="담당자 신청" back="/me">
      <section className="flex flex-col gap-(--rapo-dimension-x2)">
        <h2 className={틀.큰제목}>채용 · 교육 담당자 신청</h2>
        <p className={틀.흐린글}>소속을 확인한 뒤 공고를 올리거나 교육을 열 수 있어요.</p>
      </section>

      <section className={틀.카드 + ' flex flex-col gap-(--rapo-dimension-x4)'}>
        <h2 className={틀.소제목}>어느 쪽이신가요</h2>
        <div className="flex flex-wrap gap-x-(--rapo-dimension-x2)">
          {Object.keys(필요한것).map((k) => (
            <RapoChip key={k} on={갈래 === k} onClick={() => set갈래(k)}
              label={k === '채용담당자' ? '병원 채용 담당'
                : k === '교육담당자기관' ? '교육 기관 · 학회' : '개인 강사'} />
          ))}
        </div>
        <p className={틀.흐린글}>{필요한것[갈래].설명}</p>

        {/* 사업자등록번호는 병원 채용 담당만 (2026-11-15 세중님) */}
        {갈래 === '채용담당자' && (
          <div className="flex flex-col gap-(--rapo-dimension-x2)">
            <input
              value={사업자번호}
              onChange={(e) => { set사업자번호(e.target.value); set국세청(null); }}
              inputMode="numeric" placeholder="사업자등록번호 (숫자 10자리)" aria-label="사업자등록번호"
              className={틀.입력} />
            <div className="flex flex-wrap items-center gap-(--rapo-dimension-x3)">
              <button
                type="button" onClick={국세청확인}
                disabled={확인중 || 사업자번호.replace(/\D/g, '').length !== 10}
                className={틀.선단추}>
                {확인중 ? '보는 중…' : '국세청 확인'}
              </button>
              {국세청 && (
                <span className={'break-keep '
                  + (국세청 === '계속사업자' ? 'rapo-type-t4-bold text-(color:--rapo-color-fg-positive-contrast)'
                     : 국세청 === '휴업자' || 국세청 === '폐업자' || 국세청 === '없는 번호'
                       ? 'rapo-type-t4-bold text-(color:--rapo-color-fg-critical)' : 'rapo-type-t4-regular text-(color:--rapo-color-fg-neutral-muted)')}>
                  {국세청}
                </span>
              )}
            </div>
            <p className={틀.작은글}>
              국세청에 등록된 상태를 미리 보여 드려요. 승인은 관리자가 서류를 보고 정합니다.
            </p>
          </div>
        )}
        {갈래 === '교육담당자기관' && (
          <input
            value={교육기관} onChange={(e) => set교육기관(e.target.value)}
            placeholder="교육기관 이름 (교육 화면에 적힌 그대로)" aria-label="교육기관 이름"
            className={틀.입력} />
        )}

        <p className={틀.주의칸}>
          <b>주민등록번호는 받지 않아요.</b> 서류에 뒷자리가 보이면 가리고 올려 주세요 —
          보이면 반려하고 다시 부탁드립니다.
        </p>
        <p className={틀.작은글}>
          올려 주신 자료는 소속 확인에만 씁니다. 「기관 회원 승인」 권한을 가진 운영진만
          볼 수 있고, 열어 본 기록이 남습니다. 승인이나 반려로 확인이 끝나면 바로 지우고
          확인 결과만 남깁니다. 사진·PDF 는 {MAX_POST_IMAGES}장까지.
        </p>

        <label className="flex min-h-(--rapo-touch-min) cursor-pointer items-start gap-(--rapo-dimension-x3)">
          <input type="checkbox" checked={약관동의} onChange={(e) => set약관동의(e.target.checked)}
            className="mt-[2px] size-5 shrink-0 accent-(--rapo-color-bg-navy-solid)" />
          <span className={틀.글}>
            <Link href={갈래 === '채용담당자' ? '/terms/recruiter' : '/terms/edu'} className="underline underline-offset-2">
              {갈래 === '채용담당자' ? '채용담당자 이용약관' : '교육담당자 이용약관'}
            </Link>에 동의합니다 (필수)
          </span>
        </label>

        <button type="button" onClick={내기} disabled={도는중 || !약관동의} className={틀.큰단추}>
          신청하기
        </button>
        {탈 && <p role="alert" className={틀.오류}>{탈}</p>}
      </section>

      <section className="flex flex-col gap-(--rapo-dimension-x3)">
        <h2 className={틀.소제목}>내 신청</h2>
        {내것.length === 0
          ? <p className={틀.흐린글}>아직 없어요.</p>
          : (
            <ul className="flex flex-col gap-(--rapo-dimension-x3)">
              {내것.map((q) => (
                <li key={q.id} className={틀.카드 + ' flex flex-col gap-(--rapo-dimension-x1)'}>
                  <p className="flex flex-wrap items-center gap-(--rapo-dimension-x2)">
                    <b className="rapo-type-t5-bold text-(color:--rapo-color-fg-neutral)">{q.갈래}</b>
                    <span className={틀.표}>{q.상태}</span>
                    {q.사업자상태 && <span className={틀.작은글}>{q.사업자상태}</span>}
                  </p>
                  {q.교육기관 && <p className={틀.글}>{q.교육기관}</p>}
                  <p className={틀.작은글}>자료 {q.자료.length}장</p>
                  {q.반려까닭 && <p className={틀.오류}>{q.반려까닭}</p>}
                </li>
              ))}
            </ul>
          )}
      </section>
    </RapoPageFrame>
  );
}
