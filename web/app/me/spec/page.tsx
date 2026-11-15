'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/app/auth';
import { useToast } from '@/app/toast';
import { Chips, Langs, Rows } from '@/components/signup-survey';
import { RapoButton } from '@/components/rapo/rapo-ui';
import { RapoFormFrame, RapoFormTitle, 골라, 기본칸, 남은횟수, 만점, 학점칸, 학점틀렸나, use내스펙 } from '@/components/rapo/rapo-spec-form';
import { 학력목록 } from '@/lib/school-period';
import { CERTS, NONE, coursesFor, langError, langsPayload, rowsReady, rowsToSave, type LangRow, type WorkRow } from '@/lib/signup-fields';
import { 학교목록, 학교부연 } from '@/lib/signup-school';
import { browserSupabase } from '@/lib/supabase-browser';

/* 스펙 확인·수정 — 피그마 「12 · 내 정보」 06 경험별 스펙 수정 (2026-11-15 세중님 「내정보 쪽이 예전 게 많은 거 같아 … 피그마 확인해서 수정」).
     경험 없음  현재 학력 1447:10074 → 현재 자격·교육·실습 1447:10114 → 저장 후 내 정보
     근무 경험자 입사 병원·연도·학력 1447:10308 → 입사 당시 자격·교육·실습 1447:10366 → 저장 후 내 정보
   피그마와 다른 것 — 학점은 4.5 만점 하나(세중님 11/15 「학점 4.5 만점」 · 피그마의 「만점 기준」 고르기 없음) ·
     근무 병원·입사 연도는 「경력 수정」(/me/career)에서 고치고 여기서는 보여 주기만 · 급여는 내 정보 「내 급여」 자리(오픈 전)로 옮겨
     전 화면(급여·스펙 설문 · components/survey-edit)은 여기서 빠졌습니다(새 디자인 적용 규칙 — 없는 옛 기능은 잠시 빠짐).
   저장은 save_my_survey 한 번 — 1년에 2번. 바꾸지 않는 기본 칸(희망 조건)은 옛 값 그대로 실어 보냅니다. */

type 단계 = '학력' | '스펙';

