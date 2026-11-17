import type { SupabaseClient } from '@supabase/supabase-js';

/* 가입 미리보기의 「저장 삼킴」 (2026-11-17 세중님 「관리자 모드에서 회원가입 딱 시작하는 모드 · 모든 직군」).

   ── 무엇을 하나 ─────────────────────────────────────────────
   관리자가 가입 화면(/welcome 과 같은 화면)을 **새 회원처럼** 처음부터 끝까지 눌러 볼 때,
   브라우저가 DB 에 **아무것도 쓰지 않게** 합니다. 켜져 있는 동안 browserSupabase() 가
   이 파일의 열쇠꾸러미를 돌려주고, 그 열쇠꾸러미는

     쓰기(표에 넣기·고치기·지우기 · 아래 목록 밖의 창구 · 파일 올리기 · 로그아웃)  → **보내지 않고** 「됐다」고만 답합니다
     읽기(표 읽기 · 아래 「읽는창구」)                                              → 그대로 보냅니다

   그래서 가입자 수·통계·알림·약관 동의 기록에 한 줄도 안 섞입니다(보내지 않으니까요).

   ── 왜 browserSupabase() 한 자리에서 막나 ────────────────────
   가입 화면은 여러 부품(연봉 비교 알림 창 · 급여 직접 입력 · 병원 찾기)이 저마다 DB 를 부릅니다.
   화면마다 「시험이면 건너뛰기」를 적으면 **새 단계가 생길 때 하나를 빠뜨립니다.**
   문 하나에서 막으면 앞으로 가입 화면에 무엇이 더해져도 같이 막힙니다.

   ── 모르는 것은 막는 쪽 ─────────────────────────────────────
   창구(rpc)는 이름만으로 읽기인지 쓰기인지 알 수 없어서, **아래 목록에 있는 것만** 보냅니다.
   목록에 없는 읽기 창구는 빈 답을 받습니다 — 화면이 조금 비어 보일 수는 있어도 진짜 자료는 안 바뀝니다.

   ── 권한을 올리는 장치가 아닙니다 ───────────────────────────
   이 스위치가 하는 일은 **쓰기를 버리는 것**뿐입니다. 누가 자기 브라우저에서 켜도 자기 저장이 안 될 뿐이고,
   더 볼 수 있게 되는 것은 없습니다. 미리보기 화면에 누가 들어오는지는 서버가 막습니다(app/master/signup/page.tsx).

   ── 서버에서는 늘 꺼져 있습니다 ─────────────────────────────
   값을 window 에 둡니다. 모듈 변수에 두면 서버가 여러 사람의 요청에 같은 값을 돌려씁니다. */

export type 삼킨것 =
  | { 종류: 'rpc'; 이름: string; 값?: unknown }
  | { 종류: '표'; 이름: string; 동작: string; 값?: unknown }
  | { 종류: '로그아웃' | '인증' | '파일' | '함수'; 이름: string };

type 받는이 = (x: 삼킨것) => void;
const 칸 = '__rapo_signup_dryrun';
type 창 = Window & { [칸]?: 받는이 };

/* 켜짐·꺼짐을 듣는 화면들 (useSyncExternalStore 용) — 미리보기 화면은 「켜진 것을 본 뒤에」 가입 화면을 그립니다 */
const 듣는이들 = new Set<() => void>();
const 알림 = () => 듣는이들.forEach((l) => l());
export const 가입시험듣기 = (l: () => void) => { 듣는이들.add(l); return () => { 듣는이들.delete(l); }; };

/** 켭니다 — 삼킨 쓰기를 하나씩 받는이에게 알려 줍니다 (미리보기 화면이 가짜 가입 줄을 만드는 데 씁니다) */
export function 가입시험켜기(받는이: 받는이) { (window as 창)[칸] = 받는이; 알림(); }
export function 가입시험끄기() { delete (window as 창)[칸]; 알림(); }
export function 가입시험중(): boolean {
  return typeof window !== 'undefined' && typeof (window as 창)[칸] === 'function';
}

/* 그대로 보내는 창구 — **읽기만 하는 것으로 확인한 것**만 적습니다.
     내프로필 · is_admin · 내관리메뉴 · 내페르소나   화면 틀(app/auth.tsx · 페르소나 띠)이 로그인한 사람을 다시 읽을 때
     org_search                                    가입 ④ 근무한 병원 찾기 (components/rapo/rapo-signup.tsx)
     lang_bands                                    급여 직접 입력의 어학 구간 (components/signup-survey.tsx) */
const 읽는창구 = new Set(['내프로필', 'is_admin', '내관리메뉴', '내페르소나', 'org_search', 'lang_bands']);

