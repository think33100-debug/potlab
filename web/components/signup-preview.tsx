'use client';

import type { Session } from '@supabase/supabase-js';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { AuthPreview, type Me } from '@/app/auth';
import Welcome from '@/app/welcome/page';
import { 가입시험끄기, 가입시험듣기, 가입시험중, 가입시험켜기, type 삼킨것 } from '@/lib/signup-dryrun';
import { 가입미리, type 가입미리갈래 } from '@/lib/signup-preview-context';
import { JOB_GROUPS } from '@/lib/who';

/* 관리자 가입 미리보기 (2026-11-17 세중님 「관리자 모드에서 회원가입 딱 시작하는 모드로 들어갈 수 있는 것 · 모든 직군」).

   ── 「딱 시작」은 어디인가 ───────────────────────────────────
   가입 화면에는 시작점이 둘 있습니다 — ㉠ 가입 줄(profiles)이 **아직 없는** 사람의 ① 이용 동의,
   ㉡ 닉네임까지 정하고 멈춘 사람의 ④ 학력. 여기는 **가장 앞인 ㉠**부터입니다.
   ㉡은 전부터 있는 페르소나 「가입중」(아래 띠)이 보여 줍니다.

   ── 어떻게 「새 회원」이 되나 ────────────────────────────────
   마스터 계정의 가입 줄을 진짜로 지우지 않습니다(지우면 동의 기록·회원 수가 움직입니다).
   가입 화면(app/welcome/page.tsx)을 **그대로** 가져와, 그 화면에만 「로그인은 했고 가입 줄은 없는 사람」이라고
   알려 줍니다(AuthPreview). 화면 밖(페르소나 띠 · 위쪽 줄)은 여전히 관리자입니다 — 그래서 나오면 바로 관리자입니다.

   ── 저장은 한 줄도 안 갑니다 ─────────────────────────────────
   도는 동안 lib/signup-dryrun.ts 가 브라우저의 쓰기를 전부 삼킵니다. 삼킨 것 가운데 셋만 여기서 받아
   **가짜 가입 줄**을 만듭니다 — 그래야 「가입하기 → 줄이 생김 → 다음 단계」가 진짜처럼 이어집니다.
     가입하기(창구)        닉네임·직군·역할로 가짜 줄을 만듦
     profiles 고치기        ②③으로 돌아가 직군·닉네임을 고친 것을 가짜 줄에 반영
     save_my_survey(창구)   가입 마침(survey_at)을 가짜 줄에 찍음
   가짜 줄은 가입 화면이 「다시 읽기」(reload)를 부를 때 넘어갑니다 — 진짜 흐름과 같은 차례입니다.

   ── 진짜와 다른 것 (세중님께 말씀드림) ───────────────────────
     · 닉네임 겹침 검사가 안 됩니다 — 겹치는지는 DB 가 저장하면서 알려 주는데 저장을 안 합니다
     · 「나가기」는 로그아웃 대신 이 고르는 화면으로 돌아옵니다
     · 다 마치고 「시작하기」를 누르면 홈으로 갑니다 — 그때는 관리자입니다 */

const 경험들 = ['없음', '있음'] as const;
const 경험말 = { 없음: '아직 일한 경험이 없어요', 있음: '일한 경험이 있어요' } as const;
const 갈래말 = (g: 가입미리갈래) => (g.직군 && g.경험 ? `${g.직군} · ${경험말[g.경험]}` : '처음 그대로');

/* 가짜 계정 번호 — 진짜 회원 번호와 같은 꼴(uuid)이어야 읽기 창구가 「그런 사람 없음」으로 조용히 답합니다 */
const 새아이디 = () => {
  try { return crypto.randomUUID(); } catch { /* 옛 브라우저 */ }
  return '00000000-0000-4000-8000-' + Math.random().toString(16).slice(2, 14).padEnd(12, '0');
};

