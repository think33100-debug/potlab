import type { Metadata } from 'next';
import Link from 'next/link';

import { RapoBottomNav } from '@/components/rapo/rapo-bottom-nav';
import { RapoEduFilter, RapoEduPastToggle, RapoEduRow, RapoEduTop } from '@/components/rapo/rapo-edu';
import { RapoPagination } from '@/components/rapo/rapo-ui';
import { 기관그림 } from '@/lib/rapo-home';
import { serverSupabase, serverWho } from '@/lib/supabase-server';
import { 교육지났나 } from '@/lib/edu-state';
import { todayKst } from '@/lib/job-state';

/* 교육·학술 (2026-10-03).

   ── 왜 있나 ──────────────────────────────────────────────────
   스펙쌓기의 「이수 교육」 칸은 학회와 과정을 **고를 수만** 있었습니다.
   언제 어디서 열리는지가 앱 어디에도 없어서, 회원은 학회 홈페이지를
   하나씩 돌아야 했습니다. 그걸 한자리에 모읍니다.

   ── 자료가 어디서 오나 ────────────────────────────────────────
   `tools/collect-edu.mjs` 가 학회 게시판을 긁어 Supabase 에 담고,
   이 화면은 담긴 것만 읽습니다 (`교육목록()` · `교육셈()`).

   ── 긁는 곳을 왜 이 넷뿐인가 (robots.txt) ─────────────────────
   `robots.txt` 로 막힌 곳은 긁지 않는다는 규칙이 있습니다.
     ○ dysphagia.co.kr · ksdr.or.kr   robots.txt 없음
     ○ kdys.or.kr                     「allow: /」
     △ cogsociety.org                 교육·공지 길이 다 막혀 있어
       **허락된 첫 화면에 실린 제목·날짜만** 담습니다
     ✗ kaot.org (작업치료사협회)       「Disallow: /」 전면 → 안 긁습니다
   이 넷은 전부 COURSES_OT(작업치료) 쪽 학회입니다.
   **물리치료 쪽 학회는 아직 하나도 안 붙였습니다** — 화면에 그렇게 적습니다.

   ── 탭을 왜 학회로 묶었나 ─────────────────────────────────────
   「이수 교육」 칸이 학회 단위로 되어 있어서입니다
   (web/lib/signup-fields.ts 의 COURSES_OT). 그래서 `출처` 는 그 목록의
   학회 이름과 **글자 그대로 같습니다.** 함부로 고치면 이어지지 않습니다.

   ── 로그인 없이 봅니다 ────────────────────────────────────────
   학회가 공개한 교육 안내이고 개인정보가 한 칸도 없습니다.
   /volunteer · /orgs 와 같은 결입니다.

   ── 새 디자인 (2026-11-12) ───────────────────────────────────
   「U12 · 과정 목록」 1377:37059 — 넣은 것·뺀 것은 components/rapo/rapo-edu.tsx 머리에 있습니다.
   자료를 읽는 길(교육목록 · 교육셈 · 지난 교육 거르기)은 그대로입니다. */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '교육·학술 · RAPO',
  description: '학회 교육과정과 학술대회를 한자리에서 봅니다. 신청은 각 학회에서 합니다',
};

/* 학회 이름은 COURSES_OT · COURSES_PT 와 **글자 그대로 같아야** 합니다.
   주소에는 짧은 이름표를 씁니다 — 한글은 주소에서 아홉 배로 부풉니다.

   ★ 보바스는 고르는 목록에서 작업치료 쪽이 「보바스」, 물리치료 쪽이
     「한국보바스협회」인데 **같은 단체**입니다. 그래서 직군을 「공통」으로
     담아 양쪽 탭에 다 나옵니다. */
