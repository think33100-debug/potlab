'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Logo } from '@/components/logo';
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

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-8 pb-[88px] md:px-7 md:pb-8">
      <div className="mx-auto w-full max-w-[22rem]">
        <Logo className="!text-h1" />
        <p className="mt-2 text-lg text-mute">운영 전용 계정</p>

        <form
          className="mt-8 space-y-4"
          onSubmit={(e) => { e.preventDefault(); 들어가기(); }}
        >
          <input
            type="email" value={메일} onChange={(e) => set메일(e.target.value)}
            autoComplete="username" placeholder="메일 주소"
            className="w-full rounded-sm border border-gray-200 px-5 py-4 text-lg" />
          <input
            type="password" value={비번} onChange={(e) => set비번(e.target.value)}
            autoComplete="current-password" placeholder="비밀번호"
            className="w-full rounded-sm border border-gray-200 px-5 py-4 text-lg" />

          <button
            type="submit" disabled={도는중 || 남은초 > 0}
            className="w-full rounded-md bg-brand-red px-6 py-5 text-btn font-bold text-white
                       hover:bg-brand-red-dark active:scale-[0.98] disabled:opacity-50">
            {남은초 > 0
              ? `잠겼어요 — ${Math.floor(남은초 / 60)}분 ${남은초 % 60}초`
              : 도는중 ? '들어가는 중…' : '들어가기'}
          </button>
        </form>

        {탈 && <p className="mt-4 text-lg text-brand-red-dark">{탈}</p>}

        <p className="mt-8 text-sm text-mute">
          여기로는 가입할 수 없어요. 치료사·학생이시면{' '}
          <a href="/login" className="underline underline-offset-4">카카오·네이버로 시작하기</a>.
        </p>
      </div>
    </main>
  );
}
