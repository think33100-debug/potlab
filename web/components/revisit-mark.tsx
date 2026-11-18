'use client';

import { useEffect } from 'react';
import { useAuth } from '@/app/auth';

/* 재방문 근사치 — 브라우저 자기보고 (2026-11-18 · 멘토-5-2 · 사업계획서 12/1).

   질문함 Q5(2026-11-04 세중님 승인) · RAPO노트/수집기/지표장치_1104.md 5번 그대로입니다 —
   **첫 방문일은 이 브라우저(localStorage)에만** 둡니다. 서버에는 날짜·이벤트 하나씩만 갑니다.
   회원 번호·첫 방문 날짜·주소는 보내지 않습니다.

   보내는 것 (/api/hit · kind 'revisit' · 한 이벤트에 한 번만)
     rv:first    첫 방문 날(D0)
     rv:backN    D1~D7 가운데 **처음** 다시 온 날 — N = 첫 방문에서 며칠 뒤 (한 번만)
     rv:d7       D7 **당일**에 왔다 (D1~D7 중 한 번과 따로 셉니다)

   이 값은 **근사치**입니다. 저장을 지우거나 기기·브라우저를 바꾸면 새 사람으로 셉니다.
   회원 유지율·정확한 사람 수로 부르지 않습니다.

   ── 지키는 것 ────────────────────────────────────────────
   · 로그인한 화면에서만 돕니다 (테스트 동안 화면은 로그인한 테스터만 봅니다)
   · 관리자도 보내되 admin 표시를 붙입니다 — 통계가 뺍니다 (components/hit.tsx 와 같은 결)
   · 저장이 막힌 창(시크릿·차단)은 **아무것도 안 보냅니다** — 기억을 못 하면 날마다 「첫 방문」이 됩니다
   · 같은 날 두 번·탭 여러 개 — 보내기 전에 「보내는 중」 도장을 먼저 찍고 다시 읽어 내 도장인지 봅니다
   · 실패하면 도장이 1분 뒤 풀려 다음에 다시 해 봅니다. 다만 날이 바뀌면 그 이벤트는 버립니다
     (어제 일을 오늘 보내면 날짜가 틀어집니다 — 묶음 날짜를 서버가 「받은 날 − N」으로 셉니다)
   · 첫 방문(rv:first)이 서버에 안 닿은 브라우저는 재방문도 안 보냅니다 — 분모 없는 분자를 막습니다
   · 한국 날짜로 셉니다. 기기 시계가 틀리면 그만큼 틀립니다 (근사치라 받아들입니다) */

const KEY = 'rapo.revisit';
const 도장수명 = 60_000;

type 기록 = { first: string; 보냄: Record<string, true | number> };

function 한국날(): string {
  return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
}

function 날차(앞: string, 뒤: string): number {
  return Math.round((Date.parse(뒤 + 'T00:00:00Z') - Date.parse(앞 + 'T00:00:00Z')) / 86_400_000);
}

/* undefined = 저장을 못 씀 · null = 기록 없음 */
function 읽기(): 기록 | null | undefined {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const r = JSON.parse(raw) as Partial<기록>;
    if (typeof r.first !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(r.first)) return null;
    return { first: r.first, 보냄: r.보냄 && typeof r.보냄 === 'object' ? r.보냄 : {} };
  } catch {
    return undefined;
  }
}

function 쓰기(r: 기록): boolean {
  try { localStorage.setItem(KEY, JSON.stringify(r)); return true; } catch { return false; }
}

/* 지금 보낼 이벤트들 */
function 보낼것(r: 기록, 오늘: string): string[] {
  const n = 날차(r.first, 오늘);
  const 할것: string[] = [];
  if (n === 0) 할것.push('first');
  if (n >= 1 && n <= 7 && r.보냄.first === true) {
    /* 재방문은 한 번만 — 다른 날 것을 이미 보냈거나 보내는 중이면 안 보냅니다 */
    const 앞재방문 = Object.keys(r.보냄).find((k) => k.startsWith('back'));
    if (!앞재방문 || 앞재방문 === 'back' + n) 할것.push('back' + n);
    if (n === 7) 할것.push('d7');
  }
  return 할것.filter((t) => {
    const v = r.보냄[t];
    return v !== true && !(typeof v === 'number' && Date.now() - v < 도장수명);
  });
}

async function 보내기(t: string, admin: boolean) {
  const r = 읽기();
  if (!r) return;

  /* 「보내는 중」 도장 — 다른 탭이 같은 것을 보내지 않게 */
  const 도장 = Date.now();
  r.보냄[t] = 도장;
  if (!쓰기(r)) return;
  if (읽기()?.보냄[t] !== 도장) return;   // 다른 탭이 먼저 찍었습니다

  let 됨 = false;
  try {
    const res = await fetch('/api/hit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'revisit', target: 'rv:' + t, admin }),
      keepalive: true,
    });
    됨 = res.ok;
  } catch {
    /* 조용히 넘어갑니다 — 도장이 1분 뒤 풀립니다 */
  }
  if (!됨) return;

  /* 서버가 받았습니다 — 다시 안 보내게 「보냄」으로 바꿉니다 */
  const 뒤 = 읽기();
  if (!뒤) return;
  뒤.보냄[t] = true;
  쓰기(뒤);
}

export function RevisitMark() {
  const { loading, who, isAdmin } = useAuth();

  useEffect(() => {
    if (loading || who !== '회원') return;

    const 살피기 = () => {
      if (document.visibilityState === 'hidden') return;
      const 오늘 = 한국날();
      let r = 읽기();
      if (r === undefined) return;               // 저장을 못 씀 → 아무것도 안 보냄
      if (r === null || 날차(r.first, 오늘) < 0) {
        /* 처음 온 브라우저 (또는 기기 시계가 뒤로 간 경우 — 새로 시작합니다) */
        r = { first: 오늘, 보냄: {} };
        if (!쓰기(r)) return;
      }
      for (const t of 보낼것(r, 오늘)) void 보내기(t, isAdmin);
    };

    살피기();
    document.addEventListener('visibilitychange', 살피기);
    return () => document.removeEventListener('visibilitychange', 살피기);
  }, [loading, who, isAdmin]);

  return null;
}
