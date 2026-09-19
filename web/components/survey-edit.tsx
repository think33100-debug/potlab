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
    const [sal, spec, prof] = await Promise.all([
      sb.from('salary_records').select('*').eq('profile_id', profileId).maybeSingle(),
      sb.from('student_specs').select('*').eq('profile_id', profileId).maybeSingle(),
      sb.from('profiles').select('survey_edits,survey_edits_since').eq('id', profileId).maybeSingle(),
    ]);
    const bad = sal.error ?? spec.error ?? prof.error;
    if (bad) { setErr(`불러오지 못했어요 — ${bad.message}`); return; }

    /* 1년이 지났으면 횟수가 0 으로 돌아갑니다 — DB 함수와 같은 규칙입니다 */
    const since = prof.data?.survey_edits_since ? new Date(prof.data.survey_edits_since) : null;
    const fresh = !since || Date.now() - since.getTime() >= 365 * 24 * 3600_000;
    setLeft(FREE_EDITS - (fresh ? 0 : (prof.data?.survey_edits ?? 0)));
    setDraft(toDraft(sal.data, spec.data));
  };

  useEffect(() => { load().catch((e) => setErr(String(e))); },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [profileId]);

  if (open && draft) {
    return (
      <section className="mt-8 border-t border-gray-100 pt-7 dark:border-gray-800">
        <SignupSurvey
          userId={profileId} job={job} role={role}
          initial={draft} editsLeft={left ?? FREE_EDITS}
          onDone={async () => { setOpen(false); await load(); }}
        />
        <button type="button" onClick={() => setOpen(false)}
          className="mt-5 text-sm text-gray-500 hover:underline">
          그만두고 돌아가기
        </button>
      </section>
    );
  }

  const none = left === 0;

  return (
    <section className="mt-8 border-t border-gray-100 pt-7 dark:border-gray-800">
      <h2 className="text-h3 font-bold">급여 · 스펙</h2>
      <p className="mt-1 text-lg text-gray-500">
        {left === null ? '불러오는 중이에요…'
          : none ? '올해 고칠 수 있는 2번을 다 쓰셨어요'
          : `1년에 2번 고칠 수 있어요. ${left}번 남았어요`}
      </p>

      {/* 남은 횟수를 눈금으로도 — 닉네임 칸과 같은 방식입니다 */}
      {left !== null && (
        <div className="mt-2 flex gap-1" aria-hidden>
          {Array.from({ length: FREE_EDITS }, (_, i) => (
            <span key={i}
              className={'h-1 w-[28px] rounded-md ' + (i < FREE_EDITS - left ? 'bg-gray-200 dark:bg-gray-700' : 'bg-teal-strong')} />
          ))}
        </div>
      )}

      {err && <p className="mt-2 text-lg text-brand-red">{err}</p>}

      <button type="button" disabled={!draft || none} onClick={() => setOpen(true)}
        className="mt-5 rounded-md border border-gray-200 px-6 py-4 text-lg font-medium disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700">
        고치기
      </button>

      {none && (
        <p className="mt-5 rounded-sm bg-brand-red-soft p-6 text-lg text-brand-red-dark">
          다음 해가 되면 다시 2번 고칠 수 있어요.
          <span className="mt-1 block text-sm">자료가 자꾸 바뀌면 통계를 믿을 수 없어서 횟수를 둡니다</span>
        </p>
      )}
    </section>
  );
}
