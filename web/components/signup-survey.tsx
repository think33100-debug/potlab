'use client';

import { useState } from 'react';
import { browserSupabase } from '@/lib/supabase-browser';
import {
  CERTS, EMPLOYMENTS, GENDERS, GRADES, HOSPITALS, HOSPITAL_TYPES,
  MAX_ROWS, NONE, RANGE, REGIONS, SALARY_HIGH, SALARY_LOW, SCHOOLS, THIS_YEAR,
  anyError, coursesFor, fieldError, shortType,
  type ChipGroup, type Draft, type Form, type WorkRow,
} from '@/lib/signup-fields';
import { annualTotal, hourlyWage, man10, monthlyHours } from '@/lib/pay';
import { RATE_YEAR, grossFromNet, netFromGross, 만원 } from '@/lib/tax';
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

const DRAFT = (uid: string) => `potjob.survey.${uid}`;

const loadDraft = (uid: string): Form => {
  try { return JSON.parse(localStorage.getItem(DRAFT(uid)) || '{}'); } catch { return {}; }
};

/* 알림 판.
   밝은 바탕에서는 연한 teal 을 깔고, 어두운 바탕에서는 테두리만 씁니다 —
   어두운 화면에 연한 덩어리가 있으면 그 줄만 튀어 보입니다 */
const PANEL =
  'rounded-sm p-6 text-lg text-teal-strong bg-badge-teal-bg '
  + 'dark:bg-transparent dark:border dark:border-teal-strong/40';

/* 빈 칸은 0 이 아니라 '안 적음' 입니다. 0 으로 넣으면 평균이 내려갑니다 */
const num = (v: string | undefined) => (v && v.trim() !== '' ? Number(v) : null);

