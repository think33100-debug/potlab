'use client';

import { useEffect, useRef, useState } from 'react';
import { 표없음 } from '@/lib/beta';
import { RapoButton } from '@/components/rapo/rapo-ui';
import { 비교알림동의, 비교창, 연락처꼴, 연봉구간, 연봉물음 } from '@/lib/beta-compare';
import { browserSupabase } from '@/lib/supabase-browser';
import { JOB_GROUPS, type JobGroup } from '@/lib/who';

/* 「가입하기」를 누른 뒤 뜨는 창 — 「내 연봉, 다른 치료사들과 비교해 볼래요?」
   (2026-11-11 세중님 결정 · 줄 A · 문구는 lib/beta-compare.ts 의 비교창 그대로).
   ★ **꺼 둡니다 · 13일 뒤 켬** — lib/beta-compare.ts 의 비교알림켜짐 하나가 문입니다.

   ── 지킬 것 (세중님) ──────────────────────────────────────────
   · 미리 체크하지 않습니다 — 아무것도 고른 채로 시작하지 않습니다
   · [알림 받을래요] [다음에 할게요] 두 단추는 **같은 크기**입니다
   · 창을 **본 것**과 **신청한 것**을 따로 남깁니다 — 보고서의
     「가입 N명 중 창 본 M명 중 신청 K명」을 세려고요
       본 것    → `비교알림창` 표 (창이 뜰 때 한 줄)
       신청한 것 → `비교알림신청` 표 (연락처·직군·연봉 구간)
   · 실제 알림 발송은 만들지 않습니다

   ── 누가 무엇을 보나 ─────────────────────────────────────────
   두 표 모두 **본인은 자기 줄을 넣기만**, 읽기는 관리자만입니다 (RLS).
   연락처는 회원 화면 어디에도 다시 그리지 않습니다. */
