'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { CompareNotify } from '@/components/compare-notify';
import { SignupSurvey } from '@/components/signup-survey';
import { 비교알림켜짐 } from '@/lib/beta-compare';
import { defaultAvatar } from '@/lib/avatar';
import { BETA_AGREEMENTS, 표없음 } from '@/lib/beta';
import { RapoButton } from '@/components/rapo/rapo-ui';
import { 만점들, 학년별담기, 학년수구하기, 학교찾기칸, 학점들틀렸나, 희망유형들 as 희망유형, 희망지역들 as 희망지역 } from '@/components/rapo/rapo-spec-form';
import { 가입진행, PickGroupField, 꺾쇠, 느낌표, HospitalSearch, PracticeField, LangField, 여는칸, YearMonthSheet, 저장점, 체크, 체크마크 } from '@/components/rapo/rapo-signup';
import { clearAfterLogin, peekAfterLogin } from '@/lib/after-login';
import { CERTS, NONE, coursesFor, langError, langsPayload, rowsReady, rowsToSave, type LangRow, type WorkRow } from '@/lib/signup-fields';
import { browserSupabase } from '@/lib/supabase-browser';
import { AGREEMENTS, TERMS_VERSION } from '@/lib/terms';
import { JOB_GROUPS, type JobGroup, type Role } from '@/lib/who';
import { 날말, 무료끝날, 미래인가, 연월말, 졸업연월, 취업인증안내 as 인증안내, 학력목록 } from '@/lib/school-period';
import { todayKst } from '@/lib/job-state';
import { 관심대상들, 관심분야예시, 듣고싶은교육예시, 예시고르기, 학교목록 } from '@/lib/signup-school';

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

   2026-11-16 피그마 화면 하나씩 맞춤 (동의 · 직군 · 학력 · 스펙 · 희망 · 급여 · 완료 · 저장 중 · 나가기 · 저장 실패)
     · 자격·교육·실습·어학은 「선택 추가·변경」 → 아래 선택창 · 병원은 따로 찾는 화면 · 입학 연월은 열두 달 창 — 부품은 components/rapo/rapo-signup.tsx
     · 「1분 안에 내 연봉 불러오기」는 자동 조회가 아직 없어 잠가 두었습니다
     · 피그마에 없는 학교 칸 · 학년별 학점 · 관심 단계는 세중님 11/15 결정이라 그대로 둡니다
     · 담는 값·save_my_survey 한 번 부르기는 바뀌지 않았습니다 (「아직 성적이 없어요」는 학점을 비워 담을 뿐)

   역할 값(profiles.role)은 그대로 「학생 / 현직」입니다 — 경험 없음 = 학생 · 경험 있음 = 현직 (커뮤니티 방이 이 값을 봅니다).
   스펙은 ⑥(경험 있음은 ⑦)에서 save_my_survey 한 번으로 담습니다. 두 번 부르면 두 번째가 「1년 2번 고치기」로 세어집니다. */

type 단계 = '동의' | '내정보' | '닉네임' | '학교' | '스펙' | '희망' | '관심' | '급여' | '끝';
type 경험 = '없음' | '있음';

/* 학점은 선택 (2026-11-15 세중님 「학점은 선택 · 기입하면 가입한 사람들과 비교」) · 만점 기준은 4.5/4.0 고르기 (같은 날 「보통 4.5 인데 4.0 도 있어」) — 칸은 components/rapo/rapo-spec-form 의 학점칸 */

