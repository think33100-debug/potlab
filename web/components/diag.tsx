'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { useAuth } from '@/app/auth';

/* 회원인데 가입 권유가 뜨는 것을 가리는 진단판입니다 (2026-09-25).

   ── 왜 주소에 ?진단=1 로 켜나 ────────────────────────────────
   「관리자에게만」 보이게 하고 싶었지만 그럴 수가 없습니다.
   **관리자인지 아는 방법이 바로 지금 고장난 그 판정**입니다.
   서버가 회원을 비회원으로 보고 있다면 진단판도 같이 안 보입니다.
   그래서 주소로 켭니다 — 고장난 판정에 기대지 않는 유일한 방법입니다.

   값은 아무것도 안 새어 나갑니다. 쿠키 값·토큰·사람 id 를 안 찍고
   「있음/없음」과 개수만 찍습니다. 캡처해서 주고받을 것이라 그렇습니다.

   켜는 법 — 주소 끝에 ?진단=1 을 붙입니다
     …/orgs?진단=1        …/jobs/<번호>?진단=1

   ── 무엇을 보나 ──────────────────────────────────────────────
   서버 판정과 화면 판정을 **나란히** 놓습니다. 둘이 다르면 쿠키 문제,
   둘 다 「회원」인데 벽이 서 있으면 그 벽을 그린 부품 문제입니다.
   그래서 벽마다 DiagTag 로 이름을 달아 뒀습니다. */

/* 주소에 ?진단= 이 있나.

   useSearchParams 를 안 쓰는 이유 — 그걸 쓰면 정적으로 굽던 화면까지
   Suspense 를 요구합니다. 진단을 넣느라 화면 성질을 바꾸면 「나」(캐시) 를
   못 봅니다. 실제로 이 판을 넣은 뒤에도 /pay 는 그대로 정적입니다.

   useSyncExternalStore 를 쓰는 이유 — 주소는 React 밖의 값입니다.
   effect 에서 setState 하면 한 번 더 그려지고, 서버가 그린 것과 달라져
   경고가 납니다. 서버에서는 무조건 false(세 번째 인자)라 어긋나지 않습니다. */
const 안바뀜 = () => () => {};

export function useDiag(): boolean {
  return useSyncExternalStore(
    안바뀜,
    () => { try { return new URLSearchParams(location.search).has('진단'); } catch { return false; } },
    () => false,
  );
}

/* 브라우저가 지금 가지고 있는 쿠키. 값은 안 찍고 이름으로 갈라 세기만 합니다.
   서버 것(lib/diag-server.ts)과 **같은 규칙**이어야 나란히 놓고 볼 수 있습니다 */
function 내쿠키(): string {
  try {
    const raw = document.cookie;
    const 이름들 = raw ? raw.split(';').map((c) => c.trim().split('=')[0]) : [];
    const 세션 = 이름들.filter((n) => /^sb-.*-auth-token(.d+)?$/.test(n)).length;
    const 쪽지 = 이름들.filter((n) => n.startsWith('sb-') && n.includes('code-verifier')).length;
    return `${세션 ? '있음' : '없음'} · 세션조각 ${세션} · 쪽지 ${쪽지}`
         + ` · 전부 ${이름들.length}개 ${raw.length}바이트`;
  } catch {
    /* 인앱이 document.cookie 를 막으면 여기로 떨어집니다 — 그 자체가 답입니다 */
    return '못 읽음(브라우저가 막음)';
  }
}

/* 벽을 그린 부품의 이름표. 진단을 켰을 때만 보입니다.

   문서요청 — 이 벽을 그린 **그 문서 요청**이 들고 온 것입니다.
   아래 진단판의 「서버 판정」은 브라우저가 따로 쓴 요청이라, 둘이 다르면
   「문서 요청에만 쿠키가 안 실린다」는 뜻입니다 */
export function DiagTag({ 이름, 문서요청 }: { 이름: string; 문서요청?: string }) {
  const on = useDiag();
  if (!on) return null;
  return (
    <span className="mt-2 block text-left text-[11px] leading-[1.7] text-[#9AA0A6]">
      [진단] 이 벽을 그린 곳 · {이름}
      {문서요청 && (
        <>
          <br />
          [진단] 문서 요청이 들고 온 것 · {문서요청}
          <br />
          [진단] 브라우저가 가진 것 · {내쿠키()}
        </>
      )}
    </span>
  );
}

type Srv = {
  서버판정: string; 오류이름: string | null; 브라우저: string;
  로그인쿠키: string; 로그인쿠키조각: number; 로그인도중쪽지: number; 쿠키전체개수: number;
  배포: string; 배포판: string; 지금: string;
};

export function DiagStrip() {
  const on = useDiag();
  const { loading, session, me } = useAuth();
  const [srv, setSrv] = useState<Srv | null | undefined>(undefined);

  useEffect(() => {
    if (!on) return;
    fetch('/api/diag-who', { cache: 'no-store' })
      .then((r) => r.json())
      .then(setSrv)
      .catch(() => setSrv(null));
  }, [on]);

  if (!on) return null;

  const 화면판정 = loading ? '확인 중' : session ? '회원' : '비회원';

  return (
    <div className="mx-auto w-full max-w-3xl px-6 pb-[78px] md:px-7 md:pb-7">
      <pre className="whitespace-pre-wrap break-all rounded-[10px] border border-[#E3E3DE]
                      bg-[#FAFAF7] p-3 text-[11px] leading-[1.7] text-[#5F666C]">
{`[진단] 이 화면을 누구로 보고 있나
  서버 판정   ${srv === undefined ? '물어보는 중…' : srv === null ? '못 물어봄' : srv.서버판정}
  화면 판정   ${화면판정}${me ? ' · 설문 ' + (me.survey_at ? '마침' : '안 마침') : session ? ' · profiles 줄 없음' : ''}
  로그인 쿠키 ${srv ? `${srv.로그인쿠키} · 조각 ${srv.로그인쿠키조각}개` : '—'}
  로그인 중 쪽지 ${srv ? `${srv.로그인도중쪽지}개 · 쿠키 전부 ${srv.쿠키전체개수}개` : '—'}
  브라우저 쿠키 ${내쿠키()}
  브라우저     ${srv ? srv.브라우저 : '—'}
  서버 오류   ${srv ? (srv.오류이름 ?? '없음') : '—'}
  배포        ${srv ? `${srv.배포} · ${srv.배포판}` : '—'}
  찍은 시각   ${srv ? srv.지금 : '—'}
  주소        ${typeof location === 'undefined' ? '' : location.pathname}

  브라우저에는 있는데 서버가 안 받았으면 → 요청에 안 붙는 것입니다
  브라우저에도 없으면 → 애초에 심기지가 않은 것입니다
  둘 다 회원인데 벽이 서 있으면 → 벽에 붙은 [진단] 이름표를 보세요`}
      </pre>
    </div>
  );
}