export function SignupPreview() {
  const [갈래, set갈래] = useState<가입미리갈래 | null>(null);
  const [판, set판] = useState(0);
  const [알림, set알림] = useState<string | null>(null);

  const 시작 = (g: 가입미리갈래) => { set알림(null); set판((n) => n + 1); set갈래(g); window.scrollTo(0, 0); };
  const 나가기 = useCallback((말?: string) => { set갈래(null); set알림(말 ?? null); window.scrollTo(0, 0); }, []);

  if (갈래) return <Runner key={판} 갈래={갈래} 나가기={나가기} />;

  return (
    <div data-rapo className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col bg-(--rapo-color-bg-layer-default)">
      <header className="sticky top-0 z-20 flex h-[56px] shrink-0 items-center gap-(--rapo-dimension-x2) bg-(--rapo-color-bg-layer-default) px-(--rapo-dimension-x2)">
        <Link href="/admin" aria-label="관리자 화면으로"
          className="flex size-(--rapo-touch-min) shrink-0 items-center justify-center rounded-(--rapo-radius-r2) active:bg-(--rapo-color-bg-transparent-pressed)">
          {/* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 SVG 그대로 (가입 화면 머리와 같은 화살표) */}
          <img src="/rapo/detail/arrow-left-20.svg" alt="" width={20} height={20} />
        </Link>
        <p className="rapo-type-t5-bold min-w-0 flex-1 text-center text-(color:--rapo-color-fg-neutral)">가입 미리보기</p>
        <span aria-hidden className="size-(--rapo-touch-min) shrink-0" />
      </header>

      <main className="flex flex-1 flex-col gap-(--rapo-dimension-x5) px-(--rapo-dimension-x6) pt-(--rapo-dimension-x6) pb-[calc(var(--rapo-dimension-x13)+env(safe-area-inset-bottom))]">
        <div className="flex flex-col gap-(--rapo-dimension-x2)">
          <p className="rapo-type-t3-bold text-(color:--rapo-color-fg-brand-contrast)">운영진 전용</p>
          <h1 className="rapo-type-t11-bold break-keep text-(color:--rapo-color-fg-neutral)">가입 화면을<br />처음부터 따라가 봐요</h1>
          <p className="rapo-type-t4-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">
            새 회원이 로그인하고 처음 만나는 ‘이용 동의’부터 가입 완료까지, 회원이 보는 화면 그대로예요.
          </p>
        </div>

        {알림 && (
          <p role="status" className="rapo-type-t4-medium break-keep rounded-(--rapo-radius-r3) bg-(--rapo-color-bg-brand-weak) p-(--rapo-dimension-x4) text-(color:--rapo-color-fg-neutral)">
            {알림}
          </p>
        )}

        <p className="rapo-type-t4-regular break-keep rounded-(--rapo-radius-r3) bg-(--rapo-color-bg-neutral-weak) p-(--rapo-dimension-x4) text-(color:--rapo-color-fg-neutral-muted)">
          여기서 누르고 적은 것은 저장되지 않아요. 회원 수, 통계, 알림, 약관 동의 기록에 남지 않아요.
        </p>

        <section className="flex flex-col gap-(--rapo-dimension-x3)">
          <h2 className="rapo-type-t6-bold break-keep text-(color:--rapo-color-fg-neutral)">어느 회원으로 볼까요?</h2>
          <갈래단추 이름="처음 그대로" 덧="아무것도 고르지 않은 새 회원이에요. 직군과 경험은 가입 화면에서 직접 골라요." on={() => 시작({ 직군: null, 경험: null })} />
          {/* 가입 때 고를 수 있는 직군 전부(lib/who.ts JOB_GROUPS) × 근무 경험 둘 — 직군이 늘면 여기도 같이 늡니다 */}
          <div className="grid grid-cols-1 gap-(--rapo-dimension-x3) sm:grid-cols-2">
            {JOB_GROUPS.flatMap((직군) => 경험들.map((경험) => (
              <갈래단추 key={직군 + 경험} 이름={직군} 덧={경험말[경험]} on={() => 시작({ 직군, 경험 })} />
            )))}
          </div>
          <p className="rapo-type-t3-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">
            직군과 경험을 미리 골라 둔 채로 첫 화면부터 시작해요. 가는 길에 바꿔도 돼요.
          </p>
        </section>

        <Link href="/admin" className="rapo-type-t4-bold self-start py-(--rapo-dimension-x1) text-(color:--rapo-color-fg-neutral)">관리자 화면으로 ›</Link>
      </main>
    </div>
  );
}

/* 고르는 카드 — 가입 ②의 「경험 선택 카드」와 같은 꼴(진한 회색 테 · 오른쪽 ›) */
function 갈래단추({ 이름, 덧, on }: { 이름: string; 덧: string; on: () => void }) {
  return (
    <button type="button" onClick={on}
      className="flex items-center gap-(--rapo-dimension-x3) rounded-(--rapo-radius-r3) border-(length:--rapo-border-default) border-(color:--rapo-color-palette-navy-700)
                 px-(--rapo-dimension-x5) py-(--rapo-dimension-x5) text-left active:bg-(--rapo-color-bg-transparent-pressed)">
      <span className="min-w-0 flex-1">
        <span className="rapo-type-t6-bold block break-keep text-(color:--rapo-color-fg-neutral)">{이름}</span>
        <span className="rapo-type-t4-regular mt-(--rapo-dimension-x1_5) block break-keep text-(color:--rapo-color-fg-neutral-muted)">{덧}</span>
      </span>
      <span aria-hidden className="rapo-type-t8-regular shrink-0 text-(color:--rapo-color-fg-neutral)">›</span>
    </button>
  );
}

