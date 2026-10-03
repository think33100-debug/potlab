'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

/* 목록 거르기 줄 — 채용공고·교육·봉사·청년정책이 **같이 씁니다** (2026-10-04).

   ── 왜 한 부품인가 ──────────────────────────────────────────
   네 화면이 저마다 다른 꼴로 거르고 있었습니다. 칩이었다가 탭이었다가
   하니 회원이 화면마다 다시 배워야 합니다. 하나로 맞춥니다.

   ── 세중님이 정한 것 (2026-10-04) ───────────────────────────
   · 직군 드롭다운   기본 = 회원이 가입 때 고른 직군 · 비로그인은 「전체」
                    선택지는 전체 · 작업치료사 · 물리치료사
   · 지역 드롭다운   기본 = **전국** (회원 지역이 있어도 전국입니다)
   · 마감 체크박스   기본 꺼짐. 켜면 지난 것도 함께 보여줍니다
   · 고른 값은 **주소에 남깁니다** — 뒤로 가기·공유에서 유지됩니다
   · 봉사·청년정책처럼 직군 구분이 없는 화면은 직군 칸을 **숨깁니다**

   ── 색은 토큰만 ─────────────────────────────────────────────
   teamsparta.md 의 토큰만 씁니다. 화면마다 색을 새로 박지 않습니다.
   밝은 바탕 기준입니다 (커뮤니티만 어둡고 목록 화면은 전부 밝습니다).

   ponytail: 고르면 바로 주소가 바뀝니다. 「적용」 단추를 두지 않았습니다 —
   한 번 더 누르게 하는 만큼 값이 없습니다. */

export type 거르기값 = {
  job?: string;        // '작업치료사' | '물리치료사' | undefined(전체)
  sido?: string;       // 시·도 이름 | undefined(전국)
  past?: boolean;      // 마감된 것도 보기
};

/* 화면마다 다른 「고르는 칸 하나 더」.
   /edu 는 학회, /volunteer 는 분야, /youth 는 갈래가 들어갑니다.
   전에는 탭이 10개씩 늘어서서 휴대폰에서 두세 줄을 먹었습니다 */
export type 고름칸 = {
  이름: string;                 // 주소에 쓸 이름 — 'tab'
  전체말: string;               // '학회 전체' · '분야 전체'
  선택지: { 값: string; 글: string; 수?: number }[];
  고른값?: string;
};

