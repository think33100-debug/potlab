'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AvatarPicker } from '@/components/avatar-picker';
import { CompareNotify } from '@/components/compare-notify';
import { 비교알림켜짐 } from '@/lib/beta-compare';
import { SignupSurvey } from '@/components/signup-survey';
import { defaultAvatar } from '@/lib/avatar';
import { BETA_AGREEMENTS, 표없음 } from '@/lib/beta';
import { RapoButton } from '@/components/rapo/rapo-ui';
import { clearAfterLogin, peekAfterLogin } from '@/lib/after-login';
import { browserSupabase } from '@/lib/supabase-browser';
import { AGREEMENTS, TERMS_VERSION } from '@/lib/terms';
import { JOB_GROUPS, ROLES, ROLE_DESC, type JobGroup, type Role } from '@/lib/who';

import { useAuth } from '../auth';
import { useToast } from '../toast';

export default function Welcome() {
  const router = useRouter();
  const toast = useToast();
  const { loading, session, me, reload } = useAuth();

  /* 아직 안 누르셨으면 이미 채운 데까지 보고 자리를 정합니다.
     닉네임을 넣은 뒤 창을 닫았다가 다시 들어오면 ① 부터 다시 시켜서는 안 됩니다 —
     profiles 줄이 이미 있어서 또 만들려다 막힙니다 */
  const [stepPick, setStepPick] = useState<1 | 2 | 3 | 4 | 5 | null>(null);
  const [job, setJob] = useState<JobGroup | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [nick, setNick] = useState('');
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [nickErr, setNickErr] = useState<string | null>(null);
  /* ② 에서 방금 줄을 만든 경우입니다.
     이걸 안 두면 줄이 생기는 순간 「이미 가입한 분」 으로 몰려
     ③ 사진 칸을 못 보고 홈으로 튕깁니다 */
  const [justMade, setJustMade] = useState(false);

  /* 첫 단계 「다음」에서 베타 동의를 못 남겼을 때의 글 (2026-11-11 밤 — 초대 코드는 거뒀습니다) */
  const [betaErr, setBetaErr] = useState<string | null>(null);
  /* 「가입하기」 뒤 비교 알림 창 — 비교알림켜짐 이 false 면 한 번도 안 뜹니다 (lib/beta-compare.ts) */
  const [compareOpen, setCompareOpen] = useState(false);
  /* ⑤ 급여 정보 (선택) — 안내(피그마 U05-05)에서 「직접 입력하기」를 누르면 true (2026-11-12 저녁 세중님 「급여는 선택」) */
  const [급여입력, set급여입력] = useState(false);

  /* 아무것도 안 고르셨으면 기본 아바타. 상태로 안 두고 계산합니다 —
     effect 안에서 setState 하면 그릴 때마다 한 번 더 그립니다 */
  const avatar = picked ?? (session ? defaultAvatar(session.user.id) : '');
  const setAvatar = setPicked;

  const resume = !me ? 1 : (me.job_group && me.role) ? 5 : 2;
  const step = stepPick ?? resume;
  const setStep = setStepPick;

  useEffect(() => {
    if (loading) return;
    if (!session) { router.replace('/login'); return; }
    /* 가입을 「마쳤다」의 기준은 급여·스펙까지입니다. 닉네임만으로는 아닙니다 */
    if (me?.survey_at && !justMade) router.replace('/');
  }, [loading, session, me, router, justMade]);

  if (loading || !session) {
    return <main className="mx-auto w-full max-w-2xl px-6 py-8 pb-[88px] md:px-7 md:pb-8"><p className="text-lg text-mute">잠시만요…</p></main>;
  }

  /* ★ 2026-11-11 — 베타 동의(개인정보 [필수] · 설문 경품 [선택])를 기존 동의 뒤에 더합니다.
     기존 다섯 항목과 동의남기기() 는 그대로입니다 (그 창구는 다섯 키만 받습니다).
     베타 동의는 `베타동의` 표의 내 줄로 남습니다 — 아래 베타동의남기기() */
  /* 2026-11-12 저녁 세중님 — ① 「연봉·스펙 비교 알림 신청」 동의는 1단계에서 뺍니다(가입 뒤 알림 창에서 다시 묻습니다 ·
     창의 「알림 받을래요」가 그 동의입니다). ② 선택 항목은 전부 필수 아래로 모읍니다 */
  type 동의줄 = { key: string; label: string; required: boolean; doc?: string; lines?: string[] };
  const 모든동의: 동의줄[] = [...AGREEMENTS, ...BETA_AGREEMENTS];
  const 필수동의 = 모든동의.filter((a) => a.required);
  const 선택동의 = 모든동의.filter((a) => !a.required);
  const required = 모든동의.filter((a) => a.required);
  const allRequired = required.every((a) => checked[a.key]);
  const allChecked = 모든동의.every((a) => checked[a.key]);

  const toggleAll = () => {
    const on = !allChecked;
    setChecked(Object.fromEntries(모든동의.map((a) => [a.key, on])));
  };

  /* ① 「다음」 — 베타 동의를 `베타동의` 표의 내 줄로 남깁니다.
     2026-11-11 밤 세중님 — 초대 코드는 거둡니다(누구나 가입). 그래서 여기서 가입을 막지 않고
     동의만 적습니다. 표가 아직 없으면(SQL 올리기 전) 그냥 넘어갑니다 */
  const 베타동의남기기 = async () => {
    setBusy(true); setBetaErr(null);
    const sb = browserSupabase();
    const 동의칸 = {
      개인정보동의: !!checked.beta_privacy,
      경품동의: !!checked.survey_prize,
      /* 1단계에서 뺐습니다 (2026-11-12 저녁) — 신청은 가입 뒤 창의 「비교알림신청」 줄로 남습니다 */
      비교알림동의: false,
    };
    let { error } = await sb.from('베타동의').insert({ 사람: session.user.id, ...동의칸 });
    /* 이미 넣은 분(뒤로 갔다가 다시 온 분) — 동의 칸만 새로 적습니다 */
    if (error?.code === '23505') {
      ({ error } = await sb.from('베타동의')
        .update({ ...동의칸, 동의때: new Date().toISOString() }).eq('사람', session.user.id));
    }
    setBusy(false);
    if (error && !표없음(error)) {
      setBetaErr(`동의를 저장하지 못했어요 — ${error.message}`);
      return;
    }
    setStep(2);
  };

  /* ③ 닉네임 — profiles 줄을 여기서 만듭니다.
     nickname 이 NOT NULL·unique 라 이 칸을 지나야 줄이 생깁니다.
     그래서 ② 에서 고른 직군·역할도 여기서 한꺼번에 담습니다 —
     줄이 없는데 update 를 부르면 0줄이 바뀌고 조용히 사라집니다 */
  const saveNickname = async () => {
    if (!job || !role) { setStep(2); return; }
    const name = nick.trim();
    if (name.length < 2 || name.length > 12) {
      setNickErr('2자에서 12자까지 쓸 수 있어요'); return;
    }
    setBusy(true); setNickErr(null);

    const sb = browserSupabase();
    /* ★ 2026-10-11 — **창구로 옮겼습니다.** 전에는 여기서 profiles 에 바로
       넣었는데, profiles.회원번호 의 기본값이 nextval('회원번호_seq') 라
       회원에게 **시퀀스 권한**이 있어야 했습니다. 2026-09-30 에 회원번호를
       더하면서 그 권한을 안 줘서, 그날부터 **새 가입이 한 건도 안 됐습니다**
       (「permission denied for sequence 회원번호_seq」).
       11일 동안 아무도 가입을 안 해서 아무도 몰랐습니다.
       창구(security definer) 안에서 넣으면 회원 쪽 권한이 필요 없습니다.
       카카오가 준 사진·이메일은 일부러 안 담습니다 — lib/avatar.ts 참고 */
    const { error } = await sb.rpc('가입하기', {
      p_닉네임: name,
      p_직군: job,
      p_역할: role,
      p_사진: avatar,
      p_약관판: TERMS_VERSION,
    });

    if (error) {
      setBusy(false);

      /* 23503 = 남의 표를 가리키는 값. 여기서는 auth.users 에 그 사람이 없다는 뜻입니다.
         AuthProvider 가 미리 걸러내지만, 걸러낸 뒤 토큰이 죽는 경우가 남습니다.
         회원에게 영문 제약조건 이름을 보여주지 않고, 다음에 또 나면
         어느 id 였는지 알 수 있게 적어 둡니다 */
      if (error.code === '23503') {
        console.error('[POTJOB] 없는 계정으로 프로필을 만들려 했습니다 · id =', session.user.id);
        await browserSupabase().auth.signOut({ scope: 'local' });
        setNickErr('로그인이 풀렸어요. 다시 로그인해 주세요');
        setTimeout(() => router.replace('/login'), 1200);
        return;
      }

      setNickErr(
        error.code === '23505'
          ? '이미 쓰고 있는 닉네임이에요. 다른 것으로 해주세요'
          : `저장하지 못했어요 — ${error.message}`,
      );
      return;
    }

    /* 동의는 증빙이라 **문서별로** 남깁니다 (2026-10-01).
       profiles.terms_version 한 칸으로는 어느 문서에 동의한 건지 알 수 없습니다.
       선택 항목(알림)은 안 눌렀어도 「false 로 동의 안 함」 을 남깁니다 —
       나중에 「물어봤는데 거절했다」 를 보이려면 그 기록이 있어야 합니다.
       실패해도 가입은 굴러가게 둡니다. 여기서 막으면 가입이 통째로 죽습니다 */
    const 동의 = await sb.rpc('동의남기기', {
      p_판: TERMS_VERSION,
      p_문서들: Object.fromEntries(AGREEMENTS.map((a) => [a.key, !!checked[a.key]])),
    });
    if (동의.error) console.error('[POTJOB] 동의 기록을 못 남겼습니다 ·', 동의.error.message);

    if (checked.notify) {
      await sb.from('notification_settings').upsert({
        profile_id: session.user.id, agreed: true, agreed_at: new Date().toISOString(),
      });
    }

    setJustMade(true);      // reload 로 me 가 생겨도 ④ 에 머무르게
    await reload();
    setBusy(false);
    setStep(4);
    /* 「가입하기」 뒤에 바로 뜨던 비교 알림 창은 뺐습니다 — 5단계 「연봉 비교 알림 받기」와 겹칩니다
       (2026-11-12 저녁 세중님 「혹시나 중복된다면 여기서는 빼기」) */
  };

  /* ⑤ 끝 — 급여를 넣었든(save_my_survey 가 survey_at 을 찍음) 나중으로 미뤘든(가입마치기 · 금고 SQL_1113/Q) 여기로 옵니다.
     공유 링크를 보고 들어오신 분은 그 공고로 돌려보냅니다. 홈으로 떨어뜨리면 뭘 보러 왔는지 잊고 그냥 나갑니다 */
  const 가입끝 = async () => {
    await reload();
    let back: string | null = null;
    try {
      back = peekAfterLogin();
      clearAfterLogin();
    } catch { /* 사생활 보호 창 */ }
    router.push(back || '/');
  };
  const 나중에입력 = async () => {
    setBusy(true);
    const { error } = await browserSupabase().rpc('가입마치기');
    setBusy(false);
    if (error) { toast(`가입을 마치지 못했어요 — ${error.message}`, { tone: 'danger', ms: 4000 }); return; }
    await 가입끝();
  };

  /* ② 직군·역할 — 둘 다 필수입니다.
     역할이 비면 커뮤니티가 현직 방만 보여줘서(옛 chFor_ 와 같게) 학생이 길을 잃습니다.

     이 자리에는 아직 profiles 줄이 없습니다. 그래서 대개는 저장할 게 없고
     들고만 갔다가 ③ 에서 닉네임과 함께 넣습니다.
     아래 update 를 타는 건 줄은 있는데 직군이 빈 옛 계정뿐입니다 */
  const saveWho = async () => {
    if (!job || !role) return;
    if (!me) { setStep(3); return; }
    setBusy(true);
    const { error } = await browserSupabase()
      .from('profiles').update({ job_group: job, role }).eq('id', session.user.id);
    setBusy(false);
    if (error) {
      toast(`저장하지 못했어요 — ${error.message}`, { tone: 'danger', ms: 4000 });
      return;
    }
    await reload();
    setStep(5);
  };

  /* ── 그리기 — 새 디자인 「U05 회원가입」 (2026-11-12 밤 근무 · 대표: 피그마가 최종본).
     원본: 07 · B 가입 → U05-01 이용 동의 1211:25913 · U05-02 직군·근무 경험 1211:26089.
     앱 바(뒤로 · 회원가입) · 진행 막대(이름 + n / 5) · 큰 제목 두 줄 · 본문 · 아래 고정 단추(navy).
     ★ 단계·저장·동의 문구는 그대로입니다 — 모양만 바꿨습니다.
     원본의 「근무 경험」·「학력」·「자격」·「희망 조건」 단계는 저장할 곳이 달라 아직 없습니다(밤 근무 보고에 적음) */
  const 단계이름 = ['이용 동의', '내 정보', '닉네임', '프로필 사진', '급여 정보 (선택)'];
  const 제목 = [
    <>이용약관을 확인하고<br />라포를 시작해요</>,
    <>직군과 역할을<br />알려주세요</>,
    <>닉네임을<br />정해 주세요</>,
    <>프로필 사진을<br />골라 주세요</>,
    급여입력 ? null : <>내 급여,<br />어느 정도일까요?</>,
  ][step - 1];
  const 다시하기 = async () => {
    await browserSupabase().auth.signOut({ scope: 'local' });
    toast('처음부터 다시 해요');
    router.replace('/login');
  };
  const 뒤로 = () => {
    if (step === 2) { setStep(1); return; }
    if (step === 5 && 급여입력) { set급여입력(false); return; }
    /* 가입 도중에 막히면 나갈 길이 있어야 합니다 — 로그인 화면에서 다른 수단으로 다시 들어올 수 있습니다 */
    if (step === 1 || confirm('처음부터 다시 할까요? 로그인 화면으로 돌아가요.')) void 다시하기();
  };
  const 아래단추 = step === 1
    ? <RapoButton onClick={베타동의남기기} disabled={!allRequired || busy} full>{busy ? '확인하는 중…' : allRequired ? '동의하고 다음' : '필수 항목에 모두 동의해 주세요'}</RapoButton>
    : step === 2
    ? <RapoButton onClick={saveWho} disabled={busy || !job || !role} full>{busy ? '저장하는 중…' : (!job || !role) ? '둘 다 골라 주세요' : '다음'}</RapoButton>
    : step === 3
    /* 닉네임을 넣는 이 단추가 가입(profiles 줄 만들기)입니다 — 그래서 「가입하기」 */
    ? <RapoButton onClick={saveNickname} disabled={busy || nick.trim().length < 2} full>{busy ? '저장하는 중…' : '가입하기'}</RapoButton>
    : step === 4
    ? (
      <RapoButton disabled={busy} full onClick={async () => {
        /* 사진을 올린 뒤에 바탕색만 바꾸셨을 수 있어서 늘 한 번 저장합니다 */
        await browserSupabase().from('profiles').update({ avatar }).eq('id', session.user.id);
        await reload();
        setStep(5);
      }}>다음</RapoButton>
    ) : null;

  return (
    <div data-rapo className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col bg-(--rapo-color-bg-layer-default)">
      <header className="sticky top-0 z-20 flex h-[56px] shrink-0 items-center gap-(--rapo-dimension-x2) bg-(--rapo-color-bg-layer-default) px-(--rapo-dimension-x2)">
        <button type="button" onClick={뒤로} aria-label={step === 2 ? '이전 단계' : '처음부터 다시 하기'}
          className="flex size-(--rapo-touch-min) shrink-0 items-center justify-center rounded-(--rapo-radius-r2) active:bg-(--rapo-color-bg-transparent-pressed)">
          {/* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 SVG 그대로 */}
          <img src="/rapo/detail/arrow-left-20.svg" alt="" width={20} height={20} />
        </button>
        <p className="rapo-type-t5-bold min-w-0 flex-1 text-center text-(color:--rapo-color-fg-neutral)">회원가입</p>
        <span aria-hidden className="size-(--rapo-touch-min) shrink-0" />
      </header>

      <main className="flex-1 px-(--rapo-dimension-x5) pb-(--rapo-dimension-x6)">
        {/* 진행 — 이름 · n / 5 · 막대 다섯 */}
        <div className="pt-(--rapo-dimension-x4)" role="group" aria-label={`가입 순서 ${step} / 5 · ${단계이름[step - 1]}`}>
          <div className="flex items-center">
            <p className="rapo-type-t3-regular min-w-0 flex-1 text-(color:--rapo-color-fg-neutral-muted)">{단계이름[step - 1]}</p>
            <p className="rapo-type-t3-bold text-(color:--rapo-color-fg-neutral)">{step} / 5</p>
          </div>
          <div aria-hidden className="mt-(--rapo-dimension-x2) flex gap-(--rapo-dimension-x1)">
            {단계이름.map((t, i) => (
              <span key={t} className={'h-(--rapo-dimension-x1) flex-1 rounded-(--rapo-radius-full) ' +
                (i < step ? 'bg-(--rapo-color-bg-identity)' : 'bg-(--rapo-color-bg-neutral-weak)')} />
            ))}
          </div>
        </div>

        {제목 && <h1 className="rapo-type-t11-bold mt-(--rapo-dimension-x6) break-keep text-(color:--rapo-color-fg-neutral)">{제목}</h1>}

        {step === 1 && (
          <section className="mt-(--rapo-dimension-x6) flex flex-col gap-(--rapo-dimension-x4)">
            {/* 전체 동의 */}
            <button type="button" onClick={toggleAll} aria-pressed={allChecked}
              className="flex items-center gap-(--rapo-dimension-x4) rounded-(--rapo-radius-r3) bg-(--rapo-color-bg-brand-weak) px-(--rapo-dimension-x5) py-(--rapo-dimension-x4) text-left">
              <Box on={allChecked} />
              <span>
                <span className="rapo-type-t6-bold block text-(color:--rapo-color-fg-neutral)">전체 동의</span>
                <span className="rapo-type-t3-regular block text-(color:--rapo-color-fg-neutral-muted)">선택 항목을 포함해 모두 동의해요</span>
              </span>
            </button>

            {/* 필수 다음에 선택 — 2026-11-12 저녁 세중님 「선택 항목은 아래로 다 내리자 · 선택은 동일하게」.
                두 묶음 모두 같은 줄(동의행)로 그립니다. 베타 동의의 수집 항목·목적·보유 기간은 접지 않고 다 보입니다 */}
            {([['필수', 필수동의], ['선택', 선택동의]] as const).map(([묶음, 줄들]) => (
              <div key={묶음}>
                <p className="rapo-type-t3-bold pb-(--rapo-dimension-x1) text-(color:--rapo-color-fg-neutral-muted)">{묶음} 항목</p>
                <ul className="flex flex-col">
                  {줄들.map((a) => (
                    <동의행 key={a.key} a={a} on={!!checked[a.key]}
                      set={(v) => setChecked({ ...checked, [a.key]: v })} />
                  ))}
                </ul>
              </div>
            ))}

            {/* 「RAPO 는 지금 테스트 중이에요」 상자는 뺐습니다 (2026-11-12 세중님 「회원가입 할 땐 아래 있는 건 빼줘」 —
                같은 안내는 홈 팝업으로 갑니다 · PR #101). 원본 U05-01 의 선택 항목 안내 한 줄만 남깁니다 */}
            <p className="rapo-type-t3-regular text-(color:--rapo-color-fg-neutral-muted)">선택 항목에 동의하지 않아도 가입할 수 있어요.</p>
            {betaErr && <p role="alert" className="rapo-type-t4-medium text-(color:--rapo-color-fg-brand-contrast)">{betaErr}</p>}
          </section>
        )}

        {step === 2 && (
          <section className="mt-(--rapo-dimension-x6) flex flex-col gap-(--rapo-dimension-x3)">
            <h2 className="rapo-type-t5-medium text-(color:--rapo-color-fg-neutral)">직군</h2>
            <div className="grid grid-cols-2 gap-(--rapo-dimension-x2)">
              {JOB_GROUPS.map((g) => <Choice key={g} on={job === g} go={() => setJob(g)}>{g}</Choice>)}
            </div>
            <h2 className="rapo-type-t6-bold mt-(--rapo-dimension-x3) text-(color:--rapo-color-fg-neutral)">지금 어떤 상황인가요?</h2>
            <div className="flex flex-col gap-(--rapo-dimension-x3)">
              {ROLES.map((r) => <Choice key={r} on={role === r} go={() => setRole(r)} sub={ROLE_DESC[r]}>{r}</Choice>)}
            </div>
            <p className="rapo-type-t4-regular rounded-(--rapo-radius-r2) bg-(--rapo-color-bg-neutral-weak) p-(--rapo-dimension-x4) text-(color:--rapo-color-fg-neutral-muted)">
              커뮤니티에서 보이는 방이 이걸로 갈려요. 나중에 바꿀 수 있어요.
            </p>
          </section>
        )}

        {step === 3 && (
          <section className="mt-(--rapo-dimension-x6) flex flex-col gap-(--rapo-dimension-x3)">
            <p className="rapo-type-t5-regular text-(color:--rapo-color-fg-neutral-muted)">커뮤니티에서 이 이름으로 보여요. 나중에 5번까지 바꿀 수 있어요.</p>
            <input value={nick} onChange={(e) => { setNick(e.target.value); setNickErr(null); }} maxLength={12} placeholder="2~12자" aria-label="닉네임"
              className="rapo-type-t5-regular h-(--rapo-dimension-x13) w-full rounded-(--rapo-radius-r3) border-(length:--rapo-border-default)
                         border-(color:--rapo-color-stroke-neutral-weak) px-(--rapo-dimension-x4) text-(color:--rapo-color-fg-neutral)
                         placeholder:text-(color:--rapo-color-fg-placeholder)" />
            {nickErr && <p role="alert" className="rapo-type-t4-medium text-(color:--rapo-color-fg-brand-contrast)">{nickErr}</p>}
          </section>
        )}

        {step === 4 && (
          <section className="mt-(--rapo-dimension-x6) flex flex-col gap-(--rapo-dimension-x4)">
            <p className="rapo-type-t5-regular text-(color:--rapo-color-fg-neutral-muted)">안 고르시면 기본 아바타로 시작해요. 나중에 바꿀 수 있어요.</p>
            <AvatarPicker userId={session.user.id} value={avatar}
              onChange={async (next) => { setAvatar(next); await reload(); }} />
          </section>
        )}

        {/* ⑤ 급여 정보 (선택) — 원본 U05-05 「급여 선택 · 하단」 1245:3935 (2026-11-12 저녁 세중님 「급여는 선택 ·
            1분 안에 갖고 오기는 우리 알림 받기로 대체」). 짙은 예시 카드 · 근무 조건 도움말 · navy 단추(→ 연봉 비교 알림 창) ·
            「직접 입력하기」 행(→ 급여·스펙 입력) · 「나중에 입력하고 가입 완료」 */}
        {step === 5 && !급여입력 && (
          <section className="mt-(--rapo-dimension-x2) flex flex-col gap-(--rapo-dimension-x5)">
            <p className="rapo-type-t4-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">급여를 입력하면 내 위치와 다른 근무 조건의 급여 차이를 확인할 수 있어요.</p>
            <div className="flex flex-col gap-(--rapo-dimension-x4) rounded-(--rapo-radius-r4) bg-(--rapo-color-bg-navy-solid) p-(--rapo-dimension-x6)">
              <p className="rapo-type-t5-medium text-(color:--rapo-color-fg-on-navy-solid)">비슷한 조건에서 내 위치</p>
              <p className="rapo-type-t13-bold text-(color:--rapo-color-fg-on-navy-solid)">상위 23%</p>
              <div aria-hidden className="flex h-[65px] items-end gap-[6px]">
                {[20, 37, 52, 62, 65, 62, 52, 37, 20].map((h, k) => (
                  <span key={k} style={{ height: `${h}px` }}
                    className={'flex-1 rounded-(--rapo-radius-r1) ' + (k === 6 ? 'bg-(--rapo-color-bg-identity)' : 'bg-(--rapo-color-fg-on-navy-solid) opacity-30')} />
                ))}
              </div>
              <p className="rapo-type-t2-regular text-(color:--rapo-color-fg-on-navy-solid) opacity-70">같은 조건 47명 기준 / 가상 예시</p>
            </div>
            <p className="rapo-type-t8-bold text-(color:--rapo-color-fg-neutral)">근무 조건이 달라지면?</p>
            <p className="rapo-type-t4-regular break-keep rounded-(--rapo-radius-r3) bg-(--rapo-color-bg-neutral-weak) p-(--rapo-dimension-x4) text-(color:--rapo-color-fg-neutral-muted)">
              지역과 기관 유형에 따른 급여 차이도 비교할 수 있어요. 실제 이직 시 받을 급여를 뜻하지 않아요.
            </p>
            {비교알림켜짐 && <RapoButton full onClick={() => setCompareOpen(true)}>연봉 비교 알림 받기</RapoButton>}
            <button type="button" onClick={() => set급여입력(true)}
              className="flex items-center gap-(--rapo-dimension-x3) rounded-(--rapo-radius-r3) bg-(--rapo-color-bg-neutral-weak) p-(--rapo-dimension-x4) text-left active:bg-(--rapo-color-bg-neutral-weak-pressed)">
              <span className="rapo-type-t5-medium min-w-0 flex-1 break-keep text-(color:--rapo-color-fg-neutral)">지금 내 급여 직접 입력하기</span>
              <span aria-hidden className="rapo-type-t8-regular text-(color:--rapo-color-fg-neutral)">›</span>
            </button>
            <button type="button" onClick={나중에입력} disabled={busy}
              className="rapo-type-t4-bold self-start text-(color:--rapo-color-fg-neutral) underline underline-offset-4 disabled:opacity-40">
              {busy ? '가입을 마치는 중…' : '나중에 입력하고 가입 완료'}
            </button>
            <p className="rapo-type-t4-regular -mt-(--rapo-dimension-x3) break-keep text-(color:--rapo-color-fg-neutral-muted)">
              급여는 선택 항목이에요. 나중에 내 정보 → 스펙 확인·수정에서 입력할 수 있어요.
            </p>
          </section>
        )}
        {step === 5 && 급여입력 && (
          <div className="mt-(--rapo-dimension-x6)">
            <SignupSurvey
              userId={session.user.id}
              job={job ?? me?.job_group ?? '작업치료사'}
              role={(role ?? me?.role ?? '현직') as Role}
              /* survey_at 은 save_my_survey 가 이미 찍었습니다 */
              onDone={가입끝}
            />
          </div>
        )}
      </main>

      {/* 아래 고정 단추 — 원본 RAPO / Button / Filled (navy · 52) */}
      {아래단추 && (
        <div className="sticky bottom-0 bg-(--rapo-color-bg-layer-default) px-(--rapo-dimension-x5) pt-(--rapo-dimension-x2)
                        pb-[calc(var(--rapo-dimension-x4)+env(safe-area-inset-bottom))]">
          {아래단추}
        </div>
      )}

      {/* 「가입하기」 뒤 비교 알림 창. 꺼져 있으면 compareOpen 이 늘 false 입니다 */}
      {비교알림켜짐 && compareOpen && (
        <CompareNotify
          userId={session.user.id}
          job={job ?? (me?.job_group as JobGroup | undefined) ?? null}
          email={session.user.email ?? null}
          onDone={() => setCompareOpen(false)}
        />
      )}
    </div>
  );
}

