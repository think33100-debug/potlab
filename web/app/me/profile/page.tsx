'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { Avatar } from '@/components/avatar';
import { PhotoCropper } from '@/components/photo-cropper';
import { RapoMeFrame } from '@/components/rapo/rapo-me';
import { RapoButton } from '@/components/rapo/rapo-ui';
import { AVATAR_ANIMALS, AVATAR_COLORS, isPhoto, parseAvatar, withAnimal, withColor, withPhoto } from '@/lib/avatar';
import { RapoNicknameField } from '@/components/rapo/rapo-nickname-field';
import { 닉네임문제 } from '@/lib/nickname';
import { browserSupabase } from '@/lib/supabase-browser';
import { useAuth } from '../../auth';
import { useToast } from '../../toast';

const FREE_CHANGES = 5;

/* 프로필 편집 — 피그마 「12 · 내 정보」 08 프로필 편집 1508:2532 (2026-11-15 세중님 「내정보 쪽이 예전 게 많은 거 같아 … 피그마 확인해서 수정」).
   위에서부터 — 내 프로필 미리보기 · 닉네임 · 프로필 동물 여섯 · 배경색 · 프로필 사진 직접 올리기 · 저장.
   동물·배경색·닉네임은 고른 뒤 「저장」 한 번에 담습니다(전에는 누르는 대로 바로 저장).
   사진은 자르기 화면을 거쳐 그 자리에서 올립니다(전과 같음 · 저장소 avatars).

   피그마에 없어 빠진 것 — 이모지 고르기 · 직군·역할 바꾸기.
     역할은 학생 → 임상가 전환(/me/convert · 근무 후기 필수)으로만 바꿉니다. 여기서 바로 바꾸면 그 길을 건너뜁니다.
     직군을 잘못 고른 분은 문의하기로.
   ★ 닉네임 5번 제한은 DB 트리거가 막습니다(화면은 남은 횟수만 알립니다) */
export default function ProfileEdit() {
  return <RapoMeFrame title="프로필 편집">{(me) => <ProfileForm me={me} />}</RapoMeFrame>;
}

