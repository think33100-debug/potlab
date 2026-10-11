import { NextResponse } from 'next/server';
import { 사업자상태보기 } from '@/lib/nts';

/* 사업자등록번호를 국세청에 물어봅니다 (2026-10-11).
 *
 *   POST /api/biz   { "b_no": "1234567890" }
 *     → { 상태: "계속사업자" | "휴업자" | "폐업자" | "없는 번호" | "수동 확인" }
 *
 * ── 왜 서버를 거치나 ────────────────────────────────────────
 * 열쇠(NTS_BIZ_KEY)는 Vercel 에만 있고 브라우저로 내려가면 안 됩니다.
 *
 * ── 이 값은 **보여 주기용**입니다 ────────────────────────────
 * 담당자 신청 화면에서 「이 번호는 폐업자입니다」를 **미리** 알려 주려고
 * 씁니다. 브라우저가 부르는 자리라 **신청자가 결과를 꾸밀 수 있습니다.**
 * 그래서 DB(회원자격.사업자상태)에는 **안 적습니다** — 거기 적히는 값은
 * 서버(Lightsail)에서 tools/사업자진위확인.mjs 가 적어야 믿을 수 있습니다.
 * 그러려면 열쇠가 **서버 .env 에도** 있어야 합니다 (승인대기 ⑰).
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* 한 아이피가 마구 두드리지 못하게 — 국세청 한도를 우리 쪽에서 먼저 지킵니다.
   ponytail: 한 서버 안의 Map 입니다. 여러 대로 늘리면 그때 밖으로 뺍니다 */
const 두드림 = new Map<string, number[]>();
const 분 = 60_000;
function 너무잦나(who: string) {
  const 이제 = Date.now();
  const xs = (두드림.get(who) ?? []).filter((t) => 이제 - t < 분);
  xs.push(이제);
  두드림.set(who, xs);
  if (두드림.size > 5000) 두드림.clear();        /* 메모리 지킴이 */
  return xs.length > 20;
}

/* GET 은 두지 않습니다.
   열쇠 모양(길이·앞 4글자·퍼센트 여부)을 보려고 `?diag=1` 을 잠깐 뒀는데,
   **누구나 부를 수 있는 자리**라 앞 4글자가 밖으로 나갑니다. 물어볼 것을
   다 물었으니(2026-10-11 · Decoding 쪽 64자) 뗍니다.
   다시 봐야 하면 서버에서 `node tools/사업자진위확인.mjs <번호> --열쇠모양`. */

export async function POST(req: Request) {
  const who = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (너무잦나(who)) return NextResponse.json({ 왜: '잠시 뒤에 다시 해 주세요' }, { status: 429 });

  let 몸: { b_no?: string | string[] };
  try { 몸 = await req.json(); } catch { return NextResponse.json({ 왜: '몸이 JSON 이 아닙니다' }, { status: 400 }); }

  const 번호들 = (Array.isArray(몸.b_no) ? 몸.b_no : [몸.b_no ?? '']).slice(0, 10);
  const r = await 사업자상태보기(번호들, process.env.NTS_BIZ_KEY);

  if (r.왜 && !r.줄.length) {
    /* 왜 틀렸는지 **그대로** 돌려줍니다 — 「안 됩니다」만 주면 고칠 수가 없습니다.
       국세청 오류 글에는 열쇠 값이 안 들어갑니다 (SERVICE_KEY_IS_NOT_REGISTERED_ERROR 꼴) */
    return NextResponse.json({ HTTP: r.HTTP, 왜: r.왜 }, { status: 502 });
  }
  return NextResponse.json({ 줄: r.줄, 상태: r.줄[0]?.상태 ?? '모름' });
}
