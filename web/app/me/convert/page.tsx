'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/app/auth';
import { Chips, Langs, Rows } from '@/components/signup-survey';
import { RapoButton } from '@/components/rapo/rapo-ui';
import { RapoFormFrame as Frame, 골라, 만점읽기, 칸, 학년별담기, 학년별읽기, 학년수구하기, 학점칸, 학점들틀렸나 } from '@/components/rapo/rapo-spec-form';
import { 둥근별 } from '@/components/rapo/rapo-org-reviews';
import { 기타글, 기타글최대, 기타머리, 기타인가, 답다됨, 후기질문, type 후기답 } from '@/lib/work-review';
import { todayKst } from '@/lib/job-state';
import { 학력목록 } from '@/lib/school-period';
import { CERTS, NONE, coursesFor, langError, langsPayload, rowsReady, rowsToSave, toDraft, type LangRow, type WorkRow } from '@/lib/signup-fields';
import { browserSupabase } from '@/lib/supabase-browser';

/* 임상가 전환 — 학생·취준생이 취업한 뒤 (2026-11-15 세중님 「졸업 후 취준생에서 임상가 전환 할 때 병원 후기 필수 ·
   학점·자격증·어학·교육 이수 내용 등 현재에 맞게」 · 「재직 인증 없이 하고 추후에 한 번에 쭉 인증 넣을 거야」).

   ① 근무 병원·입사연도·입사 당시 학력·학점 → ② 입사 당시 자격·교육·실습·어학(가입 때 적은 것을 채워 둠) → ③ 근무 후기(필수) → 끝
   저장은 save_my_survey 한 번 — 학생이 처음 근무 경험을 담는 저장은 「1년 2번 고치기」를 깎지 않고 역할을 현직으로 바꿉니다(금고 SQL_1113/ZT).
   ★ save_my_survey 는 기본 칸(학력·학점·자격…희망)을 보낸 값으로 덮습니다 — 그래서 희망 조건도 옛 값을 그대로 실어 보냅니다.
   후기는 그다음 근무후기 표에 — DB 규칙이 「재직 인증(확인) 또는 내가 적은 근무 병원」만 받습니다. 인증 딱지는 인증된 후기에만 붙습니다. */

type 단계 = '병원' | '스펙' | '후기' | '끝';
const 순서: 단계[] = ['병원', '스펙', '후기'];
const 단계이름: Record<단계, string> = { 병원: '근무 병원', 스펙: '입사 당시 스펙', 후기: '근무 후기', 끝: '' };
const 최대 = 5000;

type 옛스펙 = Record<string, unknown> & { want_type?: string | null; want_region?: string | null; 근무경험?: boolean | null; 근무병원?: string | null };

