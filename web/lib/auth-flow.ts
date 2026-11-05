/* 로그인 상태를 정하는 차례 한 자리 (2026-11-05 · Q51 · 멘토-4.2-2).

   인증 응답은 늦게 올 수 있습니다. 먼저 보낸 물음의 답이 로그아웃·새 로그인·
   화면 정리 뒤에 도착하면 **버립니다.** 세션을 되살리면 회원 화면이 다시 그려집니다.
   React 를 모르게 두어, 늦은 응답을 시험에서 실제로 돌려 볼 수 있습니다
   (lib/auth-flow.test.mjs). */

type 세션꼴 = { user: { id: string } };

export type 사용자답 = { data: { user: unknown }; error: unknown };

export type 인증흐름재료<S extends 세션꼴, P> = {
  세션읽기: () => Promise<S | null>;
  사용자묻기: () => Promise<사용자답>;
  /* 서버가 답을 준 오류인가. 연결이 끊겨 답을 못 받은 오류면 false 입니다 */
  서버답인가: (error: unknown) => boolean;
  로컬로그아웃: () => Promise<unknown>;
  구독: (받기: (사건: string, s: S | null) => Promise<void>) => () => void;
  프로필읽기: (s: S) => Promise<P>;
  세션적용: (s: S | null) => void;
  /* null = 회원 자료를 비움 · '모름' = 못 읽음(가입 전이 아닙니다) */
  프로필적용: (p: P | null | '모름') => void;
  준비끝: () => void;
  /* 다른 길(탈퇴·탭 등)로 로그아웃됐을 때 화면 자료를 비울 자리 */
  로그아웃알림: () => void;
  /* 다시읽기를 기다려 주는 한도. 넘으면 부른 쪽을 먼저 돌려보냅니다 */
  다시읽기한도?: number;
};

/* getSession() 은 오류를 던지지 않고 { session: null, error } 로 답합니다.
   이것을 비회원으로 읽지 않습니다 — 던져서 「확인 중」 으로 둡니다 */
export function 세션꺼내기<S>(답: { data: { session: S | null }; error: unknown }): S | null {
  if (답.error) throw 답.error;
  return 답.data.session;
}

/* 서버 로그아웃이 실패하면 이 기기 세션만이라도 지워 봅니다.
   local 도 실패할 수 있으므로 **결과를 봅니다.** 둘 다 실패면 false 입니다 */
export async function 로그아웃시도(
  나가기: (옵션?: { scope: 'local' }) => Promise<{ error: unknown }>,
): Promise<boolean> {
  try {
    const 첫답 = await 나가기();
    if (!첫답.error) return true;
    const 둘째답 = await 나가기({ scope: 'local' });
    return !둘째답.error;
  } catch {
    return false;
  }
}