export default function MySpec() {
  const router = useRouter();
  const toast = useToast();
  const { loading, session, me, reload } = useAuth();
  const { v, err } = use내스펙();
  const [step, setStep] = useState<단계>('학력');
  const [학교, set학교] = useState('');
  const [학교직접, set학교직접] = useState(false);
  const [학력, set학력] = useState('');
  const [학점, set학점] = useState('');
  const [certs, setCerts] = useState<string[]>([]);
  const [courses, setCourses] = useState<string[]>([]);
  const [rows, setRows] = useState<WorkRow[]>([]);
  const [rowsNone, setRowsNone] = useState(false);
  const [langs, setLangs] = useState<LangRow[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!loading && !session) router.replace('/login?next=/me/spec'); }, [loading, session, router]);
  useEffect(() => {
    if (!v) return;
    const d = v.draft;
    set학교(v.spec?.학교 ?? ''); set학력(d.f.school_type ?? ''); set학점(d.f.gpa ?? '');
    setCerts(d.certs); setCourses(d.courses); setRows(d.rows); setRowsNone(d.f.rows_none === 'Y'); setLangs(d.langs);
  }, [v]);

  const 경력 = !!v?.spec?.근무경험;
  const job = me?.job_group ?? '작업치료사';
  const 학교들 = 학교목록(job);
  const 고른학교 = 학교들.find((x) => x.이름 === 학교) ?? null;
  const 학교없음 = 학력 === '학교 경험 없음';
  const 학점틀림 = !학교없음 && 학점틀렸나(학점);
  const 학력됨 = !!학력 && !학점틀림;
  const 스펙됨 = certs.length > 0 && courses.length > 0 && (rowsNone || rowsReady(rows)) && langs.every((r) => !langError(r));
  const 남은 = v?.남은 ?? 0;
  const go = (s: 단계) => { setStep(s); window.scrollTo(0, 0); };

  const 저장 = async () => {
    if (!v || !스펙됨 || busy || 남은 <= 0) return;
    setBusy(true);
    const 실습 = rowsNone ? [] : rowsToSave(rows);
    const spec: Record<string, unknown> = {
      ...기본칸(v.spec),
      school_type: 학력 || null, grade: null,
      gpa: 학교없음 || !학점.trim() ? null : Number(학점), gpa_scale: 학교없음 || !학점.trim() ? null : 만점,
      licenses: certs.filter((x) => x !== NONE), trainings: courses.filter((x) => x !== NONE),
      practice: 실습, practice_months: 실습.reduce((s, r) => s + (Number(r.months) || 0), 0),
      ...(경력 ? {} : { 학교: 학교없음 ? null : 학교.trim() || null }),
    };
    const { error } = await browserSupabase().rpc('save_my_survey', { p_salary: null, p_spec: spec, p_langs: langsPayload(langs) });
    setBusy(false);
    if (error) { toast(`저장하지 못했어요. 입력한 내용은 그대로예요 — ${error.message}`, { tone: 'danger', ms: 4500 }); return; }
    await reload();
    toast('스펙을 저장했어요');
    router.replace('/me');
  };

  const 제목 = step === '학력' ? (경력 ? '입사 당시 학력' : '현재 학력') : (경력 ? '입사 당시 자격·교육' : '현재 자격·교육');
  const 아래 = !v?.spec ? undefined
    : step === '학력' ? <RapoButton full onClick={() => go('스펙')} disabled={!학력됨}>{학력됨 ? '다음' : '위 칸을 채워 주세요'}</RapoButton>
    : <RapoButton full onClick={저장} disabled={!스펙됨 || busy || 남은 <= 0}>{busy ? '저장하는 중…' : 남은 <= 0 ? '올해는 더 고칠 수 없어요' : 스펙됨 ? '저장' : '위 칸을 채워 주세요'}</RapoButton>;

  return (
    <RapoFormFrame title={제목} onBack={step === '스펙' ? () => go('학력') : () => router.push('/me')} 아래={아래}>
      {v === undefined ? (
        <p role="status" className="rapo-type-t4-regular pt-(--rapo-dimension-x6) text-(color:--rapo-color-fg-neutral-muted)">잠시만요…</p>
      ) : !v?.spec ? (
        <section className="flex flex-col gap-(--rapo-dimension-x4) pt-(--rapo-dimension-x6)">
          <p className="rapo-type-t9-bold break-keep text-(color:--rapo-color-fg-neutral)">등록한 스펙이 없어요</p>
          <p className="rapo-type-t4-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">{err ?? '가입 때 스펙을 등록하면 여기서 확인하고 고칠 수 있어요.'}</p>
          <Link href="/welcome" className="rapo-type-t4-bold self-start text-(color:--rapo-color-fg-neutral)">스펙 등록하기 ›</Link>
        </section>
      ) : step === '학력' ? (
        <>
          <RapoFormTitle>{경력 ? '입사 당시 학력을 확인해요' : '현재 학력을 확인해요'}</RapoFormTitle>
          <section className="mt-(--rapo-dimension-x6) flex flex-col gap-(--rapo-dimension-x5)">
            {경력 && (
              <dl className="flex flex-col gap-(--rapo-dimension-x2) rounded-(--rapo-radius-r3) bg-(--rapo-color-bg-neutral-weak) p-(--rapo-dimension-x4)">
                <div className="flex gap-(--rapo-dimension-x3)"><dt className="rapo-type-t4-regular w-[64px] shrink-0 text-(color:--rapo-color-fg-neutral-muted)">입사 병원</dt><dd className="rapo-type-t4-bold min-w-0 break-keep text-(color:--rapo-color-fg-neutral)">{v.spec.근무병원 ?? '입력 정보 없음'}</dd></div>
                <div className="flex gap-(--rapo-dimension-x3)"><dt className="rapo-type-t4-regular w-[64px] shrink-0 text-(color:--rapo-color-fg-neutral-muted)">입사 연도</dt><dd className="rapo-type-t4-bold text-(color:--rapo-color-fg-neutral)">{v.spec.입사연도 ? `${v.spec.입사연도}년` : '입력 정보 없음'}</dd></div>
                <Link href="/me/career" className="rapo-type-t3-bold mt-(--rapo-dimension-x1) self-start text-(color:--rapo-color-fg-neutral)">병원·연도는 경력 수정에서 ›</Link>
              </dl>
            )}
            {!경력 && !학교없음 && (
              <div className="flex flex-col gap-(--rapo-dimension-x2)">
                {학교직접 ? (
                  <label className="flex flex-col gap-(--rapo-dimension-x2)">
                    <span className="rapo-type-t5-bold text-(color:--rapo-color-fg-neutral)">학교</span>
                    <input value={학교} onChange={(e) => set학교(e.target.value)} placeholder="학교와 학과 이름"
                      className="rapo-type-t5-regular h-(--rapo-dimension-x13) w-full rounded-(--rapo-radius-r3) border-(length:--rapo-border-default) border-(color:--rapo-color-stroke-neutral-weak) px-(--rapo-dimension-x4) text-(color:--rapo-color-fg-neutral) placeholder:text-(color:--rapo-color-fg-placeholder)" />
                  </label>
                ) : (
                  <골라 label="학교" v={학교들.some((x) => x.이름 === 학교) ? 학교 : ''} opts={학교들.map((x) => x.이름)} ph={학교 || '학교를 선택해 주세요'}
                    on={(n) => { set학교(n); const x = 학교들.find((y) => y.이름 === n); if (x?.학력) set학력(x.학력); }} />
                )}
                {고른학교 && 학교부연(고른학교) && <p className="rapo-type-t4-bold text-(color:--rapo-color-fg-brand-contrast)">{학교부연(고른학교)}</p>}
                <button type="button" onClick={() => { set학교직접(!학교직접); }}
                  className="rapo-type-t4-bold self-start text-(color:--rapo-color-fg-neutral)">{학교직접 ? '목록에서 고르기 ›' : '목록에 없나요? 직접 입력 ›'}</button>
              </div>
            )}
            <골라 label="학력" v={학력} opts={학력목록} ph="학력을 선택해 주세요" on={set학력} />
            {!학교없음 && <학점칸 label={경력 ? '입사 당시 학점' : '누적 학점'} v={학점} on={set학점} 틀림={학점틀림} 도움="4.5 만점 기준이에요. 입력하면 가입한 사람들과 학점을 비교할 수 있어요." />}
            {!경력 && <p className="rapo-type-t3-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">학적과 입학 연월은 이용 상태 · 학적 정보에서 볼 수 있어요. 바꾸려면 운영자에게 문의해 주세요.</p>}
          </section>
        </>
      ) : (
        <>
          <RapoFormTitle>{경력 ? '입사 당시 스펙을 수정해요' : '현재 스펙을 수정해요'}</RapoFormTitle>
          <section className="mt-(--rapo-dimension-x6) flex flex-col">
            <Chips label="자격증" none="보유 자격증 없음" groups={CERTS} picked={certs} on={setCerts} />
            <Chips label="교육 이수" none="이수 교육 없음" groups={coursesFor(job)} picked={courses} on={setCourses}
              hint="기관만 선택하지 않고, 이수한 과정까지 선택해요." />
            <h3 className="rapo-type-t5-bold mt-(--rapo-dimension-x8) text-(color:--rapo-color-fg-neutral)">{경력 ? '입사 전 실습 경험' : '실습 경험'}</h3>
            <p className="rapo-type-t3-regular mt-(--rapo-dimension-x1) break-keep text-(color:--rapo-color-fg-neutral-muted)">기관 유형과 지역, 실습 기간을 최대 5개까지 등록해요.</p>
            <Rows rows={rows} none="실습 없음" noneOn={rowsNone} setNone={(b) => { setRowsNone(b); if (b) setRows([]); }} on={setRows} />
            <h3 className="rapo-type-t5-bold mt-(--rapo-dimension-x8) text-(color:--rapo-color-fg-neutral)">어학 <span className="rapo-type-t3-regular text-(color:--rapo-color-fg-neutral-muted)">(선택)</span></h3>
            <Langs rows={langs} on={setLangs} />
            <div className="mt-(--rapo-dimension-x6)"><남은횟수 n={남은} /></div>
          </section>
        </>
      )}
    </RapoFormFrame>
  );
}
