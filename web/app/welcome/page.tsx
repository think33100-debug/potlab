'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CompareNotify } from '@/components/compare-notify';
import { Chips, Langs, Rows, SignupSurvey } from '@/components/signup-survey';
import { 비교알림켜짐 } from '@/lib/beta-compare';
import { defaultAvatar } from '@/lib/avatar';
import { BETA_AGREEMENTS, 표없음 } from '@/lib/beta';
import { RapoButton } from '@/components/rapo/rapo-ui';
import { clearAfterLogin, peekAfterLogin } from '@/lib/after-login';
import { CERTS, NONE, coursesFor, langError, langsPayload, rowsReady, rowsToSave, type LangRow, type WorkRow } from '@/lib/signup-fields';
import { browserSupabase } from '@/lib/supabase-browser';
import { AGREEMENTS, TERMS_VERSION } from '@/lib/terms';
import { JOB_GROUPS, type JobGroup, type Role } from '@/lib/who';
import { 날말, 무료끝날, 미래인가, 연월말, 졸업연월, 학력목록 } from '@/lib/school-period';
import { todayKst } from '@/lib/job-state';
import { 관심대상들, 관심분야예시, 듣고싶은교육예시, 예시고르기, 학교목록, 학교부연 } from '@/lib/signup-school';

import { 설치안내남기기 } from '@/lib/install-hint';
import { useAuth } from '../auth';
import { useToast } from '../toast';

/* 회원가입 — 피그마 「07 · B 가입과 원래 화면 복귀」 (2026-11-15 세중님 「피그마댓글_326-425 대로 · 겹치면 피그마」).

   흐름 (피그마 00 B 플로우 한눈에 보기 1261:2934)
     ① 이용 동의 → ② 직군 · 근무 경험(아직 없어요 / 일한 경험이 있어요) → ③ 닉네임
     경험 없음  ④ 학력·학적·입학 연월·누적 학점 → ⑤ 자격·교육·실습·어학 → ⑥ 희망 조건 → 완료(무료 열람 끝날 안내)
     경험 있음  ④ 병원·입사연도·입사 당시 학력·학점 → ⑤ 입사 당시 자격·교육·실습·어학 → ⑥ 희망 조건 → ⑦ 급여(선택) → 완료

   피그마와 다른 것 (세중님께 말씀드림)
     · ③ 닉네임 — 피그마 가입에는 없고 내 정보 「프로필 편집」에만 있습니다. 닉네임이 없으면 가입 줄(profiles)을 못 만들어 남겼습니다.
       프로필 사진 단계는 피그마대로 뺐습니다(기본 동물 그림 · 내 정보 → 프로필 편집에서 바꿈)
     · 무료 열람 기간은 **보여 주기만** 합니다(lib/school-period.ts) — 끝났다고 막는 장치는 아직 없습니다
     · 성인 인증(PASS)은 넣지 않았습니다 (11/15 세중님 「pass 는 아직」)

   역할 값(profiles.role)은 그대로 「학생 / 현직」입니다 — 경험 없음 = 학생 · 경험 있음 = 현직 (커뮤니티 방이 이 값을 봅니다).
   스펙은 ⑥(경험 있음은 ⑦)에서 save_my_survey 한 번으로 담습니다. 두 번 부르면 두 번째가 「1년 2번 고치기」로 세어집니다. */

type 단계 = '동의' | '내정보' | '닉네임' | '학교' | '스펙' | '희망' | '관심' | '급여' | '끝';
type 경험 = '없음' | '있음';

const 희망유형 = ['대학병원', '종합병원', '재활병원'] as const;
const 희망지역 = ['서울', '경기', '인천', '부산', '대구', '광주', '대전', '울산', '세종',
  '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'] as const;
/* 학점은 4.5 만점으로만 받고, 넣을지 말지는 선택 (2026-11-15 세중님 「학점 4.5 만점에 기입 · 학점은 선택 · 기입하면 가입한 사람들과 비교」) */
const 만점 = 4.5;

/* 중간에 나갔다 와도 적은 게 남게 — 이 기기에만 둡니다 (옛 설문과 같은 결) */
type 초안 = {
  학교?: string; 학교직접?: boolean;
  학력?: string; 학적?: '재학' | '졸업'; 입학년?: string; 입학월?: string; 학점?: string;
  관심대상?: string; 관심분야?: string[]; 듣고싶은교육?: string[];
  병원?: string; 입사연도?: string;
  certs?: string[]; courses?: string[]; rows?: WorkRow[]; rowsNone?: boolean; langs?: LangRow[];
  희망유형?: string; 희망지역?: string;
};
const 초안열쇠 = (uid: string) => `rapo.signup.${uid}`;
const 초안읽기 = (uid: string): 초안 => { try { return JSON.parse(localStorage.getItem(초안열쇠(uid)) || '{}'); } catch { return {}; } };