export function SignupSurvey({
  userId, job, role, onDone, initial, editsLeft,
}: {
  userId: string; job: string; role: Role; onDone: () => void | Promise<void>;
  /* 마이페이지에서 고칠 때 — 이미 등록한 값으로 시작합니다 */
  initial?: Draft;
  editsLeft?: number;
}) {
  const edit = initial !== undefined;
  /* 어느 화면까지 왔는지도 초안에 남깁니다.
     튕기거나 창을 닫았다가 돌아와도 1/9 부터 다시 채우지 않게 */
  const [i, setI] = useState(() => (initial ? 0 : Number(loadDraft(userId)._step) || 0));
  const [f, setF] = useState<Form>(() => initial?.f ?? loadDraft(userId));
  const [certs, setCerts] = useState<string[]>(
    () => initial?.certs ?? loadDraft(userId)._certs?.split('\n').filter(Boolean) ?? []);
  const [courses, setCourses] = useState<string[]>(
    () => initial?.courses ?? loadDraft(userId)._courses?.split('\n').filter(Boolean) ?? []);
  const [rows, setRows] = useState<WorkRow[]>(() => {
    if (initial) return initial.rows;
    try { return JSON.parse(loadDraft(userId)._rows || '[]'); } catch { return []; }
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  /* form 채우는 중 → confirm 정말 등록할지 → done 고맙다는 화면 */
  const [phase, setPhase] = useState<'form' | 'confirm' | 'done'>('form');

  const stu = role === '학생';

  /* 한 번에 여러 칸을 고칠 때는 반드시 patch 를 씁니다.
     set 을 두 번 잇달아 부르면 둘 다 같은 f 를 보고 만들어서 앞의 것이 지워집니다
     (「어학 점수 없음」 을 눌러도 안 풀리던 이유였습니다) */
  const patch = (p: Form) => {
    const next = { ...f, ...p };
    setF(next);
    save(next, certs, courses, rows);
  };
  const set = (k: string, v: string) => patch({ [k]: v });
  const save = (nf: Form, nc: string[], nk: string[], nr: WorkRow[], step = i) => {
    if (edit) return;      // 고치는 중에는 초안을 안 남깁니다. 등록된 값이 기준입니다
    try {
      localStorage.setItem(DRAFT(userId), JSON.stringify({
        ...nf, _certs: nc.join('\n'), _courses: nk.join('\n'), _rows: JSON.stringify(nr),
        _step: String(step),
      }));
    } catch { /* 사생활 보호 창에서는 못 씁니다. 초안만 못 남을 뿐입니다 */ }
  };

  /* 화면을 옮길 때마다 자리를 남깁니다 */
  const go = (step: number) => { setI(step); setErr(null); save(f, certs, courses, rows, step); };

  /* 「없음」도 답입니다. 빈칸이면 안 적은 건지 없는 건지 구분이 안 됩니다 —
     그래서 어학·자격증·교육·경력에는 각각 「없음」을 두고, 그걸 골라야 넘어갑니다 */
  const has = (k: string) => !!f[k]?.trim();
  const langOk = f.lang_none === 'Y' || has('lang_score');
  const rowsOk = f.rows_none === 'Y' || rows.some((r) => r.hospital && r.region && r.months);
  /* 이 화면의 숫자 칸 중 하나라도 범위를 벗어나면 못 넘어갑니다 */
  const bad = (keys: string[]) => anyError(keys, f);

  /* 되묻는 기준은 이제 세전 고정 월급입니다 */
  const salary = num(f.base_monthly);
  const flag =
    salary == null ? null
      : salary < SALARY_LOW ? { t: '세전 금액이 맞나요?', d: '실수령을 적으신 건 아닌지 확인해 주세요. 맞다면 특이사항에 사정을 적어 주세요' }
      : salary > SALARY_HIGH ? { t: '높은 편이에요', d: '수당·상여가 포함된 건 아닌지 확인해 주세요. 그건 아래 칸에 따로 적어요' }
      : null;

  /* ── 화면 목록 ── */
  const steps: { title: string; sub?: string; ok?: boolean; body: React.ReactNode }[] = [
    /* 고칠 때는 「채우면 열려요」 안내를 안 보여줍니다. 이미 채우신 분입니다 */
    ...(edit ? [] : [{
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
          <p className={'mt-6 ' + PANEL}>{PRIVACY_LINE}</p>
          <p className="mt-2 text-sm text-gray-400">병원 이름은 받지 않아요</p>
        </div>
      ),
    }]),

    ...(stu ? [
      {
        title: '학교', ok: has('grade') && has('school_type'),
        body: (
          <>
            <Sel k="grade" label="학년" v={f.grade} on={set} opts={GRADES} req />
            <Schools v={f.school_type} on={set} req />
          </>
        ),
      },
      {
        title: '학점 · 어학',
        ok: has('gpa') && has('gpa_scale') && langOk && !bad(['gpa','gpa_scale','lang_score']),
        body: (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Num k="gpa" label="학점" v={f.gpa} on={set} unit="점" step="0.01" ph="3.8" req f={f} />
              <Num k="gpa_scale" label="만점 기준" v={f.gpa_scale} on={set} unit="점" step="0.1" ph="4.5" req f={f} />
            </div>
            <Lang f={f} patch={patch} />
          </>
        ),
      },
    ] : [
      {
        title: '언제부터 일하셨나요',
        ok: has('hired_year') && has('current_hired_year') && has('region')
          && !bad(['hired_year','current_hired_year']),
        body: (
          <>
            <Num k="hired_year" label="첫 입사연도" hint="치료사로 처음 일 시작한 해" v={f.hired_year} on={set} unit="년" ph="2021" req f={f} />
            <Num k="current_hired_year" label="지금 병원 입사연도" hint="첫 직장이면 위와 같게" v={f.current_hired_year} on={set} unit="년" ph="2024" req f={f} />
            <Sel k="region" label="지역" hint="근무지 기준" v={f.region} on={set} opts={REGIONS} req />
          </>
        ),
      },
      {
        title: '어떤 곳에서 일하세요',
        ok: has('hospital_type') && has('employ_type'),
        body: (
          <>
            <Sel k="hospital_type" label="병원·기관 유형" hint="국립대병원은 대학병원(국립)" v={f.hospital_type} on={set} opts={HOSPITAL_TYPES} req />
            <Sel k="employ_type" label="고용형태" hint="인턴·프리랜서도 모두 집계돼요" v={f.employ_type} on={set} opts={EMPLOYMENTS} req />
          </>
        ),
      },
      {
        title: '급여', sub: '연 총소득으로 봅니다. 월급만 비교하면 뜻이 없어요',
        ok: has('base_monthly') && has('extra_pay_monthly') && has('bonus_yearly')
          && !bad(['base_monthly', 'extra_pay_monthly', 'bonus_yearly', 'net_monthly', 'dependents']),
        body: (
          <>
            <Gross f={f} patch={patch} />
            {/* 빨간 바탕을 안 씁니다 — teamsparta.md 「입력 오류에 빨강 배경을
                사용하지 않는다. 보더·헬퍼 텍스트로 전달한다」 */}
            {flag && (
              <p className="mt-2 rounded-sm border border-brand-red/40 p-5 text-lg text-brand-red">
                <b className="block">{flag.t}</b>
                <span className="mt-1 block text-sm text-gray-500">{flag.d}</span>
              </p>
            )}
            <Num k="extra_pay_monthly" label="추가 수당" req unit="만원 / 월" ph="0"
              hint="치료 건수나 실적으로 더 받는 돈이에요. 없으면 0"
              v={f.extra_pay_monthly} on={set} f={f} />
            <Num k="bonus_yearly" label="연간 상여금" req unit="만원" ph="0"
              hint="작년 한 해 명절·성과급으로 받은 돈을 다 합쳐서 적어 주세요. 없으면 0"
              v={f.bonus_yearly} on={set} f={f} />
          </>
        ),
      },
      {
        title: '당직 · 주말근무', sub: '없으면 0 으로 두세요. 시급을 내는 데 씁니다',
        ok: !bad(['duty_count', 'duty_hours', 'duty_pay',
                  'weekend_count', 'weekend_hours', 'weekend_pay']),
        body: (
          <>
            {/* 라벨 줄 수가 달라 칸이 좌우로 어긋났습니다. 묶음으로 싸서 줄을 맞춥니다 */}
            <Group title="당직" hint="퇴근 후 더 남는 근무 · 당직·주말을 넣어야 진짜 시급이 나와요">
              <Num k="duty_count" label="한 달에" v={f.duty_count} on={set} unit="회" ph="0" f={f} noWhy />
              <Num k="duty_hours" label="한 번에" v={f.duty_hours} on={set} unit="시간" ph="2" f={f} noWhy />
              <Num k="duty_pay" label="한 번에" v={f.duty_pay} on={set} unit="만원" ph="0" f={f} noWhy />
            </Group>
            <Group title="주말근무" hint="반나절이면 4시간">
              <Num k="weekend_count" label="한 달에" v={f.weekend_count} on={set} unit="회" ph="0" f={f} noWhy />
              <Num k="weekend_hours" label="한 번에" v={f.weekend_hours} on={set} unit="시간" ph="4" f={f} noWhy />
              <Num k="weekend_pay" label="한 번에" v={f.weekend_pay} on={set} unit="만원" ph="0" f={f} noWhy />
            </Group>

            {/* 다 넣으면 그 자리에서 보여줍니다. 보고 고칠 수 있어야 자료가 정확해집니다 */}
            <PaySummary f={f} />
          </>
        ),
      },
      {
        title: '나에 대해',
        ok: has('gender') && has('birth_year') && !bad(['birth_year']),
        body: (
          <>
            <Sel k="gender" label="성별" hint="남녀 급여 차이를 보는 데 써요" v={f.gender} on={set} opts={GENDERS} req />
            <Num k="birth_year" label="출생연도" hint="또래 비교에 써요" v={f.birth_year} on={set} unit="년생" ph="1997" req f={f} />
            <Area k="note" label="특이사항" hint="선택 · 남들과 다른 조건이 있다면" v={f.note} on={set}
              ph="예) 야간전담이라 수당이 큽니다 / 주 4일제라 낮게 나옵니다" />
          </>
        ),
      },
      {
        title: '학력', sub: '여기까지 채우면 합격 스펙 통계도 볼 수 있어요',
        ok: has('school_type') && has('gpa') && has('gpa_scale') && langOk
          && !bad(['gpa','gpa_scale','lang_score']),
        body: (
          <>
            <Schools v={f.school_type} on={set} req />
            <div className="grid grid-cols-2 gap-2">
              <Num k="gpa" label="학점" v={f.gpa} on={set} unit="점" step="0.01" ph="3.8" req f={f} />
              <Num k="gpa_scale" label="만점 기준" v={f.gpa_scale} on={set} unit="점" step="0.1" ph="4.5" req f={f} />
            </div>
            <Lang f={f} patch={patch} />
          </>
        ),
      },
    ]),

    {
      title: '자격증 · 교육', sub: '해당되는 것 모두 눌러 주세요',
      ok: certs.length > 0 && courses.length > 0,
      body: (
        <>
          <Chips label="자격증" none="자격증 없음" groups={CERTS} picked={certs}
            on={(v) => { setCerts(v); save(f, v, courses, rows); }} hint={FIELD_HINT.licenses} />
          <Chips label="교육 이수" none="이수내역 없음" groups={coursesFor(job)} picked={courses}
            on={(v) => { setCourses(v); save(f, certs, v, rows); }} hint="협회·학회 교육 등" />
        </>
      ),
    },

    {
      title: stu ? '실습' : '경력',
      sub: stu ? '다녀온 곳을 최대 5개까지' : '이전 근무지 포함, 최대 5개',
      ok: rowsOk,
      body: (
        <Rows rows={rows} none={stu ? '실습 없음' : '경력 없음'}
          noneOn={f.rows_none === 'Y'} setNone={(b) => set('rows_none', b ? 'Y' : '')}
          on={(v) => { setRows(v); save(f, certs, courses, v); }} />
      ),
    },

    ...(stu ? [{
      title: '어디로 가고 싶으세요',
      ok: has('want_type') && has('want_region'),
      body: (
        <>
          <Sel k="want_type" label="희망 취업 유형" v={f.want_type} on={set} opts={HOSPITALS} req />
          <Sel k="want_region" label="희망 지역" v={f.want_region} on={set} opts={REGIONS} req />
        </>
      ),
    }] : []),
  ];

  /* 남겨둔 자리가 지금 화면 수보다 클 수 있습니다 — 현직 9장, 학생 6장이라
     역할을 바꾸면 어긋납니다. 없는 화면을 그리면 그대로 터집니다 */
  const at = Math.min(i, steps.length - 1);
  const cur = steps[at];
  const last = at === steps.length - 1;
  const blocked = cur.ok === false;

  const finish = async () => {
    setBusy(true); setErr(null);
    const sb = browserSupabase();

    /* 스펙은 현직·학생 둘 다 씁니다 (옛 화면에서도 2단계 카드는 공용이었습니다).
       실습은 학생 칸, 경력은 현직 칸이라 같은 rows 를 역할에 따라 다른 칸에 담습니다 */
    const filled = f.rows_none === 'Y' ? [] : rows.filter((r) => r.hospital && r.region);
    const months = filled.reduce((s, r) => s + (Number(r.months) || 0), 0);

    /* 「없음」을 골랐으면 빈 목록으로 담습니다 — 화면에서만 쓰는 표시입니다 */
    const strip = (xs: string[]) => xs.filter((x) => x !== NONE);

    const spec = {
      school_type: f.school_type || null,
      grade: stu ? f.grade || null : null,
      gpa: num(f.gpa), gpa_scale: num(f.gpa_scale),
      lang_score: f.lang_none === 'Y' ? null : num(f.lang_score),
      licenses: strip(certs), trainings: strip(courses),
      practice: stu ? filled : null,
      career: stu ? null : filled,
      practice_months: stu ? months : null,
      career_months: stu ? null : months,
      want_type: stu ? f.want_type || null : null,
      want_region: stu ? f.want_region || null : null,
    };

    /* 연 총소득(annual_total)은 안 보냅니다 — DB 가 직접 셉니다.
       화면에서 계산해 보내면 둘이 어긋나는 날이 옵니다 */
    const salaryRow = !stu ? {
        hired_year: Number(f.hired_year),
        current_hired_year: num(f.current_hired_year) ?? Number(f.hired_year),
        region: f.region,
        hospital_type: shortType(f.hospital_type),
        employ_type: f.employ_type,
        base_monthly: Number(f.base_monthly),
        /* 세전을 직접 적었는지, 세후로 적어 계산했는지 남깁니다 */
        pay_basis: f.pay_basis === 'estimated' ? 'estimated' : 'gross',
        net_monthly: f.pay_unsure === 'Y' ? num(f.net_monthly) : null,
        dependents: f.pay_unsure === 'Y' ? num(f.dependents) : null,
        extra_pay_monthly: num(f.extra_pay_monthly),
        duty_count: num(f.duty_count), duty_hours: num(f.duty_hours), duty_pay: num(f.duty_pay),
        weekend_count: num(f.weekend_count), weekend_hours: num(f.weekend_hours),
        weekend_pay: num(f.weekend_pay),
        bonus_yearly: num(f.bonus_yearly),
        gender: f.gender || null,
        birth_year: num(f.birth_year),
        note: f.note || null,
      } : null;

    /* 표에 직접 안 씁니다 — 회원에게는 쓰기 권한이 없습니다.
       이 함수가 1년 2회를 세고, survey_at 을 찍고, 두 표를 같이 담습니다 */
    const { error } = await sb.rpc('save_my_survey', { p_salary: salaryRow, p_spec: spec });
    if (error) {
      setBusy(false);
      setErr(error.message.includes('1년에 2번')
        ? '1년에 2번까지 고칠 수 있어요. 다음 해에 다시 고칠 수 있어요'
        : `저장하지 못했어요 — ${error.message}`);
      return;
    }

    try { localStorage.removeItem(DRAFT(userId)); } catch { /* 없어도 그만입니다 */ }
    setBusy(false);
    setPhase('done');
  };

  /* 등록 전에 한 번 묻습니다. 한 번 등록하면 1년에 두 번만 고칠 수 있어서
     그냥 지나가게 두면 안 됩니다 */
  if (phase === 'confirm') {
    return (
      <section>
        <h1 className="text-h2 font-bold">{edit ? '이대로 고칠까요?' : '등록하시겠어요?'}</h1>
        <p className="mt-2 text-lg text-gray-500">
          적어 주신 내용을 이대로 {edit ? '저장해요' : '등록해요'}. 고칠 게 있으면 돌아가서 바꿀 수 있어요
        </p>

        <p className={'mt-6 '
          + (edit && editsLeft === 1
            ? 'rounded-sm border border-brand-red/40 p-6 text-lg text-brand-red'
            : PANEL)}>
          {edit
            ? <>지금 저장하면 올해 <b>{Math.max(0, (editsLeft ?? 2) - 1)}번</b> 남아요</>
            : <>등록하고 나면 <b>내 정보에서 1년에 2번</b> 고칠 수 있어요</>}
        </p>
        {!stu && <p className="mt-5 text-sm text-gray-400">{PRIVACY_LINE}</p>}

        {err && <p className="mt-5 text-lg text-brand-red">{err}</p>}

        <div className="mt-7 flex gap-2">
          <button type="button" onClick={() => { setPhase('form'); setErr(null); }} disabled={busy}
            className="w-[96px] shrink-0 rounded-md border border-gray-200 py-5 text-lg font-medium disabled:opacity-40 dark:border-gray-700">
            돌아가기
          </button>
          <button type="button" onClick={finish} disabled={busy}
            className="flex-1 rounded-md bg-brand-red px-6 py-5 text-lg font-bold text-white hover:bg-brand-red-dark active:scale-[0.98] disabled:opacity-40">
            {busy ? '저장하는 중…' : edit ? '이대로 저장할래요' : '등록할래요'}
          </button>
        </div>
      </section>
    );
  }

  if (phase === 'done') {
    return (
      <section className="py-8 text-center">
        <p aria-hidden className="text-h1">🌱</p>
        <h1 className="mt-6 text-h2 font-bold">
          {edit ? '고쳤어요' : '등록해주셔서 고마워요'}
        </h1>
        <p className="mt-5 text-body-lg leading-relaxed text-gray-500">
          {edit
            ? '바꾸신 내용으로 저장했어요'
            : <>치료사들의 더 나은 미래를 위해<br />힘을 보태주셨어요</>}
        </p>
        <p className="mt-7 rounded-sm bg-gray-50 p-6 text-lg text-gray-500 dark:bg-gray-950">
          {edit
            ? <>올해 <b>{Math.max(0, (editsLeft ?? 2) - 1)}번</b> 더 고칠 수 있어요</>
            : <>적어 주신 내용은 <b>내 정보에서 1년에 2번</b> 고칠 수 있어요</>}
        </p>
        <button type="button" onClick={() => onDone()}
          className="mt-7 w-full rounded-md bg-brand-red px-6 py-5 text-lg font-bold text-white hover:bg-brand-red-dark active:scale-[0.98]">
          {edit ? '내 정보로 돌아가기' : '시작하기'}
        </button>
      </section>
    );
  }

  return (
    <section>
      {/* 진행 막대 — 몇 칸 남았는지 안 보이면 중간에 나갑니다 */}
      <div className="flex items-center gap-5">
        <div className="h-1 flex-1 rounded-md bg-gray-100 dark:bg-gray-800">
          <div className="h-1 rounded-md bg-teal-strong transition-[width]"
               style={{ width: `${(at / (steps.length - 1)) * 100}%` }} />
        </div>
        <span className="shrink-0 text-sm text-gray-400">{at + 1} / {steps.length}</span>
      </div>

      <h1 className="mt-6 text-h2 font-bold">{cur.title}</h1>
      {cur.sub && <p className="mt-2 text-lg text-gray-500">{cur.sub}</p>}

      <div className="mt-6">{cur.body}</div>

      {err && <p className="mt-5 text-lg text-brand-red">{err}</p>}

      <div className="mt-7 flex gap-2">
        {at > 0 && (
          <button type="button" onClick={() => go(at - 1)} disabled={busy}
            className="w-[96px] shrink-0 rounded-md border border-gray-200 py-5 text-lg font-medium disabled:opacity-40 dark:border-gray-700">
            이전
          </button>
        )}
        <button
          type="button"
          disabled={busy || blocked}
          onClick={() => (last ? setPhase('confirm') : go(at + 1))}
          className="flex-1 rounded-md bg-brand-red px-6 py-5 text-lg font-bold text-white hover:bg-brand-red-dark active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {blocked ? '위 칸을 채워 주세요' : last ? '다 됐어요' : at === 0 ? '채우러 가기' : '다음'}
        </button>
      </div>

      {at > 0 && !stu && <p className="mt-5 text-sm text-gray-400">{PRIVACY_LINE}</p>}
    </section>
  );
}

/* ── 칸들 ── */

/* 라벨은 한 줄에 하나씩 쌓습니다. 굵은 글씨·작은 힌트를 한 줄에 섞으면
   줄이 들쭉날쭉해져서 화면이 깨져 보입니다 */
function Label({ label, hint, req, k }: { label: string; hint?: string; req?: boolean; k?: string }) {
  const why = k ? FIELD_HINT[k] : undefined;
  return (
    <>
      <span className="block text-lg font-bold">
        {label}
        {req && <span className="ml-1 text-brand-red">*</span>}
      </span>
      {hint && <span className="mt-1 block text-sm text-gray-400">{hint}</span>}
      {why && <span className="mt-1 block text-sm text-teal-strong">{why}</span>}
    </>
  );
}

/* 모든 칸이 같은 자리에서 끝나야 합니다.
   단위(만원·년)를 칸 밖에 두면 그 줄만 짧아져서 네모가 제각각으로 보입니다 —
   그래서 테두리는 바깥 상자가 갖고, 단위는 그 안에 넣습니다 */
const SKIN = 'rounded-xs border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-950';
/* 단위가 붙는 칸 — 테두리는 이 상자가 갖습니다.
   폭은 INPUT 과 같은 이유로 여기서 안 정합니다 */
const BOX = `flex items-center ${SKIN} focus-within:outline-[3px] focus-within:outline-focus-ring focus-within:outline-offset-2`;
const BARE = 'min-w-0 flex-1 bg-transparent px-5 py-4 text-lg outline-none';
/* 틀린 칸은 테두리 색으로 알립니다 — teamsparta.md 는 오류에 빨강 배경을 금합니다 */
const BOX_BAD = BOX.replace('border-gray-200', 'border-brand-red').replace('dark:border-gray-700', 'dark:border-brand-red');
/* 단위가 없는 칸 (고르는 칸·여러 줄).
   폭은 여기서 안 정합니다 — w-full 을 넣어두면 줄 안에서 w-[88px] 과 부딪혀
   어느 쪽이 이길지 클래스 적는 순서로는 안 정해집니다. 쓰는 자리에서 정합니다 */
const INPUT = `block ${SKIN} px-5 py-4 text-lg`;

function Num({
  k, label, hint, v, on, unit, ph, step, req, f, noWhy,
}: {
  k: string; label: string; hint?: string; v?: string; on: (k: string, v: string) => void;
  unit?: string; ph?: string; step?: string; req?: boolean;
  /* 칸끼리 얽힌 규칙을 보려면 다른 칸도 필요합니다 (지금 병원 ≥ 첫 입사 등) */
  f?: Form;
  /* 묶음 안에서는 안내 줄을 끕니다 — 한 칸만 줄이 늘어 좌우가 어긋납니다 */
  noWhy?: boolean;
}) {
  const err = fieldError(k, v, f ?? {});
  const r = RANGE[k];
  const max = r ? (r.max === 0 ? (k === 'birth_year' ? THIS_YEAR - 15 : THIS_YEAR) : r.max) : undefined;

  return (
    <label className="mt-6 block first:mt-0">
      <Label label={label} hint={hint} req={req} k={noWhy ? undefined : k} />
      <span className={(err ? BOX_BAD : BOX) + ' mt-2 w-full'}>
        {/* min·max 를 달아두면 폰 자판이 먼저 걸러줍니다. 믿지는 않습니다 */}
        <input type="number" inputMode="decimal" step={step} value={v ?? ''} placeholder={ph}
          min={r?.min} max={max} aria-invalid={err ? true : undefined}
          onChange={(e) => on(k, e.target.value)} className={BARE} />
        {unit && <span className="shrink-0 pr-5 text-lg text-gray-400">{unit}</span>}
      </span>
      {/* 무엇이 틀렸는지 그 자리에서 적습니다 — 「다음」이 안 눌리는 이유가 보여야 합니다 */}
      {err && <span className="mt-1 block text-sm text-brand-red">{err}</span>}
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
    <label className="mt-6 block first:mt-0">
      <Label label={label} hint={hint} req={req} k={k} />
      <select value={v ?? ''} onChange={(e) => on(k, e.target.value)} className={INPUT + ' mt-2 w-full'}>
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
    <label className="mt-6 block first:mt-0">
      <Label label="최종 학력" req={req} k="school_type" />
      <select value={v ?? ''} onChange={(e) => on('school_type', e.target.value)} className={INPUT + ' mt-2 w-full'}>
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

/* 예·아니오를 둘 다 누르게 합니다.
   체크박스 하나로 두면 「안 눌렀다」가 「없다」인지 「아직 안 봤다」인지 모릅니다 */
function Two({
  k, label, hint, v, on, yes, no, req,
}: {
  k: string; label: string; hint?: string; v?: string; on: (k: string, v: string) => void;
  yes: string; no: string; req?: boolean;
}) {
  return (
    <div className="mt-6">
      <Label label={label} hint={hint} req={req} k={k} />
      <div className="mt-2 grid grid-cols-2 gap-2">
        {([['Y', yes], ['N', no]] as const).map(([val, text]) => (
          <button key={val} type="button" onClick={() => on(k, val)} aria-pressed={v === val}
            className={'rounded-md border py-5 text-lg font-medium transition-colors '
              + (v === val ? 'border-teal-strong bg-teal-strong text-white'
                           : 'border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-400')}>
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

/* 어학 점수 — 안 본 사람이 많습니다. 안 봤으면 안 봤다고 찍어야 넘어갑니다 */
function Lang({ f, patch }: { f: Form; patch: (p: Form) => void }) {
  const none = f.lang_none === 'Y';
  return (
    <div className="mt-6">
      {!none && (
        <Num k="lang_score" label="어학 점수" hint="토익 기준" v={f.lang_score}
          on={(k, v) => patch({ [k]: v })} unit="점" ph="800" req />
      )}
      <button type="button" aria-pressed={none}
        onClick={() => patch(none ? { lang_none: '' } : { lang_none: 'Y', lang_score: '' })}
        className={'mt-5 flex w-full items-center gap-5 rounded-sm border px-6 py-5 text-left transition-colors '
          + (none ? 'border-teal-strong bg-badge-teal-bg' : 'border-gray-200 dark:border-gray-700')}>
        <Tick on={none} />
        <span className="text-lg font-medium">어학 점수 없음</span>
      </button>
    </div>
  );
}

function Tick({ on }: { on: boolean }) {
  return (
    <span aria-hidden className={'flex size-[22px] shrink-0 items-center justify-center rounded-xs border text-white '
      + (on ? 'border-teal-strong bg-teal-strong' : 'border-gray-300 dark:border-gray-600')}>
      {on ? '✓' : ''}
    </span>
  );
}

function Area({
  k, label, hint, v, on, ph,
}: { k: string; label: string; hint?: string; v?: string; on: (k: string, v: string) => void; ph?: string }) {
  const n = (v ?? '').length;
  return (
    <label className="mt-6 block">
      <Label label={label} hint={hint} k={k} />
      <textarea rows={4} maxLength={300} value={v ?? ''} placeholder={ph}
        onChange={(e) => on(k, e.target.value)} className={INPUT + ' mt-2 w-full'} />
      <span className="mt-1 block text-right text-sm text-gray-400">{n} / 300</span>
    </label>
  );
}

/* 자격증·교육 — 묶음을 접었다 펴는 건 <details> 로 둡니다. 직접 만들 이유가 없어요.
   담기는 값은 옛 chips() 와 같게 '묶음 - 항목' 입니다 */
function Chips({
  label, hint, none, groups, picked, on,
}: {
  label: string; hint?: string; none: string;
  groups: ChipGroup[]; picked: string[]; on: (v: string[]) => void;
}) {
  const [etc, setEtc] = useState('');
  const noneOn = picked.includes(NONE);

  /* 「없음」과 다른 항목은 같이 못 고릅니다 */
  const toggle = (v: string) =>
    on(picked.includes(v) ? picked.filter((x) => x !== v) : [...picked.filter((x) => x !== NONE), v]);

  const known = new Set(groups.flatMap((g) => (g.s.length ? g.s.map((s) => `${g.n} - ${s}`) : [g.n])));
  const custom = picked.filter((p) => p !== NONE && !known.has(p));

  return (
    <div className={'mt-8 first:mt-0 ' + (noneOn ? 'opacity-60' : '')}>
      <Label label={label} hint={hint} req />
      <div className="mt-2 space-y-1">
        {groups.map((g) => g.s.length === 0 ? (
          <Chip key={g.n} on={picked.includes(g.n)} go={() => toggle(g.n)}>{g.n}</Chip>
        ) : (
          <details key={g.n} className="group rounded-sm border border-gray-200 dark:border-gray-700">
            {/* summary 를 flex 로 두면 브라우저가 그리던 삼각형이 사라집니다.
                열고 닫을 수 있다는 표시가 없으면 아무도 안 눌러서 직접 답니다 */}
            <summary className="flex cursor-pointer list-none items-center gap-3 px-6 py-4 text-lg font-medium">
              {/* 개수 대신 체크 표시 — 몇 개인지보다 골랐는지가 먼저 보여야 합니다 */}
              {picked.some((p) => p.startsWith(g.n + ' - ')) && (
                <span aria-label="고름"
                  className="flex size-[20px] shrink-0 items-center justify-center rounded-md bg-teal-strong text-sm text-white">
                  ✓
                </span>
              )}
              {g.n}
              <span aria-hidden className="ml-auto shrink-0 text-lg text-gray-400 transition-transform group-open:rotate-90">
                ›
              </span>
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
          placeholder={`목록에 없는 ${label}`} className={INPUT + ' min-w-0 flex-1'}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            const v = etc.trim();
            if (v && !picked.includes(v)) toggle(v);
            setEtc('');
          }} />
        <button type="button"
          onClick={() => { const v = etc.trim(); if (v && !picked.includes(v)) toggle(v); setEtc(''); }}
          className="shrink-0 rounded-md border border-gray-200 px-6 py-4 text-lg font-medium dark:border-gray-700">
          추가
        </button>
      </div>

      {/* 제일 아래 — 없으면 없다고 찍어야 넘어갑니다 */}
      <button type="button" aria-pressed={noneOn}
        onClick={() => on(noneOn ? [] : [NONE])}
        className={'mt-5 flex w-full items-center gap-5 rounded-sm border px-6 py-5 text-left transition-colors '
          + (noneOn ? 'border-teal-strong bg-badge-teal-bg' : 'border-gray-200 dark:border-gray-700')}>
        <Tick on={noneOn} />
        <span className="text-lg font-medium">{none}</span>
      </button>
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

/* 실습·경력 — 병원 이름은 안 받습니다. 유형·지역·개월만 (옛 drawRows 에 지역을 더한 것) */
function Rows({
  rows, on, none, noneOn, setNone,
}: {
  rows: WorkRow[]; on: (v: WorkRow[]) => void;
  none: string; noneOn: boolean; setNone: (b: boolean) => void;
}) {
  const edit = (i: number, patch: Partial<WorkRow>) =>
    on(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <div>
      <div className={noneOn ? 'opacity-60' : ''}>
        {rows.map((r, i) => (
          /* min-w-0 이 없으면 고르는 칸이 제 글자 길이만큼 버텨서
             줄 전체가 오른쪽으로 삐져나갑니다 */
          <div key={i} className="mt-5 rounded-sm border border-gray-100 p-5 first:mt-0 dark:border-gray-800">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-gray-400">{i + 1}번째</span>
              <button type="button" aria-label={`${i + 1}번째 줄 지우기`}
                onClick={() => on(rows.filter((_, j) => j !== i))}
                className="rounded-md px-4 py-1 text-sm text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-950">
                지우기
              </button>
            </div>
            <select value={r.hospital} onChange={(e) => edit(i, { hospital: e.target.value })}
              className={INPUT + ' mt-2 w-full'}>
              <option value="">병원 유형</option>
              {HOSPITALS.map((h) => <option key={h}>{h}</option>)}
            </select>
            <div className="mt-2 flex gap-2">
              <select value={r.region} onChange={(e) => edit(i, { region: e.target.value })}
                className={INPUT + ' min-w-0 flex-1'}>
                <option value="">지역</option>
                {REGIONS.map((x) => <option key={x}>{x}</option>)}
              </select>
              <span className={BOX + ' w-[124px] shrink-0'}>
                <input type="number" inputMode="numeric" placeholder="개월" value={r.months}
                  min={RANGE.months.min} max={RANGE.months.max}
                  onChange={(e) => edit(i, { months: e.target.value })} className={BARE} />
                <span className="shrink-0 pr-5 text-lg text-gray-400">개월</span>
              </span>
            </div>
          </div>
        ))}

        <button type="button" disabled={rows.length >= MAX_ROWS || noneOn}
          onClick={() => on([...rows, { hospital: '', region: '', months: '' }])}
          className="mt-5 w-full rounded-md border border-dashed border-gray-300 px-6 py-5 text-lg font-medium text-gray-500 disabled:opacity-40 dark:border-gray-600">
          {rows.length >= MAX_ROWS ? '최대 5개까지 넣을 수 있어요' : '+ 한 줄 추가'}
        </button>
      </div>

      {/* 제일 아래 — 없으면 없다고 찍어야 넘어갑니다 */}
      <button type="button" aria-pressed={noneOn}
        onClick={() => { setNone(!noneOn); if (!noneOn) on([]); }}
        className={'mt-5 flex w-full items-center gap-5 rounded-sm border px-6 py-5 text-left transition-colors '
          + (noneOn ? 'border-teal-strong bg-badge-teal-bg' : 'border-gray-200 dark:border-gray-700')}>
        <Tick on={noneOn} />
        <span className="text-lg font-medium">{none}</span>
      </button>
    </div>
  );
}

/* ── 급여 ──────────────────────────────────────────────── */

/* 라벨 줄 수가 달라 칸이 좌우로 어긋나던 것을 묶음으로 감싸 줄을 맞춥니다 */
function Group({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="mt-6 rounded-sm border border-gray-100 p-5 first:mt-0 dark:border-gray-800">
      <p className="text-lg font-bold">{title}</p>
      {hint && <p className="mt-1 text-sm text-gray-400">{hint}</p>}
      <div className="mt-2 grid grid-cols-3 gap-2 [&>label]:mt-0">{children}</div>
    </div>
  );
}

/* ① 고정 월급 (세전). 세전을 모르는 분이 많아 세후로 넣고 계산하는 길을 둡니다.
   어느 쪽으로 넣었는지는 pay_basis 로 DB 에 남깁니다 — 나중에 자료를 믿을지 말지의 근거입니다 */
function Gross({ f, patch }: { f: Form; patch: (p: Form) => void }) {
  const unsure = f.pay_unsure === 'Y';
  const net = Number(f.net_monthly);
  const dep = Math.max(1, Number(f.dependents) || 1);
  const canEstimate = unsure && Number.isFinite(net) && net > 0
    && !fieldError('net_monthly', f.net_monthly, f) && !fieldError('dependents', f.dependents, f);
  const guess = canEstimate ? 만원(grossFromNet(net * 10_000, dep)) : null;

  return (
    <div>
      <Num k="base_monthly" label="고정 월급" req unit="만원" ph="250"
        hint="근로계약서에 적힌 기본급이에요. 수당·상여는 빼고요"
        v={f.base_monthly} on={(k, v) => patch({ [k]: v, pay_basis: 'gross' })} f={f} />
      <p className="mt-1 text-sm text-gray-400">세전 — 세금·4대보험 떼기 전 금액이에요</p>

      <button type="button" aria-pressed={unsure}
        onClick={() => patch(unsure
          ? { pay_unsure: '', net_monthly: '', dependents: '' }
          : { pay_unsure: 'Y' })}
        className={'mt-5 flex w-full items-center gap-5 rounded-sm border px-6 py-5 text-left transition-colors '
          + (unsure ? 'border-teal-strong bg-badge-teal-bg dark:border-teal-strong/40 dark:bg-transparent'
                    : 'border-gray-200 dark:border-gray-700')}>
        <Tick on={unsure} />
        <span className="text-lg font-medium">세전을 모르겠어요</span>
      </button>

      {unsure && (
        <div className="mt-5 rounded-sm border border-gray-100 p-5 dark:border-gray-800">
          <Num k="net_monthly" label="세후(실수령) 월급" req unit="만원" ph="220"
            hint="통장에 들어오는 금액이에요"
            v={f.net_monthly} on={(k, v) => patch({ [k]: v })} f={f} />
          <Num k="dependents" label="부양가족 수" req unit="명" ph="1"
            hint="본인 포함이에요. 혼자면 1"
            v={f.dependents} on={(k, v) => patch({ [k]: v })} f={f} />

          {guess != null && (
            <>
              <p className={'mt-6 ' + PANEL}>
                세전 약 <b>{guess}만원</b>으로 보여요
                <span className="mt-1 block text-sm">
                  {RATE_YEAR}년 4대보험 요율과 국세청 세율로 계산했어요. 소득세는 간이세액표라 대략이에요
                </span>
              </p>
              <button type="button"
                onClick={() => patch({ base_monthly: String(guess), pay_basis: 'estimated' })}
                className="mt-5 w-full rounded-md bg-brand-red px-6 py-5 text-lg font-bold text-white hover:bg-brand-red-dark active:scale-[0.98]">
                이 값으로 넣을게요
              </button>
              <p className="mt-2 text-sm text-gray-400">넣고 나서 위 고정 월급 칸에서 고치셔도 돼요</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* 다 넣으면 그 자리에서 보여줍니다. 회원이 보고 고쳐야 자료가 정확해집니다 */
function PaySummary({ f }: { f: Form }) {
  const p = {
    base: Number(f.base_monthly), extra: Number(f.extra_pay_monthly), bonus: Number(f.bonus_yearly),
    dutyCount: Number(f.duty_count), dutyHours: Number(f.duty_hours), dutyPay: Number(f.duty_pay),
    weekendCount: Number(f.weekend_count), weekendHours: Number(f.weekend_hours),
    weekendPay: Number(f.weekend_pay),
  };
  if (!Number.isFinite(p.base) || p.base <= 0) return null;

  const year = annualTotal(p);
  const month = Math.round(year / 12);
  /* 실수령은 1인 가구 기준으로 통일합니다 — 사람마다 부양가족이 달라
     그대로 두면 서로 비교가 안 됩니다 */
  const net = 만원(netFromGross((month * 10_000), 1).net);
  const hour = hourlyWage(p);

  return (
    <section className="mt-7 rounded-sm border border-gray-200 p-6 dark:border-gray-700">
      <p className="text-sm font-bold text-gray-500">적어 주신 걸로 계산하면</p>
      <p className="mt-2 text-h1 font-bold">연 {man10(year)}</p>
      <dl className="mt-5 space-y-2 text-lg">
        <Line k="월 평균" v={`약 ${month}만원`} />
        <Line k="1인 가구 실수령" v={`약 ${net}만원`} />
        <Line k="시급" v={`약 ${hour.toLocaleString('ko-KR')}원`}
          note={`실제 일하는 ${monthlyHours(p)}시간 기준 · 당직·주말 포함`} />
      </dl>
      <p className="mt-5 text-sm text-gray-400">
        다르면 위 칸을 고쳐 주세요. {RATE_YEAR}년 요율 기준이고 소득세는 대략이에요
      </p>
    </section>
  );
}

function Line({ k, v, note }: { k: string; v: string; note?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-5">
      <dt className="shrink-0 text-gray-500">{k}</dt>
      <dd className="text-right">
        <b>{v}</b>
        {note && <span className="mt-1 block text-sm text-gray-400">{note}</span>}
      </dd>
    </div>
  );
}
