'use client';

import { useState } from 'react';
import { browserSupabase } from '@/lib/supabase-browser';
import {
  CERTS, EMPLOYMENTS, GENDERS, GRADES, HOSPITALS, HOSPITAL_TYPES,
  MAX_ROWS, REGIONS, SALARY_HIGH, SALARY_LOW, SCHOOLS,
  coursesFor, shortType, type ChipGroup, type WorkRow,
} from '@/lib/signup-fields';
import { FIELD_HINT, PRIVACY_LINE, UNLOCKS } from '@/lib/unlocks';
import type { Role } from '@/lib/who';

/* 가입 마지막 — 급여·스펙을 받습니다. 건너뛰기는 없습니다.

   칸이 30개 가까이 됩니다. 한 화면에 다 놓으면 아무도 안 끝냅니다.
   그래서 3~5칸씩 끊고 진행 막대를 답니다.

   필수는 옛 앱과 똑같이 다섯 개(현직)·세 개(학생)뿐입니다 (index.html 8475).
   나머지를 필수로 올리고 싶어도 참으세요 — 그 순간 이탈이 늡니다.

   중간에 나가도 적은 게 남게 localStorage 에 초안을 둡니다.
   DB 에 나눠 담을 수 없습니다 — 급여 표는 필수 칸이 NOT NULL 이라
   반쯤 채운 줄을 못 넣습니다. */

type Form = Record<string, string>;
const DRAFT = (uid: string) => `potjob.survey.${uid}`;

const loadDraft = (uid: string): Form => {
  try { return JSON.parse(localStorage.getItem(DRAFT(uid)) || '{}'); } catch { return {}; }
};

/* 빈 칸은 0 이 아니라 '안 적음' 입니다. 0 으로 넣으면 평균이 내려갑니다 */
const num = (v: string | undefined) => (v && v.trim() !== '' ? Number(v) : null);

