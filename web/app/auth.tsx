'use client';

import { isAuthApiError, type Session } from '@supabase/supabase-js';
/* 값이 아니라 **모양**만 가져옵니다 (import type 은 지워집니다).
   서버와 화면이 같은 세 값을 써야 맞춰볼 수 있습니다 — 이름표를 두 벌 만들지 않습니다 */
import type { Who } from '@/lib/supabase-server';
import { useRouter } from 'next/navigation';
import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from 'react';
import { 로그아웃시도, 세션꺼내기, 인증흐름 } from '@/lib/auth-flow';
import { browserSupabase } from '@/lib/supabase-browser';
import { useToast } from './toast';

type 읽은답 = { data: unknown; error: unknown };
type 프로필묶음 = { prof: 읽은답; admin: 읽은답; 메뉴: 읽은답 };

export type Me = {
  id: string;
  nickname: string;
  avatar: string | null;
  job_group: string | null;
  role: string | null;
  nickname_changes: number;
  /* 급여·스펙을 마친 시각. 비어 있으면 가입이 아직 안 끝났습니다 */
  survey_at: string | null;
};

/* 가입 설문을 마쳤나. **세 값입니다** (2026-09-25).

   마침    profiles.survey_at 이 찍혀 있습니다
   안마침  줄을 읽어냈는데 survey_at 이 비어 있습니다 — 가입하다 만 분입니다
   모름    **profiles 를 못 읽었습니다.** 마쳤는지 안 마쳤는지 모릅니다

   왜 세 값인가 — 전에는 `!!me?.survey_at` 한 줄이었습니다. profiles 읽기가
   실패해도 me 가 null 이라, 「못 읽음」이 「안 마침」과 똑같이 보였습니다.
   그래서 가입을 마친 회원에게 「가입하고 전부 보기」 가 떴습니다.
   serverWho 가 서버에서 막은 그 함정이 브라우저에 그대로 남아 있었습니다. */
export type 설문상태 = '마침' | '안마침' | '모름';

/* 들어가는 길을 그릴 때 쓰는 값 (2026-10-09).
   「채용 관리」·「교육 관리」 링크를 누구에게 보일지 정합니다.
   내프로필() 에 붙이지 않은 까닭 — 그쪽은 returns table 이라 칸을 더하면
   drop 이 필요합니다. 여기는 Promise.all 로 함께 불러 왕복이 안 늡니다. */
export type 관리메뉴 = {
  채용관리: boolean; 교육관리: boolean; 페르소나역할: string | null;
};

type Auth = {
  loading: boolean;
  session: Session | null;
  me: Me | null;          // profiles 줄. 가입을 마치기 전에는 null 입니다
  isAdmin: boolean;       // 단추를 보일지 말지에만 씁니다 — 막는 자리는 DB 입니다
  관리: 관리메뉴;          // 「채용 관리」·「교육 관리」 링크를 보일지
  /* 로그인했나. **lib/supabase-server.ts 의 serverWho 와 같은 세 값·같은 뜻입니다.**
     서버와 화면이 다른 말을 쓰면 맞춰볼 수가 없습니다 */
  who: Who;
  설문: 설문상태;
  reload: () => Promise<void>;
  signOut: () => Promise<void>;
};

const 관리없음: 관리메뉴 = { 채용관리: false, 교육관리: false, 페르소나역할: null };

const Ctx = createContext<Auth>({
  loading: true, session: null, me: null, isAdmin: false, 관리: 관리없음,
  who: '모름', 설문: '모름',
  reload: async () => {}, signOut: async () => {},
});

export const useAuth = () => useContext(Ctx);