const 관리없음 = { 채용관리: false, 교육관리: false, 페르소나역할: null };

function Runner({ 갈래, 나가기 }: { 갈래: 가입미리갈래; 나가기: (말?: string) => void }) {
  const [아이디] = useState(새아이디);
  /* 삼킴 스위치가 켜진 **뒤에** 가입 화면을 그립니다 — 먼저 그리면 그 화면의 첫 동작이 진짜로 나갈 수 있습니다 */
  const 켜짐 = useSyncExternalStore(가입시험듣기, 가입시험중, () => false);
  const [me, setMe] = useState<Me | null>(null);
  const 가짜줄 = useRef<Me | null>(null);

  useEffect(() => {
    const 초안 = `rapo.signup.${아이디}`;
    가입시험켜기((x: 삼킨것) => {
      if (x.종류 === '로그아웃') {
        나가기('가입 화면에서 ‘나가기’를 눌렀어요. 진짜 회원은 여기서 로그아웃되고 로그인 화면으로 가요.');
        return;
      }
      if (x.종류 === 'rpc' && x.이름 === '가입하기') {
        const a = (x.값 ?? {}) as Record<string, unknown>;
        가짜줄.current = {
          id: 아이디, nickname: String(a.p_닉네임 ?? ''), avatar: (a.p_사진 as string | undefined) ?? null,
          job_group: (a.p_직군 as string | undefined) ?? null, role: (a.p_역할 as string | undefined) ?? null,
          nickname_changes: 0, survey_at: null, terms_version: (a.p_약관판 as string | undefined) ?? null,
        };
      } else if (x.종류 === '표' && x.이름 === 'profiles' && x.동작 === 'update' && 가짜줄.current) {
        const v = (x.값 ?? {}) as Record<string, unknown>;
        가짜줄.current = {
          ...가짜줄.current,
          ...(typeof v.nickname === 'string' ? { nickname: v.nickname } : {}),
          ...(typeof v.job_group === 'string' ? { job_group: v.job_group } : {}),
          ...(typeof v.role === 'string' ? { role: v.role } : {}),
        };
      } else if (x.종류 === 'rpc' && x.이름 === 'save_my_survey' && 가짜줄.current) {
        가짜줄.current = { ...가짜줄.current, survey_at: new Date().toISOString() };
      }
    });
    return () => {
      가입시험끄기();
      /* 가입 화면이 이 기기에 남기는 초안(가짜 번호 이름)을 치웁니다 */
      try { localStorage.removeItem(초안); } catch { /* 사생활 보호 창 */ }
    };
  }, [아이디, 나가기]);

  const reload = useCallback(async () => { setMe(가짜줄.current); }, []);
  const signOut = useCallback(async () => { 나가기(); }, [나가기]);

  /* 로그인은 했고 가입 줄은 아직 없는 사람 — 가입 화면이 읽는 것은 번호와 메일뿐입니다 */
  const session = useMemo(() => ({ user: { id: 아이디, email: null } }) as unknown as Session, [아이디]);

  return (
    <>
      <div data-rapo className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-x-(--rapo-dimension-x3) gap-y-(--rapo-dimension-x1) bg-(--rapo-color-bg-navy-solid) px-(--rapo-dimension-x4) py-(--rapo-dimension-x2)">
        <p className="rapo-type-t3-regular min-w-0 flex-1 break-keep text-(color:--rapo-color-fg-on-navy-solid)">
          <b className="rapo-type-t3-bold">가입 미리보기</b> <span className="whitespace-nowrap">저장되지 않아요</span>
          <span className="block opacity-80">{갈래말(갈래)}</span>
        </p>
        <button type="button" onClick={() => 나가기()}
          className="rapo-type-t3-bold shrink-0 rounded-(--rapo-radius-full) border-(length:--rapo-border-default) border-(color:--rapo-color-fg-on-navy-solid) px-(--rapo-dimension-x3) py-(--rapo-dimension-x1) text-(color:--rapo-color-fg-on-navy-solid)">
          다시 고르기
        </button>
      </div>
      {켜짐 ? (
        <가입미리.Provider value={갈래}>
          <AuthPreview value={{ session, me, isAdmin: false, 관리: 관리없음, who: '회원', 설문: me?.survey_at ? '마침' : '안마침', reload, signOut }}>
            <Welcome />
          </AuthPreview>
        </가입미리.Provider>
      ) : (
        <main data-rapo className="mx-auto w-full max-w-3xl bg-(--rapo-color-bg-layer-default) px-(--rapo-dimension-x6) py-(--rapo-dimension-x6)">
          <p className="rapo-type-t4-regular text-(color:--rapo-color-fg-neutral-muted)">잠시만요…</p>
        </main>
      )}
    </>
  );
}
