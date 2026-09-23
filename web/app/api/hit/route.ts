import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/* 화면을 한 번 봤다고 알리는 자리입니다.

   왜 브라우저에서 바로 DB 로 안 넣고 여기를 거치는가 —
   봇을 거르려면 User-Agent 를 봐야 하는데, 그 값은 서버에만 옵니다.

   담는 것은 날짜·화면종류·대상·하루번호와 기기 한 낱말(mobile·desktop)뿐입니다.
   IP 도 User-Agent 도 저장하지 않습니다. 거르고 가리는 데만 쓰고 버립니다. */

export const runtime = 'nodejs';

const KINDS = ['home', 'jobs', 'job', 'community', 'post', 'orgs', 'org', 'other'] as const;
type Kind = (typeof KINDS)[number];

/* 자기를 밝히는 봇들. 대부분은 자바스크립트를 안 돌려서 여기까지 오지도 않습니다 —
   이건 자바스크립트를 도는 크롤러를 거르는 두 번째 그물입니다 */
const BOT = /bot|crawl|spider|slurp|facebookexternalhit|embedly|preview|scrape|curl|wget|python-requests|headless|lighthouse|pingdom|monitor/i;

/* 휴대폰인지 피시인지.

   User-Agent 는 서버에만 오므로 여기서 한 낱말로 줄여 담습니다.
   값 자체는 저장하지 않습니다 — 길게 담으면 사람을 되짚을 수 있습니다.

   태블릿은 휴대폰 쪽으로 셉니다. 우리가 알고 싶은 것은 「손가락으로 보나
   마우스로 보나」이고, 화면 만들 때 갈리는 자리도 거기입니다.
   ponytail: 낱말 검사 한 줄입니다. 정확도를 더 올려야 할 이유가 생기면
   그때 제대로 된 판별기를 답니다 — 지금은 두 갈래면 충분합니다. */
const MOBILE = /android|iphone|ipad|ipod|iemobile|opera mini|mobile|silk|kindle|blackberry|webos/i;

function seoulDay(): string {
  /* 한국 날짜로 셉니다. 서버는 UTC 라 그냥 두면 아침 9시에 날이 바뀝니다 */
  return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
}

export async function POST(req: Request) {
  const ua = req.headers.get('user-agent') ?? '';

  /* 봇이면 조용히 200 을 돌려줍니다. 막혔다고 알려줄 이유가 없습니다 */
  if (!ua || BOT.test(ua)) return NextResponse.json({ ok: true, counted: false });

  /* 미리 가져오기는 사람이 본 게 아닙니다 */
  const purpose = req.headers.get('purpose') ?? req.headers.get('sec-purpose') ?? '';
  if (purpose.includes('prefetch')) return NextResponse.json({ ok: true, counted: false });

  let body: { kind?: string; target?: string | null; key?: string; admin?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, why: '몸통을 못 읽었습니다' }, { status: 400 });
  }

  const kind = (KINDS as readonly string[]).includes(body.kind ?? '')
    ? (body.kind as Kind) : 'other';
  const key = String(body.key ?? '').slice(0, 64);
  if (!key) return NextResponse.json({ ok: false, why: '하루번호가 없습니다' }, { status: 400 });

  const { error } = await supabase.from('page_hits').insert({
    day: seoulDay(),
    kind,
    device: MOBILE.test(ua) ? 'mobile' : 'desktop',
    target: body.target ? String(body.target).slice(0, 64) : null,
    day_key: key,
    /* 관리자가 본 것은 숫자에서 뺍니다.
       이 값은 브라우저가 말해주는 것이라 완벽하지 않습니다 —
       다만 「내가 관리자다」라고 거짓말할 이유가 없는 자리라 이걸로 둡니다.
       광고 숫자에 우리가 섞이는 것만 막으면 됩니다 */
    by_admin: body.admin === true,
  });

  if (error) {
    console.error('[POTJOB] 조회 기록 실패:', error.message);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  return NextResponse.json({ ok: true, counted: true });
}
