import type { Metadata } from 'next';
import Link from 'next/link';

import { EduOrgCard, type 기관 } from '@/components/edu-org-card';
import NotifyToggle from '@/components/notify-toggle';
import { RapoEduFilter } from '@/components/rapo/rapo-edu';
import { RapoPageFrame, 틀 } from '@/components/rapo/rapo-frame';
import { serverSupabase, serverWho } from '@/lib/supabase-server';

/* 교육기관 보기 (2026-10-04).

   병원 정보 찾기(/orgs)처럼 **기관을 한 장씩** 보여줍니다.
   교육 목록(/edu)이 「무슨 교육이 열렸나」라면, 여기는 「어디서 배우나」입니다.

   ⚷ 남의 누리집 로고를 가져오지 않습니다 — 대표 그림은 관리자가 올린
     것만 쓰고, 없으면 이름 글자로 된 기본 카드가 나갑니다.

   로그인 없이 봅니다. 알림 종만 로그인이 필요합니다.

   ── 새 틀 (2026-11-16) ───────────────────────────────────────
   세중님 테스터 점검 — /edu 「교육기관으로 보기」를 누르면 옛 위쪽 줄(POTJOB 로고)이 나왔습니다.
   피그마에 이 화면이 없어 /compete·/contact 와 같은 규칙(앱 바 · 토큰 · rapo 조각)으로 옮겼습니다.
   직군 고르기는 옛 드롭다운(ListFilters) 대신 교육 목록과 같은 칩(RapoEduFilter) — 주소(?job=)는 그대로입니다. */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '교육기관 · RAPO',
  description: '학회·협회가 어떤 교육을 여는지 한자리에서 봅니다',
};

type SP = { job?: string };

const 직군들 = [
  { 글: '전체', 직군: null as string | null },
  { 글: '작업치료', 직군: '작업치료사' },
  { 글: '물리치료', 직군: '물리치료사' },
];

export default async function EduOrgs({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const sb = await serverSupabase();

  /* ★ 이 화면만 직군 기본값을 **안 겁니다** (2026-10-04 고침).

     공고·교육 목록은 수백~수천 건이라 가입 직군으로 먼저 좁히는 게 맞습니다.
     그런데 여기는 **기관이 11곳뿐인 주소록**입니다. 직군을 걸면 6곳만 남아
     절반이 사라집니다 — 세중님이 로그인해서 열었을 때 그게 났습니다.
     「어디서 배우나」를 보는 화면에서 절반을 감출 이유가 없습니다.

     고르는 칩은 그대로 둡니다. 좁혀 보고 싶으면 직접 고르면 됩니다. */
  const 회원인가 = await serverWho(sb) === '회원';
  const 고른직군 = sp.job === '전체' ? null : (sp.job ?? null);

  const [목록, 내알림] = await Promise.all([
    sb.rpc('교육기관목록', { p_직군: 고른직군 }),
    회원인가 ? sb.rpc('내교육기관알림') : Promise.resolve({ data: [] }),
  ]);

  const rows = (목록.data ?? []) as unknown as 기관[];
  const 켠것 = new Set(((내알림.data ?? []) as { 기관: string }[]).map((x) => x.기관));
  /* 카드가 「최근」인지 「다음 일정」인지 가리는 데 씁니다.
     서버에서 재서 내려보냅니다 — 카드 안에서 재면 서버와 화면의 날짜가
     어긋나 리액트가 한 번 다시 그립니다 */
  const 오늘 = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);

  const 직군선택지 = 직군들.map((j) => ({
    글: j.글,
    주소: j.직군 ? '/edu/org?job=' + encodeURIComponent(j.직군) : '/edu/org',
    켜짐: j.직군 === 고른직군,
  }));
  const 직군글 = 직군들.find((j) => j.직군 && j.직군 === 고른직군)?.글 ?? null;

  return (
    <RapoPageFrame title="교육기관" back="/edu" nav="/toolkit">
      <section className="flex flex-col gap-(--rapo-dimension-x2)">
        <p className={틀.흐린글}>
          학회·협회가 어떤 교육을 여는지 봅니다. <b>신청은 각 기관에서</b> 합니다
        </p>
        <div className="flex flex-wrap items-center gap-(--rapo-dimension-x2)">
          <RapoEduFilter icon="/rapo/list/briefcase-16.svg" label="직군" 고른것={직군글} 선택지={직군선택지} />
        </div>
        <p className={틀.흐린글}>
          <b className="text-(color:--rapo-color-fg-neutral) whitespace-nowrap">{rows.length}곳</b>
          {' · '}
          <Link href="/edu" className={틀.링크}>교육 목록으로 보기</Link>
        </p>
      </section>

      {목록.error && (
        <p role="alert" className={틀.오류칸}>
          불러오지 못했어요 — {목록.error.message}
          <span className="rapo-type-t3-regular mt-(--rapo-dimension-x1) block">app/edu/org/page.tsx · 교육기관목록()</span>
        </p>
      )}

      <ul className="flex flex-col gap-(--rapo-dimension-x3)">
        {rows.map((o) => (
          <li key={o.이름}>
            <EduOrgCard o={o} 켜짐={켠것.has(o.이름)} 로그인했나={회원인가} 오늘={오늘} />
          </li>
        ))}
      </ul>

      {/* 종만 켜면 아무것도 안 옵니다 — 이 기기를 등록해야 보냅니다.
          그 둘이 다른 일이라는 것을 글로 밝힙니다 (2026-10-04) */}
      {회원인가 && 켠것.size > 0 && (
        <div className={틀.회색칸 + ' flex flex-col gap-(--rapo-dimension-x2)'}>
          <p className={틀.글}>
            알림 켠 기관이 <b>{켠것.size}곳</b>이에요. 실제로 받으려면
            <b> 이 기기</b>에서 알림을 한 번 허용해 주세요
          </p>
          <p className={틀.작은글}>
            켠 뒤에 올라오는 교육만 보냅니다. 밤 10시~아침 7시에는 안 보냅니다
          </p>
          <div><NotifyToggle /></div>
        </div>
      )}

      <p className={틀.회색칸 + ' ' + 틀.작은글}>
        기관 소개와 대표 그림은 <b>관리자가 넣은 것</b>입니다.
        남의 누리집 로고를 가져오지 않습니다.
        <br />
        <b>대한작업치료사협회</b>와 <b>국제의과학아카데미</b>는 홈페이지가 자동
        수집을 막아 두어 교육을 모으지 않습니다 — 누르면 그 기관 화면으로 갑니다.
      </p>
    </RapoPageFrame>
  );
}
