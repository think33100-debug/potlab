/* 사전 신청 저장 창구의 초안 — 아직 어디에서도 쓰지 않습니다.

   DB 창구(pay_prereg_*)는 운영에 없습니다. 화면에 단추·상태·약속을 올리는 일은
   세중님 승인 뒤이므로, 이 파일을 화면에서 불러오면 안 됩니다.
   지금 화면의 안내 글은 pay-prereg.ts 가 그대로 맡습니다.

   회원 번호를 인수로 받지 않습니다. 서버가 로그인 세션으로 정합니다. */

export type PreregKind = '연봉' | '후기';
export type PreregStatus = Record<PreregKind, boolean>;
export type PreregError = 'login' | 'bad-kind' | 'failed';
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
  code === '42501' ? 'login' : code === '22023' ? 'bad-kind' : 'failed';

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
