'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { RapoLeaveDone, RapoLeaveFrame as Frame } from '@/components/rapo/rapo-leave';
import { RapoButton } from '@/components/rapo/rapo-ui';
import { browserSupabase } from '@/lib/supabase-browser';
import { useAuth } from '../../auth';
import { useToast } from '../../toast';

/* 회원 탈퇴 — 피그마 「12 · 내 정보」 개인정보·탈퇴 1508:2485 · 안내 확인 후 1509:2786 · 탈퇴 완료 1508:2517 (2026-11-15 세중님 「회원탈퇴 옛날거 뜨네」).

   ★ 피그마·옛 화면과 다르게 적은 것 (2026-11-15 DB 에서 확인) — 둘 다 「글·후기는 남는다」고 적었지만 지금은 다 지워집니다.
     reset_my_account() 가 auth.users 를 지우면 profiles(on delete cascade) → posts·comments·chat_messages(author/sender cascade)
     · 근무후기(회원 cascade) 가 연달아 지워집니다. 탈퇴한 3명(10/11~10/15) 모두 프로필 줄이 없습니다.
     남는 것은 erased_accounts(가입일·탈퇴일·30일 잠근 원래 닉네임)뿐입니다. 화면은 실제 동작대로 적었습니다.
     2026-11-15 세중님 「다 지우자」(질문함 Q95) — 지금 동작 그대로 둡니다.

   ── 왜 앱 안에 있어야 하나 ───────────────────────────────────
   애플 심사 기준 5.1.1(v) — 앱에서 계정을 만들 수 있으면 **앱 안에서** 계정을 지울 수도 있어야 합니다.

   ── 지우는 일은 DB 가 합니다 ─────────────────────────────────
   reset_my_account() 한 곳입니다. auth.uid() 하나만 건드리게 못 박혀 있어 화면을 뚫어도 남의 계정은 못 지웁니다.
   관리자 화면(/admin/reset)도 **같은 함수**를 부릅니다 — 규칙이 한 벌입니다.

   ── 애플 연결 끊기 (2026-10-11) ──────────────────────────────
   **reset_my_account() 를 부르기 전에** /api/apple-revoke 를 부릅니다 — 계정을 지운 뒤에는 그 사람 토큰으로 창구를 못 부릅니다.
   애플 열쇠가 없으면 그 자리가 「없습니다」만 돌려주고 탈퇴는 그대로 됩니다. */