/* 고르는 카드 — 원본 U05-02 의 선택 카드: 고르면 brand-weak 바탕 + brand 테두리 + 채운 동그라미 */
function Choice({
  on, go, sub, children,
}: {
  on: boolean; go: () => void; sub?: string; children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={go} aria-pressed={on}
      className={
        'flex items-center gap-(--rapo-dimension-x3) rounded-(--rapo-radius-r3) border-(length:--rapo-border-default) px-(--rapo-dimension-x5) py-(--rapo-dimension-x4) text-left ' +
        (on ? 'border-(color:--rapo-color-fg-brand-contrast) bg-(--rapo-color-bg-brand-weak)'
            : 'border-(color:--rapo-color-stroke-neutral-weak) active:bg-(--rapo-color-bg-transparent-pressed)')
      }>
      <span className="min-w-0 flex-1">
        <span className="rapo-type-t6-bold block text-(color:--rapo-color-fg-neutral)">{children}</span>
        {sub && <span className="rapo-type-t3-regular mt-(--rapo-dimension-x1) block text-(color:--rapo-color-fg-neutral-muted)">{sub}</span>}
      </span>
      <span aria-hidden className={'flex size-[20px] shrink-0 items-center justify-center rounded-(--rapo-radius-full) border-(length:--rapo-border-default) ' +
        (on ? 'border-(color:--rapo-color-bg-navy-solid) bg-(--rapo-color-bg-navy-solid)' : 'border-(color:--rapo-color-stroke-neutral-weak)')}>
        {on && <span className="size-[8px] rounded-(--rapo-radius-full) bg-(--rapo-color-bg-layer-default)" />}
      </span>
    </button>
  );
}

