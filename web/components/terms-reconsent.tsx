'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/app/auth';
import { RapoButton } from '@/components/rapo/rapo-ui';
import { KAKAO_CHANNEL } from '@/lib/contact';
import { browserSupabase } from '@/lib/supabase-browser';
import { AGREEMENTS, TERMS_VERSION, 새약관시행됐나, 시행일말 } from '@/lib/terms';

/* 새 약관 다시 동의 창 (2026-11-16 세중님 확정 · 약관 부칙 ② 「시행일 전에 가입한 회원에게는 시행일 이후 처음 로그인할 때 동의를 받습니다」).

   ── 언제 뜨나 ────────────────────────────────────────────────
   시행 시각(lib/terms.ts 새약관시행시각 · 11/23 00:00 KST) 뒤 · 가입을 마친 회원 · 동의한 판(profiles.terms_version)이 지금 판과 다를 때.
   약관·문의·탈퇴 화면에서는 안 띄웁니다 — 읽고 묻고 떠날 길은 막지 않습니다.

   ── 무엇을 남기나 ─────────────────────────────────────────────
   동의남기기(판, 문서들) 로 약관동의 표에 줄 · 내 profiles 줄의 terms_version·terms_agreed_at (내 줄만 고치는 RLS).
   선택 항목(채용공고 알림)은 여기서 다시 묻지 않습니다 — 필수 넷만. */
const 안띄울길 = ['/terms', '/contact', '/me/leave', '/me/account', '/login', '/welcome', '/auth', '/master', '/beta'];

export function TermsReconsent() {
  const { me, reload } = useAuth();
  const path = usePathname() ?? '/';
  const [고름, set고름] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [탈, set탈] = useState<string | null>(null);
  const [끝, set끝] = useState(false);

  if (끝 || !me?.survey_at || !새약관시행됐나()) return null;
  if (me.terms_version === TERMS_VERSION) return null;
  if (안띄울길.some((p) => path === p || path.startsWith(p + '/'))) return null;

  const 필수 = AGREEMENTS.filter((a) => a.required);
  const 다됨 = 필수.every((a) => 고름[a.key]);

  const 동의 = async () => {
    if (!다됨 || busy) return;
    setBusy(true); set탈(null);
    const sb = browserSupabase();
    const a = await sb.rpc('동의남기기', { p_판: TERMS_VERSION, p_문서들: Object.fromEntries(필수.map((x) => [x.key, true])) });
    const b = a.error ? null : await sb.from('profiles').update({ terms_version: TERMS_VERSION, terms_agreed_at: new Date().toISOString() }).eq('id', me.id);
    setBusy(false);
    if (a.error || b?.error) { set탈('저장하지 못했어요. 잠시 뒤 다시 눌러 주세요.'); return; }
    set끝(true);
    await reload();
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="새약관제목" data-rapo
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 md:items-center">
      <div className="max-h-[92dvh] w-full max-w-[480px] overflow-y-auto rounded-t-(--rapo-radius-r5) bg-(--rapo-color-bg-layer-default) p-(--rapo-dimension-x6) md:rounded-(--rapo-radius-r5)">
        <h2 id="새약관제목" className="rapo-type-t9-bold break-keep text-(color:--rapo-color-fg-neutral)">약관이 바뀌었어요</h2>
        <p className="rapo-type-t4-regular mt-(--rapo-dimension-x2) break-keep text-(color:--rapo-color-fg-neutral-muted)">
          {시행일말}부터 새 약관을 적용해요. 계속 이용하시려면 아래 내용에 동의해 주세요.
        </p>
        <ul className="mt-(--rapo-dimension-x5) flex flex-col gap-(--rapo-dimension-x3)">
          {필수.map((a) => (
            <li key={a.key} className="flex flex-col gap-(--rapo-dimension-x1)">
              <div className="flex items-center gap-(--rapo-dimension-x3)">
                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-(--rapo-dimension-x3)">
                  <input type="checkbox" checked={!!고름[a.key]} onChange={(e) => set고름({ ...고름, [a.key]: e.target.checked })}
                    className="size-[20px] shrink-0 accent-(--rapo-color-bg-navy-solid)" />
                  <span className="rapo-type-t5-medium break-keep text-(color:--rapo-color-fg-neutral)">{a.label} <span className="text-(color:--rapo-color-fg-brand-contrast)">(필수)</span></span>
                </label>
                {a.doc && <Link href={`/terms/${a.doc}`} className="rapo-type-t3-regular shrink-0 underline underline-offset-2 text-(color:--rapo-color-fg-neutral-muted)">보기</Link>}
              </div>
              {a.lines && (
                <ul className="rapo-type-t3-regular ml-[32px] flex flex-col gap-(--rapo-dimension-x1) text-(color:--rapo-color-fg-neutral-muted)">
                  {a.lines.map((l) => <li key={l} className="break-keep">{l}</li>)}
                </ul>
              )}
            </li>
          ))}
        </ul>
        {탈 && <p role="alert" className="rapo-type-t4-medium mt-(--rapo-dimension-x3) text-(color:--rapo-color-fg-brand-contrast)">{탈}</p>}
        <div className="mt-(--rapo-dimension-x5)">
          <RapoButton full onClick={동의} disabled={!다됨 || busy}>{busy ? '저장하는 중…' : 다됨 ? '동의하고 계속하기' : '필수 항목에 모두 동의해 주세요'}</RapoButton>
        </div>
        {/* 막는 창이라 물을 길을 잘 보이게 (2026-11-16 세중님 「문의하기는 진입을 막을 때엔 잘 보이게 · 카톡 채널로」) */}
        <div className="mt-(--rapo-dimension-x4) flex items-center justify-between gap-(--rapo-dimension-x3)">
          <a href={KAKAO_CHANNEL} target="_blank" rel="noopener noreferrer" className="rapo-type-t4-bold text-(color:--rapo-color-fg-brand-contrast)">카카오톡으로 문의하기 ›</a>
          <Link href="/me/leave" className="rapo-type-t3-regular text-(color:--rapo-color-fg-neutral-muted) underline underline-offset-2">동의하지 않고 탈퇴하기</Link>
        </div>
      </div>
    </div>
  );
}