function ProfileForm({ me }: { me: NonNullable<ReturnType<typeof useAuth>['me']> }) {
  const toast = useToast();
  const { reload } = useAuth();
  const [nick, setNick] = useState(me.nickname);
  const [그림, set그림] = useState<string | null>(me.avatar);
  const [사진, set사진] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const 파일 = useRef<HTMLInputElement>(null);

  const left = Math.max(0, FREE_CHANGES - me.nickname_changes);
  const locked = left === 0;
  const 닉바뀜 = nick.trim() !== me.nickname;
  const 그림바뀜 = 그림 !== me.avatar;
  const 지금 = parseAvatar(그림);
  const 고른동물 = 지금.kind === 'animal' ? 지금.key : null;

  /* 사진 → 동물로 바꾸면 사진은 되돌릴 수 없어 한 번 묻습니다 (바탕색은 사진을 그대로 둠) */
  const 동물고르기 = (key: string) => {
    if (isPhoto(그림) && !confirm('프로필 사진 대신 동물로 바꿀까요? 지금 사진은 되돌릴 수 없어요')) return;
    set그림(withAnimal(그림, key));
  };

  const 저장 = async () => {
    if (busy || (!닉바뀜 && !그림바뀜)) return;
    const name = nick.trim();
    if (닉바뀜) {
      /* 4~10자 · 자음·모음 낱자 금지는 lib/nickname.ts · 비속어·음란 용어는 DB 가 가립니다 (2026-11-17 세중님 · 금고 SQL_1113/ZZD) — 닉네임을 바꿀 때만 봅니다 */
      const 문제 = 닉네임문제(name);
      if (문제 || !name) { setErr(문제 ?? '닉네임을 적어 주세요'); return; }
      if (!confirm(`닉네임은 앞으로 ${left}번 바꿀 수 있어요. 그다음부터는 유료로 바뀝니다. 바꿀까요?`)) return;
    }
    setBusy(true); setErr(null);
    const 바꿀 = { ...(닉바뀜 ? { nickname: name } : {}), ...(그림바뀜 ? { avatar: 그림 } : {}) };
    const { error } = await browserSupabase().from('profiles').update(바꿀).eq('id', me.id);
    setBusy(false);
    if (error) {
      setErr(error.code === '23505' ? '이미 쓰고 있는 닉네임이에요'
        : error.code === '22023' ? error.message
        : error.message.includes('5번') ? '닉네임을 더 바꾸려면 결제가 필요해요'
        : `저장하지 못했어요 — ${error.message}`);
      return;
    }
    await reload();
    toast('프로필을 저장했어요');
  };

  /* 사진 올리기 — 자른 400x400 WebP 를 저장소에 올리고 바로 담습니다 (전과 같음) */
  const 올리기 = async (blob: Blob) => {
    setBusy(true);
    try {
      const path = `${me.id}/${Date.now()}.webp`;
      const sb = browserSupabase();
      const { error } = await sb.storage.from('avatars').upload(path, blob, { contentType: 'image/webp', upsert: true });
      if (error) throw error;
      const next = withPhoto(그림, path);
      const r = await sb.from('profiles').update({ avatar: next }).eq('id', me.id);
      if (r.error) throw r.error;
      set그림(next);
      await reload();
      toast('프로필 사진이 바뀌었어요');
    } catch (e) {
      toast(`사진을 올리지 못했어요 — ${(e as Error).message}`, { tone: 'danger', ms: 4000 });
    }
    set사진(null);
    setBusy(false);
  };

  if (사진) return <div className="pt-(--rapo-dimension-x4)"><PhotoCropper file={사진} onDone={올리기} onCancel={() => set사진(null)} /></div>;

  const 소제목 = 'rapo-type-t6-bold text-(color:--rapo-color-fg-neutral)';

  return (
    <div className="flex flex-col gap-(--rapo-dimension-x8) pt-(--rapo-dimension-x4)">
      {/* 내 프로필 미리보기 */}
      <div className="flex items-center gap-(--rapo-dimension-x4) rounded-(--rapo-radius-r4) bg-(--rapo-color-bg-positive-weak) p-(--rapo-dimension-x5)">
        <Avatar value={그림} size="profile" className="shrink-0" />
        <div className="min-w-0">
          <p className="rapo-type-t3-regular text-(color:--rapo-color-fg-neutral-muted)">내 프로필</p>
          <p className="rapo-type-t8-bold truncate text-(color:--rapo-color-fg-neutral)">{nick.trim() || me.nickname}</p>
        </div>
      </div>

      <section className="flex flex-col gap-(--rapo-dimension-x2)">
        <label htmlFor="닉네임" className="rapo-type-t5-medium text-(color:--rapo-color-fg-neutral)">닉네임</label>
        {/* 글자 수 · 규칙 안내 · 적는 동안 알림 — 가입 화면과 같은 칸 (2026-11-17 세중님 「적을 때 학생 임상가 모두」) */}
        <RapoNicknameField v={nick} on={(v) => { setNick(v); setErr(null); }} 잠김={locked} 검사={닉바뀜}
          덧={<p className="rapo-type-t3-regular text-(color:--rapo-color-fg-neutral-muted)">
            {locked ? '무료로 바꿀 수 있는 5번을 다 쓰셨어요. 결제는 아직 준비 중이에요.' : `닉네임은 ${FREE_CHANGES}번 중 ${left}번 더 바꿀 수 있어요.`}
          </p>} />
      </section>

      <section className="flex flex-col gap-(--rapo-dimension-x3)">
        <h2 className={소제목}>프로필 동물</h2>
        <div className="grid grid-cols-3 justify-items-center gap-(--rapo-dimension-x4)">
          {AVATAR_ANIMALS.map((a) => (
            <button key={a.key} type="button" aria-label={a.name} aria-pressed={고른동물 === a.key} disabled={busy} onClick={() => 동물고르기(a.key)}
              className={'flex size-[72px] items-center justify-center overflow-hidden rounded-(--rapo-radius-full) disabled:opacity-40 '
                + (고른동물 === a.key ? 'ring-2 ring-(--rapo-color-fg-positive) ring-offset-2' : '')}
              style={{ background: 지금.color }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 SVG 그대로 */}
              <img src={`/rapo/animals/${a.key}.svg`} alt="" width={72} height={72} className="size-full" />
            </button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-(--rapo-dimension-x3)">
        <h2 className={소제목}>배경색</h2>
        {/* 여덟 색을 한 줄 고른 칸으로 (2026-11-16 세중님 테스터 점검 — 375 폭에서 36px 동그라미 여덟이 안 들어가
            마지막 하나만 둘째 줄에 혼자 섰습니다). 칸 폭에 맞춰 줄고 36px 을 넘지 않습니다 — 320 폭에서 약 27px */}
        <div className="grid grid-cols-8 justify-items-center gap-(--rapo-dimension-x2)">
          {AVATAR_COLORS.map((c) => (
            <button key={c} type="button" aria-label={'배경색 ' + c} aria-pressed={지금.color === c} disabled={busy} onClick={() => set그림(withColor(그림, c))}
              className={'aspect-square w-full max-w-[36px] rounded-(--rapo-radius-full) disabled:opacity-40 ' + (지금.color === c ? 'ring-2 ring-(--rapo-color-fg-neutral) ring-offset-2' : '')}
              style={{ background: c }} />
          ))}
        </div>
      </section>

      <div>
        <RapoButton full tone="outline" disabled={busy} onClick={() => 파일.current?.click()}>프로필 사진 직접 올리기</RapoButton>
        <input ref={파일} type="file" accept="image/*" hidden onChange={(e) => {
          const f = e.target.files?.[0]; e.target.value = '';
          if (f && (!isPhoto(그림) || confirm('프로필 사진을 바꿀까요? 지금 사진은 되돌릴 수 없어요'))) set사진(f);
        }} />
      </div>

      {err && <p role="alert" className="rapo-type-t4-medium text-(color:--rapo-color-fg-critical)">{err}</p>}
      <RapoButton full onClick={저장} disabled={busy || (!닉바뀜 && !그림바뀜)}>{busy ? '저장하는 중…' : '저장'}</RapoButton>

      <p className="rapo-type-t3-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">
        직군을 잘못 고르셨다면 <Link href="/contact" className="underline underline-offset-2">문의하기</Link>로 알려 주세요.
        {me.role === '학생' && <> 취업하셨다면 <Link href="/me/convert" className="underline underline-offset-2">임상가 전환</Link>에서 바꿔요.</>}
      </p>
    </div>
  );
}
