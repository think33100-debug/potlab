/* 사전 신청 저장 창구와 흐름의 초안 — 비활성입니다.

   DB 창구는 운영에 없습니다. 화면에 단추·상태·약속을 올리는 일은 세중님 승인 뒤입니다.
   지금 화면의 안내 글은 pay-prereg.ts 가 그대로 맡습니다.

   회원 번호를 인수로 받지 않습니다. 서버가 로그인 세션으로 정합니다. */

/* 켜는 문은 이 고정값 하나입니다. 환경값·주소·브라우저 저장으로 켜지지 않습니다.
   SQL 설치·문구 승인 전에 true 로 바꾸지 않습니다. */
export const 사전신청켜짐: boolean = false;

export type PreregKind = '연봉' | '후기';
export type PreregStatus = Record<PreregKind, boolean>;
/* denied — 권한 거부(42501)입니다. 비로그인·가입 미완료·탈퇴·기능 꺼짐을 DB 코드로는
   못 가리므로 까닭을 짐작해 말하지 않습니다. 로그인 필요는 인증 상태로만 정합니다. */
export type PreregError = 'denied' | 'bad-kind' | 'failed';
export type PreregResult =
  | { ok: true; status: PreregStatus }
  | { ok: false; error: PreregError };

/* 필요한 만큼만 적어 시험에서 가짜로 갈아 끼웁니다 */
export interface PreregClient {
  rpc(
    name: string,
    args?: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: { code?: string } | null }>;
}

const 상태꼴 = (data: unknown): PreregStatus | null => {
  if (typeof data !== 'object' || data === null) return null;
  const d = data as Record<string, unknown>;
  if (typeof d['연봉'] !== 'boolean' || typeof d['후기'] !== 'boolean') return null;
  return { 연봉: d['연봉'], 후기: d['후기'] };
};

/* 서버 오류 원문은 넘기지 않습니다. 화면으로 흘러 나가지 않게 갈래만 돌려줍니다 */
const 오류갈래 = (code?: string): PreregError =>
  code === '42501' ? 'denied' : code === '22023' ? 'bad-kind' : 'failed';

const 부르기 = async (
  client: PreregClient,
  name: string,
  args?: Record<string, unknown>,
): Promise<PreregResult> => {
  try {
    const { data, error } = await client.rpc(name, args);
    if (error) return { ok: false, error: 오류갈래(error.code) };
    const status = 상태꼴(data);
    return status ? { ok: true, status } : { ok: false, error: 'failed' };
  } catch {
    return { ok: false, error: 'failed' };
  }
};

export const myPreregStatus = (client: PreregClient) =>
  부르기(client, 'pay_prereg_my_status');

export const addPrereg = (client: PreregClient, kind: PreregKind) =>
  부르기(client, 'pay_prereg_add', { p_kind: kind });

export const cancelPrereg = (client: PreregClient, kind: PreregKind) =>
  부르기(client, 'pay_prereg_cancel', { p_kind: kind });

/* ── 화면 흐름 ── React 없이 시험하려고 가짜 client 를 주입받습니다 */

export type PreregAuth = {
  who: '모름' | '회원' | '비회원';
  userId: string | null;
  설문: '마침' | '안마침' | '모름';
};

export type PreregView =
  | { 단계: '꺼짐' }
  | { 단계: '확인중' }
  | { 단계: '로그인필요' }
  | { 단계: '가입미완료' }
  | { 단계: '불러오는중' }
  | { 단계: '준비'; status: PreregStatus; 처리중: PreregKind | null }
  /* 오류에는 상태를 싣지 않습니다. 쓰기 실패는 서버 결과를 모르므로 지난 성공을 보이면 거짓입니다 */
  | { 단계: '오류'; 오류: PreregError };

export type PreregController = {
  보기: () => PreregView;
  인증바뀜: (auth: PreregAuth) => void;
  신청: (kind: PreregKind) => void;
  취소: (kind: PreregKind) => void;
  다시확인: () => void;
  닫기: () => void;
};

export const createPreregController = ({ enabled, getClient, onChange }: {
  enabled: boolean;
  getClient: () => PreregClient;
  onChange: (view: PreregView) => void;
}): PreregController => {
  let 지금: PreregView = enabled ? { 단계: '확인중' } : { 단계: '꺼짐' };
  let 세대 = 0;            // 세대가 바뀌면 앞서 나간 요청의 응답은 버립니다
  let 인증열쇠: string | null = null;
  let 닫힘 = !enabled;     // 문이 닫혔으면 처음부터 닫힌 것과 같습니다

  const 그리기 = (view: PreregView) => { 지금 = view; onChange(view); };

  const 돌리기 = async (일: (client: PreregClient) => Promise<PreregResult>) => {
    const 이번 = ++세대;
    let 결과: PreregResult;
    try {
      결과 = await 일(getClient());
    } catch {
      결과 = { ok: false, error: 'failed' };
    }
    if (닫힘 || 이번 !== 세대) return;
    그리기(결과.ok
      ? { 단계: '준비', status: 결과.status, 처리중: null }
      : { 단계: '오류', 오류: 결과.error });
  };

  const 불러오기 = () => {
    그리기({ 단계: '불러오는중' });
    void 돌리기(myPreregStatus);
  };

  const 쓰기 = (
    kind: PreregKind,
    일: (client: PreregClient, kind: PreregKind) => Promise<PreregResult>,
  ) => {
    if (닫힘 || 지금.단계 !== '준비' || 지금.처리중) return;   // 중복 클릭은 여기서 끝납니다
    그리기({ ...지금, 처리중: kind });
    void 돌리기((client) => 일(client, kind));
  };

  return {
    보기: () => 지금,
    인증바뀜: ({ who, userId, 설문 }) => {
      if (닫힘) return;
      /* 토큰 갱신처럼 같은 사람·같은 상태면 다시 부르지 않습니다 */
      const 열쇠 = JSON.stringify([who, userId, 설문]);
      if (열쇠 === 인증열쇠) return;
      인증열쇠 = 열쇠;
      세대 += 1;
      if (who === '비회원') return 그리기({ 단계: '로그인필요' });
      if (who === '모름' || !userId || 설문 === '모름') return 그리기({ 단계: '확인중' });
      if (설문 === '안마침') return 그리기({ 단계: '가입미완료' });
      불러오기();
    },
    신청: (kind) => 쓰기(kind, addPrereg),
    취소: (kind) => 쓰기(kind, cancelPrereg),
    다시확인: () => {
      if (닫힘 || 지금.단계 !== '오류') return;
      불러오기();
    },
    닫기: () => { 닫힘 = true; 세대 += 1; },
  };
};