export function CompareNotify({
  userId, job, email, onDone,
}: {
  userId: string;
  job: JobGroup | null;
  /** 로그인 수단이 준 이메일 — 연락처 칸을 미리 채우는 데만 씁니다 (고칠 수 있습니다) */
  email: string | null;
  onDone: () => void;
}) {
  const [단계, set단계] = useState<'묻기' | '적기' | '끝'>('묻기');
  const [연락처, set연락처] = useState(email ?? '');
  const [직군, set직군] = useState<JobGroup | null>(job);
  const [구간, set구간] = useState<string>('');
  const [자세히, set자세히] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [끝말, set끝말] = useState('신청됐어요. 서비스가 열리면 가장 먼저 알려 드릴게요.');

  /* 창을 「본 것」 — 뜰 때 한 번만 남깁니다.
     두 번 넣어도(개발 모드의 두 번 그리기 · 새로고침) 23505 로 막히고 그건 괜찮습니다 */
  const 남겼나 = useRef(false);
  useEffect(() => {
    if (남겼나.current) return;
    남겼나.current = true;
    browserSupabase().from('비교알림창').insert({ 사람: userId }).then(({ error }) => {
      if (error && error.code !== '23505' && !표없음(error)) {
        console.error('[RAPO] 비교 알림 창을 본 기록을 못 남겼습니다 ·', error.code, error.message);
      }
    });
  }, [userId]);

  const 신청 = async () => {
    if (!연락처꼴(연락처)) { setErr('이메일을 적어 주세요'); return; }
    if (!직군) { setErr('직군을 골라 주세요'); return; }
    if (!구간) { setErr('연봉 구간을 골라 주세요'); return; }
    setBusy(true); setErr(null);
    const { error } = await browserSupabase().from('비교알림신청').insert({
      사람: userId, 연락처: 연락처.trim(), 직군, 연봉구간: 구간,
    });
    setBusy(false);
    if (error && error.code === '23505') {
      set끝말('이미 신청하셨어요. 서비스가 열리면 알려 드릴게요.');
    } else if (error && 표없음(error)) {
      set끝말('지금은 신청을 받지 못했어요. 서비스가 열리기 전에 다시 여쭤볼게요.');
    } else if (error) {
      setErr(`저장하지 못했어요 — ${error.message}`);
      return;
    }
    set단계('끝');
  };

  /* ── 그리기 — 새 디자인 꼴 (2026-11-12 저녁 세중님 「옛날 거 그대로 · 피그마 참고해서」).
     피그마에 이 창 원본은 없어 가입 화면(U05)의 조각을 씁니다: 아래에서 올라오는 판 · navy/outline 단추(52) ·
     brand-weak 고르기 카드 · 입력 칸(r3 · stroke-neutral-weak). 두 단추는 같은 크기(세중님) */
  const 칸 = 'rapo-type-t5-regular h-(--rapo-dimension-x13) w-full rounded-(--rapo-radius-r3) border-(length:--rapo-border-default) ' +
    'border-(color:--rapo-color-stroke-neutral-weak) bg-(--rapo-color-bg-layer-default) px-(--rapo-dimension-x4) text-(color:--rapo-color-fg-neutral) ' +
    'placeholder:text-(color:--rapo-color-fg-placeholder)';
  const 칸이름 = 'rapo-type-t4-bold block text-(color:--rapo-color-fg-neutral)';
  const 상세 = 비교알림동의;

  return (
    <div
      data-rapo
      role="dialog"
      aria-modal="true"
      aria-labelledby="compare-notify-title"
      className="fixed inset-0 z-[70] flex items-end justify-center bg-(--rapo-color-bg-overlay) md:items-center md:p-(--rapo-dimension-x4)"
    >
      <div className="max-h-[90dvh] w-full max-w-[26rem] overflow-y-auto rounded-t-(--rapo-radius-r5) bg-(--rapo-color-bg-layer-default)
                      px-(--rapo-dimension-x5) pt-(--rapo-dimension-x6) pb-[calc(var(--rapo-dimension-x5)+env(safe-area-inset-bottom))] md:rounded-(--rapo-radius-r5)">
        {단계 === '묻기' && (
          <>
            <p className="rapo-type-t3-bold text-(color:--rapo-color-fg-brand)">연봉·스펙 비교 · 준비 중</p>
            <h2 id="compare-notify-title" className="rapo-type-t9-bold mt-(--rapo-dimension-x2) break-keep text-(color:--rapo-color-fg-neutral)">{비교창.제목}</h2>
            <p className="rapo-type-t5-regular mt-(--rapo-dimension-x3) break-keep text-(color:--rapo-color-fg-neutral-muted)">{비교창.무엇}</p>
            <p className="rapo-type-t5-regular mt-(--rapo-dimension-x1) break-keep text-(color:--rapo-color-fg-neutral-muted)">{비교창.설명}</p>
            <ul className="mt-(--rapo-dimension-x4) flex flex-col gap-(--rapo-dimension-x2) rounded-(--rapo-radius-r3) bg-(--rapo-color-bg-brand-weak) p-(--rapo-dimension-x4)">
              {비교창.점.map((t) => (
                <li key={t} className="rapo-type-t5-medium flex gap-(--rapo-dimension-x2) break-keep text-(color:--rapo-color-fg-neutral)">
                  <span aria-hidden className="text-(color:--rapo-color-fg-brand)">✓</span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
            <p className="rapo-type-t3-regular mt-(--rapo-dimension-x3) break-keep text-(color:--rapo-color-fg-neutral-muted)">{비교창.안내}</p>

            <div className="mt-(--rapo-dimension-x5) grid grid-cols-2 gap-(--rapo-dimension-x2)">
              <RapoButton tone="outline" full onClick={onDone}>{비교창.다음}</RapoButton>
              <RapoButton full onClick={() => set단계('적기')}>{비교창.받기}</RapoButton>
            </div>

            <p className="rapo-type-t2-regular mt-(--rapo-dimension-x4) break-keep text-(color:--rapo-color-fg-neutral-subtle)">
              {비교창.작은글}{' '}
              <button type="button" onClick={() => set자세히(!자세히)} aria-expanded={자세히} className="underline underline-offset-2">
                자세히 보기
              </button>
            </p>
            {자세히 && 상세 && (
              <ul className="rapo-type-t2-regular mt-(--rapo-dimension-x2) flex flex-col gap-(--rapo-dimension-x1) rounded-(--rapo-radius-r2) bg-(--rapo-color-bg-neutral-weak) p-(--rapo-dimension-x3) text-(color:--rapo-color-fg-neutral-muted)">
                {상세.lines.map((l) => <li key={l} className="break-keep">{l}</li>)}
              </ul>
            )}
          </>
        )}

        {단계 === '적기' && (
          <>
            <h2 id="compare-notify-title" className="rapo-type-t9-bold break-keep text-(color:--rapo-color-fg-neutral)">알림 받을 이메일을 적어 주세요</h2>
            <p className="rapo-type-t4-regular mt-(--rapo-dimension-x2) break-keep text-(color:--rapo-color-fg-neutral-muted)">
              서비스가 열릴 때 이메일로 한 번 보내요. 이 밖의 일에는 쓰지 않아요.
            </p>

            <label className={칸이름 + ' mt-(--rapo-dimension-x5)'} htmlFor="compare-contact">이메일</label>
            <input id="compare-contact" type="email" value={연락처}
              onChange={(e) => { set연락처(e.target.value); setErr(null); }}
              inputMode="email" autoComplete="email" placeholder="example@email.com"
              className={칸 + ' mt-(--rapo-dimension-x2)'} />

            <p className={칸이름 + ' mt-(--rapo-dimension-x5)'}>직군</p>
            <div className="mt-(--rapo-dimension-x2) grid grid-cols-2 gap-(--rapo-dimension-x2)">
              {JOB_GROUPS.map((g) => (
                <button key={g} type="button" aria-pressed={직군 === g} onClick={() => { set직군(g); setErr(null); }}
                  className={'rapo-type-t5-bold h-(--rapo-dimension-x13) rounded-(--rapo-radius-r3) border-(length:--rapo-border-default) ' +
                    (직군 === g
                      ? 'border-(color:--rapo-color-fg-brand-contrast) bg-(--rapo-color-bg-brand-weak) text-(color:--rapo-color-fg-neutral)'
                      : 'border-(color:--rapo-color-stroke-neutral-weak) text-(color:--rapo-color-fg-neutral-muted) active:bg-(--rapo-color-bg-transparent-pressed)')}>
                  {g}
                </button>
              ))}
            </div>

            {/* 2026-11-12 저녁 세중님 문구 — 「연봉 구간」 대신 묻는 말로 */}
            <label className={칸이름 + ' mt-(--rapo-dimension-x5) break-keep'} htmlFor="compare-band">{연봉물음.제목}</label>
            <p className="rapo-type-t3-regular mt-(--rapo-dimension-x1) text-(color:--rapo-color-fg-brand)">{연봉물음.덧말}</p>
            <select id="compare-band" value={구간} onChange={(e) => { set구간(e.target.value); setErr(null); }}
              className={칸 + ' mt-(--rapo-dimension-x2)'}>
              <option value="">세전 · 대략 골라 주세요</option>
              {연봉구간.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>

            {err && <p role="alert" className="rapo-type-t4-medium mt-(--rapo-dimension-x3) text-(color:--rapo-color-fg-critical)">{err}</p>}

            <div className="mt-(--rapo-dimension-x6) grid grid-cols-2 gap-(--rapo-dimension-x2)">
              <RapoButton tone="outline" full disabled={busy} onClick={onDone}>{비교창.다음}</RapoButton>
              <RapoButton full loading={busy} onClick={신청}>신청하기</RapoButton>
            </div>
          </>
        )}

        {단계 === '끝' && (
          <>
            <h2 id="compare-notify-title" className="rapo-type-t9-bold break-keep text-(color:--rapo-color-fg-neutral)">{끝말}</h2>
            <div className="mt-(--rapo-dimension-x6)">
              <RapoButton full onClick={onDone}>가입 이어서 하기</RapoButton>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