/* 동의 한 줄 — 필수·선택이 같은 꼴입니다 (원본 「RAPO / B GUI / 약관 행」 + 아래 설명 줄) */
function 동의행({ a, on, set }: {
  a: { key: string; label: string; required: boolean; doc?: string; lines?: string[] };
  on: boolean; set: (v: boolean) => void;
}) {
  return (
    <li className="border-b border-(--rapo-color-stroke-neutral-weak) py-(--rapo-dimension-x1)">
      <div className="flex items-center gap-(--rapo-dimension-x2)">
        <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-(--rapo-dimension-x4) py-(--rapo-dimension-x2)">
          <input type="checkbox" className="sr-only" checked={on} onChange={(e) => set(e.target.checked)} />
          <Box on={on} />
          <span className="min-w-0">
            <span className="rapo-type-t5-medium block break-keep text-(color:--rapo-color-fg-neutral)">{a.label}</span>
            <span className={'rapo-type-t3-regular block ' + (a.required ? 'text-(color:--rapo-color-fg-brand-contrast)' : 'text-(color:--rapo-color-fg-neutral-muted)')}>
              {a.required ? '필수' : '선택'}
            </span>
          </span>
        </label>
        {a.doc && (
          <Link href={`/terms/${a.doc}`} aria-label={`${a.label} 전문 보기`}
            className="flex size-(--rapo-touch-min) shrink-0 items-center justify-center rounded-(--rapo-radius-r2) active:bg-(--rapo-color-bg-transparent-pressed)">
            {/* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 SVG 그대로 */}
            <img src="/rapo/me/chevron-18.svg" alt="" width={18} height={18} />
          </Link>
        )}
      </div>
      {a.lines && a.lines.length > 0 && (
        <ul className="rapo-type-t3-regular mb-(--rapo-dimension-x2) ml-[38px] flex flex-col gap-(--rapo-dimension-x1) text-(color:--rapo-color-fg-neutral-muted)">
          {a.lines.map((l) => <li key={l} className="break-keep">{l}</li>)}
        </ul>
      )}
    </li>
  );
}

/* 체크 네모 — 원본: 켜지면 navy 바탕에 흰 체크 */
function Box({ on }: { on: boolean }) {
  return (
    <span aria-hidden
      className={'flex size-[22px] shrink-0 items-center justify-center rounded-(--rapo-radius-r1) border-(length:--rapo-border-default) text-[14px] font-bold leading-none ' +
        (on ? 'border-(color:--rapo-color-bg-navy-solid) bg-(--rapo-color-bg-navy-solid) text-(color:--rapo-color-fg-on-navy-solid)'
            : 'border-(color:--rapo-color-stroke-neutral-weak) bg-(--rapo-color-bg-layer-default)')}>
      {on ? '✓' : ''}
    </span>
  );
}