const 표쓰기 = new Set(['insert', 'update', 'upsert', 'delete']);
const 인증쓰기 = new Set(['updateUser', 'signUp', 'signInWithPassword', 'signInWithOAuth', 'signInWithOtp', 'signInWithIdToken', 'setSession', 'linkIdentity', 'unlinkIdentity']);
const 파일쓰기 = new Set(['upload', 'update', 'remove', 'move', 'copy', 'uploadToSignedUrl', 'createSignedUploadUrl']);

/* 진짜 저장처럼 잠깐 걸리게 — 「저장 중」 화면이 눈에 보여야 흐름을 그대로 봅니다 */
const 늦춤 = 350;

function 알리기(x: 삼킨것) {
  try { (window as 창)[칸]?.(x); } catch { /* 받는 쪽이 탈 나도 화면은 그대로 */ }
}

/* 「됐다」고만 답하는 가짜 줄. supabase 의 줄처럼 .eq().select().single() 을 이어 붙여도 되고,
   await 하거나 .then() 을 달면 { data: null, error: null } 이 옵니다 */
function 삼킴(x: 삼킨것): unknown {
  알리기(x);
  let 답: Promise<unknown> | null = null;
  const 기다림 = () => (답 ??= new Promise((ok) => {
    setTimeout(() => ok({ data: null, error: null, count: null, status: 200, statusText: 'OK' }), 늦춤);
  }));
  const 줄: unknown = new Proxy({}, {
    get(_t, k) {
      if (k === 'then') return (a?: (v: unknown) => unknown, b?: (e: unknown) => unknown) => 기다림().then(a, b);
      if (k === 'catch') return (b?: (e: unknown) => unknown) => 기다림().catch(b);
      if (k === 'finally') return (f?: () => void) => 기다림().finally(f);
      return () => 줄;
    },
  });
  return 줄;
}

/* 꺼낸 값이 함수면 원래 주인에 묶어 돌려줍니다 — 안 묶으면 this 가 Proxy 가 되어 안쪽 값을 못 읽습니다 */
const 그대로 = (주인: object, k: string | symbol): unknown => {
  const v = Reflect.get(주인, k);
  return typeof v === 'function' ? v.bind(주인) : v;
};

let 만든것: { 진짜: SupabaseClient; 가짜: SupabaseClient } | null = null;

/** 진짜 열쇠꾸러미를 감싼 「쓰기를 삼키는」 열쇠꾸러미. 한 번 만들어 돌려씁니다 —
    부를 때마다 새로 만들면 app/auth.tsx 가 「열쇠가 바뀌었다」고 보고 로그인 상태를 끝없이 다시 읽습니다 */
export function 가입시험클라이언트(진짜: SupabaseClient): SupabaseClient {
  if (만든것?.진짜 === 진짜) return 만든것.가짜;

  const 가짜 = new Proxy(진짜, {
    get(t, k) {
      if (k === 'rpc') {
        return (이름: string, 인수?: unknown, 옵션?: unknown) => (읽는창구.has(이름)
          ? (t.rpc as (...a: unknown[]) => unknown)(이름, 인수, 옵션)
          : 삼킴({ 종류: 'rpc', 이름, 값: 인수 }));
      }
      if (k === 'from') {
        return (표: string) => new Proxy(t.from(표), {
          get(줄, m) {
            if (typeof m === 'string' && 표쓰기.has(m)) return (값?: unknown) => 삼킴({ 종류: '표', 이름: 표, 동작: m, 값 });
            return 그대로(줄, m);
          },
        });
      }
      if (k === 'auth') {
        return new Proxy(t.auth, {
          get(a, m) {
            /* 로그아웃 — 가입 화면의 「나가기」가 부릅니다. 진짜로 하면 관리자가 로그아웃됩니다.
               끝나지 않는 약속을 돌려줘서 그 뒤의 「로그인 화면으로 가기」가 안 돌게 하고,
               미리보기 화면이 알림을 받아 고르는 화면으로 돌아갑니다 */
            if (m === 'signOut') return () => { 알리기({ 종류: '로그아웃', 이름: 'signOut' }); return new Promise(() => {}); };
            if (typeof m === 'string' && 인증쓰기.has(m)) return () => 삼킴({ 종류: '인증', 이름: m });
            return 그대로(a, m);
          },
        });
      }
      if (k === 'storage') {
        return new Proxy(t.storage, {
          get(s, m) {
            if (m !== 'from') return 그대로(s, m);
            return (통: string) => new Proxy(t.storage.from(통), {
              get(f, n) {
                if (typeof n === 'string' && 파일쓰기.has(n)) return () => 삼킴({ 종류: '파일', 이름: `${통}.${n}` });
                return 그대로(f, n);
              },
            });
          },
        });
      }
      if (k === 'functions') {
        return new Proxy(t.functions, {
          get(f, m) {
            if (m === 'invoke') return (이름: string) => 삼킴({ 종류: '함수', 이름 });
            return 그대로(f, m);
          },
        });
      }
      return 그대로(t, k);
    },
  }) as SupabaseClient;

  만든것 = { 진짜, 가짜 };
  return 가짜;
}
