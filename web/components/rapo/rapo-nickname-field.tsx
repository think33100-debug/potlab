'use client';

import { 닉네임규칙글, 닉네임문제, 닉네임최대 } from '@/lib/nickname';

/* 닉네임 칸 — 가입 ③ 과 프로필 편집이 같이 씁니다 (2026-11-17 세중님 「글자수 제한에 대해서도 잘 알려줘 · 적을 때 학생 임상가 모두」).
   칸 오른쪽에 「몇 자 / 10」 · 아래에 규칙 세 줄 · 적는 동안 규칙에 어긋나면 빨간 글로 바로 알려 줍니다.
   저장 뒤 DB 가 돌려준 글(겹친 닉네임·금지어)은 err 로 받아 같은 자리에 보여 줍니다.
   maxLength 를 최대보다 하나 크게 두어, 붙여 넣은 긴 닉네임도 잘리지 않고 「10자까지」 안내가 뜨게 합니다 */
/** 검사 — false 면 적는 동안 규칙 알림을 끕니다(아직 안 바꾼 옛 닉네임은 그대로 두므로 탓하지 않음) */
export function RapoNicknameField({ v, on, err, 잠김 = false, 검사 = true, 덧 }: {
  v: string; on: (v: string) => void; err?: string | null; 잠김?: boolean; 검사?: boolean; 덧?: React.ReactNode;
}) {
  const 길이 = v.trim().length;
  const 문제 = err || (검사 ? 닉네임문제(v) : null);
  const 넘침 = 검사 && 길이 > 닉네임최대;
  return (
    <div className="flex flex-col gap-(--rapo-dimension-x2)">
      <div className="relative">
        <input id="닉네임" value={v} onChange={(e) => on(e.target.value)} disabled={잠김} maxLength={닉네임최대 + 1}
          placeholder={`${닉네임규칙글[0].split(' ·')[0]}로 적어 주세요`} aria-label="닉네임" aria-invalid={!!문제} aria-describedby="닉네임-규칙"
          className={'rapo-type-t5-regular h-[56px] w-full min-w-0 rounded-(--rapo-radius-r3) border-(length:--rapo-border-default) bg-(--rapo-color-bg-layer-default) '
            + 'pl-(--rapo-dimension-x4) pr-[72px] text-(color:--rapo-color-fg-neutral) placeholder:text-(color:--rapo-color-fg-placeholder) disabled:opacity-40 '
            + (문제 ? 'border-(color:--rapo-color-stroke-critical-solid)' : 'border-(color:--rapo-color-stroke-neutral-weak)')} />
        {/* 글자 수 — 넘치면 빨간색 */}
        <span aria-live="polite" className={'rapo-type-t4-medium pointer-events-none absolute right-(--rapo-dimension-x4) top-1/2 -translate-y-1/2 whitespace-nowrap '
          + (넘침 ? 'text-(color:--rapo-color-fg-critical)' : 'text-(color:--rapo-color-fg-neutral-muted)')}>
          {길이}/{닉네임최대}
        </span>
      </div>
      {문제 && <p role="alert" className="rapo-type-t3-medium break-keep text-(color:--rapo-color-fg-critical)">{문제}</p>}
      {덧}
      <ul id="닉네임-규칙" className="flex flex-col gap-(--rapo-dimension-x1) rounded-(--rapo-radius-r3) bg-(--rapo-color-bg-neutral-weak) p-(--rapo-dimension-x4)">
        {닉네임규칙글.map((t) => (
          <li key={t} className="rapo-type-t3-regular flex gap-(--rapo-dimension-x2) break-keep text-(color:--rapo-color-fg-neutral-muted)">
            <span aria-hidden>·</span><span>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