/* 중간에 나갔다 와도 적은 게 남게 — 이 기기에만 둡니다 (옛 설문과 같은 결) */
type 초안 = {
  학교?: string;
  학력?: string; 학적?: '재학' | '졸업'; 입학년?: string; 입학월?: string; 학점?: string; 만점?: string; 학년별?: string[];
  /* 「아직 성적이 없어요」 (피그마 1241:2076) — 화면 표시만. 켜면 학점을 비워 담습니다(gpa null) */
  성적없음?: boolean;
  관심대상?: string; 관심분야?: string[]; 듣고싶은교육?: string[];
  병원?: string; 입사연도?: string;
  certs?: string[]; courses?: string[]; rows?: WorkRow[]; rowsNone?: boolean; langs?: LangRow[];
  희망유형?: string; 희망지역?: string;
};
/* 학생 가입 끝 추천 메뉴 (2026-11-15 세중님) — 실습 후기는 커뮤니티 「실습」 방 */
const 추천메뉴 = [
  { 이름: '실습 후기 확인하고 남기러 가기', href: '/community/prac' },
  { 이름: '봉사활동 찾아보기', href: '/volunteer' },
  { 이름: '청년 정책 찾아보기', href: '/youth' },
] as const;
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
  /* 병원 찾기 화면(피그마 1245:3594~3665) · 입학 연월 창(1241:2285) · 나가기 확인(1246:2291) */
  const [병원화면, set병원화면] = useState<'찾기' | '직접' | null>(null);
  const [연월열림, set연월열림] = useState(false);
  const [나가기, set나가기] = useState(false);

  useEffect(() => { if (session) setD(초안읽기(session.user.id)); }, [session]);
  /* 가입 줄이 생긴 뒤 ②③으로 돌아왔을 때 — 이미 고른 직군·닉네임을 채워 둡니다 (2026-11-15 세중님 「2-3으로도 돌아갈 수 있게」) */
  useEffect(() => { if (me) { setJob((j) => j ?? (me.job_group as JobGroup | null)); setNick((n) => n || me.nickname); } }, [me]);
  /* 가입하다 나갔다 다시 온 분께 한 번 (2026-11-15 세중님) */
  const 다시안내 = useRef(false);
  useEffect(() => {
    if (loading || 다시안내.current || justMade || !me || me.survey_at) return;
    다시안내.current = true;
    /* 줄은 직접 나눔 — 좁은 폰에서 말 가운데 안 잘리게 (토스트는 whitespace-pre-line) */
    toast('다시 돌아오셨네요!\n회원가입을 마무리하고\n라포를 이용해 주세요!', { ms: 4500 });
  }, [loading, me, justMade, toast]);
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

  /* 병원 찾기는 components/rapo/rapo-signup 의 병원찾기화면이 합니다 (org_search · 회원 권한 · 이름만 담음) */

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

  /* ── ② 직군·근무 경험 ── 가입 줄이 있으면(③ 뒤에 돌아온 분 · 옛 계정) 여기서 고칩니다 */
  const role: Role | null = 경험값 ? (경험값 === '있음' ? '현직' : '학생') : null;
  const saveWho = async () => {
    if (!job || !role) return;
    if (!me) { go('닉네임'); return; }
    setBusy(true);
    const { error } = await browserSupabase().from('profiles').update({ job_group: job, role }).eq('id', session.user.id);
    setBusy(false);
    if (error) { toast(`저장하지 못했어요 — ${error.message}`, { tone: 'danger', ms: 4000 }); return; }
    await reload();
    go('닉네임');
  };

  /* ── ③ 닉네임 = 가입 줄 만들기 (2026-10-11 창구 「가입하기」 그대로) ── */
  const saveNickname = async () => {
    if (!job || !role) { go('내정보'); return; }
    const name = nick.trim();
    if (name.length < 2 || name.length > 12) { setNickErr('2자에서 12자까지 쓸 수 있어요'); return; }
    setBusy(true); setNickErr(null);
    const sb = browserSupabase();
    /* 가입 줄이 이미 있음 — ③으로 돌아온 분. 닉네임만 고칩니다(가입 중 고침은 5번 셈에 안 들어감 · 금고 SQL_1113/ZX) */
    if (me) {
      if (name !== me.nickname) {
        const r = await sb.from('profiles').update({ nickname: name }).eq('id', session.user.id);
        if (r.error) { setBusy(false); setNickErr(r.error.code === '23505' ? '이미 쓰고 있는 닉네임이에요. 다른 것으로 해주세요' : `저장하지 못했어요 — ${r.error.message}`); return; }
        await reload();
      }
      setBusy(false);
      go('학교');
      return;
    }
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
  const 학교들 = 학교목록(job ?? me?.job_group);
  const 고른학교 = 학교들.find((x) => x.이름 === d.학교) ?? null;
  /* 학점 — 학년별(3년제 3칸 · 4년제 4칸) + 평균 · 모두 선택 (2026-11-15 세중님) */
  const 만점값 = d.만점 ?? '4.5';
  const 학년수 = 학년수구하기(d.학력, 있음 ? null : 고른학교?.학제);
  const 학점틀림 = !d.성적없음 && 학점들틀렸나(d.학점 ?? '', d.학년별 ?? [], 학년수, 만점값);
  const 평균틀림 = !d.성적없음 && 학점들틀렸나(d.학점 ?? '', [], 0, 만점값);
  const 학년별값 = d.성적없음 ? null : 학년별담기(d.학년별 ?? [], 학년수);
  const 학점됨 = !학점틀림;   // 비워도 됨
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
    gpa: 학교없음 || d.성적없음 || !d.학점?.trim() ? null : Number(d.학점),
    gpa_scale: 학교없음 || d.성적없음 || (!d.학점?.trim() && !학년별값) ? null : Number(만점값), 학년별학점: 학교없음 ? null : 학년별값,
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
    setBusy(true); setSaveErr(null); window.scrollTo(0, 0);
    const { error } = await browserSupabase().rpc('save_my_survey', { p_salary: null, p_spec: spec, p_langs: langsPayload(langs) });
    setBusy(false);
    /* 안내 글은 「저장 실패」 화면(1246:2205)이 냅니다 — 여기는 원인만 담아 작게 보여 줍니다 */
    if (error) { setSaveErr(`오류 내용: ${error.message}`); return; }
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

  /* ── 그리기 ── 피그마 07 B 화면을 하나씩 맞춤 (2026-11-16) — 본문 여백 24 · 진행 표시 → 제목 20 · 아래 고정 단추 위아래 24 */
  const 단계이름: Record<단계, string> = {
    동의: '이용 동의', 내정보: '내 정보', 닉네임: '닉네임', 학교: '학력·학점',
    스펙: '자격·교육·실습', 희망: '희망 취업 조건', 관심: '관심 분야', 급여: '급여 정보 (선택)', 끝: '',
  };
  const n = 순서.indexOf(step) + 1;
  /* 줄은 피그마 글상자 그대로 나눕니다 — 좁은 폰(320)에서는 break-keep 이 낱말 단위로 더 나눕니다 */
  const 제목: Partial<Record<단계, React.ReactNode>> = {
    동의: <>이용약관을 확인하고<br />라포를 시작해요</>,
    내정보: <>직군과 근무 경험을<br />알려주세요</>,
    닉네임: <>닉네임을<br />정해 주세요</>,
    학교: 있음 ? <>입사 당시 학력과<br />학점을 알려주세요</> : 학교없음 ? '학교 경험이 없어도 괜찮아요' : '학력과 학점을 알려주세요',
    스펙: 있음 ? <>입사 당시 자격과<br />교육·실습을 알려주세요</> : <>자격·교육과 실습을<br />알려주세요</>,
    희망: '어디로 가고 싶으세요?',
    관심: <>어떤 분야에<br />관심 있으세요?</>,
    급여: 급여입력 ? null : <>내 급여,<br />어느 정도일까요?</>,
  };
  const 설명: Partial<Record<단계, React.ReactNode>> = {
    학교: 있음 ? '현재 또는 가장 최근에 근무한 병원 한 곳을 기준으로 입력해 주세요.'
      : 학교없음 ? <>학적과 학점 입력 없이 계속할 수 있어요.<br />비교 정보가 없으면 ‘입력 정보 없음’으로 표시해요.</>
      : <>관심 병원 입사자 정보와<br />내 스펙을 비교할 수 있어요.</>,
    스펙: 있음 ? '입사할 때 보유했던 자격과 이수한 교육을 선택해 주세요.' : '입사자들이 어떤 자격과 교육을 갖췄는지 비교할 수 있어요.',
    희망: '희망 지역과 기관 유형에 맞는 공고를 먼저 보여드려요.',
    관심: '관심에 맞는 교육·공고 소식을 먼저 알려드려요.',
    급여: 급여입력 ? undefined : '급여를 입력하면 내 위치와 다른 근무 조건의 급여 차이를 확인할 수 있어요.',
  };

  const 다시하기 = async () => {
    await browserSupabase().auth.signOut({ scope: 'local' });
    toast('처음부터 다시 해요');
    router.replace('/login');
  };
  const 뒤로 = () => {
    if (step === '급여' && 급여입력) { set급여입력(false); return; }
    const i = 순서.indexOf(step);
    /* 가입 줄이 생긴 뒤에도 ②③으로 돌아갑니다 (2026-11-15 세중님) — ②는 직군·경험을 고치고 ③은 닉네임만 고칩니다 */
    if (i > 0) { go(순서[i - 1]); return; }
    /* 첫 단계에서 뒤로 — 브라우저 확인창 대신 피그마 「입력 중 나가기」 화면 (1246:2291) */
    set나가기(true); window.scrollTo(0, 0);
  };

  /* 가입 끝 단추 — 원래 화면으로 돌아갑니다 (피그마 「B 가입과 원래 화면 복귀」 · 1245:4005 「게시글로 돌아가기」) */
  /* 「끝」은 가입을 마친 뒤 브라우저에서만 닿는 단계라 그 자리에서 읽습니다 */
  let 돌아갈곳: string | null = null;
  if (step === '끝') { try { 돌아갈곳 = peekAfterLogin(); } catch { /* 사생활 보호 창 */ } }
  const 끝단추글 = 돌아갈곳?.startsWith('/community') ? '게시글로 돌아가기'
    : 돌아갈곳?.startsWith('/jobs') ? '공고로 돌아가기'
    : 돌아갈곳 && 돌아갈곳 !== '/' ? '보던 화면으로 돌아가기'
    : 학교없음 && !있음 ? '공개된 정보 둘러보기' : '시작하기';

  /* 단추 글은 막혀 있어도 그대로 둡니다 — 피그마는 회색 「다음」 (1211:25848 · 1241:1622) */
  const 아래단추 =
    step === '동의' ? <RapoButton onClick={베타동의남기기} disabled={!allRequired || busy} full>{busy ? '확인하는 중…' : '동의하고 다음'}</RapoButton>
    : step === '내정보' ? <RapoButton onClick={saveWho} disabled={busy || !job || !role} full>{busy ? '저장하는 중…' : '다음'}</RapoButton>
    : step === '닉네임' ? <RapoButton onClick={saveNickname} disabled={busy || nick.trim().length < 2} full>{busy ? '저장하는 중…' : me ? '다음' : '가입하기'}</RapoButton>
    : step === '학교' ? <RapoButton onClick={() => go('스펙')} disabled={!학교됨} full>다음</RapoButton>
    : step === '스펙' ? <RapoButton onClick={() => go('희망')} disabled={!스펙됨} full>다음</RapoButton>
    : step === '희망' ? <RapoButton onClick={() => go(있음 ? '급여' : '관심')} disabled={!희망됨} full>다음</RapoButton>
    : step === '관심' ? <RapoButton onClick={스펙저장} disabled={!관심됨 || busy} full>가입 완료</RapoButton>
    : step === '끝' ? <RapoButton onClick={가입끝} full>{끝단추글}</RapoButton>
    : null;

  const 머리 = (뒤: () => void) => (
    <header className="sticky top-0 z-20 flex h-[56px] shrink-0 items-center gap-(--rapo-dimension-x2) bg-(--rapo-color-bg-layer-default) px-(--rapo-dimension-x2)">
      <button type="button" onClick={뒤} aria-label="이전으로"
        className="flex size-(--rapo-touch-min) shrink-0 items-center justify-center rounded-(--rapo-radius-r2) active:bg-(--rapo-color-bg-transparent-pressed)">
        {/* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 SVG 그대로 */}
        <img src="/rapo/detail/arrow-left-20.svg" alt="" width={20} height={20} />
      </button>
      <p className="rapo-type-t5-bold min-w-0 flex-1 text-center text-(color:--rapo-color-fg-neutral)">회원가입</p>
      <span aria-hidden className="size-(--rapo-touch-min) shrink-0" />
    </header>
  );
  const 틀 = (뒤: () => void, 본문: React.ReactNode, 단추?: React.ReactNode) => (
    <div data-rapo className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col bg-(--rapo-color-bg-layer-default)">
      {머리(뒤)}
      <main className="flex-1 px-(--rapo-dimension-x6) pt-(--rapo-dimension-x6) pb-(--rapo-dimension-x6)">{본문}</main>
      {단추 && (
        <div className="sticky bottom-0 bg-(--rapo-color-bg-layer-default) px-(--rapo-dimension-x5) pt-(--rapo-dimension-x6) pb-[calc(var(--rapo-dimension-x6)+env(safe-area-inset-bottom))]">
          {단추}
        </div>
      )}
    </div>
  );

  /* ── 근무한 병원 찾기 (경험 있음 ④) — 피그마 1245:3594 · 3616 · 3641 · 3665 ── */
  if (병원화면) {
    return <HospitalSearch 처음={d.병원 ?? ''} 직접으로={병원화면 === '직접'}
      on={(이름) => { put({ 병원: 이름 }); set병원화면(null); window.scrollTo(0, 0); }} 닫기={() => set병원화면(null)} />;
  }

  /* ── 입력 중 나가기 — 1246:2291 ── */
  if (나가기) {
    return 틀(() => set나가기(false), (
      <section className="flex flex-col gap-(--rapo-dimension-x2)">
        <느낌표 />
        <h1 className="rapo-type-t11-bold mt-(--rapo-dimension-x5) break-keep text-(color:--rapo-color-fg-neutral)">가입을 잠시<br />멈출까요?</h1>
        <p className="rapo-type-t4-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">저장된 단계는 같은 계정으로 로그인해 이어갈 수 있어요.</p>
        <button type="button" onClick={() => void 다시하기()} className="rapo-type-t4-bold mt-(--rapo-dimension-x3) self-start py-(--rapo-dimension-x1) text-(color:--rapo-color-fg-neutral)">나가기</button>
      </section>
    ), <RapoButton full onClick={() => set나가기(false)}>계속 입력</RapoButton>);
  }

  /* ── 저장 중 — 1246:2267 (스펙 한 번에 담는 동안) ── */
  if (busy && (step === '관심' || step === '급여')) {
    return 틀(() => {}, (
      <section className="flex flex-col gap-(--rapo-dimension-x2)" role="status">
        <h1 className="rapo-type-t11-bold break-keep text-(color:--rapo-color-fg-neutral)">가입 정보를<br />저장하고 있어요</h1>
        <p className="rapo-type-t4-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">완료 여부를 확인한 뒤 이용 가능한 화면으로 안내할게요.</p>
        <span className="mt-(--rapo-dimension-x4)"><저장점 /></span>
        <p className="rapo-type-t4-regular mt-(--rapo-dimension-x4) text-(color:--rapo-color-fg-neutral-muted)">잠시만 기다려 주세요.</p>
      </section>
    ), <RapoButton full disabled onClick={() => {}}>저장 중</RapoButton>);
  }

  /* ── 저장 실패 — 1246:2205 (입력한 것은 이 기기 초안에 그대로 남습니다) ── */
  if (saveErr && (step === '관심' || step === '급여')) {
    return 틀(() => setSaveErr(null), (
      <section className="flex flex-col gap-(--rapo-dimension-x2)" role="alert">
        <느낌표 />
        <h1 className="rapo-type-t11-bold mt-(--rapo-dimension-x5) break-keep text-(color:--rapo-color-fg-neutral)">저장하지 못했어요</h1>
        <p className="rapo-type-t4-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">현재 입력한 내용은 그대로 있어요. 저장을 다시 시도해 주세요.</p>
        <p className="rapo-type-t2-regular break-all text-(color:--rapo-color-fg-neutral-subtle)">{saveErr}</p>
        <button type="button" onClick={() => setSaveErr(null)} className="rapo-type-t4-bold mt-(--rapo-dimension-x3) self-start py-(--rapo-dimension-x1) text-(color:--rapo-color-fg-neutral)">입력 화면으로</button>
      </section>
    ), <RapoButton full onClick={스펙저장}>다시 저장</RapoButton>);
  }

  /* 학점 묶음 — 피그마 「누적 학점 | 만점 기준」 한 줄 + 「아직 성적이 없어요」 (1241:1622 · 경험 있음 1245:1663 「입사 당시 학점 | 만점」 · 「성적 없음」).
     학년별 칸(3·4칸)은 피그마에 없지만 세중님이 11/15 에 넣으라고 하신 것이라 평균 아래에 둡니다 */
  const 학점묶음 = !학교없음 && (
    <div className="flex flex-col gap-(--rapo-dimension-x2)">
      {!d.성적없음 && (
        <>
          <div className="grid grid-cols-2 gap-(--rapo-dimension-x4)">
            <label className="flex min-w-0 flex-col gap-(--rapo-dimension-x2)">
              <span className="rapo-type-t4-medium text-(color:--rapo-color-fg-neutral)">{있음 ? '입사 당시 학점' : '누적 학점'}</span>
              <input value={d.학점 ?? ''} onChange={(e) => put({ 학점: e.target.value })} inputMode="decimal"
                placeholder={있음 ? '입사 당시 학점 입력' : '학점 입력'}
                className={칸 + ' h-[56px] ' + (평균틀림 ? 'border-(color:--rapo-color-stroke-critical-solid)' : '')} />
            </label>
            <골라 label={있음 ? '만점' : '만점 기준'} v={d.만점 ?? ''} opts={만점들} ph="만점 선택" on={(v) => put({ 만점: v })} 작은이름 />
          </div>
          {학년수 > 0 && (
            <div className="mt-(--rapo-dimension-x2) flex flex-col gap-(--rapo-dimension-x2)">
              <p className="rapo-type-t4-medium text-(color:--rapo-color-fg-neutral)">학년별 학점 <span className="rapo-type-t3-regular text-(color:--rapo-color-fg-neutral-muted)">(선택)</span></p>
              <div className={'grid gap-(--rapo-dimension-x2) ' + (학년수 === 4 ? 'grid-cols-4' : 'grid-cols-3')}>
                {Array.from({ length: 학년수 }, (_, i) => {
                  const v = d.학년별?.[i] ?? '';
                  const 칸틀림 = 학점들틀렸나('', [v], 1, 만점값);
                  return (
                    <input key={i} value={v} inputMode="decimal" placeholder={`${i + 1}학년`} aria-label={`${i + 1}학년 학점`}
                      onChange={(e) => { const x = [...(d.학년별 ?? [])]; while (x.length < 학년수) x.push(''); x[i] = e.target.value; put({ 학년별: x }); }}
                      className={칸 + ' px-(--rapo-dimension-x3) text-center ' + (칸틀림 ? 'border-(color:--rapo-color-stroke-critical-solid)' : '')} />
                  );
                })}
              </div>
            </div>
          )}
          <p className={'rapo-type-t3-regular break-keep ' + (학점틀림 ? 'text-(color:--rapo-color-fg-critical)' : 'text-(color:--rapo-color-fg-neutral-muted)')}>
            {학점틀림 ? '학점은 선택한 만점 이하로 입력해 주세요.' : '입력하면 가입한 사람들과 학점을 비교할 수 있어요.'}
          </p>
        </>
      )}
      <체크 on={!!d.성적없음} set={(b) => put(b ? { 성적없음: true, 학점: '', 학년별: [] } : { 성적없음: false })}>
        {있음 ? '성적 없음' : '아직 성적이 없어요'}
      </체크>
    </div>
  );

  const 연도목록 = Array.from({ length: 16 }, (_, i) => String(Number(todayKst().slice(0, 4)) - i));

  return 틀(step === '끝' ? 가입끝 : 뒤로, (
    <>
      {step !== '끝' && <가입진행 이름={단계이름[step]} n={n} 모두={순서.length} />}

      {제목[step] && <h1 className="rapo-type-t11-bold mt-(--rapo-dimension-x5) break-keep text-(color:--rapo-color-fg-neutral)">{제목[step]}</h1>}
      {설명[step] && <p className="rapo-type-t4-regular mt-(--rapo-dimension-x2) break-keep text-(color:--rapo-color-fg-neutral-muted)">{설명[step]}</p>}

      {/* ① 이용 동의 — 1211:25848(동의 전) · 1211:25913(필수 동의 완료). 일부만 고르면 전체 동의 칸이 「−」 */}
      {step === '동의' && (
        <section className="mt-(--rapo-dimension-x6) flex flex-col gap-(--rapo-dimension-x5)">
          <button type="button" onClick={toggleAll} aria-pressed={allChecked}
            className={'flex items-center gap-(--rapo-dimension-x4) rounded-(--rapo-radius-r4) px-(--rapo-dimension-x5) py-(--rapo-dimension-x5) text-left '
              + (모든동의.some((a) => checked[a.key]) ? 'bg-(--rapo-color-bg-brand-weak)' : 'bg-(--rapo-color-bg-neutral-weak)')}>
            <체크마크 on={allChecked} 반={!allChecked && 모든동의.some((a) => checked[a.key])} />
            <span className="min-w-0">
              <span className="rapo-type-t6-bold block text-(color:--rapo-color-fg-neutral)">전체 동의</span>
              <span className="rapo-type-t3-regular mt-(--rapo-dimension-x1) block break-keep text-(color:--rapo-color-fg-neutral-muted)">선택 항목을 포함해 모두 동의해요</span>
            </span>
          </button>
          {/* 필수 → 선택 차례로 한 목록 (피그마에는 묶음 제목이 없습니다) */}
          <ul className="flex flex-col">
            {[...필수동의, ...선택동의].map((a, i, all) => (
              <동의행 key={a.key} a={a} on={!!checked[a.key]} 끝={i === all.length - 1} set={(v) => setChecked({ ...checked, [a.key]: v })} />
            ))}
          </ul>
          <p className="rapo-type-t4-regular break-keep rounded-(--rapo-radius-r3) bg-(--rapo-color-bg-neutral-weak) p-(--rapo-dimension-x4) text-(color:--rapo-color-fg-neutral-muted)">
            선택 항목에 동의하지 않아도 가입할 수 있어요.<br />각 항목의 화살표를 눌러 전문을 확인해 주세요.
          </p>
          {betaErr && <p role="alert" className="rapo-type-t4-medium text-(color:--rapo-color-fg-critical)">{betaErr}</p>}
        </section>
      )}

      {/* ② 직군·근무 경험 — 1211:25984 · 26036 · 26089 */}
      {step === '내정보' && (
        <section className="mt-(--rapo-dimension-x6) flex flex-col gap-(--rapo-dimension-x3)">
          <골라 label="직군" v={job ?? ''} opts={JOB_GROUPS} ph="직군을 선택해 주세요" on={(v) => setJob(v as JobGroup)} />
          <h2 className="rapo-type-t6-bold mt-(--rapo-dimension-x3) break-keep text-(color:--rapo-color-fg-neutral)">선택한 직군으로 일한 경험이 있나요?</h2>
          <Choice on={경험값 === '없음'} go={() => setExp('없음')} sub="현재 스펙을 입력해요">아직 없어요</Choice>
          <Choice on={경험값 === '있음'} go={() => setExp('있음')} sub="입사 당시 스펙을 입력해요">일한 경험이 있어요</Choice>
          <p className="rapo-type-t4-regular mt-(--rapo-dimension-x3) break-keep rounded-(--rapo-radius-r3) bg-(--rapo-color-bg-neutral-weak) p-(--rapo-dimension-x4) text-(color:--rapo-color-fg-neutral-muted)">
            실습 경험은 제외해요. 지금 쉬고 있거나 이직을 준비 중이어도 근무 경험이 있다면 ‘있어요’를 선택해 주세요.
          </p>
        </section>
      )}

      {/* ③ 닉네임 — 피그마 가입에는 없음(가입 줄을 만드는 자리라 남김) */}
      {step === '닉네임' && (
        <section className="mt-(--rapo-dimension-x6) flex flex-col gap-(--rapo-dimension-x3)">
          <p className="rapo-type-t4-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">커뮤니티에서 이 이름으로 보여요. 나중에 5번까지 바꿀 수 있어요.</p>
          <input value={nick} onChange={(e) => { setNick(e.target.value); setNickErr(null); }} maxLength={12} placeholder="2~12자" aria-label="닉네임"
            className={칸 + ' h-[56px] ' + (nickErr ? 'border-(color:--rapo-color-stroke-critical-solid)' : '')} />
          {nickErr && <p role="alert" className="rapo-type-t3-regular break-keep text-(color:--rapo-color-fg-critical)">{nickErr}</p>}
        </section>
      )}

      {/* ④ 학력·학점 — 경험 없음 1241:1622 · 1906 · 2001 · 2076 · 학교 경험 없음 1483:4796 / 경험 있음 1245:1663 · 1745 */}
      {step === '학교' && (
        <section className="mt-(--rapo-dimension-x5) flex flex-col gap-(--rapo-dimension-x5)">
          {있음 && (
            <>
              <div className="flex flex-col gap-(--rapo-dimension-x2)">
                <span className="rapo-type-t5-medium text-(color:--rapo-color-fg-neutral)">병원</span>
                <여는칸 글={d.병원?.trim()} 빈글="병원 선택" on={() => set병원화면('찾기')} aria="병원 찾기" />
                <button type="button" onClick={() => set병원화면('직접')}
                  className="rapo-type-t3-bold mt-(--rapo-dimension-x2) self-start text-(color:--rapo-color-fg-neutral)">검색되지 않나요? 직접 입력 ›</button>
              </div>
              <골라 label="입사연도" v={d.입사연도 ?? ''} ph="입사연도 선택"
                opts={Array.from({ length: 41 }, (_, i) => String(Number(todayKst().slice(0, 4)) - i))} 붙임="년"
                on={(v) => put({ 입사연도: v })} />
            </>
          )}

          <골라 label={있음 ? '입사 당시 학력' : '학력'} v={d.학력 ?? ''} opts={학력목록} ph={있음 ? '입사 당시 학력 선택' : '학력을 선택해 주세요'} on={(v) => put({ 학력: v })} />

          {/* 학교 — 피그마에는 없지만 세중님 11/15 「물치 작치 학과 전부 · 조금 적으면 추천」으로 넣은 칸 (고르면 학력도 맞춰 채움) */}
          {!있음 && !학교없음 && (
            <학교찾기칸 학교들={학교들} v={d.학교 ?? ''} on={(이름, x) => put({ 학교: 이름, ...(x?.학력 ? { 학력: x.학력 } : {}) })} />
          )}

          {!있음 && !학교없음 && (
            <>
              <div className="flex flex-col gap-(--rapo-dimension-x2)">
                <span className="rapo-type-t4-medium text-(color:--rapo-color-fg-neutral)">학적</span>
                <div className="grid grid-cols-2 gap-(--rapo-dimension-x4)">
                  {(['재학', '졸업'] as const).map((x) => (
                    <Choice key={x} on={d.학적 === x} go={() => put({ 학적: x })} small>{x === '재학' ? '재학 중' : '졸업'}</Choice>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-(--rapo-dimension-x2)">
                <span className="rapo-type-t5-medium text-(color:--rapo-color-fg-neutral)">입학 연월</span>
                <여는칸 글={d.입학년 && d.입학월 ? `${d.입학년}년 ${d.입학월}월` : undefined} 빈글="선택해 주세요" 틀림={입학미래}
                  on={() => set연월열림(true)} aria="입학 연월 고르기" />
                <p className={'rapo-type-t3-regular break-keep ' + (입학미래 ? 'text-(color:--rapo-color-fg-critical)' : 'text-(color:--rapo-color-fg-neutral-muted)')}>
                  {입학미래 ? '입학 연월은 현재 또는 이전으로 선택해 주세요.'
                    : 졸업 ? (
                      <>
                        <span className="block">{d.학적 === '졸업' ? '졸업 연월' : '졸업 예정'} {연월말(졸업)} · 자동 계산</span>
                        <span className="block">{끝남 ? '무료 열람 기간 종료' : `${날말(끝날!)}까지 무료 열람`} · 변경은 운영자 문의</span>
                        <span className="block">{인증안내}</span>
                      </>
                    ) : <>선택한 학력과 입학 연월로 졸업 예정일을 계산해요.<br />수정이 필요하면 운영자에게 문의해 주세요.</>}
                </p>
              </div>
              {연월열림 && (
                <YearMonthSheet 년={d.입학년} 월={d.입학월} 연도들={연도목록} 닫기={() => set연월열림(false)}
                  on={(y, m) => { put({ 입학년: y, 입학월: m }); set연월열림(false); }} />
              )}
            </>
          )}

          {학점묶음}

          {/* 학교 경험 없음 — 1483:4796 은 회색 상자 없이 작은 글 (성인 인증 줄은 PASS 를 안 넣어 뺐습니다) */}
          {학교없음 && !있음 && (
            <p className="rapo-type-t3-regular -mt-(--rapo-dimension-x2) break-keep text-(color:--rapo-color-fg-neutral-muted)">졸업 기준 무료 열람 기간은 적용되지 않아요.</p>
          )}
          {있음 && (
            <p className="rapo-type-t4-regular break-keep rounded-(--rapo-radius-r3) bg-(--rapo-color-bg-neutral-weak) p-(--rapo-dimension-x4) text-(color:--rapo-color-fg-neutral-muted)">
              병원과 스펙 정보는 게시글이나 댓글에 표시되지 않아요.
            </p>
          )}
        </section>
      )}

      {/* ⑤ 자격·교육·실습·어학 — 1245:972 · 1051 · 1136 · 1218 · 1416 / 경험 있음 1245:1896 · 1985 · 2143 · 선택창 1299:4699 · 4876 · 4951 · 4994 · 1562:5693 */}
      {step === '스펙' && (
        <section className="mt-(--rapo-dimension-x6) flex flex-col gap-(--rapo-dimension-x5)">
          <PickGroupField 종류="자격증" 제목={있음 ? '입사 당시 자격증' : '자격증'} 없음글="자격증 없음" groups={CERTS} picked={certs} on={(v) => put({ certs: v })} />
          <PickGroupField 종류="교육" 제목={있음 ? '입사 당시 교육' : '교육 이수'} 없음글="이수 내역 없음" 직군={job ?? me?.job_group ?? '작업치료사'}
            groups={coursesFor(job ?? me?.job_group ?? '작업치료사')} picked={courses} on={(v) => put({ courses: v })} />
          <PracticeField 제목={있음 ? '입사 전 실습' : '실습 경험'} rows={rows} on={(v) => put({ rows: v, rowsNone: false })}
            없음={!!d.rowsNone} set없음={(b) => put(b ? { rowsNone: true, rows: [] } : { rowsNone: false })} />
          <LangField rows={langs} on={(v) => put({ langs: v })} />
        </section>
      )}

      {/* ⑥ 희망 취업 조건 — 1245:3784 · 3835 */}
      {step === '희망' && (
        <section className="mt-(--rapo-dimension-x5) flex flex-col gap-(--rapo-dimension-x5)">
          <골라 label="희망 기관 유형" v={d.희망유형 ?? ''} opts={희망유형} ph="기관 유형 선택" on={(v) => put({ 희망유형: v })} />
          <골라 label="희망 지역" v={d.희망지역 ?? ''} opts={희망지역} ph="희망 지역 선택" on={(v) => put({ 희망지역: v })} />
          <p className="rapo-type-t4-regular break-keep rounded-(--rapo-radius-r3) bg-(--rapo-color-bg-neutral-weak) p-(--rapo-dimension-x4) text-(color:--rapo-color-fg-neutral-muted)">
            {있음 ? '지금 근무하는 조건과 별개로, 앞으로 일하고 싶은 곳의 조건을 알려주세요.' : '희망 조건은 가입 후 내 정보에서 바꿀 수 있어요.'}
          </p>
        </section>
      )}

      {/* 관심 (학생·취준생) — 2026-11-15 세중님 「성인, 소아 중 더 관심 있는 분야 · 듣고 싶은 교육의 종류 · 관심 있는 분야 — 물리·작업 학생에 맞게 예시」 (피그마에 없는 화면) */}
      {step === '관심' && (
        <section className="mt-(--rapo-dimension-x6) flex flex-col gap-(--rapo-dimension-x6)">
          <div className="flex flex-col gap-(--rapo-dimension-x2)">
            <span className="rapo-type-t5-bold text-(color:--rapo-color-fg-neutral)">성인, 소아 중 더 관심 있는 분야는?</span>
            <div className="grid grid-cols-3 gap-(--rapo-dimension-x2)">
              {관심대상들.map((x) => <Choice key={x} on={d.관심대상 === x} go={() => put({ 관심대상: x })} small>{x}</Choice>)}
            </div>
          </div>
          <고른칩 제목="관심 있는 분야는?" 덧="여러 개 골라도 돼요" 예시={예시고르기(관심분야예시, job ?? me?.job_group)} 고름={d.관심분야 ?? []} on={(v) => put({ 관심분야: v })} 없음="아직 없어요" />
          <고른칩 제목="듣고 싶은 교육의 종류는?" 덧="여러 개 골라도 돼요" 예시={예시고르기(듣고싶은교육예시, job ?? me?.job_group)} 고름={d.듣고싶은교육 ?? []} on={(v) => put({ 듣고싶은교육: v })} />
        </section>
      )}

      {/* ⑦ 급여 (경험 있음만 · 선택) — 1245:3886 「U05-05 급여 선택」 */}
      {step === '급여' && !급여입력 && (
        <section className="mt-(--rapo-dimension-x5) flex flex-col gap-(--rapo-dimension-x5)">
          <div className="flex flex-col gap-(--rapo-dimension-x4) rounded-(--rapo-radius-r4) bg-(--rapo-color-bg-navy-solid) p-(--rapo-dimension-x6)">
            <p className="rapo-type-t5-medium text-(color:--rapo-color-fg-on-navy-solid)">비슷한 조건에서 내 위치</p>
            <p className="rapo-type-t13-bold whitespace-nowrap text-(color:--rapo-color-fg-on-navy-solid)">상위 23%</p>
            <div aria-hidden className="flex h-[65px] items-end gap-[6px]">
              {[20, 37, 52, 62, 65, 62, 52, 37, 20].map((h, k) => (
                <span key={k} style={{ height: `${h}px` }}
                  className={'flex-1 rounded-(--rapo-radius-r1) ' + (k === 6 ? 'bg-(--rapo-color-bg-brand-solid)' : 'bg-(--rapo-color-fg-on-navy-solid) opacity-30')} />
              ))}
            </div>
            <p className="rapo-type-t2-regular text-(color:--rapo-color-fg-on-navy-solid) opacity-70">같은 조건 47명 기준 / 가상 예시</p>
          </div>
          <p className="rapo-type-t8-bold text-(color:--rapo-color-fg-neutral)">근무 조건이 달라지면?</p>
          <p className="rapo-type-t4-regular break-keep rounded-(--rapo-radius-r3) bg-(--rapo-color-bg-neutral-weak) p-(--rapo-dimension-x4) text-(color:--rapo-color-fg-neutral-muted)">
            지역과 기관 유형에 따른 급여 차이도 비교할 수 있어요. 실제 이직 시 받을 급여를 뜻하지 않아요.
          </p>
          {/* 「1분 안에 내 연봉 불러오기」 — 피그마에 있지만 자동 조회 기능이 아직 없어 잠가 둡니다 (2026-11-16) */}
          <div className="flex flex-col gap-(--rapo-dimension-x2)">
            <RapoButton full disabled onClick={() => {}}>1분 안에 내 연봉 불러오기</RapoButton>
            <p className="rapo-type-t3-regular text-center text-(color:--rapo-color-fg-neutral-muted)">자동으로 불러오기는 준비 중이에요.</p>
          </div>
          {/* 연봉 비교 알림(베타 기능 · 피그마에 없음) — 남색 단추가 둘 서지 않게 회색 줄로 둡니다 */}
          {비교알림켜짐 && (
            <button type="button" onClick={() => setCompareOpen(true)}
              className="flex items-center gap-(--rapo-dimension-x3) rounded-(--rapo-radius-r3) bg-(--rapo-color-bg-neutral-weak) p-(--rapo-dimension-x4) text-left active:bg-(--rapo-color-bg-neutral-weak-pressed)">
              <span className="rapo-type-t5-medium min-w-0 flex-1 break-keep text-(color:--rapo-color-fg-neutral)">연봉 비교 알림 받기</span>
              <span aria-hidden className="rapo-type-t7-regular shrink-0 text-(color:--rapo-color-fg-neutral)">›</span>
            </button>
          )}
          <button type="button" onClick={() => set급여입력(true)}
            className="flex items-center gap-(--rapo-dimension-x3) rounded-(--rapo-radius-r3) bg-(--rapo-color-bg-neutral-weak) p-(--rapo-dimension-x4) text-left active:bg-(--rapo-color-bg-neutral-weak-pressed)">
            <span className="rapo-type-t5-medium min-w-0 flex-1 break-keep text-(color:--rapo-color-fg-neutral)">자동 조회가 어렵다면 직접 입력</span>
            <span aria-hidden className="rapo-type-t7-regular shrink-0 text-(color:--rapo-color-fg-neutral)">›</span>
          </button>
          <button type="button" onClick={스펙저장} disabled={busy}
            className="rapo-type-t4-bold self-start py-(--rapo-dimension-x1) text-(color:--rapo-color-fg-neutral) disabled:opacity-40">
            나중에 입력하고 가입 완료
          </button>
          <p className="rapo-type-t4-regular -mt-(--rapo-dimension-x3) break-keep text-(color:--rapo-color-fg-neutral-muted)">
            급여는 선택 항목이에요. 나중에 내 정보 → 스펙 확인·수정에서 입력할 수 있어요.
          </p>
        </section>
      )}
      {step === '급여' && 급여입력 && (
        <div className="mt-(--rapo-dimension-x6)">
          <SignupSurvey userId={session.user.id} job={job ?? me?.job_group ?? '작업치료사'} role="현직"
            급여만={{ spec, langs, 입사연도: Number(d.입사연도) }}
            onDone={async () => { try { localStorage.removeItem(초안열쇠(session.user.id)); } catch { /* 없어도 그만 */ } await 가입끝(); }} />
        </div>
      )}

      {/* 완료 — 1245:4005 (경험 있음) · 4053 · 4075 / 학생 무료 이용 1495:5010 · 공개 범위 1495:5033 */}
      {step === '끝' && (
        <section className="flex flex-col gap-(--rapo-dimension-x5)">
          <h1 className="rapo-type-t11-bold text-(color:--rapo-color-fg-neutral)">가입이 완료됐어요</h1>
          <span aria-hidden className="flex size-[96px] items-center justify-center rounded-(--rapo-radius-full) bg-(--rapo-color-bg-brand-weak)">
            <svg width="44" height="34" viewBox="0 0 44 34" fill="none"><path d="M3 17l13 13L41 4" stroke="var(--rapo-color-bg-brand-solid)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
          {있음 ? (
            <>
              <p className="rapo-type-t9-bold break-keep text-(color:--rapo-color-fg-neutral)">근무 정보를 등록했어요</p>
              <p className="rapo-type-t4-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">급여는 나중에 입력해도 괜찮아요. 이제 비교 정보와 커뮤니티를 이용할 수 있어요.</p>
            </>
          ) : (
            /* 학생·취준생 (2026-11-15 세중님) — 무료 열람 끝날 · 「1년 안 취업 인증」 안내 · 「우리들의 이야기」 · 추천 메뉴 셋 */
            <>
              {끝날 && !끝남 ? (
                <p className="rapo-type-t9-bold break-keep text-(color:--rapo-color-fg-neutral)">{날말(끝날)}까지<br />무료로 이용해요</p>
              ) : 학교없음 ? (
                <p className="rapo-type-t4-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">졸업 기준 무료 열람 기간이 적용되지 않아요.</p>
              ) : null}
              {끝날 && (
                <p className="rapo-type-t4-regular break-keep rounded-(--rapo-radius-r3) bg-(--rapo-color-bg-neutral-weak) p-(--rapo-dimension-x4) text-(color:--rapo-color-fg-neutral)">
                  {인증안내}
                </p>
              )}
              <p className="rapo-type-t6-bold break-keep text-(color:--rapo-color-fg-neutral)">이제부터 우리들의 이야기를 라포에서 자유롭게 나눠주세요!</p>
              <div className="flex flex-col gap-(--rapo-dimension-x2)">
                <p className="rapo-type-t3-bold text-(color:--rapo-color-fg-neutral-muted)">추천 메뉴</p>
                {추천메뉴.map((m) => (
                  <Link key={m.href} href={m.href} className="flex items-center gap-(--rapo-dimension-x3) rounded-(--rapo-radius-r3) bg-(--rapo-color-bg-neutral-weak) p-(--rapo-dimension-x4) active:bg-(--rapo-color-bg-neutral-weak-pressed)">
                    <span className="rapo-type-t5-medium min-w-0 flex-1 break-keep text-(color:--rapo-color-fg-neutral)">{m.이름}</span>
                    <span aria-hidden className="rapo-type-t8-regular text-(color:--rapo-color-fg-neutral)">›</span>
                  </Link>
                ))}
              </div>
              {학교없음 && <Link href="/contact" className="rapo-type-t4-bold self-start text-(color:--rapo-color-fg-neutral)">아직 임상 경험이 없어요 / 문의 ›</Link>}
            </>
          )}
        </section>
      )}

      {비교알림켜짐 && compareOpen && (
        <CompareNotify userId={session.user.id} job={job ?? (me?.job_group as JobGroup | undefined) ?? null}
          email={session.user.email ?? null} onDone={() => setCompareOpen(false)} />
      )}
    </>
  ), 아래단추);
}

const 칸 = 'rapo-type-t5-regular h-(--rapo-dimension-x13) w-full min-w-0 rounded-(--rapo-radius-r3) border-(length:--rapo-border-default) '
  + 'border-(color:--rapo-color-stroke-neutral-weak) bg-(--rapo-color-bg-layer-default) px-(--rapo-dimension-x4) text-(color:--rapo-color-fg-neutral) '
  + 'placeholder:text-(color:--rapo-color-fg-placeholder)';

/* 고르는 칸 — 피그마 「RAPO / Select Field」 (높이 52 · ⌄ 20). 폰에서는 기본 고르기 창이 떠서 그대로 씁니다 */
function 골라({ label, v, opts, ph, on, aria, 붙임 = '', 작은이름 = false }: {
  label?: string; v: string; opts: readonly string[]; ph: string; on: (v: string) => void; aria?: string; 붙임?: string; 작은이름?: boolean;
}) {
  const sel = (
    <span className="relative block">
      <select value={v} onChange={(e) => on(e.target.value)} aria-label={aria ?? label}
        className={칸 + ' appearance-none pr-(--rapo-dimension-x10) ' + (v ? '' : 'text-(color:--rapo-color-fg-placeholder)')}>
        <option value="" disabled>{ph}</option>
        {opts.map((o) => <option key={o} value={o}>{o}{붙임}</option>)}
      </select>
      <span className="pointer-events-none absolute right-(--rapo-dimension-x4) top-1/2 -translate-y-1/2"><꺾쇠 /></span>
    </span>
  );
  if (!label) return sel;
  return (
    <label className="flex min-w-0 flex-col gap-(--rapo-dimension-x2)">
      <span className={(작은이름 ? 'rapo-type-t4-medium' : 'rapo-type-t5-medium') + ' text-(color:--rapo-color-fg-neutral)'}>{label}</span>
      {sel}
    </label>
  );
}

/* 고르는 카드 — 피그마 「경험 선택 카드」(1211:25984 · 큰 것: 고르면 산호 테+연분홍, 안 고르면 진한 회색 테)
   · 「학적」(1241:1622 · 작은 것: 고르면 산호 테+연분홍, 안 고르면 회색 바탕 테 없음) */
function Choice({ on, go, sub, small = false, children }: { on: boolean; go: () => void; sub?: string; small?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" onClick={go} aria-pressed={on}
      className={'flex items-center gap-(--rapo-dimension-x3) border-(length:--rapo-border-default) text-left '
        + (small ? 'h-(--rapo-dimension-x13) rounded-(--rapo-radius-r3) px-(--rapo-dimension-x4) ' : 'rounded-(--rapo-radius-r3) px-(--rapo-dimension-x5) py-(--rapo-dimension-x5) ')
        + (on ? 'border-(color:--rapo-color-stroke-brand-solid) bg-(--rapo-color-bg-brand-weak)'
          : small ? 'border-transparent bg-(--rapo-color-bg-neutral-weak) active:bg-(--rapo-color-bg-neutral-weak-pressed)'
          /* 피그마 border-default #6a7b87 — 우리 토큰에 같은 이름이 없어 가장 가까운 navy-700(#728394) */
          : 'border-(color:--rapo-color-palette-navy-700) active:bg-(--rapo-color-bg-transparent-pressed)')}>
      {small && <Dot on={on} />}
      <span className="min-w-0 flex-1">
        <span className={(small ? 'rapo-type-t4-medium' : 'rapo-type-t6-bold') + ' block break-keep text-(color:--rapo-color-fg-neutral)'}>{children}</span>
        {sub && <span className="rapo-type-t4-regular mt-(--rapo-dimension-x1_5) block break-keep text-(color:--rapo-color-fg-neutral-muted)">{sub}</span>}
      </span>
      {!small && <Dot on={on} />}
    </button>
  );
}
function Dot({ on }: { on: boolean }) {
  return (
    <span aria-hidden className={'flex size-[20px] shrink-0 items-center justify-center rounded-(--rapo-radius-full) border-(length:--rapo-border-default) '
      + (on ? 'border-(color:--rapo-color-bg-navy-solid) bg-(--rapo-color-bg-navy-solid)' : 'border-(color:--rapo-color-stroke-neutral-weak) bg-(--rapo-color-bg-layer-default)')}>
      {on && <span className="size-[8px] rounded-(--rapo-radius-full) bg-(--rapo-color-bg-layer-default)" />}
    </span>
  );
}

/* 동의 한 줄 — 1211:25848 「체크 · 이름 / 필수(회색 작은 글) · 오른쪽 ›」 · 줄 사이 가는 선(마지막 줄 아래는 없음) */
function 동의행({ a, on, set, 끝 }: {
  a: { key: string; label: string; required: boolean; doc?: string; lines?: string[] };
  on: boolean; set: (v: boolean) => void; 끝: boolean;
}) {
  return (
    <li className={끝 ? '' : 'border-b border-(--rapo-color-stroke-neutral-weak)'}>
      <div className="flex items-center gap-(--rapo-dimension-x2)">
        <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-(--rapo-dimension-x4) py-(--rapo-dimension-x3)">
          <input type="checkbox" className="sr-only" checked={on} onChange={(e) => set(e.target.checked)} />
          <체크마크 on={on} />
          <span className="min-w-0">
            <span className="rapo-type-t5-medium block break-keep text-(color:--rapo-color-fg-neutral)">{a.label}</span>
            <span className="rapo-type-t3-regular block text-(color:--rapo-color-fg-neutral-muted)">{a.required ? '필수' : '선택'}</span>
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
        <ul className="rapo-type-t3-regular mb-(--rapo-dimension-x2) ml-[36px] flex flex-col gap-(--rapo-dimension-x1) text-(color:--rapo-color-fg-neutral-muted)">
          {a.lines.map((l) => <li key={l} className="break-keep">{l}</li>)}
        </ul>
      )}
    </li>
  );
}

/* 여러 개 고르는 칩 + 직접 추가 (관심 분야 · 듣고 싶은 교육) */
/* 없음 — 고르면 혼자 남고, 다른 것을 고르면 빠지는 칩 (관심 분야 「아직 없어요」 · 2026-11-15 세중님) */
function 고른칩({ 제목, 덧, 예시, 고름, on, 없음 }: { 제목: string; 덧?: string; 예시: readonly string[]; 고름: string[]; on: (v: string[]) => void; 없음?: string }) {
  const [글, set글] = useState('');
  const 모두 = [...(없음 ? [없음] : []), ...예시, ...고름.filter((x) => !예시.includes(x) && x !== 없음)];
  const 토글 = (x: string) => {
    if (고름.includes(x)) { on(고름.filter((y) => y !== x)); return; }
    on(x === 없음 ? [x] : [...고름.filter((y) => y !== 없음), x]);
  };
  const 더하기 = () => { const t = 글.trim().slice(0, 20); set글(''); if (t && !고름.includes(t)) on([...고름.filter((y) => y !== 없음), t]); };
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