export function SignupSurvey({
  userId, job, role, onDone,
}: {
  userId: string; job: string; role: Role; onDone: () => void | Promise<void>;
}) {
  const [i, setI] = useState(0);
  const [f, setF] = useState<Form>(() => loadDraft(userId));
  const [certs, setCerts] = useState<string[]>(() => loadDraft(userId)._certs?.split('\n').filter(Boolean) ?? []);
  const [courses, setCourses] = useState<string[]>(() => loadDraft(userId)._courses?.split('\n').filter(Boolean) ?? []);
  const [rows, setRows] = useState<WorkRow[]>(() => {
    try { return JSON.parse(loadDraft(userId)._rows || '[]'); } catch { return []; }
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const stu = role === '학생';

  const set = (k: string, v: string) => {
    const next = { ...f, [k]: v };
    setF(next);
    save(next, certs, courses, rows);
  };
  const save = (nf: Form, nc: string[], nk: string[], nr: WorkRow[]) => {
    try {
      localStorage.setItem(DRAFT(userId), JSON.stringify({
        ...nf, _certs: nc.join('\n'), _courses: nk.join('\n'), _rows: JSON.stringify(nr),
      }));
    } catch { /* 사생활 보호 창에서는 못 씁니다. 초안만 못 남을 뿐입니다 */ }
  };

  const salary = num(f.net_monthly);
  const flag =
    salary == null ? null
      : salary < SALARY_LOW ? { t: '세후 금액이 맞나요?', d: '세전을 적으신 건 아닌지 확인해 주세요. 맞다면 특이사항에 사정을 적어 주세요' }
      : salary > SALARY_HIGH ? { t: '높은 편이에요', d: '당직·수당이 포함된 건 아닌지 확인해 주세요. 맞다면 특이사항에 적어 주세요' }
      : null;

  /* ── 화면 목록 ── */
  const steps: { title: string; sub?: string; need?: string[]; body: React.ReactNode }[] = [
    {
      title: '마지막이에요',
      sub: '여기까지 채우면 아래가 열려요',
      body: (
        <div>
          <ul className="mt-6 space-y-1">
            {UNLOCKS.map((u) => (
              <li key={u.title} className="flex gap-5 rounded-sm border border-gray-100 px-6 py-5 dark:border-gray-800">
                <span aria-hidden className="text-h3">{u.emoji}</span>
                <span className="min-w-0">
                  <b className="block text-lg">
                    {u.title}
                    {u.soon && <span className="ml-2 rounded-xs bg-gray-50 px-2 py-1 text-sm font-medium text-gray-400 dark:bg-gray-950">준비 중</span>}
                  </b>
                  <span className="mt-1 block text-sm text-gray-500">{u.desc}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-6 rounded-sm bg-badge-teal-bg p-6 text-lg text-teal-strong">{PRIVACY_LINE}</p>
          <p className="mt-2 text-sm text-gray-400">병원 이름은 받지 않아요</p>
        </div>
      ),
    },

    ...(stu ? [
      {
        title: '학교', need: ['grade', 'school_type'],
        body: (
          <>
            <Sel k="grade" label="학년" v={f.grade} on={set} opts={GRADES} req />
            <Schools v={f.school_type} on={set} req />
          </>
        ),
      },
      {
        title: '학점 · 어학', sub: '선택이에요. 적으면 또래와 비교해 볼 수 있어요',
        body: (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Num k="gpa" label="학점" v={f.gpa} on={set} unit="점" step="0.01" ph="3.8" />
              <Num k="gpa_scale" label="만점 기준" v={f.gpa_scale} on={set} unit="점" step="0.1" ph="4.5" />
            </div>
            <Num k="lang_score" label="어학 점수" hint="토익 기준 · 없으면 비워두세요" v={f.lang_score} on={set} unit="점" ph="800" />
          </>
        ),
      },
    ] : [
      {
        title: '언제부터 일하셨나요', need: ['hired_year', 'region'],
        body: (
          <>
            <Num k="hired_year" label="첫 입사연도" hint="치료사로 처음 일 시작한 해" v={f.hired_year} on={set} unit="년" ph="2021" req />
            <Num k="current_hired_year" label="지금 병원 입사연도" hint="첫 직장이면 위와 같게" v={f.current_hired_year} on={set} unit="년" ph="2024" />
            <Sel k="region" label="지역" hint="근무지 기준" v={f.region} on={set} opts={REGIONS} req />
          </>
        ),
      },
      {
        title: '어떤 곳에서 일하세요', need: ['hospital_type', 'employ_type'],
        body: (
          <>
            <Sel k="hospital_type" label="병원·기관 유형" hint="국립대병원은 대학병원" v={f.hospital_type} on={set} opts={HOSPITAL_TYPES} req />
            <Sel k="employ_type" label="고용형태" hint="인턴·프리랜서도 모두 집계돼요" v={f.employ_type} on={set} opts={EMPLOYMENTS} req />
          </>
        ),
      },
      {
        title: '급여', sub: '기본급 + 매달 고정 수당 · 세후. 성과금·상여·당직 수당은 빼고요',
        need: ['net_monthly'],
        body: (
          <>
            <Num k="net_monthly" label="고정 월 실수령액" hint="세금 떼고 통장에 들어오는 금액" v={f.net_monthly} on={set} unit="만원" ph="250" req />
            {flag && (
              <p className="mt-2 rounded-sm bg-brand-red-soft p-5 text-lg text-brand-red-dark">
                <b className="block">{flag.t}</b>
                <span className="mt-1 block text-sm">{flag.d}</span>
              </p>
            )}
            <Check k="extra_pay" v={f.extra_pay} on={set}
              label="기본 치료 외에 추가 수당이 있어요"
              sub="건수·실적에 따라 더 받는 경우. 위 실수령에 그 금액까지 더해서 적어 주세요" />
            <Num k="bonus_yearly" label="연간 상여 총액" hint="1년치 상여·성과금 합계 · 없으면 0" v={f.bonus_yearly} on={set} unit="만원" ph="0" />
          </>
        ),
      },
      {
        title: '당직 · 주말근무', sub: '없으면 0 으로 두세요',
        body: (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Num k="duty_count" label="당직" hint="퇴근 후 더 남는 근무" v={f.duty_count} on={set} unit="회 / 월" ph="0" />
              <Num k="duty_hours" label="한 번에" v={f.duty_hours} on={set} unit="시간" ph="2" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Num k="weekend_count" label="주말근무" v={f.weekend_count} on={set} unit="회 / 월" ph="0" />
              <Num k="weekend_hours" label="한 번에" hint="반나절이면 4" v={f.weekend_hours} on={set} unit="시간" ph="4" />
            </div>
            <p className="mt-5 text-sm text-gray-400">기본 174시간 · 주 5일 기준으로 시급을 냅니다</p>
          </>
        ),
      },
      {
        title: '나에 대해', sub: '전부 선택이에요',
        body: (
          <>
            <Sel k="gender" label="성별" hint="남녀 급여 차이를 보는 데 써요" v={f.gender} on={set} opts={GENDERS} blank="고르지 않음" />
            <Num k="birth_year" label="출생연도" hint="또래 비교에 써요" v={f.birth_year} on={set} unit="년생" ph="1997" />
            <Area k="note" label="특이사항" hint="남들과 다른 조건이 있다면" v={f.note} on={set}
              ph="예) 야간전담이라 수당이 큽니다 / 주 4일제라 낮게 나옵니다" />
          </>
        ),
      },
      {
        title: '학력', sub: '여기까지 채우면 합격 스펙 통계도 볼 수 있어요',
        body: (
          <>
            <Schools v={f.school_type} on={set} />
            <div className="grid grid-cols-2 gap-2">
              <Num k="gpa" label="학점" v={f.gpa} on={set} unit="점" step="0.01" ph="3.8" />
              <Num k="gpa_scale" label="만점 기준" v={f.gpa_scale} on={set} unit="점" step="0.1" ph="4.5" />
            </div>
            <Num k="lang_score" label="어학 점수" hint="토익 기준 · 없으면 비워두세요" v={f.lang_score} on={set} unit="점" ph="800" />
          </>
        ),
      },
    ]),

    {
      title: '자격증 · 교육', sub: '해당되는 것 모두 눌러 주세요',
      body: (
        <>
          <Chips label="자격증" groups={CERTS} picked={certs}
            on={(v) => { setCerts(v); save(f, v, courses, rows); }} hint={FIELD_HINT.licenses} />
          <Chips label="교육 이수" groups={coursesFor(job)} picked={courses}
            on={(v) => { setCourses(v); save(f, certs, v, rows); }} hint="협회·학회 교육 등" />
        </>
      ),
    },

    {
      title: stu ? '실습' : '경력',
      sub: stu ? '다녀온 곳을 최대 5개까지' : '이전 근무지 포함, 최대 5개',
      body: (
        <Rows rows={rows} on={(v) => { setRows(v); save(f, certs, courses, v); }} />
      ),
    },

    ...(stu ? [{
      title: '어디로 가고 싶으세요', need: ['want_type'],
      body: (
        <>
          <Sel k="want_type" label="희망 취업 유형" v={f.want_type} on={set} opts={HOSPITALS} req />
          <Sel k="want_region" label="희망 지역" v={f.want_region} on={set} opts={REGIONS} />
        </>
      ),
    }] : []),
  ];

  const cur = steps[i];
  const last = i === steps.length - 1;
  const missing = (cur.need ?? []).filter((k) => !f[k]?.trim());

  const finish = async () => {
    setBusy(true); setErr(null);
    const sb = browserSupabase();

    /* 스펙은 현직·학생 둘 다 씁니다 (옛 화면에서도 2단계 카드는 공용이었습니다).
       실습은 학생 칸, 경력은 현직 칸이라 같은 rows 를 역할에 따라 다른 칸에 담습니다 */
    const filled = rows.filter((r) => r.hospital);
    const months = filled.reduce((s, r) => s + (Number(r.months) || 0), 0);

    const spec = {
      profile_id: userId,
      school_type: f.school_type || null,
      grade: stu ? f.grade || null : null,
      gpa: num(f.gpa), gpa_scale: num(f.gpa_scale), lang_score: num(f.lang_score),
      licenses: certs, trainings: courses,
      practice: stu ? filled : null,
      career: stu ? null : filled,
      practice_months: stu ? months : null,
      career_months: stu ? null : months,
      want_type: stu ? f.want_type || null : null,
      want_region: stu ? f.want_region || null : null,
    };

    const { error: e1 } = await sb.from('student_specs').upsert(spec, { onConflict: 'profile_id' });
    if (e1) { setBusy(false); setErr(`저장하지 못했어요 — ${e1.message}`); return; }

    if (!stu) {
      const { error: e2 } = await sb.from('salary_records').upsert({
        profile_id: userId,
        hired_year: Number(f.hired_year),
        current_hired_year: num(f.current_hired_year) ?? Number(f.hired_year),
        region: f.region,
        hospital_type: shortType(f.hospital_type),
        employ_type: f.employ_type,
        net_monthly: Number(f.net_monthly),
        duty_count: num(f.duty_count), duty_hours: num(f.duty_hours),
        weekend_count: num(f.weekend_count), weekend_hours: num(f.weekend_hours),
        bonus_yearly: num(f.bonus_yearly),
        extra_pay: f.extra_pay === 'on',
        gender: f.gender || null,
        birth_year: num(f.birth_year),
        note: f.note || null,
      }, { onConflict: 'profile_id' });
      if (e2) { setBusy(false); setErr(`저장하지 못했어요 — ${e2.message}`); return; }
    }

    try { localStorage.removeItem(DRAFT(userId)); } catch { /* 없어도 그만입니다 */ }
    await onDone();
  };

  return (
    <section>
      {/* 진행 막대 — 몇 칸 남았는지 안 보이면 중간에 나갑니다 */}
      <div className="flex items-center gap-5">
        <div className="h-1 flex-1 rounded-md bg-gray-100 dark:bg-gray-800">
          <div className="h-1 rounded-md bg-teal-strong transition-[width]"
               style={{ width: `${(i / (steps.length - 1)) * 100}%` }} />
        </div>
        <span className="shrink-0 text-sm text-gray-400">{i + 1} / {steps.length}</span>
      </div>

      <h1 className="mt-6 text-h2 font-bold">{cur.title}</h1>
      {cur.sub && <p className="mt-2 text-lg text-gray-500">{cur.sub}</p>}

      <div className="mt-6">{cur.body}</div>

      {err && <p className="mt-5 text-lg text-brand-red">{err}</p>}

      <div className="mt-7 flex gap-2">
        {i > 0 && (
          <button type="button" onClick={() => { setI(i - 1); setErr(null); }} disabled={busy}
            className="rounded-md border border-gray-200 px-7 py-5 text-lg font-medium disabled:opacity-40 dark:border-gray-700">
            이전
          </button>
        )}
        <button
          type="button"
          disabled={busy || missing.length > 0}
          onClick={() => (last ? finish() : setI(i + 1))}
          className="flex-1 rounded-md bg-brand-red px-6 py-5 text-lg font-bold text-white hover:bg-brand-red-dark active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? '저장하는 중…' : missing.length > 0 ? '위 칸을 채워 주세요' : last ? '다 됐어요' : i === 0 ? '채우러 가기' : '다음'}
        </button>
      </div>

      {i > 0 && !stu && <p className="mt-5 text-sm text-gray-400">{PRIVACY_LINE}</p>}
    </section>
  );
}

/* ── 칸들 ── */

function Label({ label, hint, req, k }: { label: string; hint?: string; req?: boolean; k?: string }) {
  const why = k ? FIELD_HINT[k] : undefined;
  return (
    <>
      <span className="block text-lg font-bold">
        {label}
        {req && <span className="ml-1 text-brand-red">*</span>}
        {hint && <span className="ml-2 text-sm font-medium text-gray-400">{hint}</span>}
      </span>
      {why && <span className="mt-1 block text-sm text-teal-strong">{why}</span>}
    </>
  );
}

const INPUT =
  'w-full rounded-xs border border-gray-200 bg-gray-50 px-5 py-4 text-lg dark:border-gray-700 dark:bg-gray-950';

function Num({
  k, label, hint, v, on, unit, ph, step, req,
}: {
  k: string; label: string; hint?: string; v?: string; on: (k: string, v: string) => void;
  unit?: string; ph?: string; step?: string; req?: boolean;
}) {
  return (
    <label className="mt-5 block first:mt-0">
      <Label label={label} hint={hint} req={req} k={k} />
      <span className="mt-2 flex items-center gap-3">
        <input type="number" inputMode="decimal" step={step} value={v ?? ''} placeholder={ph}
          onChange={(e) => on(k, e.target.value)} className={INPUT} />
        {unit && <span className="shrink-0 text-lg text-gray-500">{unit}</span>}
      </span>
    </label>
  );
}

function Sel({
  k, label, hint, v, on, opts, req, blank,
}: {
  k: string; label: string; hint?: string; v?: string; on: (k: string, v: string) => void;
  opts: readonly string[]; req?: boolean; blank?: string;
}) {
  return (
    <label className="mt-5 block first:mt-0">
      <Label label={label} hint={hint} req={req} k={k} />
      <select value={v ?? ''} onChange={(e) => on(k, e.target.value)} className={INPUT + ' mt-2'}>
        <option value="">{blank ?? '선택'}</option>
        {opts.map((o) => <option key={o}>{o}</option>)}
      </select>
    </label>
  );
}

/* 최종 학력만 묶음이 있어서 따로 뒀습니다.
   학생은 필수, 현직은 선택입니다 — 옛 submit 의 req 배열과 같습니다 */
function Schools({ v, on, req }: { v?: string; on: (k: string, v: string) => void; req?: boolean }) {
  return (
    <label className="mt-5 block first:mt-0">
      <Label label="최종 학력" req={req} k="school_type" />
      <select value={v ?? ''} onChange={(e) => on('school_type', e.target.value)} className={INPUT + ' mt-2'}>
        <option value="">선택</option>
        {SCHOOLS.map((g) => (
          <optgroup key={g.group} label={g.group}>
            {g.items.map((s) => <option key={s}>{s}</option>)}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

function Check({
  k, label, sub, v, on,
}: { k: string; label: string; sub?: string; v?: string; on: (k: string, v: string) => void }) {
  const on_ = v === 'on';
  return (
    <button type="button" onClick={() => on(k, on_ ? '' : 'on')} aria-pressed={on_}
      className={'mt-5 flex w-full items-start gap-5 rounded-sm border px-6 py-5 text-left transition-colors '
        + (on_ ? 'border-teal-strong bg-badge-teal-bg' : 'border-gray-200 dark:border-gray-700')}>
      <span aria-hidden className={'mt-1 flex size-[22px] shrink-0 items-center justify-center rounded-xs border text-white '
        + (on_ ? 'border-teal-strong bg-teal-strong' : 'border-gray-300 dark:border-gray-600')}>
        {on_ ? '✓' : ''}
      </span>
      <span>
        <b className="block text-lg">{label}</b>
        {sub && <span className="mt-1 block text-sm text-gray-500">{sub}</span>}
      </span>
    </button>
  );
}

function Area({
  k, label, hint, v, on, ph,
}: { k: string; label: string; hint?: string; v?: string; on: (k: string, v: string) => void; ph?: string }) {
  const n = (v ?? '').length;
  return (
    <label className="mt-5 block">
      <Label label={label} hint={hint} k={k} />
      <textarea rows={4} maxLength={300} value={v ?? ''} placeholder={ph}
        onChange={(e) => on(k, e.target.value)} className={INPUT + ' mt-2'} />
      <span className="mt-1 block text-right text-sm text-gray-400">{n} / 300</span>
    </label>
  );
}

/* 자격증·교육 — 묶음을 접었다 펴는 건 <details> 로 둡니다. 직접 만들 이유가 없어요.
   담기는 값은 옛 chips() 와 같게 '묶음 - 항목' 입니다 */
function Chips({
  label, hint, groups, picked, on,
}: {
  label: string; hint?: string; groups: ChipGroup[]; picked: string[]; on: (v: string[]) => void;
}) {
  const [etc, setEtc] = useState('');
  const toggle = (v: string) =>
    on(picked.includes(v) ? picked.filter((x) => x !== v) : [...picked, v]);

  const known = new Set(groups.flatMap((g) => (g.s.length ? g.s.map((s) => `${g.n} - ${s}`) : [g.n])));
  const custom = picked.filter((p) => !known.has(p));

  return (
    <div className="mt-6 first:mt-0">
      <Label label={label} hint={hint} />
      <div className="mt-2 space-y-1">
        {groups.map((g) => g.s.length === 0 ? (
          <Chip key={g.n} on={picked.includes(g.n)} go={() => toggle(g.n)}>{g.n}</Chip>
        ) : (
          <details key={g.n} className="rounded-sm border border-gray-200 dark:border-gray-700">
            <summary className="cursor-pointer px-6 py-4 text-lg font-medium">
              {g.n}
              {picked.filter((p) => p.startsWith(g.n + ' - ')).length > 0 && (
                <span className="ml-2 rounded-xs bg-badge-teal-bg px-2 py-1 text-sm text-teal-strong">
                  {picked.filter((p) => p.startsWith(g.n + ' - ')).length}
                </span>
              )}
            </summary>
            <div className="flex flex-wrap gap-2 px-6 pb-5">
              {g.s.map((s) => {
                const full = `${g.n} - ${s}`;
                return <Chip key={s} on={picked.includes(full)} go={() => toggle(full)}>{s}</Chip>;
              })}
            </div>
          </details>
        ))}
      </div>

      {custom.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {custom.map((c) => <Chip key={c} on go={() => toggle(c)}>{c}</Chip>)}
        </div>
      )}

      <div className="mt-2 flex gap-2">
        <input value={etc} onChange={(e) => setEtc(e.target.value)}
          placeholder={`목록에 없는 ${label}`} className={INPUT}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            const v = etc.trim();
            if (v && !picked.includes(v)) on([...picked, v]);
            setEtc('');
          }} />
        <button type="button"
          onClick={() => { const v = etc.trim(); if (v && !picked.includes(v)) on([...picked, v]); setEtc(''); }}
          className="shrink-0 rounded-md border border-gray-200 px-6 py-4 text-lg font-medium dark:border-gray-700">
          추가
        </button>
      </div>
    </div>
  );
}

function Chip({ on, go, children }: { on: boolean; go: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={go} aria-pressed={on}
      className={'rounded-md border px-5 py-3 text-lg transition-colors '
        + (on ? 'border-teal-strong bg-teal-strong text-white'
              : 'border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-400')}>
      {children}
    </button>
  );
}

/* 실습·경력 — 병원 이름은 안 받습니다. 유형과 개월만 (옛 drawRows 와 같게) */
function Rows({ rows, on }: { rows: WorkRow[]; on: (v: WorkRow[]) => void }) {
  const edit = (i: number, patch: Partial<WorkRow>) =>
    on(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <div>
      {rows.length === 0 && <p className="text-lg text-gray-400">없으면 그냥 넘어가도 돼요</p>}

      {rows.map((r, i) => (
        <div key={i} className="mt-2 flex gap-2">
          <select value={r.hospital} onChange={(e) => edit(i, { hospital: e.target.value })} className={INPUT}>
            <option value="">병원 유형</option>
            {HOSPITALS.map((h) => <option key={h}>{h}</option>)}
          </select>
          <input type="number" inputMode="numeric" placeholder="개월" value={r.months}
            onChange={(e) => edit(i, { months: e.target.value })}
            className={INPUT + ' max-w-[100px]'} />
          <button type="button" aria-label={`${i + 1}번째 줄 지우기`}
            onClick={() => on(rows.filter((_, j) => j !== i))}
            className="shrink-0 rounded-md border border-gray-200 px-5 text-lg text-gray-400 dark:border-gray-700">
            ×
          </button>
        </div>
      ))}

      <button type="button" disabled={rows.length >= MAX_ROWS}
        onClick={() => on([...rows, { hospital: '', months: '' }])}
        className="mt-5 w-full rounded-md border border-dashed border-gray-300 px-6 py-5 text-lg font-medium text-gray-500 disabled:opacity-40 dark:border-gray-600">
        {rows.length >= MAX_ROWS ? '최대 5개까지 넣을 수 있어요' : '+ 한 줄 추가'}
      </button>
    </div>
  );
}