export default function Convert() {
  const router = useRouter();
  const { loading, session, me, reload } = useAuth();
  const [step, setStep] = useState<단계>('병원');
  const [옛, set옛] = useState<옛스펙 | null | undefined>(undefined);
  const [병원, set병원] = useState('');
  const [직접입력, set직접입력] = useState(false);
  const [병원후보, set병원후보] = useState<{ name: string; 곳: string }[]>([]);
  const [입사연도, set입사연도] = useState('');
  const [학력, set학력] = useState('');
  const [학점, set학점] = useState('');
  const [만점값, set만점값] = useState('4.5');
  const [학년별, set학년별] = useState<string[]>([]);
  const [certs, setCerts] = useState<string[]>([]);
  const [courses, setCourses] = useState<string[]>([]);
  const [rows, setRows] = useState<WorkRow[]>([]);
  const [rowsNone, setRowsNone] = useState(false);
  const [langs, setLangs] = useState<LangRow[]>([]);
  const [별점, set별점] = useState(0);
  const [답, set답] = useState<후기답>({});
  const [글, set글] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  /* 전환 저장은 됐는데 후기만 못 담은 경우 — 다시 누르면 후기만 담습니다 */
  const [전환됨, set전환됨] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!session) { router.replace('/login?next=/me/convert'); return; }
    if (!me) return;
    (async () => {
      const sb = browserSupabase();
      const [spec, ls] = await Promise.all([
        sb.from('student_specs').select('*').maybeSingle(),
        sb.from('spec_langs').select('exam,score,level'),
      ]);
      const s = (spec.data as 옛스펙 | null) ?? null;
      set옛(s);
      const d = toDraft(null, s, (ls.data ?? []) as Record<string, unknown>[]);
      set학력(d.f.school_type ?? '');
      set학점(d.f.gpa ?? ''); set만점값(만점읽기(d.f.gpa_scale)); set학년별(학년별읽기(s?.학년별학점));
      setCerts(d.certs); setCourses(d.courses); setRows(d.rows); setRowsNone(d.f.rows_none === 'Y'); setLangs(d.langs);
    })();
  }, [loading, session, me, router]);

  /* 병원 찾기 — 가입 화면과 같은 org_search · 이름만 담습니다 */
  useEffect(() => {
    const q = 병원.trim();
    if (step !== '병원' || 직접입력 || q.length < 2) { set병원후보([]); return; }
    const t = setTimeout(async () => {
      const { data } = await browserSupabase().rpc('org_search', {
        p_q: q, p_tile: null, p_sido: null, p_sgg: null, p_sort: null, p_limit: 5, p_offset: 0,
      });
      const rs = (data ?? []) as { name: string; sido_std: string | null; sgg_std: string | null }[];
      set병원후보(rs.filter((r) => r.name !== q).map((r) => ({ name: r.name, 곳: [r.sido_std, r.sgg_std].filter(Boolean).join(' ') })));
    }, 250);
    return () => clearTimeout(t);
  }, [병원, step, 직접입력]);

  const go = (s: 단계) => { setStep(s); setErr(null); window.scrollTo(0, 0); };

  if (loading || !me || 옛 === undefined) {
    return <Frame title="임상가 전환" onBack={() => router.back()}><p role="status" className="rapo-type-t4-regular pt-(--rapo-dimension-x6) text-(color:--rapo-color-fg-neutral-muted)">잠시만요…</p></Frame>;
  }

  /* 이미 임상가 — 전환할 것이 없습니다 */
  if (me.role !== '학생' && step !== '끝') {
    return (
      <Frame title="임상가 전환" onBack={() => router.back()}>
        <section className="flex flex-col gap-(--rapo-dimension-x4) pt-(--rapo-dimension-x6)">
          <p className="rapo-type-t9-bold break-keep text-(color:--rapo-color-fg-neutral)">이미 임상가 회원이에요</p>
          <p className="rapo-type-t4-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">근무 정보와 스펙은 내 정보 → 스펙 확인·수정에서 바꿀 수 있어요.</p>
          <Link href="/me/spec" className="rapo-type-t4-bold self-start text-(color:--rapo-color-fg-neutral)">스펙 확인·수정 ›</Link>
          {옛?.근무병원 && (
            <Link href={`/orgs/review/write?org=${encodeURIComponent(옛.근무병원)}`} className="rapo-type-t4-bold self-start text-(color:--rapo-color-fg-neutral)">{옛.근무병원} 근무 후기 쓰기 ›</Link>
          )}
        </section>
      </Frame>
    );
  }

  const job = me.job_group ?? '작업치료사';
  const 학교없음 = 학력 === '학교 경험 없음';
  const 학점수 = Number(학점);
  const 학년수 = 학년수구하기(학력);
  const 학점틀림 = !학교없음 && 학점들틀렸나(학점, 학년별, 학년수, 만점값);
  const 학년별값 = 학교없음 ? null : 학년별담기(학년별, 학년수);
  const 학점있음 = !학교없음 && (!!학점.trim() || !!학년별값);
  const 병원됨 = !!병원.trim() && !!입사연도 && !!학력 && !학점틀림;
  const 스펙됨 = certs.length > 0 && courses.length > 0 && (rowsNone || rowsReady(rows)) && langs.every((r) => !langError(r));
  const 후기됨 = 별점 > 0 && 답다됨(답);

  const 실습 = rowsNone ? [] : rowsToSave(rows);
  const spec: Record<string, unknown> = {
    school_type: 학력 || null,
    grade: null,
    gpa: 학교없음 || !학점.trim() ? null : 학점수,
    gpa_scale: 학점있음 ? Number(만점값) : null, 학년별학점: 학년별값,
    licenses: certs.filter((x) => x !== NONE), trainings: courses.filter((x) => x !== NONE),
    practice: 실습, practice_months: 실습.reduce((s, r) => s + (Number(r.months) || 0), 0),
    career: null, career_months: null,
    want_type: 옛?.want_type ?? null, want_region: 옛?.want_region ?? null,
    근무경험: true,
    근무병원: 병원.trim(),
    근무기관번호: null,
    입사연도: Number(입사연도),
  };

  const 저장 = async () => {
    if (!후기됨 || busy) return;
    setBusy(true); setErr(null);
    const sb = browserSupabase();
    if (!전환됨) {
      const { error } = await sb.rpc('save_my_survey', { p_salary: null, p_spec: spec, p_langs: langsPayload(langs) });
      if (error) { setBusy(false); setErr(`저장하지 못했어요. 입력한 내용은 그대로예요 — ${error.message}`); return; }
      set전환됨(true);
    }
    const { error } = await sb.from('근무후기').insert({ 기관: 병원.trim(), 별점, ...답, 글: 글.trim() || null });
    setBusy(false);
    if (error) {
      setErr(error.code === '23505' ? '이 병원에는 이미 후기를 쓰셨어요.' : `근무 정보는 저장했지만 후기를 담지 못했어요. 다시 눌러 주세요 — ${error.message}`);
      if (error.code !== '23505') return;
    }
    go('끝');
    await reload();
  };

  const n = 순서.indexOf(step) + 1;
  const 뒤로 = () => { const i = 순서.indexOf(step); if (i > 0) go(순서[i - 1]); else router.back(); };
  const 아래단추 =
    step === '병원' ? <RapoButton onClick={() => go('스펙')} disabled={!병원됨} full>{병원됨 ? '다음' : '위 칸을 채워 주세요'}</RapoButton>
    : step === '스펙' ? <RapoButton onClick={() => go('후기')} disabled={!스펙됨} full>{스펙됨 ? '다음' : '위 칸을 채워 주세요'}</RapoButton>
    : step === '후기' ? <RapoButton onClick={저장} disabled={!후기됨 || busy} full>{busy ? '저장하는 중…' : 후기됨 ? '임상가로 전환하기' : '별점과 일곱 가지를 골라 주세요'}</RapoButton>
    : <RapoButton onClick={() => router.push(`/orgs?org=${encodeURIComponent(병원.trim())}&tab=review`)} full>내 후기 보러 가기</RapoButton>;

  return (
    <Frame title="임상가 전환" onBack={step === '끝' ? undefined : 뒤로} 아래={아래단추}>
      {step !== '끝' && (
        <div className="pt-(--rapo-dimension-x4)" role="group" aria-label={`전환 순서 ${n} / ${순서.length} · ${단계이름[step]}`}>
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

      {step === '병원' && (
        <>
          <h1 className="rapo-type-t11-bold mt-(--rapo-dimension-x6) break-keep text-(color:--rapo-color-fg-neutral)">취업을 축하해요!<br />근무 병원을 알려주세요</h1>
          <p className="rapo-type-t4-regular mt-(--rapo-dimension-x2) break-keep text-(color:--rapo-color-fg-neutral-muted)">지금 일하는 병원 한 곳을 기준으로 입력해 주세요.</p>
          <section className="mt-(--rapo-dimension-x6) flex flex-col gap-(--rapo-dimension-x5)">
            <div className="flex flex-col gap-(--rapo-dimension-x2)">
              <span className="rapo-type-t5-bold text-(color:--rapo-color-fg-neutral)">병원</span>
              <input value={병원} onChange={(e) => set병원(e.target.value)} placeholder={직접입력 ? '병원 이름을 적어 주세요' : '병원 이름으로 찾기'} aria-label="병원" className={칸} />
              {병원후보.length > 0 && (
                <ul className="flex flex-col overflow-hidden rounded-(--rapo-radius-r3) border-(length:--rapo-border-default) border-(color:--rapo-color-stroke-neutral-weak)">
                  {병원후보.map((h) => (
                    <li key={h.name + h.곳}>
                      <button type="button" onClick={() => { set병원(h.name); set병원후보([]); }}
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
            <골라 label="입사연도" v={입사연도} ph="입사연도를 선택해 주세요" 붙임="년"
              opts={Array.from({ length: 11 }, (_, i) => String(Number(todayKst().slice(0, 4)) - i))} on={set입사연도} />
            <골라 label="입사 당시 학력" v={학력} opts={학력목록} ph="학력을 선택해 주세요" on={set학력} />
            {!학교없음 && <학점칸 label="입사 당시 학점" v={학점} on={set학점} 만점값={만점값} on만점={set만점값} 학년수={학년수} 학년별={학년별} on학년별={set학년별} 도움="졸업 학점으로 바꿔 주세요." />}
            <p className="rapo-type-t4-regular break-keep rounded-(--rapo-radius-r2) bg-(--rapo-color-bg-neutral-weak) p-(--rapo-dimension-x4) text-(color:--rapo-color-fg-neutral-muted)">
              병원과 스펙 정보는 게시글이나 댓글에 표시되지 않아요.
            </p>
          </section>
        </>
      )}

      {step === '스펙' && (
        <>
          <h1 className="rapo-type-t11-bold mt-(--rapo-dimension-x6) break-keep text-(color:--rapo-color-fg-neutral)">입사 당시 자격과<br />교육·실습을 알려주세요</h1>
          <p className="rapo-type-t4-regular mt-(--rapo-dimension-x2) break-keep text-(color:--rapo-color-fg-neutral-muted)">가입 때 적은 내용을 채워 두었어요. 그 뒤로 새로 딴 자격·교육·어학이 있으면 더해 주세요.</p>
          <section className="mt-(--rapo-dimension-x6) flex flex-col">
            <Chips label="자격증" none="보유 자격증 없음" groups={CERTS} picked={certs} on={setCerts} />
            <Chips label="교육 이수" none="이수 교육 없음" groups={coursesFor(job)} picked={courses} on={setCourses}
              hint="기관만 선택하지 않고, 이수한 과정까지 선택해요." />
            <h2 className="rapo-type-t5-bold mt-(--rapo-dimension-x8) text-(color:--rapo-color-fg-neutral)">입사 전 실습 경험</h2>
            <p className="rapo-type-t3-regular mt-(--rapo-dimension-x1) break-keep text-(color:--rapo-color-fg-neutral-muted)">기관 유형과 지역, 실습 기간을 알려주세요. 최대 5개까지 추가할 수 있어요.</p>
            <Rows rows={rows} none="실습 없음" noneOn={rowsNone} setNone={(b) => { setRowsNone(b); if (b) setRows([]); }} on={setRows} />
            <h2 className="rapo-type-t5-bold mt-(--rapo-dimension-x8) text-(color:--rapo-color-fg-neutral)">어학 <span className="rapo-type-t3-regular text-(color:--rapo-color-fg-neutral-muted)">(선택)</span></h2>
            <Langs rows={langs} on={setLangs} />
          </section>
        </>
      )}

      {step === '후기' && (
        <>
          <h1 className="rapo-type-t11-bold mt-(--rapo-dimension-x6) break-keep text-(color:--rapo-color-fg-neutral)">{병원.trim()},<br />일해 보니 어때요?</h1>
          <p className="rapo-type-t4-regular mt-(--rapo-dimension-x2) break-keep text-(color:--rapo-color-fg-neutral-muted)">임상가로 바꾸려면 근무 후기를 남겨 주세요. 별점·객관식은 필수, 글은 선택이에요. 후기에는 닉네임이 보여요.</p>
          <section className="mt-(--rapo-dimension-x6) flex flex-col gap-(--rapo-dimension-x5)">
            <div className="flex flex-col gap-(--rapo-dimension-x2)">
              <span className="rapo-type-t5-bold text-(color:--rapo-color-fg-neutral)">종합 별점</span>
              <div className="flex gap-(--rapo-dimension-x3)" role="radiogroup" aria-label="종합 별점">
                {[1, 2, 3, 4, 5].map((k) => (
                  <button key={k} type="button" role="radio" aria-checked={별점 === k} aria-label={`${k}점`} onClick={() => set별점(k)}
                    className="flex size-(--rapo-touch-min) items-center justify-center">
                    <둥근별 켬={k <= 별점} 크기={32} 색="var(--rapo-color-bg-identity)" />
                  </button>
                ))}
              </div>
            </div>
            {후기질문.map((q) => <셋 key={q.칸} 제목={q.질문} 값들={q.값들} 지금={답[q.칸] ?? ''} on={(v) => set답((a) => ({ ...a, [q.칸]: v }))} />)}
            <label className="flex flex-col gap-(--rapo-dimension-x2)">
              <span className="rapo-type-t5-bold text-(color:--rapo-color-fg-neutral)">자유 후기 <span className="rapo-type-t3-regular text-(color:--rapo-color-fg-neutral-muted)">(선택)</span></span>
              <textarea value={글} onChange={(e) => set글(e.target.value.slice(0, 최대))} rows={5}
                placeholder="함께 일할 동료에게 들려주고 싶은 경험을 적어 주세요."
                className="rapo-type-t5-regular w-full rounded-(--rapo-radius-r3) border-(length:--rapo-border-default) border-(color:--rapo-color-stroke-neutral-weak) p-(--rapo-dimension-x4) text-(color:--rapo-color-fg-neutral) placeholder:text-(color:--rapo-color-fg-placeholder)" />
              <span className="rapo-type-t3-regular text-(color:--rapo-color-fg-neutral-muted)">{글.length.toLocaleString('ko-KR')} / {최대.toLocaleString('ko-KR')}</span>
            </label>
            {err && <p role="alert" className="rapo-type-t4-medium break-keep text-(color:--rapo-color-fg-critical)">{err}</p>}
          </section>
        </>
      )}

      {step === '끝' && (
        <section className="flex flex-col gap-(--rapo-dimension-x5) pt-(--rapo-dimension-x6)">
          <span aria-hidden className="flex size-[96px] items-center justify-center rounded-(--rapo-radius-full) bg-(--rapo-color-bg-brand-weak)">
            <svg width="44" height="34" viewBox="0 0 44 34" fill="none"><path d="M3 17l13 13L41 4" stroke="var(--rapo-color-bg-identity)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
          <p className="rapo-type-t9-bold break-keep text-(color:--rapo-color-fg-neutral)">임상가 회원이 됐어요</p>
          <p className="rapo-type-t4-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">근무 정보와 후기를 등록했어요. 급여는 내 정보 → 스펙 확인·수정에서 언제든 입력할 수 있어요.</p>
          {err && <p className="rapo-type-t4-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">{err}</p>}
          <Link href="/me" className="rapo-type-t4-bold self-start text-(color:--rapo-color-fg-neutral)">내 정보로 ›</Link>
        </section>
      )}
    </Frame>
  );
}

/* 후기 객관식 한 묶음 — 값은 lib/work-review.ts (후기 쓰기와 같은 자리) */
function 셋({ 제목, 값들, 지금, on }: { 제목: string; 값들: readonly string[]; 지금: string; on: (v: string) => void }) {
  return (
    <fieldset className="flex flex-col gap-(--rapo-dimension-x2)">
      <legend className="rapo-type-t5-bold mb-(--rapo-dimension-x2) text-(color:--rapo-color-fg-neutral)">{제목}</legend>
      <div className="flex flex-col gap-(--rapo-dimension-x2)">
        {값들.map((x) => {
          /* 「기타」는 값이 「기타: 적은 글」이라 따로 가립니다 (lib/work-review.ts) */
          const 켬 = x === '기타' ? 기타인가(지금) : 지금 === x;
          return (
            <button key={x} type="button" aria-pressed={켬} onClick={() => on(x === '기타' ? 기타머리 + 기타글(지금) : x)}
              className={'rapo-type-t5-medium min-h-(--rapo-touch-min) break-keep rounded-(--rapo-radius-r3) border-(length:--rapo-border-default) px-(--rapo-dimension-x4) py-(--rapo-dimension-x3) text-left '
                + (켬 ? 'border-(color:--rapo-color-fg-brand-contrast) bg-(--rapo-color-bg-brand-weak) text-(color:--rapo-color-fg-neutral)'
                     : 'border-(color:--rapo-color-stroke-neutral-weak) text-(color:--rapo-color-fg-neutral)')}>
              {x}
            </button>
          );
        })}
        {값들.includes('기타') && 기타인가(지금) && (
          /* 두 줄 칸 — 긴 답이 잘리지 않고 낱말 사이에서 줄을 바꿉니다 · 엔터는 띄어쓰기로 */
          <textarea rows={2} value={기타글(지금)} onChange={(e) => on(기타머리 + e.target.value.replace(/\s*\n\s*/g, ' ').slice(0, 기타글최대))}
            aria-label={`${제목} — 기타 직접 입력`} placeholder="직접 적어 주세요 (예: 격주로 토요일)" autoFocus
            className="rapo-type-t5-regular w-full resize-none break-keep py-(--rapo-dimension-x3) rounded-(--rapo-radius-r3) border-(length:--rapo-border-default) border-(color:--rapo-color-stroke-neutral-weak) bg-(--rapo-color-bg-layer-default) px-(--rapo-dimension-x4) text-(color:--rapo-color-fg-neutral) placeholder:text-(color:--rapo-color-fg-placeholder)" />
        )}
      </div>
    </fieldset>
  );
}