export function ListFilters({
  기준,
  고름,
  시도들 = [],
  직군숨김 = false,
  지역숨김 = false,
  마감숨김 = false,
  마감말 = '마감된 것도',
  기본직군 = null,
  역할 = null,
  뿌리,
  남길값 = {},
}: {
  기준: 거르기값;
  고름?: 고름칸;
  /* 교육·학술처럼 **시·도 칸이 아예 없는** 자료는 지역을 숨깁니다.
     장소가 자유 글이라 거르는 칸으로 못 씁니다 — 없는 거르기를 보여주면
     「왜 걸러도 안 줄지?」 하고 헤맵니다 */
  시도들?: readonly string[];
  직군숨김?: boolean;
  지역숨김?: boolean;
  /* 교육기관 화면처럼 마감 개념이 없는 곳에서 체크박스를 숨깁니다 */
  마감숨김?: boolean;
  마감말?: string;
  /* 회원이 가입 때 고른 직군. 주소에 job 이 없을 때 **이것이 골라진 것처럼**
     보입니다. 비로그인이면 null 이라 「전체」가 됩니다 */
  기본직군?: string | null;
  /* '학생' | '현직'. 안내 글귀만 바꿉니다 —
     학생에게 「가입할 때 고른 작업치료사 공고」라고 하면 어색합니다 */
  역할?: string | null;
  뿌리: string;                       // '/jobs' · '/edu' · …
  남길값?: Record<string, string>;    // 탭·검색어처럼 함께 지킬 것
}) {
  const router = useRouter();

  const 가기 = useCallback((바꿀: 거르기값 & { 고름값?: string | null }) => {
    const 다음 = { ...기준, ...바꿀 };
    const q = new URLSearchParams();
    /* 화면마다 지켜야 할 값(검색어·차례)을 먼저 넣습니다 */
    for (const [k, v] of Object.entries(남길값)) if (v) q.set(k, v);
    if (다음.job) q.set('job', 다음.job);
    if (다음.sido) q.set('sido', 다음.sido);
    if (다음.past) q.set('past', '1');
    /* 고르는 칸 하나 더 — 바꾸지 않았으면 쓰던 값을 그대로 지킵니다 */
    if (고름) {
      const v = '고름값' in 바꿀 ? 바꿀.고름값 : 고름.고른값;
      if (v) q.set(고름.이름, v);
    }
    /* 조건을 바꾸면 쪽은 처음으로 — 3쪽 보다 지역을 바꾸면 빈 화면이 납니다 */
    const s = q.toString();
    router.push(s ? 뿌리 + '?' + s : 뿌리);
  }, [기준, 고름, 남길값, 뿌리, router]);

  const 칸 = 'rounded-xs border border-line bg-white px-4 py-3 text-lg text-ink'
    + ' focus:border-teal-strong focus:outline-none';

  return (
    <nav aria-label="거르기"
      className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-2">

      {!직군숨김 && (
        <label className="flex items-center gap-2">
          <span className="sr-only">직군</span>
          {/* ★ 가입 직군이 기본인 화면에서는 「전체 직군」에 **또렷한 값**이
              필요합니다. 빈 값으로 두면 주소에서 빠지고, 그러면 화면이 다시
              가입 직군으로 되돌려 버려 **고른 것이 무시됩니다.**
              그래서 기본직군이 있을 때만 '전체' 라고 적어 보냅니다 */}
          <select
            className={칸}
            value={기준.job ?? ''}
            onChange={(e) => 가기({ job: e.target.value || undefined })}
          >
            <option value={기본직군 ? '전체' : ''}>전체 직군</option>
            <option value="작업치료사">작업치료사</option>
            <option value="물리치료사">물리치료사</option>
          </select>
        </label>
      )}

      {!지역숨김 && (
      <label className="flex items-center gap-2">
        <span className="sr-only">지역</span>
        <select
          className={칸}
          value={기준.sido ?? ''}
          onChange={(e) => 가기({ sido: e.target.value || undefined })}
        >
          <option value="">전국</option>
          {시도들.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </label>
      )}

      {고름 && (
        <label className="flex items-center gap-2">
          <span className="sr-only">{고름.전체말}</span>
          <select
            className={칸}
            value={고름.고른값 ?? ''}
            onChange={(e) => 가기({ 고름값: e.target.value || null })}
          >
            <option value="">{고름.전체말}</option>
            {고름.선택지.map((o) => (
              <option key={o.값} value={o.값}>
                {o.글}{typeof o.수 === 'number' ? ` (${o.수})` : ''}
              </option>
            ))}
          </select>
        </label>
      )}

      {!마감숨김 && (
      <label className="flex cursor-pointer items-center gap-2 text-lg text-body">
        <input
          type="checkbox"
          className="size-5 accent-[--color-teal-strong]"
          checked={!!기준.past}
          onChange={(e) => 가기({ past: e.target.checked })}
        />
        {마감말}
      </label>
      )}

      {/* 비로그인에게 「기본이 내 직군」이라고 말해 두지 않으면,
          왜 작업치료사만 보이는지 모른 채 헤맵니다 */}
      {!직군숨김 && !기준.job && 기본직군 && (
        <span className="w-full text-sm text-mute">
          {역할 === '학생'
            /* 「작업치료사」에서 「사」를 떼면 전공 이름이 됩니다 */
            ? <>전공(<b>{기본직군.replace(/사$/, '')}</b>) 공고를 먼저 보여드립니다 — </>
            : <>가입할 때 고른 <b>{기본직군}</b> 공고를 먼저 보여드립니다 — </>}
          직군을 「전체」로 바꾸면 다 나옵니다
        </span>
      )}
    </nav>
  );
}