const TABS = [
  { key: 'all', label: '전체', 출처: null as string | null, 직군: null as string | null },
  { key: 'dys', label: '연하재활', 출처: '대한연하재활학회', 직군: '작업치료사' },
  { key: 'kdys', label: '연하장애', 출처: '대한연하장애학회', 직군: '작업치료사' },
  { key: 'cog', label: '인지재활', 출처: '대한인지재활학회', 직군: '작업치료사' },
  { key: 'drv', label: '운전재활', 출처: '한국운전재활학회', 직군: '작업치료사' },
  { key: 'bob', label: '보바스', 출처: '한국보바스협회', 직군: '공통' },
  { key: 'omt', label: '정형도수', 출처: '대한정형도수물리치료학회', 직군: '물리치료사' },
  { key: 'pnf', label: 'PNF', 출처: '대한고유수용성신경근촉진법학회', 직군: '물리치료사' },
  { key: 'ke', label: '칼텐본', 출처: '칼텐본-에비언스학회', 직군: '물리치료사' },
  { key: 'aqua', label: '수중치료', 출처: '국제수중치료협회', 직군: '물리치료사' },
];

/* 직군 줄 — 세중님 지시 (2026-10-03). 「공통」은 양쪽에 다 보입니다 */
const JOBS = [
  { key: 'all', label: '전체', 직군: null as string | null },
  { key: 'ot', label: '작업치료', 직군: '작업치료사' },
  { key: 'pt', label: '물리치료', 직군: '물리치료사' },
];

/* robots.txt 가 긁기를 막은 곳 — **모으지 않고 링크만 겁니다** (세중님 결정).
   둘 다 교육 안내가 살아 있는 곳이라, 길은 열어 두고 자료는 안 가져옵니다 */
const 링크만 = [
  { 이름: '한국작업치료사협회', 주소: 'http://www.kaot.org/board/index.jsp?code=course_notice', 직군: '작업치료사' },
  { 이름: '국제의과학아카데미 (INDT)', 주소: 'https://www.imsacademy.net/Edu_Notice', 직군: '물리치료사' },
];

type SP = { tab?: string; job?: string; p?: string; past?: string };

type 줄 = {
  번호: string; 출처: string; 직군: string; 갈래: string; 제목: string;
  시작: string | null; 끝: string | null; 장소: string | null;
  모집인원: string | null; 상태: string | null;
  올린날: string | null; 링크: string;
};

const 날 = (s: string) => {
  const [, m, d] = s.split('-');
  return Number(m) + '월 ' + Number(d) + '일';
};

/* 「2026-10-17 ~ 2026-10-18」 을 「10월 17일~18일」 로.
   날짜가 없으면 올린 날을 「올린 날」 로 밝혀 보여줍니다 —
   교육 날짜인 척 보여주면 회원이 날짜를 잘못 적습니다 */
function 날쓰기(v: 줄) {
  if (!v.시작) return v.올린날 ? { 글: 날(v.올린날), 꼬리: '올림' } : null;
  if (!v.끝 || v.끝 === v.시작) return { 글: 날(v.시작), 꼬리: '' };
  const [, m1] = v.시작.split('-');
  const [, m2, d2] = v.끝.split('-');
  return {
    글: 날(v.시작) + '~' + (m1 === m2 ? Number(d2) + '일' : 날(v.끝)),
    꼬리: '',
  };
}

