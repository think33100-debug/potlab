'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { browserSupabase } from '@/lib/supabase-browser';

/* 마스터 계정 로그인 — 운영 전용입니다 (2026-10-09).
 *
 * ── 왜 따로 있나 ─────────────────────────────────────────────
 * 회원 화면을 **진짜 그 역할로** 보려면 역할을 실제로 바꿔야 합니다.
 * 실제 회원 계정으로 그러면 안 되고(작업지침 8-9), 카카오·네이버 계정을
 * 역할마다 만들 수도 없습니다. 그래서 이메일·비번 계정 **하나**를 둡니다.
 * 앱스토어 심사용 계정으로도 씁니다.
 *
 * ── 여기로는 가입이 안 됩니다 ────────────────────────────────
 * 로그인만 있습니다. 이메일 가입은 DB 의 before-user-created 훅이 거절합니다
 * (hook_이메일가입막기). 계정은 서버에서 관리 API 로 만들었습니다.
 *
 * ── 비번 ─────────────────────────────────────────────────────
 * 서버 ~/potlab/.env 의 MASTER_PW 에만 있습니다.
 * 저장소·브라우저 코드·문서 어디에도 안 적습니다.
 *
 * ── 여러 번 틀리면 ───────────────────────────────────────────
 * 이 브라우저에서 다섯 번 틀리면 15분 잠급니다. 진짜 한도는 Supabase 쪽
 * 로그인 제한이고, 이것은 그 앞에 둔 한 겹입니다 (브라우저를 바꾸면 풀립니다).
 */

const 잠금칸 = 'potjob.master.lock';
const 센칸 = 'potjob.master.tries';
const 최대 = 5;
const 잠금분 = 15;

export default function Master() {
  const router = useRouter();
  const [메일, set메일] = useState('');
  const [비번, set비번] = useState('');
  const [탈, set탈] = useState<string | null>(null);
  const [도는중, set도는중] = useState(false);
  const [남은초, set남은초] = useState(0);

  /* 잠겼나 — 1초마다 남은 시간을 셉니다 */
  useEffect(() => {
    const 보기 = () => {
      let 끝 = 0;
      try { 끝 = Number(localStorage.getItem(잠금칸) || 0); } catch { /* 무시 */ }
      set남은초(Math.max(0, Math.ceil((끝 - Date.now()) / 1000)));
    };
    보기();
    const t = setInterval(보기, 1000);
    return () => clearInterval(t);
  }, []);

  const 들어가기 = async () => {
    if (남은초 > 0) return;
    set도는중(true); set탈(null);
    const { error } = await browserSupabase().auth
      .signInWithPassword({ email: 메일.trim(), password: 비번 });
    set도는중(false);

    if (!error) {
      try { localStorage.removeItem(센칸); localStorage.removeItem(잠금칸); } catch { /* 무시 */ }
      set비번('');
      router.replace('/');
      return;
    }

    let 센 = 0;
    try {
      센 = Number(localStorage.getItem(센칸) || 0) + 1;
      localStorage.setItem(센칸, String(센));
      if (센 >= 최대) {
        localStorage.setItem(잠금칸, String(Date.now() + 잠금분 * 60_000));
        localStorage.removeItem(센칸);
      }
    } catch { /* 무시 */ }

    /* 무엇이 틀렸는지는 안 알려 줍니다 — 메일이 있는지 없는지도 힌트가 됩니다 */
    set탈(센 >= 최대
      ? `${잠금분}분 동안 잠갔습니다.`
      : `맞지 않습니다. ${최대 - 센}번 남았어요.`);
  };

  /* ★ 2026-11-13 세중님 「관리자 마스터 키 모드 들어갈 때 예전 화면 뜨더라」 — 새 틀(lib/nav.ts 새틀화면) · RAPO 토큰으로.
     동작(잠금 · 틀린 횟수 · 무엇이 틀렸는지 안 알림)은 그대로입니다 */
  const 칸꼴 = 'rapo-type-t5-regular h-(--rapo-dimension-x13) w-full rounded-(--rapo-radius-r3) border-(length:--rapo-border-default) '
    + 'border-(color:--rapo-color-stroke-neutral-weak) bg-(--rapo-color-bg-layer-default) px-(--rapo-dimension-x4) text-(color:--rapo-color-fg-neutral) '
    + 'placeholder:text-(color:--rapo-color-fg-placeholder) focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-(--rapo-color-stroke-focus-ring)';
  return (
    <main data-rapo className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col items-center justify-center bg-(--rapo-color-bg-layer-default) p-(--rapo-dimension-x6)">
      <div className="flex w-full max-w-[340px] flex-col gap-(--rapo-dimension-x6)">
        <div className="flex flex-col items-center gap-(--rapo-dimension-x3)">
          <div className="relative h-[31.5px] w-[120px] shrink-0">
            {/* eslint-disable @next/next/no-img-element -- Figma 원본 SVG 그대로 (가로형 로고 · components/rapo/home-notice.tsx 와 같은 꼴) */}
            <img src="/rapo/home/logo-symbol.svg" alt="" className="absolute left-0 top-0 h-[31.5px] w-[32.25px]" />
            <img src="/rapo/home/logo-wordmark.svg" alt="RAPO" className="absolute bottom-[24.37%] left-[34.21%] right-[0.04%] top-[24.67%]" />
            {/* eslint-enable @next/next/no-img-element */}
          </div>
          <p className="rapo-type-t4-medium text-(color:--rapo-color-fg-neutral-muted)">운영 전용 계정</p>
        </div>

        <form className="flex flex-col gap-(--rapo-dimension-x3)" onSubmit={(e) => { e.preventDefault(); 들어가기(); }}>
          <input type="email" value={메일} onChange={(e) => set메일(e.target.value)}
            autoComplete="username" placeholder="메일 주소" aria-label="메일 주소" className={칸꼴} />
          <input type="password" value={비번} onChange={(e) => set비번(e.target.value)}
            autoComplete="current-password" placeholder="비밀번호" aria-label="비밀번호" className={칸꼴} />
          <button type="submit" disabled={도는중 || 남은초 > 0}
            className="rapo-type-t5-bold mt-(--rapo-dimension-x1) flex h-(--rapo-dimension-x13) w-full items-center justify-center rounded-(--rapo-radius-r3)
                       bg-(--rapo-color-bg-navy-solid) text-(color:--rapo-color-fg-on-navy-solid) active:bg-(--rapo-color-bg-navy-solid-pressed) disabled:opacity-50">
            {남은초 > 0
              ? `잠겼어요 — ${Math.floor(남은초 / 60)}분 ${남은초 % 60}초`
              : 도는중 ? '들어가는 중…' : '들어가기'}
          </button>
        </form>

        {탈 && <p role="alert" className="rapo-type-t4-medium text-center text-(color:--rapo-color-fg-brand-contrast)">{탈}</p>}

        <p className="rapo-type-t3-regular break-keep text-center text-(color:--rapo-color-fg-neutral-muted)">
          여기로는 가입할 수 없어요. 치료사·학생이시면{' '}
          <a href="/login" className="underline underline-offset-2">카카오·네이버로 시작하기</a>.
        </p>
      </div>
    </main>
  );
}