/* 로그인은 됐지만 profiles 줄이 아직 없는 상태가 「가입 진행 중」입니다.
   줄은 닉네임을 정하는 칸에서 만듭니다 — nickname 이 NOT NULL 이라
   그 전에는 만들 수가 없습니다. */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const sb = browserSupabase();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [관리, set관리] = useState<관리메뉴>(관리없음);
  /* profiles 를 읽어냈나. false 면 「모름」입니다 — 「가입 안 함」이 아닙니다 */
  const [meOk, setMeOk] = useState(true);
  const [로그아웃실패, set로그아웃실패] = useState(false);
  const toast = useToast();

  const 프로필모으기 = useCallback(async (): Promise<프로필묶음> => {
    const [prof, admin, 메뉴] = await Promise.all([
      /* profiles 를 바로 읽지 않습니다 (2026-10-01).
         비로그인·다른 회원이 프로필을 통째로 읽던 것을 막으면서
         job_group·role 같은 칸은 남에게 아예 안 나가게 했습니다.
         **본인 전체 프로필은 내프로필() 창구로만** 나옵니다 */
      sb.rpc('내프로필').maybeSingle(),
      /* 관리자인지는 DB 에 물어봅니다. 이 값은 단추를 보일지 말지에만 씁니다 —
         진짜로 막는 자리는 RLS 와 칸 단위 권한입니다.
         여기서 true 로 만들어도 서버가 안 해줍니다 */
      sb.rpc('is_admin'),
      /* 「채용 관리」·「교육 관리」 링크를 보일지. 못 읽으면 안 보이는 쪽으로 둡니다 —
         링크를 숨겨도 막는 자리는 DB 입니다 */
      sb.rpc('내관리메뉴'),
    ]);
    return { prof, admin, 메뉴 };
  }, [sb]);

  const 프로필적용 = useCallback((p: 프로필묶음 | null | '모름') => {
    if (p === null || p === '모름') {
      setMe(null); setMeOk(p === null); setIsAdmin(false); set관리(관리없음);
      return;
    }
    const { prof, admin, 메뉴 } = p;

    /* **오류와 「줄이 없음」은 다릅니다** (2026-09-25).

         prof.error 가 있다   못 읽었습니다 → 모름. 가입 안 한 사람 취급하면 안 됩니다
         error 없이 data null  maybeSingle() 이 「그런 줄 없다」고 답한 것입니다 →
                               정말 가입 전입니다

       전에는 `setMe(prof.data ?? null)` 한 줄이라 둘이 똑같이 보였습니다.
       그래서 profiles 를 한 번 못 읽으면 회원이 「가입 안 한 사람」이 됐고,
       흐림·댓글·상단바가 전부 그 말을 따라갔습니다. */
    setMeOk(!prof.error);
    setMe(prof.error ? null : ((prof.data as Me) ?? null));

    /* 관리자는 못 읽으면 아닌 쪽으로 둡니다 — 단추를 보일지 말지에만 쓰고,
       진짜로 막는 자리는 RLS 라 여기서 틀려도 뚫리지 않습니다 */
    setIsAdmin(!admin.error && admin.data === true);
    set관리(메뉴.error ? 관리없음 : { ...관리없음, ...(메뉴.data as 관리메뉴) });
  }, []);

  /* 늦게 온 인증 응답을 버리는 차례는 lib/auth-flow.ts 한 자리입니다 (2026-11-05).
     지워진 계정을 내보내는 확인도 거기 있습니다 — 2026-09-19 에 그 상태로 글을 쓰다
     「profiles_id_fkey 위반」 같은 영문 오류를 만났습니다. 화면마다 따로 막지 않습니다. */
  const 흐름 = useMemo(() => 인증흐름<Session, 프로필묶음>({
    세션읽기: async () => 세션꺼내기<Session>(await sb.auth.getSession()),
    사용자묻기: () => sb.auth.getUser(),
    서버답인가: (error) => isAuthApiError(error),
    로컬로그아웃: () => sb.auth.signOut({ scope: 'local' }),
    구독: (받기) => {
      const { data: sub } = sb.auth.onAuthStateChange(받기);
      return () => sub.subscription.unsubscribe();
    },
    프로필읽기: () => 프로필모으기(),
    세션적용: setSession,
    프로필적용,
    준비끝: () => setLoading(false),
    /* 탈퇴·개인정보 지우기·가입 다시 하기처럼 signOut() 을 안 거치는 길과 다른 탭 —
       브라우저에 남은 화면 자료를 여기서 함께 비웁니다 */
    로그아웃알림: () => router.refresh(),
  }), [sb, router, 프로필모으기, 프로필적용]);

  useEffect(() => 흐름.시작(), [흐름]);

  /* 확인 중에는 둘 다 「모름」입니다 — 0.2초 사이에 비회원으로 그리면 안 됩니다 */
  const who: Who = loading ? '모름' : session ? '회원' : '비회원';
  const 설문: 설문상태 = loading || !meOk ? '모름'
                        : me?.survey_at ? '마침' : '안마침';

  const value = useMemo<Auth>(() => ({
    loading, session, me, isAdmin, 관리, who, 설문,
    reload: () => 흐름.다시읽기(),
    signOut: async () => {
      const 성공 = await 흐름.로그아웃(() => 로그아웃시도((옵션) => sb.auth.signOut(옵션)));
      set로그아웃실패(!성공);
      if (!성공) {
        /* 성공처럼 넘어가지 않습니다. 화면은 잠근 채 다시 시도할 길을 남깁니다 */
        toast('로그아웃하지 못했어요. 다시 시도해 주세요', { tone: 'danger', ms: 5000 });
        return;
      }
      router.push('/');
      /* 브라우저에 남은 화면 자료를 비웁니다 — 뒤로 가도 이전 글을 다시 쓰지 않게 */
      router.refresh();
    },
  }), [loading, session, me, isAdmin, 관리, who, 설문, sb, 흐름, router, toast]);

  return (
    <Ctx.Provider value={value}>
      {로그아웃실패 && (
        <div role="alert" className="flex items-center justify-between gap-3 bg-brand-red-dark px-6 py-3 text-sm text-white">
          <span className="break-keep">로그아웃하지 못했어요</span>
          <button type="button" onClick={value.signOut} className="shrink-0 font-bold underline">
            다시 시도
          </button>
        </div>
      )}
      {children}
    </Ctx.Provider>
  );
}