/* 삭제 코드 — 헷갈리는 글자(0·O·1·I·L)를 뺀 12자, 4자씩 끊어 보여 줍니다 */
function 삭제코드만들기(): string {
  const 글자 = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const r = crypto.getRandomValues(new Uint8Array(12));
  const s = Array.from(r, (b) => 글자[b % 글자.length]).join('');
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8)}`;
}
/** 운영진이 대조할 때도 같은 셈을 씁니다 — 하이픈을 떼고 대문자로 바꾼 뒤 SHA-256 16진수 */
async function 지문(코드: string): Promise<string> {
  const 글 = new TextEncoder().encode(코드.replace(/-/g, '').toUpperCase());
  const h = await crypto.subtle.digest('SHA-256', 글);
  return Array.from(new Uint8Array(h), (b) => b.toString(16).padStart(2, '0')).join('');
}

export default function LeavePage() {
  const { session, loading } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const [확인, set확인] = useState(false);
  const [busy, setBusy] = useState(false);
  const [끝, set끝] = useState(false);
  const [삭제코드, set삭제코드] = useState<string | null>(null);

  const run = async () => {
    if (!확인 || busy || !session) return;
    setBusy(true);
    const sb = browserSupabase();
    /* ★ 애플 연결을 **먼저** 끊습니다. 실패해도 탈퇴는 그대로 갑니다 */
    try {
      await fetch('/api/apple-revoke', { method: 'POST', headers: { Authorization: 'Bearer ' + session.access_token } });
    } catch { /* 탈퇴를 막지 않습니다 */ }

    /* 2026-11-16 약관 25조 ⑥ — 삭제 코드는 이 기기에서 만들고 **지문(SHA-256)만** 보냅니다. 회사는 코드 자체를 모릅니다 */
    const 코드 = 삭제코드만들기();
    const { error } = await sb.rpc('reset_my_account', { p_지문: await 지문(코드) });
    if (error) {
      setBusy(false);
      toast(`탈퇴하지 못했어요 — ${error.message}`, { tone: 'danger', ms: 5000 });
      return;
    }
    /* 계정이 사라졌으니 들고 있던 토큰도 버립니다 */
    set삭제코드(코드);
    set끝(true);
    await sb.auth.signOut({ scope: 'local' });
    window.scrollTo(0, 0);
  };

  /* 탈퇴 완료 1508:2517 */
  if (끝) return <RapoLeaveDone onHome={() => router.replace('/')} 삭제코드={삭제코드} />;

  if (loading) {
    return <Frame title="개인정보·탈퇴"><p role="status" className="rapo-type-t4-regular pt-(--rapo-dimension-x6) text-(color:--rapo-color-fg-neutral-muted)">잠시만요…</p></Frame>;
  }
  if (!session) {
    return (
      <Frame title="개인정보·탈퇴">
        <section className="flex flex-col gap-(--rapo-dimension-x4) pt-(--rapo-dimension-x6)">
          <h2 className="rapo-type-t9-bold text-(color:--rapo-color-fg-neutral)">로그인한 분만 쓸 수 있어요</h2>
          <Link href="/login" className="rapo-type-t4-bold self-start text-(color:--rapo-color-fg-neutral)">로그인하기 ›</Link>
        </section>
      </Frame>
    );
  }

  /* 개인정보·탈퇴 1508:2485 · 안내 확인 후 1509:2786 */
  return (
    <Frame title="개인정보·탈퇴" back="/me/account" 아래={
      <div className="flex flex-col gap-(--rapo-dimension-x4)">
        <label className="flex cursor-pointer items-center gap-(--rapo-dimension-x2)">
          <input type="checkbox" className="sr-only" checked={확인} onChange={(e) => set확인(e.target.checked)} />
          <span aria-hidden className={'flex size-[22px] shrink-0 items-center justify-center rounded-(--rapo-radius-r1) border-(length:--rapo-border-default) text-[14px] font-bold leading-none '
            + (확인 ? 'border-(color:--rapo-color-bg-navy-solid) bg-(--rapo-color-bg-navy-solid) text-(color:--rapo-color-fg-on-navy-solid)' : 'border-(color:--rapo-color-stroke-neutral-weak)')}>
            {확인 ? '✓' : ''}
          </span>
          <span className="rapo-type-t4-regular text-(color:--rapo-color-fg-neutral)">안내 내용을 확인했어요</span>
        </label>
        <RapoButton full onClick={run} disabled={!확인 || busy}>{busy ? '탈퇴하는 중…' : '탈퇴하기'}</RapoButton>
      </div>
    }>
      <h2 className="rapo-type-t11-bold mt-(--rapo-dimension-x6) break-keep text-(color:--rapo-color-fg-neutral)">탈퇴 전에 확인해 주세요</h2>

      <div className="mt-(--rapo-dimension-x6) flex flex-col gap-(--rapo-dimension-x3)">
        <div className="flex flex-col gap-(--rapo-dimension-x2) rounded-(--rapo-radius-r4) bg-(--rapo-color-bg-brand-weak) p-(--rapo-dimension-x5)">
          <p className="rapo-type-t6-bold text-(color:--rapo-color-fg-neutral)">삭제되는 정보</p>
          <p className="rapo-type-t4-regular break-keep text-(color:--rapo-color-fg-neutral)">계정과 프로필, 커뮤니티 글·댓글, 학생으로 적은 학력·스펙, 저장한 공고와 알림 설정이 바로 삭제돼요.</p>
        </div>
        <div className="flex flex-col gap-(--rapo-dimension-x2) rounded-(--rapo-radius-r4) bg-(--rapo-color-bg-neutral-weak) p-(--rapo-dimension-x5)">
          <p className="rapo-type-t6-bold text-(color:--rapo-color-fg-neutral)">남는 정보</p>
          <p className="rapo-type-t4-regular break-keep text-(color:--rapo-color-fg-neutral)">내가 남긴 후기(근무·교육 후기, 면접 후기·교육 후기·실습 게시판 글)와 임상가로 등록한 근무 기관·급여·연차·입사 당시 스펙은 누구 것인지 모르게 바꿔서 남아요. 탈퇴할 때 드리는 삭제 코드로 나중에 지워 달라고 할 수 있어요.</p>
        </div>
      </div>

      {/* 자세한 내용 — 옛 화면에 있던 안내 그대로 (무엇이 지워지고 남는지 · 30일 보관) */}
      <details className="mt-(--rapo-dimension-x4) rounded-(--rapo-radius-r3) px-(--rapo-dimension-x1)">
        <summary className="rapo-type-t4-bold cursor-pointer py-(--rapo-dimension-x2) text-(color:--rapo-color-fg-neutral-muted)">자세히 보기</summary>
        <div className="rapo-type-t3-regular flex flex-col gap-(--rapo-dimension-x3) break-keep pb-(--rapo-dimension-x2) text-(color:--rapo-color-fg-neutral-muted)">
          <p>바로 지워지는 것 — 로그인 수단(카카오·네이버·애플 연결) · 닉네임 · 프로필 사진 · 커뮤니티 글·댓글 · 학생으로 적은 학력·스펙 · 어학 점수 · 알림 설정 · 저장한 공고·숨긴 공고 · 관심 병원 · 좋아요 · 교육 신청 · 재직 인증·담당자 신청 자료.</p>
          <p>남는 것 — 후기(근무·교육 후기와 면접 후기·교육 후기·실습 게시판 글) · 임상가로 등록한 근무 기관·급여·연차·입사 당시 스펙(누구 것인지 모르게) · 가입·탈퇴 일시(1년) · 원래 닉네임(암호로 잠가 30일). 남기고 싶지 않은 후기는 탈퇴 전에 지우거나, 탈퇴 뒤 삭제 코드로 지워 달라고 할 수 있어요.</p>
          <p>같은 카카오·네이버로 다시 로그인하면 새 계정으로 가입 첫 화면부터 시작해요.</p>
        </div>
      </details>

      <h3 className="rapo-type-t6-bold mt-(--rapo-dimension-x8) text-(color:--rapo-color-fg-neutral)">남은 정보도 삭제하고 싶다면</h3>
      <p className="rapo-type-t4-regular mt-(--rapo-dimension-x2) break-keep text-(color:--rapo-color-fg-neutral-muted)">탈퇴 후에도 삭제를 요청할 수 있어요. 운영자가 확인한 뒤 처리해요.</p>
    </Frame>
  );
}