export default function Welcome() {
  const router = useRouter();
  const toast = useToast();
  const { loading, session, me, reload } = useAuth();

  const [stepPick, setStepPick] = useState<단계 | null>(null);
  const [job, setJob] = useState<JobGroup | null>(null);
  const [exp, setExp] = useState<경험 | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [nick, setNick] = useState('');
  const [busy, setBusy] = useState(false);
  const [nickErr, setNickErr] = useState<string | null>(null);
  const [betaErr, setBetaErr] = useState<string | null>(null);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const [급여입력, set급여입력] = useState(false);
  /* 방금 가입 줄을 만든 경우 — 줄이 생기는 순간 「이미 가입한 분」으로 몰려 홈으로 튕기지 않게 */
  const [justMade, setJustMade] = useState(false);
  const [d, setD] = useState<초안>({});
  const [병원후보, set병원후보] = useState<{ name: string; 곳: string }[]>([]);
  const [직접입력, set직접입력] = useState(false);

  useEffect(() => { if (session) setD(초안읽기(session.user.id)); }, [session]);
  const put = (p: Partial<초안>) => {
    const next = { ...d, ...p };
    setD(next);
    try { if (session) localStorage.setItem(초안열쇠(session.user.id), JSON.stringify(next)); } catch { /* 사생활 보호 창 */ }
  };

  /* 경험은 가입 줄이 생긴 뒤에는 role 에서 읽습니다 */
  const 경험값: 경험 | null = exp ?? (me?.role === '현직' ? '있음' : me?.role === '학생' ? '없음' : null);
  const 있음 = 경험값 === '있음';
  /* 학생·취준생은 「관심」 한 장 더 (성인/소아 · 관심 분야 · 듣고 싶은 교육 · 2026-11-15 세중님) */
  const 순서: 단계[] = ['동의', '내정보', '닉네임', '학교', '스펙', '희망', ...(있음 ? ['급여' as const] : ['관심' as const])];
  const resume: 단계 = !me ? '동의' : (me.job_group && me.role) ? '학교' : '내정보';
  const step = stepPick ?? resume;
  const go = (s: 단계) => { setStepPick(s); setSaveErr(null); window.scrollTo(0, 0); };

  useEffect(() => {
    if (loading) return;
    if (!session) { router.replace('/login'); return; }
    if (me?.survey_at && !justMade) router.replace('/');
  }, [loading, session, me, router, justMade]);

  /* 병원 찾기 — org_search(회원 권한) · 이름만 담습니다 */
  useEffect(() => {
    const q = (d.병원 ?? '').trim();
    if (step !== '학교' || !있음 || 직접입력 || q.length < 2) { set병원후보([]); return; }
    const t = setTimeout(async () => {
      const { data } = await browserSupabase().rpc('org_search', {
        p_q: q, p_tile: null, p_sido: null, p_sgg: null, p_sort: null, p_limit: 5, p_offset: 0,
      });
      const rows = (data ?? []) as { name: string; sido_std: string | null; sgg_std: string | null }[];
      set병원후보(rows.filter((r) => r.name !== q).map((r) => ({ name: r.name, 곳: [r.sido_std, r.sgg_std].filter(Boolean).join(' ') })));
    }, 250);
    return () => clearTimeout(t);
  }, [d.병원, step, 있음, 직접입력]);

  if (loading || !session) {
    return <main className="mx-auto w-full max-w-2xl px-6 py-8 pb-[88px] md:px-7 md:pb-8"><p className="text-lg text-mute">잠시만요…</p></main>;
  }

  /* ── ① 동의 ── (2026-11-11 · 11-12 그대로) */
  type 동의줄 = { key: string; label: string; required: boolean; doc?: string; lines?: string[] };
  const 모든동의: 동의줄[] = [...AGREEMENTS, ...BETA_AGREEMENTS];
  const 필수동의 = 모든동의.filter((a) => a.required);
  const 선택동의 = 모든동의.filter((a) => !a.required);
  const allRequired = 필수동의.every((a) => checked[a.key]);
  const allChecked = 모든동의.every((a) => checked[a.key]);
  const toggleAll = () => { const on = !allChecked; setChecked(Object.fromEntries(모든동의.map((a) => [a.key, on]))); };

  const 베타동의남기기 = async () => {
    setBusy(true); setBetaErr(null);
    const sb = browserSupabase();
    const 동의칸 = { 개인정보동의: !!checked.beta_privacy, 경품동의: !!checked.survey_prize, 비교알림동의: false };
    let { error } = await sb.from('베타동의').insert({ 사람: session.user.id, ...동의칸 });
    if (error?.code === '23505') {
      ({ error } = await sb.from('베타동의').update({ ...동의칸, 동의때: new Date().toISOString() }).eq('사람', session.user.id));
    }
    setBusy(false);
    if (error && !표없음(error)) { setBetaErr(`동의를 저장하지 못했어요 — ${error.message}`); return; }
    go('내정보');
  };

  /* ── ② 직군·근무 경험 ── 줄이 이미 있는 옛 계정만 여기서 고칩니다 */
  const role: Role | null = 경험값 ? (경험값 === '있음' ? '현직' : '학생') : null;
  const saveWho = async () => {
    if (!job || !role) return;
    if (!me) { go('닉네임'); return; }
    setBusy(true);
    const { error } = await browserSupabase().from('profiles').update({ job_group: job, role }).eq('id', session.user.id);
    setBusy(false);
    if (error) { toast(`저장하지 못했어요 — ${error.message}`, { tone: 'danger', ms: 4000 }); return; }
    await reload();
    go('학교');
  };

  /* ── ③ 닉네임 = 가입 줄 만들기 (2026-10-11 창구 「가입하기」 그대로) ── */
  const saveNickname = async () => {
    if (!job || !role) { go('내정보'); return; }
    const name = nick.trim();
    if (name.length < 2 || name.length > 12) { setNickErr('2자에서 12자까지 쓸 수 있어요'); return; }
    setBusy(true); setNickErr(null);
    const sb = browserSupabase();
    const { error } = await sb.rpc('가입하기', {
      p_닉네임: name, p_직군: job, p_역할: role, p_사진: defaultAvatar(session.user.id), p_약관판: TERMS_VERSION,
    });
    if (error) {
      setBusy(false);
      if (error.code === '23503') {
        console.error('[RAPO] 없는 계정으로 프로필을 만들려 했습니다 · id =', session.user.id);
        await browserSupabase().auth.signOut({ scope: 'local' });
        setNickErr('로그인이 풀렸어요. 다시 로그인해 주세요');
        setTimeout(() => router.replace('/login'), 1200);
        return;
      }
      setNickErr(error.code === '23505' ? '이미 쓰고 있는 닉네임이에요. 다른 것으로 해주세요' : `저장하지 못했어요 — ${error.message}`);
      return;
    }
    const 동의 = await sb.rpc('동의남기기', {
      p_판: TERMS_VERSION, p_문서들: Object.fromEntries(AGREEMENTS.map((a) => [a.key, !!checked[a.key]])),
    });
    if (동의.error) console.error('[RAPO] 동의 기록을 못 남겼습니다 ·', 동의.error.message);
    if (checked.notify) {
      await sb.from('notification_settings').upsert({ profile_id: session.user.id, agreed: true, agreed_at: new Date().toISOString() });
    }
    setJustMade(true);
    await reload();
    setBusy(false);
    go('학교');
  };

  /* ── ④ 학력·학점 ── */
  const 학교없음 = d.학력 === '학교 경험 없음';
  const 입학 = d.입학년 && d.입학월 ? { y: Number(d.입학년), m: Number(d.입학월) } : null;
  const 입학미래 = !!입학 && 미래인가(입학);
  const 졸업 = !있음 && !학교없음 && d.학력 && 입학 && !입학미래 ? 졸업연월(d.학력, 입학) : null;
  const 끝날 = 무료끝날(졸업);
  const 끝남 = !!끝날 && 끝날 < todayKst();
  const 학점수 = Number(d.학점);
  const 학점틀림 = !!d.학점?.trim() && (!Number.isFinite(학점수) || 학점수 < 0 || 학점수 > 만점);
  const 학점됨 = !학점틀림;   // 비워도 됨
  const 학교들 = 학교목록(job ?? me?.job_group);
  const 고른학교 = 학교들.find((x) => x.이름 === d.학교) ?? null;
  const 학교됨 = 있음
    ? !!d.병원?.trim() && !!d.입사연도 && !!d.학력 && (학교없음 || 학점됨)
    : !!d.학력 && (학교없음 || (!!d.학교?.trim() && !!d.학적 && !!입학 && !입학미래 && 학점됨));

  /* ── ⑤ 자격·교육·실습·어학 ── 「없음」도 답 — 고르거나 없음을 눌러야 넘어갑니다 */
  const certs = d.certs ?? [], courses = d.courses ?? [], rows = d.rows ?? [], langs = d.langs ?? [];
  const 스펙됨 = certs.length > 0 && courses.length > 0 && (d.rowsNone || rowsReady(rows)) && langs.every((r) => !langError(r));

  /* ── ⑥ 희망 ── */
  const 희망됨 = !!d.희망유형 && !!d.희망지역;
  const 관심됨 = !!d.관심대상;

  /* 담는 꼴 — save_my_survey 의 p_spec (금고 SQL_1113/ZL) */
  const 실습 = d.rowsNone ? [] : rowsToSave(rows);
  const spec: Record<string, unknown> = {
    school_type: d.학력 ?? null,
    grade: null,
    gpa: 학교없음 || !d.학점?.trim() ? null : Number(d.학점),
    gpa_scale: 학교없음 || !d.학점?.trim() ? null : 만점,
    학교: !있음 && !학교없음 ? d.학교?.trim() || null : null,
    관심대상: 있음 ? null : d.관심대상 ?? null,
    관심분야: 있음 ? null : d.관심분야 ?? [],
    듣고싶은교육: 있음 ? null : d.듣고싶은교육 ?? [],
    licenses: certs.filter((x) => x !== NONE), trainings: courses.filter((x) => x !== NONE),
    practice: 실습, practice_months: 실습.reduce((s, r) => s + (Number(r.months) || 0), 0),
    career: null, career_months: null,
    want_type: d.희망유형 ?? null, want_region: d.희망지역 ?? null,
    학적: !있음 && !학교없음 ? d.학적 ?? null : null,
    입학연월: !있음 && !학교없음 && 입학 ? `${입학.y}-${String(입학.m).padStart(2, '0')}-01` : null,
    근무경험: 있음,
    근무병원: 있음 ? d.병원?.trim() || null : null,
    근무기관번호: null,
    입사연도: 있음 && d.입사연도 ? Number(d.입사연도) : null,
  };

  const 스펙저장 = async () => {
    setBusy(true); setSaveErr(null);
    const { error } = await browserSupabase().rpc('save_my_survey', { p_salary: null, p_spec: spec, p_langs: langsPayload(langs) });
    setBusy(false);
    if (error) { setSaveErr(`가입을 완료하지 못했어요. 입력한 정보는 유지돼요. 다시 시도해 주세요 — ${error.message}`); return; }
    try { localStorage.removeItem(초안열쇠(session.user.id)); } catch { /* 없어도 그만 */ }
    setJustMade(true);
    await reload();
    go('끝');
  };

  const 가입끝 = async () => {
    await reload();
    설치안내남기기();
    let back: string | null = null;
    try { back = peekAfterLogin(); clearAfterLogin(); } catch { /* 사생활 보호 창 */ }
    router.push(back || '/');
  };

  /* ── 그리기 ── */
  const 단계이름: Record<단계, string> = {
    동의: '이용 동의', 내정보: '내 정보', 닉네임: '닉네임', 학교: '학력·학점',
    스펙: '자격·교육·실습', 희망: '희망 취업 조건', 관심: '관심 분야', 급여: '급여 정보 (선택)', 끝: '',
  };
  const n = 순서.indexOf(step) + 1;
  const 제목: Partial<Record<단계, React.ReactNode>> = {
    동의: <>이용약관을 확인하고<br />라포를 시작해요</>,
    내정보: <>직군과 근무 경험을<br />알려주세요</>,
    닉네임: <>닉네임을<br />정해 주세요</>,
    학교: 있음 ? <>입사 당시 학력과<br />학점을 알려주세요</> : 학교없음 ? <>학교 경험이 없어도<br />괜찮아요</> : <>학력과 학점을<br />알려주세요</>,
    스펙: 있음 ? <>입사 당시 자격과<br />교육·실습을 알려주세요</> : <>자격·교육과<br />실습을 알려주세요</>,
    희망: <>어디로<br />가고 싶으세요?</>,
    관심: <>어떤 분야에<br />관심 있으세요?</>,
    급여: 급여입력 ? null : <>내 급여,<br />어느 정도일까요?</>,
  };
  const 설명: Partial<Record<단계, string>> = {
    학교: 있음 ? '현재 또는 가장 최근에 근무한 병원 한 곳을 기준으로 입력해 주세요.'
      : 학교없음 ? '학적과 학점 입력 없이 계속할 수 있어요. 비교 정보가 없으면 ‘입력 정보 없음’으로 표시해요.'
      : '관심 병원 입사자 정보와 내 스펙을 비교할 수 있어요.',
    스펙: 있음 ? '입사할 때 보유했던 자격과 이수한 교육을 선택해 주세요.' : '입사자들이 어떤 자격과 교육을 갖췄는지 비교할 수 있어요.',
    희망: '희망 지역과 기관 유형에 맞는 공고를 먼저 보여드려요.',
    관심: '관심에 맞는 교육·공고 소식을 먼저 알려드려요.',
  };

  const 다시하기 = async () => {
    await browserSupabase().auth.signOut({ scope: 'local' });
    toast('처음부터 다시 해요');
    router.replace('/login');
  };
  const 뒤로 = () => {
    if (step === '급여' && 급여입력) { set급여입력(false); return; }
    const i = 순서.indexOf(step);
    /* 가입 줄이 생긴 뒤에는 ②③으로 돌아가지 않습니다(닉네임을 두 번 만들 수 없음) */
    if (i > 0 && !(me && i <= 3)) { go(순서[i - 1]); return; }
    if (step === '동의' || confirm('처음부터 다시 할까요? 로그인 화면으로 돌아가요.')) void 다시하기();
  };

  const 아래단추 =
    step === '동의' ? <RapoButton onClick={베타동의남기기} disabled={!allRequired || busy} full>{busy ? '확인하는 중…' : allRequired ? '동의하고 다음' : '필수 항목에 모두 동의해 주세요'}</RapoButton>
    : step === '내정보' ? <RapoButton onClick={saveWho} disabled={busy || !job || !role} full>{busy ? '저장하는 중…' : (!job || !role) ? '둘 다 골라 주세요' : '다음'}</RapoButton>
    : step === '닉네임' ? <RapoButton onClick={saveNickname} disabled={busy || nick.trim().length < 2} full>{busy ? '저장하는 중…' : '가입하기'}</RapoButton>
    : step === '학교' ? <RapoButton onClick={() => go('스펙')} disabled={!학교됨} full>{학교됨 ? '다음' : '위 칸을 채워 주세요'}</RapoButton>
    : step === '스펙' ? <RapoButton onClick={() => go('희망')} disabled={!스펙됨} full>{스펙됨 ? '다음' : '위 칸을 채워 주세요'}</RapoButton>
    : step === '희망' ? <RapoButton onClick={() => go(있음 ? '급여' : '관심')} disabled={!희망됨} full>{!희망됨 ? '위 칸을 채워 주세요' : '다음'}</RapoButton>
    : step === '관심' ? <RapoButton onClick={스펙저장} disabled={!관심됨 || busy} full>{busy ? '저장하는 중…' : !관심됨 ? '성인·소아 중 하나를 골라 주세요' : '가입 완료'}</RapoButton>
    : step === '끝' ? <RapoButton onClick={가입끝} full>{학교없음 && !있음 ? '공개된 정보 둘러보기' : '시작하기'}</RapoButton>
    : null;

  return (
    <div data-rapo className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col bg-(--rapo-color-bg-layer-default)">
      <header className="sticky top-0 z-20 flex h-[56px] shrink-0 items-center gap-(--rapo-dimension-x2) bg-(--rapo-color-bg-layer-default) px-(--rapo-dimension-x2)">
        {step !== '끝' ? (
          <button type="button" onClick={뒤로} aria-label="이전 단계"
            className="flex size-(--rapo-touch-min) shrink-0 items-center justify-center rounded-(--rapo-radius-r2) active:bg-(--rapo-color-bg-transparent-pressed)">
            {/* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 SVG 그대로 */}
            <img src="/rapo/detail/arrow-left-20.svg" alt="" width={20} height={20} />
          </button>
        ) : <span aria-hidden className="size-(--rapo-touch-min) shrink-0" />}
        <p className="rapo-type-t5-bold min-w-0 flex-1 text-center text-(color:--rapo-color-fg-neutral)">회원가입</p>
        <span aria-hidden className="size-(--rapo-touch-min) shrink-0" />
      </header>

      <main className="flex-1 px-(--rapo-dimension-x5) pb-(--rapo-dimension-x6)">
        {step !== '끝' && (
          <div className="pt-(--rapo-dimension-x4)" role="group" aria-label={`가입 순서 ${n} / ${순서.length} · ${단계이름[step]}`}>
            <div className="flex items-center">
              <p className="rapo-type-t3-regular min-w-0 flex-1 text-(color:--rapo-color-fg-neutral-muted)">{단계이름[step]}</p>
              <p className="rapo-type-t3-bold text-(color:--rapo-color-fg-neutral)">{n} / {순서.length}</p>
            </div>
            <div aria-hidden className="mt-(--rapo-dimension-x2) flex gap-(--rapo-dimension-x1)">
              {순서.map((t, i) => (
                <span key={t} className={'h-(--rapo-dimension-x1) flex-1 rounded-(--rapo-radius-full) ' + (i < n ? 'bg-(--rapo-color-bg-identity)' : 'bg-(--rapo-color-bg-neutral-weak)')} />
              ))}
            </div>
          </div>
        )}

        {제목[step] && <h1 className="rapo-type-t11-bold mt-(--rapo-dimension-x6) break-keep text-(color:--rapo-color-fg-neutral)">{제목[step]}</h1>}
        {설명[step] && <p className="rapo-type-t4-regular mt-(--rapo-dimension-x2) break-keep text-(color:--rapo-color-fg-neutral-muted)">{설명[step]}</p>}

        {step === '동의' && (
          <section className="mt-(--rapo-dimension-x6) flex flex-col gap-(--rapo-dimension-x4)">
            <button type="button" onClick={toggleAll} aria-pressed={allChecked}
              className="flex items-center gap-(--rapo-dimension-x4) rounded-(--rapo-radius-r3) bg-(--rapo-color-bg-brand-weak) px-(--rapo-dimension-x5) py-(--rapo-dimension-x4) text-left">
              <Box on={allChecked} />
              <span>
                <span className="rapo-type-t6-bold block text-(color:--rapo-color-fg-neutral)">전체 동의</span>
                <span className="rapo-type-t3-regular block text-(color:--rapo-color-fg-neutral-muted)">선택 항목을 포함해 모두 동의해요</span>
              </span>
            </button>
            {([['필수', 필수동의], ['선택', 선택동의]] as const).map(([묶음, 줄들]) => (
              <div key={묶음}>
                <p className="rapo-type-t3-bold pb-(--rapo-dimension-x1) text-(color:--rapo-color-fg-neutral-muted)">{묶음} 항목</p>
                <ul className="flex flex-col">
                  {줄들.map((a) => <동의행 key={a.key} a={a} on={!!checked[a.key]} set={(v) => setChecked({ ...checked, [a.key]: v })} />)}
                </ul>
              </div>
            ))}
            <p className="rapo-type-t3-regular text-(color:--rapo-color-fg-neutral-muted)">선택 항목에 동의하지 않아도 가입할 수 있어요.</p>
            {betaErr && <p role="alert" className="rapo-type-t4-medium text-(color:--rapo-color-fg-brand-contrast)">{betaErr}</p>}
          </section>
        )}

        {step === '내정보' && (
          <section className="mt-(--rapo-dimension-x6) flex flex-col gap-(--rapo-dimension-x3)">
            <골라 label="직군" v={job ?? ''} opts={JOB_GROUPS} ph="직군을 선택해 주세요" on={(v) => setJob(v as JobGroup)} />
            <h2 className="rapo-type-t6-bold mt-(--rapo-dimension-x3) text-(color:--rapo-color-fg-neutral)">선택한 직군으로 일한 경험이 있나요?</h2>
            <Choice on={경험값 === '없음'} go={() => setExp('없음')} sub="현재 스펙을 입력해요">아직 없어요</Choice>
            <Choice on={경험값 === '있음'} go={() => setExp('있음')} sub="입사 당시 스펙을 입력해요">일한 경험이 있어요</Choice>
            <p className="rapo-type-t4-regular break-keep rounded-(--rapo-radius-r2) bg-(--rapo-color-bg-neutral-weak) p-(--rapo-dimension-x4) text-(color:--rapo-color-fg-neutral-muted)">
              실습 경험은 제외해요. 지금 쉬고 있거나 이직을 준비 중이어도 근무 경험이 있다면 ‘있어요’를 선택해 주세요.
            </p>
          </section>
        )}

        {step === '닉네임' && (
          <section className="mt-(--rapo-dimension-x6) flex flex-col gap-(--rapo-dimension-x3)">
            <p className="rapo-type-t5-regular text-(color:--rapo-color-fg-neutral-muted)">커뮤니티에서 이 이름으로 보여요. 나중에 5번까지 바꿀 수 있어요.</p>
            <input value={nick} onChange={(e) => { setNick(e.target.value); setNickErr(null); }} maxLength={12} placeholder="2~12자" aria-label="닉네임" className={칸} />
            {nickErr && <p role="alert" className="rapo-type-t4-medium text-(color:--rapo-color-fg-brand-contrast)">{nickErr}</p>}
          </section>
        )}

        {step === '학교' && (
          <section className="mt-(--rapo-dimension-x6) flex flex-col gap-(--rapo-dimension-x5)">
            {있음 && (
              <>
                <div className="flex flex-col gap-(--rapo-dimension-x2)">
                  <span className="rapo-type-t5-bold text-(color:--rapo-color-fg-neutral)">병원</span>
                  <input value={d.병원 ?? ''} onChange={(e) => put({ 병원: e.target.value })} placeholder={직접입력 ? '병원 이름을 적어 주세요' : '병원 이름으로 찾기'}
                    aria-label="병원" className={칸} />
                  {병원후보.length > 0 && (
                    <ul className="flex flex-col overflow-hidden rounded-(--rapo-radius-r3) border-(length:--rapo-border-default) border-(color:--rapo-color-stroke-neutral-weak)">
                      {병원후보.map((h) => (
                        <li key={h.name + h.곳}>
                          <button type="button" onClick={() => { put({ 병원: h.name }); set병원후보([]); }}
                            className="flex w-full items-baseline gap-(--rapo-dimension-x2) px-(--rapo-dimension-x4) py-(--rapo-dimension-x3) text-left active:bg-(--rapo-color-bg-transparent-pressed)">
                            <span className="rapo-type-t5-medium min-w-0 flex-1 break-keep text-(color:--rapo-color-fg-neutral)">{h.name}</span>
                            <span className="rapo-type-t3-regular shrink-0 whitespace-nowrap text-(color:--rapo-color-fg-neutral-muted)">{h.곳}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {!직접입력 && (
                    <button type="button" onClick={() => { set직접입력(true); set병원후보([]); }}
                      className="rapo-type-t4-bold self-start text-(color:--rapo-color-fg-neutral)">검색되지 않나요? 직접 입력 ›</button>
                  )}
                </div>
                <골라 label="입사연도" v={d.입사연도 ?? ''} ph="입사연도를 선택해 주세요"
                  opts={Array.from({ length: 41 }, (_, i) => String(Number(todayKst().slice(0, 4)) - i))} 붙임="년"
                  on={(v) => put({ 입사연도: v })} />
              </>
            )}

            {/* 학교 — 협회 목록의 작업치료·물리치료 학과 전부 (직군에 맞춰) · 고르면 아래에 「경기 · 3년제」 · 학력도 맞춰 채움 */}
            {!있음 && !학교없음 && (
              <div className="flex flex-col gap-(--rapo-dimension-x2)">
                {d.학교직접 ? (
                  <label className="flex flex-col gap-(--rapo-dimension-x2)">
                    <span className="rapo-type-t5-bold text-(color:--rapo-color-fg-neutral)">학교</span>
                    <input value={d.학교 ?? ''} onChange={(e) => put({ 학교: e.target.value })} placeholder="학교와 학과 이름" className={칸} />
                  </label>
                ) : (
                  <골라 label="학교" v={d.학교 ?? ''} opts={학교들.map((x) => x.이름)} ph="학교를 선택해 주세요"
                    on={(v) => { const x = 학교들.find((y) => y.이름 === v); put({ 학교: v, ...(x?.학력 ? { 학력: x.학력 } : {}) }); }} />
                )}
                {고른학교 && 학교부연(고른학교) && <p className="rapo-type-t4-bold text-(color:--rapo-color-fg-brand-contrast)">{학교부연(고른학교)}</p>}
                <button type="button" onClick={() => put({ 학교직접: !d.학교직접, 학교: '' })}
                  className="rapo-type-t4-bold self-start text-(color:--rapo-color-fg-neutral)">{d.학교직접 ? '목록에서 고르기 ›' : '목록에 없나요? 직접 입력 ›'}</button>
              </div>
            )}

            <골라 label={있음 ? '입사 당시 학력' : '학력'} v={d.학력 ?? ''} opts={학력목록} ph="학력을 선택해 주세요" on={(v) => put({ 학력: v })} />

            {!있음 && !학교없음 && (
              <>
                <div className="flex flex-col gap-(--rapo-dimension-x2)">
                  <span className="rapo-type-t5-bold text-(color:--rapo-color-fg-neutral)">학적</span>
                  <div className="grid grid-cols-2 gap-(--rapo-dimension-x2)">
                    {(['재학', '졸업'] as const).map((x) => (
                      <Choice key={x} on={d.학적 === x} go={() => put({ 학적: x })} small>{x === '재학' ? '재학 중' : '졸업'}</Choice>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-(--rapo-dimension-x2)">
                  <span className="rapo-type-t5-bold text-(color:--rapo-color-fg-neutral)">입학 연월</span>
                  <div className="grid grid-cols-2 gap-(--rapo-dimension-x2)">
                    <골라 v={d.입학년 ?? ''} ph="연도" aria="입학 연도" 붙임="년"
                      opts={Array.from({ length: 16 }, (_, i) => String(Number(todayKst().slice(0, 4)) - i))} on={(v) => put({ 입학년: v })} />
                    <골라 v={d.입학월 ?? ''} ph="월" aria="입학 월" 붙임="월"
                      opts={Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'))} on={(v) => put({ 입학월: v })} />
                  </div>
                  <p className={'rapo-type-t3-regular break-keep ' + (입학미래 ? 'text-(color:--rapo-color-fg-critical)' : 'text-(color:--rapo-color-fg-neutral-muted)')}>
                    {입학미래 ? '입학 연월은 현재 또는 이전으로 선택해 주세요.'
                      : 졸업 ? (
                        <>
                          <span className="block">{d.학적 === '졸업' ? '졸업 연월' : '졸업 예정'} {연월말(졸업)} · 자동 계산</span>
                          <span className="block">{끝남 ? '무료 열람 기간 종료' : `${날말(끝날!)}까지 무료 열람`} · 변경은 운영자 문의</span>
                        </>
                      ) : '선택한 학력과 입학 연월로 졸업 예정일을 계산해요. 수정이 필요하면 운영자에게 문의해 주세요.'}
                  </p>
                </div>
              </>
            )}

            {!학교없음 && (
              <label className="flex flex-col gap-(--rapo-dimension-x2)">
                <span className="rapo-type-t5-bold text-(color:--rapo-color-fg-neutral)">
                  {있음 ? '입사 당시 학점' : '누적 학점'} <span className="rapo-type-t3-regular text-(color:--rapo-color-fg-neutral-muted)">(선택)</span>
                </span>
                <span className={'flex items-center rounded-(--rapo-radius-r3) border-(length:--rapo-border-default) ' + (학점틀림 ? 'border-(color:--rapo-color-stroke-critical-solid)' : 'border-(color:--rapo-color-stroke-neutral-weak)')}>
                  <input value={d.학점 ?? ''} onChange={(e) => put({ 학점: e.target.value })} inputMode="decimal" placeholder="예) 3.8"
                    className="rapo-type-t5-regular h-(--rapo-dimension-x13) min-w-0 flex-1 rounded-(--rapo-radius-r3) bg-transparent px-(--rapo-dimension-x4) text-(color:--rapo-color-fg-neutral) outline-none placeholder:text-(color:--rapo-color-fg-placeholder)" />
                  <span className="rapo-type-t5-regular shrink-0 pr-(--rapo-dimension-x4) text-(color:--rapo-color-fg-neutral-muted)">/ 4.5</span>
                </span>
                <span className={'rapo-type-t3-regular break-keep ' + (학점틀림 ? 'text-(color:--rapo-color-fg-critical)' : 'text-(color:--rapo-color-fg-neutral-muted)')}>
                  {학점틀림 ? '학점은 0부터 4.5까지 입력해 주세요.' : '4.5 만점 기준이에요. 입력하면 가입한 사람들과 학점을 비교할 수 있어요.'}
                </span>
              </label>
            )}

            {학교없음 && !있음 && (
              <p className="rapo-type-t4-regular break-keep rounded-(--rapo-radius-r2) bg-(--rapo-color-bg-neutral-weak) p-(--rapo-dimension-x4) text-(color:--rapo-color-fg-neutral-muted)">
                졸업 기준 무료 열람 기간은 적용되지 않아요.
              </p>
            )}
            {있음 && (
              <p className="rapo-type-t4-regular break-keep rounded-(--rapo-radius-r2) bg-(--rapo-color-bg-neutral-weak) p-(--rapo-dimension-x4) text-(color:--rapo-color-fg-neutral-muted)">
                병원과 스펙 정보는 게시글이나 댓글에 표시되지 않아요.
              </p>
            )}
          </section>
        )}

        {step === '스펙' && (
          <section className="mt-(--rapo-dimension-x6) flex flex-col">
            <Chips label="자격증" none="보유 자격증 없음" groups={CERTS} picked={certs} on={(v) => put({ certs: v })} />
            <Chips label="교육 이수" none="이수 교육 없음" groups={coursesFor(job ?? me?.job_group ?? '작업치료사')} picked={courses}
              on={(v) => put({ courses: v })} hint="기관만 선택하지 않고, 이수한 과정까지 선택해요." />
            <h2 className="rapo-type-t5-bold mt-(--rapo-dimension-x8) text-(color:--rapo-color-fg-neutral)">{있음 ? '입사 전 실습 경험' : '실습 경험'}</h2>
            <p className="rapo-type-t3-regular mt-(--rapo-dimension-x1) break-keep text-(color:--rapo-color-fg-neutral-muted)">기관 유형과 지역, 실습 기간을 알려주세요. 최대 5개까지 추가할 수 있어요.</p>
            <Rows rows={rows} none="실습 없음" noneOn={!!d.rowsNone} setNone={(b) => put(b ? { rowsNone: true, rows: [] } : { rowsNone: false })}
              on={(v) => put({ rows: v })} />
            <h2 className="rapo-type-t5-bold mt-(--rapo-dimension-x8) text-(color:--rapo-color-fg-neutral)">어학 <span className="rapo-type-t3-regular text-(color:--rapo-color-fg-neutral-muted)">(선택)</span></h2>
            <Langs rows={langs} on={(v) => put({ langs: v })} />
            <p className="rapo-type-t3-regular mt-(--rapo-dimension-x2) text-(color:--rapo-color-fg-neutral-muted)">어학 정보가 없어도 다음으로 넘어갈 수 있어요.</p>
          </section>
        )}

        {step === '희망' && (
          <section className="mt-(--rapo-dimension-x6) flex flex-col gap-(--rapo-dimension-x5)">
            <골라 label="희망 기관 유형" v={d.희망유형 ?? ''} opts={희망유형} ph="기관 유형 선택" on={(v) => put({ 희망유형: v })} />
            <골라 label="희망 지역" v={d.희망지역 ?? ''} opts={희망지역} ph="지역 선택" on={(v) => put({ 희망지역: v })} />
            <p className="rapo-type-t4-regular break-keep rounded-(--rapo-radius-r2) bg-(--rapo-color-bg-neutral-weak) p-(--rapo-dimension-x4) text-(color:--rapo-color-fg-neutral-muted)">
              {있음 ? '현재 근무조건과 별개로, 앞으로 일하고 싶은 곳의 조건이에요.' : '희망 조건은 가입 후 내 정보에서 바꿀 수 있어요.'}
            </p>
            {saveErr && <p role="alert" className="rapo-type-t4-medium break-keep text-(color:--rapo-color-fg-critical)">{saveErr}</p>}
          </section>
        )}

        {/* 관심 (학생·취준생) — 2026-11-15 세중님 「성인, 소아 중 더 관심 있는 분야 · 듣고 싶은 교육의 종류 · 관심 있는 분야 — 물리·작업 학생에 맞게 예시」 */}
        {step === '관심' && (
          <section className="mt-(--rapo-dimension-x6) flex flex-col gap-(--rapo-dimension-x6)">
            <div className="flex flex-col gap-(--rapo-dimension-x2)">
              <span className="rapo-type-t5-bold text-(color:--rapo-color-fg-neutral)">성인, 소아 중 더 관심 있는 분야는?</span>
              <div className="grid grid-cols-3 gap-(--rapo-dimension-x2)">
                {관심대상들.map((x) => <Choice key={x} on={d.관심대상 === x} go={() => put({ 관심대상: x })} small>{x}</Choice>)}
              </div>
            </div>
            <고른칩 제목="관심 있는 분야는?" 덧="여러 개 골라도 돼요" 예시={예시고르기(관심분야예시, job ?? me?.job_group)} 고름={d.관심분야 ?? []} on={(v) => put({ 관심분야: v })} />
            <고른칩 제목="듣고 싶은 교육의 종류는?" 덧="여러 개 골라도 돼요" 예시={예시고르기(듣고싶은교육예시, job ?? me?.job_group)} 고름={d.듣고싶은교육 ?? []} on={(v) => put({ 듣고싶은교육: v })} />
            {saveErr && <p role="alert" className="rapo-type-t4-medium break-keep text-(color:--rapo-color-fg-critical)">{saveErr}</p>}
          </section>
        )}

        {/* ⑦ 급여 (경험 있음만 · 선택) — 원본 U05-05 「급여 선택 · 하단」 1245:3935 */}
        {step === '급여' && !급여입력 && (
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
            <button type="button" onClick={스펙저장} disabled={busy}
              className="rapo-type-t4-bold self-start text-(color:--rapo-color-fg-neutral) underline underline-offset-4 disabled:opacity-40">
              {busy ? '가입을 마치는 중…' : '나중에 입력하고 가입 완료'}
            </button>
            <p className="rapo-type-t4-regular -mt-(--rapo-dimension-x3) break-keep text-(color:--rapo-color-fg-neutral-muted)">
              급여는 선택 항목이에요. 나중에 내 정보 → 스펙 확인·수정에서 입력할 수 있어요.
            </p>
            {saveErr && <p role="alert" className="rapo-type-t4-medium break-keep text-(color:--rapo-color-fg-critical)">{saveErr}</p>}
          </section>
        )}
        {step === '급여' && 급여입력 && (
          <div className="mt-(--rapo-dimension-x6)">
            <SignupSurvey userId={session.user.id} job={job ?? me?.job_group ?? '작업치료사'} role="현직"
              급여만={{ spec, langs, 입사연도: Number(d.입사연도) }}
              onDone={async () => { try { localStorage.removeItem(초안열쇠(session.user.id)); } catch { /* 없어도 그만 */ } await 가입끝(); }} />
          </div>
        )}

        {/* 완료 — 원본 U05-06 (무료 이용 1495:5010 · 임상 정보 완료 1245:4005 · 공개 범위 1495:5033) */}
        {step === '끝' && (
          <section className="flex flex-col gap-(--rapo-dimension-x5) pt-(--rapo-dimension-x4)">
            <h1 className="rapo-type-t11-bold text-(color:--rapo-color-fg-neutral)">가입이 완료됐어요</h1>
            <span aria-hidden className="flex size-[96px] items-center justify-center rounded-(--rapo-radius-full) bg-(--rapo-color-bg-brand-weak)">
              <svg width="44" height="34" viewBox="0 0 44 34" fill="none"><path d="M3 17l13 13L41 4" stroke="var(--rapo-color-bg-identity)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
            {있음 ? (
              <>
                <p className="rapo-type-t9-bold break-keep text-(color:--rapo-color-fg-neutral)">근무 정보를 등록했어요</p>
                <p className="rapo-type-t4-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">급여는 나중에 입력해도 괜찮아요. 이제 비교 정보와 커뮤니티를 이용할 수 있어요.</p>
              </>
            ) : 끝날 && !끝남 ? (
              <>
                <p className="rapo-type-t9-bold break-keep text-(color:--rapo-color-fg-neutral)">{날말(끝날)}까지<br />무료로 이용해요</p>
                <p className="rapo-type-t4-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">선택한 학력과 입학 연월로 계산한 졸업 시점을 기준으로 해요.</p>
              </>
            ) : 학교없음 ? (
              <>
                <p className="rapo-type-t9-bold break-keep text-(color:--rapo-color-fg-neutral)">공개된 정보부터<br />둘러보세요</p>
                <p className="rapo-type-t4-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">졸업 기준 무료 열람 기간이 적용되지 않아요.</p>
                <Link href="/contact" className="flex items-center gap-(--rapo-dimension-x3) rounded-(--rapo-radius-r3) bg-(--rapo-color-bg-neutral-weak) p-(--rapo-dimension-x4)">
                  <span className="rapo-type-t5-medium min-w-0 flex-1 text-(color:--rapo-color-fg-neutral)">아직 임상 경험이 없어요 / 문의</span>
                  <span aria-hidden className="rapo-type-t8-regular text-(color:--rapo-color-fg-neutral)">›</span>
                </Link>
                <Link href="/me/spec" className="rapo-type-t4-bold self-start text-(color:--rapo-color-fg-neutral)">근무 경험이 생겼다면 정보 등록 ›</Link>
              </>
            ) : (
              <p className="rapo-type-t9-bold break-keep text-(color:--rapo-color-fg-neutral)">라포에서 동료들의<br />이야기를 만나보세요</p>
            )}
          </section>
        )}
      </main>

      {아래단추 && (
        <div className="sticky bottom-0 bg-(--rapo-color-bg-layer-default) px-(--rapo-dimension-x5) pt-(--rapo-dimension-x2) pb-[calc(var(--rapo-dimension-x4)+env(safe-area-inset-bottom))]">
          {아래단추}
        </div>
      )}

      {비교알림켜짐 && compareOpen && (
        <CompareNotify userId={session.user.id} job={job ?? (me?.job_group as JobGroup | undefined) ?? null}
          email={session.user.email ?? null} onDone={() => setCompareOpen(false)} />
      )}
    </div>
  );
}

const 칸 = 'rapo-type-t5-regular h-(--rapo-dimension-x13) w-full min-w-0 rounded-(--rapo-radius-r3) border-(length:--rapo-border-default) '
  + 'border-(color:--rapo-color-stroke-neutral-weak) bg-(--rapo-color-bg-layer-default) px-(--rapo-dimension-x4) text-(color:--rapo-color-fg-neutral) '
  + 'placeholder:text-(color:--rapo-color-fg-placeholder)';

/* 고르는 칸 — 피그마의 「⌄」 드롭다운. 폰에서는 기본 고르기 창이 떠서 그대로 씁니다 */
function 골라({ label, v, opts, ph, on, aria, 붙임 = '' }: {
  label?: string; v: string; opts: readonly string[]; ph: string; on: (v: string) => void; aria?: string; 붙임?: string;
}) {
  const sel = (
    <span className="relative block">
      <select value={v} onChange={(e) => on(e.target.value)} aria-label={aria ?? label}
        className={칸 + ' appearance-none pr-(--rapo-dimension-x10) ' + (v ? '' : 'text-(color:--rapo-color-fg-placeholder)')}>
        <option value="" disabled>{ph}</option>
        {opts.map((o) => <option key={o} value={o}>{o}{붙임}</option>)}
      </select>
      <svg aria-hidden className="pointer-events-none absolute right-(--rapo-dimension-x4) top-1/2 -translate-y-1/2" width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M3 6l5 5 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
  if (!label) return sel;
  return (
    <label className="flex flex-col gap-(--rapo-dimension-x2)">
      <span className="rapo-type-t5-bold text-(color:--rapo-color-fg-neutral)">{label}</span>
      {sel}
    </label>
  );
}

/* 고르는 카드 — 원본 U05-02 의 선택 카드 */
function Choice({ on, go, sub, small = false, children }: { on: boolean; go: () => void; sub?: string; small?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" onClick={go} aria-pressed={on}
      className={'flex items-center gap-(--rapo-dimension-x3) rounded-(--rapo-radius-r3) border-(length:--rapo-border-default) text-left '
        + (small ? 'h-(--rapo-dimension-x13) px-(--rapo-dimension-x4) ' : 'px-(--rapo-dimension-x5) py-(--rapo-dimension-x4) ')
        + (on ? 'border-(color:--rapo-color-fg-brand-contrast) bg-(--rapo-color-bg-brand-weak)'
              : 'border-(color:--rapo-color-stroke-neutral-weak) active:bg-(--rapo-color-bg-transparent-pressed)')}>
      {small && <Dot on={on} />}
      <span className="min-w-0 flex-1">
        <span className={(small ? 'rapo-type-t4-medium' : 'rapo-type-t6-bold') + ' block text-(color:--rapo-color-fg-neutral)'}>{children}</span>
        {sub && <span className="rapo-type-t3-regular mt-(--rapo-dimension-x1) block text-(color:--rapo-color-fg-neutral-muted)">{sub}</span>}
      </span>
      {!small && <Dot on={on} />}
    </button>
  );
}
function Dot({ on }: { on: boolean }) {
  return (
    <span aria-hidden className={'flex size-[20px] shrink-0 items-center justify-center rounded-(--rapo-radius-full) border-(length:--rapo-border-default) '
      + (on ? 'border-(color:--rapo-color-bg-navy-solid) bg-(--rapo-color-bg-navy-solid)' : 'border-(color:--rapo-color-stroke-neutral-weak)')}>
      {on && <span className="size-[8px] rounded-(--rapo-radius-full) bg-(--rapo-color-bg-layer-default)" />}
    </span>
  );
}

/* 동의 한 줄 — 필수·선택이 같은 꼴 */
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

/* 여러 개 고르는 칩 + 직접 추가 (관심 분야 · 듣고 싶은 교육) */
function 고른칩({ 제목, 덧, 예시, 고름, on }: { 제목: string; 덧?: string; 예시: readonly string[]; 고름: string[]; on: (v: string[]) => void }) {
  const [글, set글] = useState('');
  const 모두 = [...예시, ...고름.filter((x) => !예시.includes(x))];
  const 토글 = (x: string) => on(고름.includes(x) ? 고름.filter((y) => y !== x) : [...고름, x]);
  const 더하기 = () => { const t = 글.trim().slice(0, 20); set글(''); if (t && !고름.includes(t)) on([...고름, t]); };
  return (
    <div className="flex flex-col gap-(--rapo-dimension-x2)">
      <span className="rapo-type-t5-bold text-(color:--rapo-color-fg-neutral)">{제목}</span>
      {덧 && <span className="rapo-type-t3-regular text-(color:--rapo-color-fg-neutral-muted)">{덧}</span>}
      <div className="flex flex-wrap gap-(--rapo-dimension-x2)">
        {모두.map((x) => {
          const 켬 = 고름.includes(x);
          return (
            <button key={x} type="button" aria-pressed={켬} onClick={() => 토글(x)}
              className={'rapo-type-t4-medium rounded-(--rapo-radius-full) border-(length:--rapo-border-default) px-(--rapo-dimension-x4) py-(--rapo-dimension-x2) '
                + (켬 ? 'border-(color:--rapo-color-fg-brand-contrast) bg-(--rapo-color-bg-brand-weak) text-(color:--rapo-color-fg-brand-contrast)'
                      : 'border-(color:--rapo-color-stroke-neutral-weak) text-(color:--rapo-color-fg-neutral)')}>
              {x}
            </button>
          );
        })}
      </div>
      <span className="flex gap-(--rapo-dimension-x2)">
        <input value={글} onChange={(e) => set글(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); 더하기(); } }}
          placeholder="직접 추가" aria-label={제목 + ' 직접 추가'} className={칸 + ' flex-1'} />
        <button type="button" onClick={더하기} className="rapo-type-t4-bold shrink-0 rounded-(--rapo-radius-r3) border-(length:--rapo-border-default) border-(color:--rapo-color-stroke-neutral-muted) px-(--rapo-dimension-x4) text-(color:--rapo-color-fg-neutral)">추가</button>
      </span>
    </div>
  );
}

/* 체크 네모 — 켜지면 navy 바탕에 흰 체크 */
function Box({ on }: { on: boolean }) {
  return (
    <span aria-hidden
      className={'flex size-[22px] shrink-0 items-center justify-center rounded-(--rapo-radius-r1) border-(length:--rapo-border-default) text-[14px] font-bold leading-none '
        + (on ? 'border-(color:--rapo-color-bg-navy-solid) bg-(--rapo-color-bg-navy-solid) text-(color:--rapo-color-fg-on-navy-solid)'
              : 'border-(color:--rapo-color-stroke-neutral-weak) bg-(--rapo-color-bg-layer-default)')}>
      {on ? '✓' : ''}
    </span>
  );
}
