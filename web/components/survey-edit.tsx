'use client';

import { useEffect, useState } from 'react';
import { SignupSurvey } from '@/components/signup-survey';
import { toDraft, type Draft } from '@/lib/signup-fields';
import { browserSupabase } from '@/lib/supabase-browser';
import type { Role } from '@/lib/who';

/* 마이페이지 — 등록한 급여·스펙을 고칩니다. 1년에 2번까지.

   남은 횟수를 화면에 보여주긴 하지만 막는 자리는 여기가 아닙니다.
   save_my_survey 안에서 셉니다 — 화면에서만 막으면 요청을 직접 만들어 뚫립니다.

   회원에게는 두 표에 쓰기 권한이 아예 없습니다(revoke). 읽기만 됩니다. */

const FREE_EDITS = 2;

export function SurveyEdit({ profileId, role, job }: { profileId: string; role: Role; job: string }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [left, setLeft] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    const sb = browserSupabase();
    const [sal, spec, langs, prof] = await Promise.all([
      sb.from('salary_records').select('*').eq('profile_id', profileId).maybeSingle(),
      sb.from('student_specs').select('*').eq('profile_id', profileId).maybeSingle(),
      /* 어학은 표가 따로입니다 (spec_langs). 한 사람이 여러 줄입니다 */
      sb.from('spec_langs').select('exam,score,level').eq('profile_id', profileId),
      /* profiles 를 바로 읽지 않습니다 (2026-10-01) — 남에게 안 나가게 칸을 막았습니다.
         본인 것은 내프로필() 창구로 나옵니다 (그 함수가 auth.uid() 로 스스로 거릅니다) */
      sb.rpc('내프로필').maybeSingle(),
    ]);
    const bad = sal.error ?? spec.error ?? langs.error ?? prof.error;
    if (bad) { setErr(`불러오지 못했어요 — ${bad.message}`); return; }

    /* 내프로필() 은 만들어 둔 타입에 없어서 여기서 이름을 붙여 줍니다 */
    const 내것 = prof.data as { survey_edits: number | null; survey_edits_since: string | null } | null;

    /* 1년이 지났으면 횟수가 0 으로 돌아갑니다 — DB 함수와 같은 규칙입니다 */
    const since = 내것?.survey_edits_since ? new Date(내것.survey_edits_since) : null;
    const fresh = !since || Date.now() - since.getTime() >= 365 * 24 * 3600_000;
    setLeft(FREE_EDITS - (fresh ? 0 : (내것?.survey_edits ?? 0)));
    setDraft(toDraft(sal.data, spec.data, langs.data ?? []));
  };

  useEffect(() => { load().catch((e) => setErr(String(e))); },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [profileId]);

  if (open && draft) {
    return (
      <section className="pt-(--rapo-dimension-x4)">
        <SignupSurvey
          userId={profileId} job={job} role={role}
          initial={draft} editsLeft={left ?? FREE_EDITS}
          onDone={async () => { setOpen(false); await load(); }}
        />
        <button type="button" onClick={() => setOpen(false)}
          className="mt-5 text-sm text-mute hover:underline">
          그만두고 돌아가기
        </button>
      </section>
    );
  }

  const none = left === 0;

  /* 닫힌 모양 — 새 디자인 토큰 (2026-11-14 세중님 「이 부분도 수정」). 쓰는 곳은 /me/spec 하나라 위 여백·윗선을 뺐습니다(전에는 빈 띠와 선이 떠 보였음).
     고치는 설문(SignupSurvey)은 아직 옛 모양입니다 — 피그마 「U14-SPEC-*」는 다음 차례 */
  return (
    <section className="flex flex-col gap-(--rapo-dimension-x4) pt-(--rapo-dimension-x4)">
      <div className="flex flex-col gap-(--rapo-dimension-x2) rounded-(--rapo-radius-r3) bg-(--rapo-color-bg-neutral-weak) p-(--rapo-dimension-x5)">
        <h2 className="rapo-type-t7-bold text-(color:--rapo-color-fg-neutral)">급여 · 스펙</h2>
        <p className="rapo-type-t4-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">
          {left === null ? '불러오는 중이에요…'
            : none ? '올해 고칠 수 있는 2번을 다 쓰셨어요'
            : `1년에 2번 고칠 수 있어요. ${left}번 남았어요`}
        </p>
        {/* 남은 횟수를 눈금으로도 */}
        {left !== null && (
          <div className="flex gap-(--rapo-dimension-x1)" aria-hidden>
            {Array.from({ length: FREE_EDITS }, (_, i) => (
              <span key={i} className={'h-[4px] w-[28px] rounded-full ' + (i < FREE_EDITS - left ? 'bg-(--rapo-color-stroke-neutral-muted)' : 'bg-(--rapo-color-bg-navy-solid)')} />
            ))}
          </div>
        )}
      </div>

      {err && <p role="alert" className="rapo-type-t4-regular break-keep text-(color:--rapo-color-fg-critical-contrast)">{err}</p>}

      <button type="button" disabled={!draft || none} onClick={() => setOpen(true)}
        className="rapo-type-t6-bold flex h-(--rapo-dimension-x13) w-full items-center justify-center rounded-(--rapo-radius-r3) bg-(--rapo-color-bg-navy-solid)
                   text-(color:--rapo-color-fg-on-navy-solid) enabled:active:bg-(--rapo-color-bg-navy-solid-pressed)
                   disabled:cursor-not-allowed disabled:bg-(--rapo-color-bg-disabled) disabled:text-(color:--rapo-color-fg-disabled)">
        급여 · 스펙 고치기
      </button>

      {none && (
        <p className="rapo-type-t4-regular break-keep rounded-(--rapo-radius-r3) bg-(--rapo-color-bg-neutral-weak) p-(--rapo-dimension-x5) text-(color:--rapo-color-fg-neutral)">
          다음 해가 되면 다시 2번 고칠 수 있어요.
          <span className="rapo-type-t3-regular mt-(--rapo-dimension-x1) block text-(color:--rapo-color-fg-neutral-muted)">자료가 자꾸 바뀌면 통계를 믿을 수 없어서 횟수를 둡니다</span>
        </p>
      )}
    </section>
  );
}
