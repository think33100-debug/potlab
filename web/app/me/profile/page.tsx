'use client';

import { useState } from 'react';
import { AvatarPicker } from '@/components/avatar-picker';
import { RapoMeFrame } from '@/components/rapo/rapo-me';
import { RapoButton, RapoChip } from '@/components/rapo/rapo-ui';
import { browserSupabase } from '@/lib/supabase-browser';
import { JOB_GROUPS, ROLES, ROLE_DESC } from '@/lib/who';
import { useAuth } from '../../auth';
import { useToast } from '../../toast';

const FREE_CHANGES = 5;

/* 프로필 편집 — 내 정보(U14-01)의 「프로필 편집」 (2026-11-11 밤).
   전 /me 한 장에 있던 사진 · 닉네임 · 직군·역할 칸을 그대로 옮겼습니다 — 저장 규칙은 같습니다.
   ★ 닉네임 5번 제한은 DB 트리거가 막습니다(화면은 남은 횟수만 알립니다) */
export default function ProfileEdit() {
  return <RapoMeFrame title="프로필 편집">{(me) => <ProfileForm me={me} />}</RapoMeFrame>;
}

function ProfileForm({ me }: { me: NonNullable<ReturnType<typeof useAuth>['me']> }) {
  const toast = useToast();
  const { reload } = useAuth();
  const [typed, setTyped] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const nick = typed ?? me.nickname;
  const used = me.nickname_changes;
  const left = Math.max(0, FREE_CHANGES - used);
  const locked = left === 0;
  const nickChanged = nick.trim() !== me.nickname;

  const saveNick = async () => {
    const name = nick.trim();
    if (!nickChanged) return;
    if (name.length < 2 || name.length > 12) { setErr('2자에서 12자까지 쓸 수 있어요'); return; }
    if (!confirm(`앞으로 ${left}번 바꿀 수 있어요. 그다음부터는 유료로 바뀝니다. 바꿀까요?`)) return;
    setBusy(true); setErr(null);
    const { error } = await browserSupabase().from('profiles').update({ nickname: name }).eq('id', me.id);
    setBusy(false);
    if (error) {
      setErr(error.code === '23505' ? '이미 쓰고 있는 닉네임이에요'
        : error.message.includes('5번') ? '더 바꾸려면 결제가 필요해요'
        : `바꾸지 못했어요 — ${error.message}`);
      return;
    }
    await reload();
    toast(`닉네임이 바뀌었어요! ${left - 1}번 더 바꿀 수 있어요`);
  };

  /* 직군·역할 — 횟수 제한 없음(졸업하면 학생 → 현직) */
  const setWho = async (patch: { job_group?: string; role?: string }) => {
    const { error } = await browserSupabase().from('profiles').update(patch).eq('id', me.id);
    if (error) { toast(`바꾸지 못했어요 — ${error.message}`, { tone: 'danger' }); return; }
    await reload();
    toast(patch.role ? `${patch.role}으로 바꿨어요` : `${patch.job_group}로 바꿨어요`);
  };

  const 제목 = 'rapo-type-t7-bold text-(color:--rapo-color-fg-neutral)';
  const 설명 = 'rapo-type-t4-regular text-(color:--rapo-color-fg-neutral-muted)';

  return (
    <div className="flex flex-col gap-(--rapo-dimension-x8) pt-(--rapo-dimension-x4)">
      <section className="flex flex-col gap-(--rapo-dimension-x3)">
        <h2 className={제목}>프로필 사진</h2>
        <p className={설명}>고르면 바로 저장돼요</p>
        <AvatarPicker userId={me.id} value={me.avatar} onChange={reload} />
      </section>

      <section className="flex flex-col gap-(--rapo-dimension-x3)">
        <h2 className={제목}>닉네임</h2>
        <p className={설명}>{locked ? '무료로 바꿀 수 있는 5번을 다 쓰셨어요' : `${FREE_CHANGES}번 중 ${left}번 남았어요`}</p>
        <div className="flex gap-(--rapo-dimension-x2)">
          <input value={nick} onChange={(e) => { setTyped(e.target.value); setErr(null); }} disabled={locked} maxLength={12} aria-label="닉네임"
            className="rapo-type-t5-regular h-(--rapo-dimension-x13) min-w-0 flex-1 rounded-(--rapo-radius-r3) border-(length:--rapo-border-default)
                       border-(color:--rapo-color-stroke-neutral-weak) px-(--rapo-dimension-x4) text-(color:--rapo-color-fg-neutral) disabled:opacity-40" />
          <RapoButton onClick={saveNick} disabled={busy || locked || !nickChanged} tone="deep-coral" className="shrink-0">바꾸기</RapoButton>
        </div>
        {err && <p role="alert" className="rapo-type-t4-medium text-(color:--rapo-color-fg-brand-contrast)">{err}</p>}
        {locked && <p className={설명}>더 바꾸려면 결제가 필요해요. 결제는 아직 준비 중이에요.</p>}
      </section>

      <section className="flex flex-col gap-(--rapo-dimension-x3)">
        <h2 className={제목}>직군 · 역할</h2>
        <p className={설명}>커뮤니티에서 보이는 방이 역할로 갈려요. 졸업하시면 현직으로 바꿔 주세요. 누르면 바로 저장돼요.</p>
        <p className="rapo-type-t4-bold text-(color:--rapo-color-fg-neutral-muted)">직군</p>
        <div className="flex flex-wrap gap-(--rapo-dimension-x2)">
          {JOB_GROUPS.map((g) => <RapoChip key={g} label={g} on={me.job_group === g} onClick={() => setWho({ job_group: g })} />)}
        </div>
        <p className="rapo-type-t4-bold mt-(--rapo-dimension-x2) text-(color:--rapo-color-fg-neutral-muted)">역할</p>
        <div className="flex flex-wrap gap-(--rapo-dimension-x2)">
          {ROLES.map((r) => <RapoChip key={r} label={`${r} · ${ROLE_DESC[r]}`} on={me.role === r} onClick={() => setWho({ role: r })} />)}
        </div>
      </section>
    </div>
  );
}