export function 인증흐름<S extends 세션꼴, P>(d: 인증흐름재료<S, P>) {
  let 세대 = 0;        // 세션을 정하는 일마다 하나씩 오릅니다. 다르면 늦은 답입니다
  let 읽기번호 = 0;     // 프로필을 읽는 일의 차례. 나중에 시작한 읽기가 이깁니다
  let 멈춤 = false;
  /* 로그아웃 진행 중이거나 실패한 상태. **성공한 시도만 풉니다** —
     사건·다시읽기·재시작으로 안 풀립니다. 세션이 저장소에 남아 있을 수 있기 때문입니다 */
  let 닫힘 = false;
  let 나가는중: Promise<boolean> | null = null;
  let 앞번호: string | null = null;
  let 진행중: Promise<void> = Promise.resolve();

  /* getSession() 은 브라우저에 저장된 것을 읽기만 하고 서버에 물어보지 않습니다.
     그래서 지워진 계정의 토큰도 만료(약 1시간) 전까지는 멀쩡해 보입니다.
     여기서 한 번 서버에 물어보고, 없는 사람이면 조용히 내보냅니다.

     오류에는 두 가지가 섞여 있습니다 (2026-09-25).
       답을 받았다    서버가 「그런 사람 없다」고 답했습니다 → 내보냅니다
       답을 못 받았다  연결이 끊겼습니다 → 모름입니다. 내보내면 안 됩니다

     전에는 오류가 나기만 하면 로그아웃시켜, 지하철에서 잠깐 끊긴 것만으로
     로그인이 풀렸습니다. 지금은 답을 받았을 때만 내보냅니다.

     ★ 늦은 답으로는 내보내지 않습니다 — 옛 토큰에 대한 답이 새로 로그인한
       사람의 세션을 지우면 안 됩니다 (2026-11-05) */
  const 확인 = async (s: S | null, 살았나: () => boolean): Promise<S | null> => {
    if (!s) return null;
    let 답: 사용자답;
    try {
      답 = await d.사용자묻기();
    } catch {
      return s;   // 답을 못 받음 → 모름 → 그대로 둠
    }
    if (답.data.user) return s;
    if (답.error && !d.서버답인가(답.error)) return s;
    if (!살았나()) return null;
    await d.로컬로그아웃();
    return null;
  };

  const 프로필받기 = async (s: S): Promise<P | '모름'> => {
    try {
      return await d.프로필읽기(s);
    } catch {
      return '모름';
    }
  };

  const 돌리기 = async (얻기: (살았나: () => boolean) => Promise<S | null>) => {
    const 내세대 = ++세대;
    const 살았나 = () => 내세대 === 세대;

    let 세션: S | null;
    try {
      세션 = await 얻기(살았나);
    } catch {
      return;   // 세션을 못 읽음 → 「확인 중」 그대로. 회원으로도 비회원으로도 안 그립니다
    }
    if (!살았나()) return;

    /* 다른 사람으로 바뀌었으면 앞사람 자료를 먼저 치웁니다 */
    if (세션 && 앞번호 && 앞번호 !== 세션.user.id) d.프로필적용('모름');
    앞번호 = 세션?.user.id ?? null;
    d.세션적용(세션);

    if (!세션) {
      d.프로필적용(null);
      d.준비끝();
      return;
    }

    const 내번호 = ++읽기번호;
    const 프로필 = await 프로필받기(세션);
    if (!살았나()) return;
    /* 그사이 다시읽기가 시작됐으면 더 새 값은 그쪽입니다 */
    if (내번호 === 읽기번호) d.프로필적용(프로필);
    d.준비끝();
  };

  /* 진행 중인 물음을 전부 무효로 하고 그 자리에서 비웁니다 */
  const 비우기 = () => {
    세대 += 1;
    읽기번호 += 1;
    앞번호 = null;
    d.세션적용(null);
    d.프로필적용(null);
    d.준비끝();
  };

  const 사건받기 = async (사건: string, s: S | null) => {
    if (멈춤 || 닫힘) return;
    if (사건 === 'SIGNED_OUT') {
      비우기();
      d.로그아웃알림();
      return;
    }
    /* 라이브러리는 세션을 못 읽어도 INITIAL_SESSION 을 null 로 보냅니다.
       비회원으로 읽지 않고 직접 다시 물어봅니다 — 오류면 「확인 중」 그대로입니다 */
    진행중 = 사건 === 'INITIAL_SESSION' && !s
      ? 돌리기(async (살았나) => 확인(await d.세션읽기(), 살았나))
      : 돌리기((살았나) => 확인(s, 살았나));
    await 진행중;
  };

  const 프로필다시읽기 = async () => {
    const 내세대 = 세대;
    const 내번호 = ++읽기번호;
    const 살았나 = () => 내세대 === 세대 && 내번호 === 읽기번호;

    let 세션: S | null;
    try {
      세션 = await d.세션읽기();
    } catch {
      return;
    }
    if (!살았나()) return;
    if (!세션) {
      d.프로필적용(null);
      return;
    }
    /* 화면이 아는 사람과 다르면 섞지 않습니다 — 세션을 정하는 사건이 맡습니다 */
    if (세션.user.id !== 앞번호) return;
    const 프로필 = await 프로필받기(세션);
    if (살았나()) d.프로필적용(프로필);
  };

  return {
    /* 돌려주는 함수가 뒷정리입니다 — 그 뒤에 온 답은 전부 버립니다 */
    시작(): () => void {
      멈춤 = false;
      if (!닫힘) 진행중 = 돌리기(async (살았나) => 확인(await d.세션읽기(), 살았나));
      const 풀기 = d.구독(사건받기);
      return () => {
        멈춤 = true;
        세대 += 1;
        읽기번호 += 1;
        풀기();
      };
    },

    /* 세션은 그대로 두고 프로필만 다시 읽습니다 (닉네임 저장 뒤 등) */
    async 다시읽기(): Promise<void> {
      if (멈춤 || 닫힘) return;
      /* 진행 중인 세션 확인을 기다리지 않습니다. 답이 안 와도 가입 저장 같은 화면이
         멈추지 않게 한도까지만 기다립니다. 늦은 답은 위 세대 검사가 가립니다 */
      let 타이머: ReturnType<typeof setTimeout> | undefined;
      const 한도 = new Promise<void>((끝) => {
        타이머 = setTimeout(끝, d.다시읽기한도 ?? 5000);
      });
      await Promise.race([프로필다시읽기(), 한도]);
      clearTimeout(타이머);
    },

    /* 누르는 순간 화면을 먼저 잠급니다. 끝나기 전에 온 사건·답으로 되살아나지 않습니다.
       true 를 돌려받았을 때만 풀립니다. 실패면 잠근 채 false 를 돌려줍니다 */
    로그아웃(실행: () => Promise<boolean>): Promise<boolean> {
      if (나가는중) return 나가는중;
      닫힘 = true;
      비우기();
      나가는중 = (async () => {
        let 성공 = false;
        try {
          성공 = (await 실행()) === true;
        } catch {
          성공 = false;
        }
        닫힘 = !성공;
        나가는중 = null;
        return 성공;
      })();
      return 나가는중;
    },
  };
}