export default async function Edu({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const page = Math.max(0, Number(sp.p ?? 0) || 0);
  const 지난것 = sp.past === '1';

  const sb = await serverSupabase();

  /* 직군 기본값 = 회원이 가입 때 고른 직군 (세중님 결정 2026-10-04).
     주소의 job 이 먼저이고, '전체' 는 또렷하게 「전부 보기」입니다 */
  /* ★ profiles 를 직접 읽으면 안 됩니다 — authenticated 에게 SELECT 권한이
     없어서 늘 빈 값이 옵니다. 정식 통로는 내프로필() 입니다 (2026-10-04) */
  let 내직군: string | null = null;
  if (await serverWho(sb) === '회원') {
    const { data } = await sb.rpc('내프로필');
    const 나 = ((data ?? []) as { job_group?: string | null }[])[0];
    내직군 = 나?.job_group ?? null;
  }
  const 고른직군 = sp.job === '전체' ? null : (sp.job ?? 내직군);

  /* 직군을 고르면 그 직군 학회만 탭에 둡니다. 「공통」(보바스)은 양쪽에 */
  const 보일탭 = TABS.filter((t) => !고른직군 || t.직군 === null
    || t.직군 === 고른직군 || t.직군 === '공통');
  /* 직군을 바꾸면 안 보이는 학회가 골라져 있을 수 있습니다 — 그러면 전체로 */
  const tab = 보일탭.find((t) => t.key === sp.tab) ?? 보일탭[0];

  /* 탭마다 건수를 보여줍니다. 교육셈() 이 int 하나만 주므로 탭 수만큼 부릅니다 —
     표가 작아서(백여 건) 이게 뷰를 새로 만드는 것보다 쌉니다 */
  const [목록, ...셈들] = await Promise.all([
    sb.rpc('교육목록', { p_직군: 고른직군, p_출처: tab.출처, p_지난것: 지난것, p_page: page }),
    ...보일탭.map((t) => sb.rpc('교육셈', { p_직군: 고른직군, p_출처: t.출처, p_지난것: 지난것 })),
  ]);

  /* ★ 2026-10-28 세중님 1번 — **지난 교육을 내립니다.**
     교육 113건 가운데 끝 날짜가 있는 것이 3건뿐이라, 창구의 `끝 is null` 울타리에
     105건이 걸려 영영 목록에 남았습니다. 규칙은 lib/edu-state.ts 한 자리입니다 —
     끝 → 시작 → **담은 날 +30일**, 셋 다 모르면 안 내립니다.
     ⚠ 창구(교육목록)는 **그대로**입니다 — 여기서 걸러서 **한 쪽의 건수가 들쭉날쭉**
       할 수 있습니다. 창구까지 고치는 안은 docs/승인대기_1025.md 에 올려 뒀습니다 */
  const 받은것 = (목록.data ?? []) as unknown as 줄[];
  const rows = 지난것 ? 받은것 : 받은것.filter((v) => !교육지났나(v, todayKst()));
  const 셈 = Object.fromEntries(보일탭.map((t, i) => [t.key, (셈들[i]?.data as number | null) ?? 0]));

  const 링크칸 = 링크만.filter((x) => !고른직군 || x.직군 === 고른직군);

  const 길 = (next: Partial<SP>) => {
    const q = new URLSearchParams();
    const t = next.tab ?? sp.tab;
    const j = next.job ?? sp.job;
    const pa = next.past ?? sp.past;
    if (j && j !== 'all') q.set('job', j);
    if (t && t !== 'all') q.set('tab', t);
    if (pa === '1') q.set('past', '1');
    if (next.p && next.p !== '0') q.set('p', next.p);
    const s = q.toString();
    return '/edu' + (s ? '?' + s : '');
  };

  /* 직군 칩 — 회원이 가입 때 고른 직군이 기본입니다. 「전체」는 job=전체 로 적습니다 */
  const 직군선택지 = JOBS.map((j) => ({
    글: j.label,
    주소: 길({ job: j.직군 ?? '전체', tab: 'all', p: '0' }),
    켜짐: (j.직군 ?? null) === 고른직군,
  }));
  const 기관선택지 = 보일탭.map((t) => ({
    글: t.key === 'all' ? '학회 전체' : t.label,
    주소: 길({ tab: t.key, p: '0' }),
    켜짐: t.key === tab.key,
    수: 셈[t.key],
  }));
  const 직군글 = JOBS.find((j) => j.직군 === 고른직군 && j.직군)?.label ?? null;
  const 건수 = 셈[tab.key] ?? 0;

  return (
    <div data-rapo className="mx-auto min-h-dvh w-full max-w-3xl bg-(--rapo-color-bg-layer-default)">
      <RapoEduTop />
      <main className="px-(--rapo-dimension-x5) pb-(--rapo-dimension-x8)">
        {/* 조건 — 직군 · 기관(학회) */}
        <div className="flex flex-wrap gap-(--rapo-dimension-x2) pt-(--rapo-dimension-x4)">
          <RapoEduFilter icon="/rapo/list/briefcase-16.svg" label="직군" 고른것={직군글} 선택지={직군선택지} />
          <RapoEduFilter icon="/rapo/edu/academy-16.svg" label="기관" 고른것={tab.key === 'all' ? null : tab.label} 선택지={기관선택지} />
        </div>

        <div className="flex items-center justify-between gap-(--rapo-dimension-x3) pt-(--rapo-dimension-x2)">
          <h2 className="text-[20px] font-bold leading-[22px] text-(color:--rapo-brand-color-navy)">교육 목록 {건수}건</h2>
          <RapoEduPastToggle on={지난것} href={길({ past: 지난것 ? '0' : '1', p: '0' })} />
        </div>

        {목록.error && (
          <p role="alert" className="rapo-type-t4-regular mt-(--rapo-dimension-x4) rounded-(--rapo-radius-r2) bg-(--rapo-brand-color-blush) p-(--rapo-dimension-x4) text-[#b42a21]">
            교육 목록을 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.
          </p>
        )}

        {!목록.error && rows.length === 0 && (
          <div className="flex flex-col items-center gap-(--rapo-dimension-x3) py-(--rapo-dimension-x12) text-center">
            <p className="rapo-type-t6-bold text-(color:--rapo-brand-color-navy)">{지난것 ? '모아 둔 교육이 없어요' : '지금 열려 있는 교육이 없어요'}</p>
            {!지난것 && (
              <Link href={길({ past: '1', p: '0' })} className="rapo-type-t4-bold flex h-(--rapo-touch-min) items-center text-[#b42a21] underline underline-offset-4">
                종료된 일정까지 보기
              </Link>
            )}
          </div>
        )}

        <ul>
          {rows.map((v) => {
            const d = 날쓰기(v);
            /* 날짜가 없으면 올린 날을 「게시」로 밝힙니다 — 교육 날짜인 척 보이지 않게 (원본 「9월 14일 게시」) */
            const 날짜 = d ? (d.꼬리 ? `${d.글} 게시` : d.글) : '교육일은 학회에서 확인';
            return (
              <li key={v.번호}>
                <RapoEduRow href={v.링크} 기관={v.출처} 그림={기관그림(v.출처)} 제목={v.제목}
                  날짜={<>{날짜}{v.장소 && <>&nbsp;&nbsp;&nbsp;{v.장소}</>}</>} />
              </li>
            );
          })}
        </ul>

        {/* 쪽 넘기기 — 한 쪽 20건입니다 (교육목록() 과 같아야 합니다) */}
        <div className="pt-(--rapo-dimension-x4)">
          <RapoPagination page={page} pages={Math.max(1, Math.ceil(건수 / 20))} href={(p) => 길({ p: String(p) })} />
        </div>

        {/* 출처와 한계 — 원본에 없지만 지침 15절대로 맨 아래에 작게 둡니다 */}
        <section aria-label="자료 안내" className="rapo-type-t3-regular mt-(--rapo-dimension-x6) flex flex-col gap-(--rapo-dimension-x2) rounded-(--rapo-radius-r3) bg-(--rapo-color-bg-neutral-weak) p-(--rapo-dimension-x4) text-[#3f4c57]">
          <p className="break-keep">학회 홈페이지에 공개된 안내를 모았어요. <b>신청·문의는 학회에서</b> 해 주세요.</p>
          <p className="break-keep">대한인지재활학회는 홈페이지가 수집을 막아 두어 첫 화면의 제목과 날짜만 가져와요.</p>
          {링크칸.length > 0 && (
            <p className="break-keep">
              수집을 막아 둔 곳은 직접 들어가서 보세요 —{' '}
              {링크칸.map((x, i) => (
                <span key={x.주소}>
                  {i > 0 && ' · '}
                  <a href={x.주소} target="_blank" rel="noopener noreferrer" className="font-bold underline underline-offset-4">{x.이름}</a>
                </span>
              ))}
            </p>
          )}
          <p><Link href="/edu/org" className="font-bold underline underline-offset-4">교육기관으로 보기</Link></p>
        </section>
      </main>
      <div aria-hidden style={{ height: 'calc(73px + env(safe-area-inset-bottom))' }} />
      <RapoBottomNav current="/" />
    </div>
  );
}
