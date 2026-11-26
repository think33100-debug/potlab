import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
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

/* ★ 2026-10-11 — **하루번호를 서버가 만듭니다.**

   전에는 브라우저가 `key` 를 보냈습니다. 번호를 매번 새로 지어 보내면
   조회수가 끝없이 올라갑니다 — 그 숫자로 광고 값을 매길 참이라 거짓
   숫자는 되돌릴 수 없습니다.

   이제 **아이피 + 브라우저 한 낱말 + 날짜 + 본 자리**를 해시해 우리가
   정합니다. 아이피도 UA 도 **저장하지 않습니다** — 해시만 남고 되짚을 수
   없습니다. 브라우저가 보낸 `key` 는 **안 믿고 버립니다.** */
function 하루번호(ip: string, ua: string, day: string, target: string): string {
  const 소금 = process.env.HIT_SALT ?? 'potjob-hit';
  return createHash('sha256')
    .update([소금, day, ip, ua.slice(0, 80), target].join('|'))
    .digest('hex').slice(0, 32);
}

/* ★ 2026-11-27 — 하루 **방문 기기**를 세는 열쇠 (세중님 「하루에 몇 명 들어오나」).
   위 하루번호는 본 자리(target)까지 넣어서, 한 사람이 공고 다섯 개를 보면 다섯으로 셉니다 —
   「같은 자리 하루 한 번」에는 맞지만 「몇 명」에는 안 맞습니다. 본 자리를 뺀 해시를 따로 둡니다.
   이것도 아이피·UA 를 저장하지 않고 되짚을 수 없습니다 (DB page_hits.사람키 · RAPO노트/SQL_261127) */
function 사람키(ip: string, ua: string, day: string): string {
  const 소금 = process.env.HIT_SALT ?? 'potjob-hit';
  return createHash('sha256')
    .update([소금, 'person', day, ip, ua.slice(0, 80)].join('|'))
    .digest('hex').slice(0, 32);
}

/* ★ 2026-11-27 — 본 사람의 갈래 (세중님 「학생 임상가들 다르게 움직이나」).
   브라우저가 말해 주는 값이라 관리자 표시(admin)와 같은 믿음입니다 — 거짓말할 까닭이 없는 자리입니다.
   이 넷 밖은 버립니다(null). 회원 번호·직군은 오지도 않고 담지도 않습니다 */
const 갈래들 = ['비회원', '학생', '현직', '미정'] as const;

/* 재방문 근사치가 보낼 수 있는 값 — 이 밖은 버립니다 (아래 POST 의 revisit 갈래).
     rv:first     이 브라우저의 첫 방문 날 (D0)
     rv:back1~7   D1~D7 가운데 **처음** 다시 온 날 (숫자 = 첫 방문에서 며칠 뒤)
     rv:d7        D7 **당일**에 왔다
   묶음 날짜(첫 방문일)는 DB 가 「받은 날 − 숫자」로 거꾸로 셉니다 — 브라우저는 날짜를 안 보냅니다.
   ※ DB 쪽 짝: sql/초안_1118/재방문_근사치.sql 의 admin_stats_revisit() 가 같은 값 목록을 씁니다 */
const 재방문값 = /^rv:(first|back[1-7]|d7)$/;
const 재방문키 = 'revisit';

/* 공유 누름이 보낼 수 있는 꼴 — sh:share|copy:/주소 (lib/share-hit.ts). 64자까지(아래 target 자르기와 같음).
   ※ DB 쪽 짝: sql/초안_1119/공유_이탈률.sql 의 admin_stats_shares() 가 'sh:%' 를 셉니다 */
const 공유값 = /^sh:(share|copy):\/[A-Za-z0-9_\-./%?=&]{0,55}$/;

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

  let body: { kind?: string; target?: string | null; key?: string; admin?: boolean; who?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, why: '몸통을 못 읽었습니다' }, { status: 400 });
  }

  /* ★ 2026-11-18 — 재방문 근사치 (질문함 Q5 · 11/4 세중님 승인 · RAPO노트/수집기/지표장치_1104.md 5번).
     브라우저가 첫 방문일을 **자기만** 들고 있다가 첫 방문·D1~D7 첫 재방문·D7 당일에
     한 번씩 알려 줍니다 (components/revisit-mark.tsx). 여기서는 **정해진 값만** 받습니다 —
     첫 방문 날짜·회원 번호·주소는 오지도 않고 담지도 않습니다.
     담는 것: 날짜(서버 시각) · kind 'other' · target 'rv:…' · 기기 한 낱말 · 관리자 표시.
     하루번호 자리에는 **고정 글자 'revisit'** 을 넣습니다 — 아이피 해시를 만들지 않아
     같은 날 다른 화면 기록과도 이어지지 않습니다.
     page_hits.kind 는 DB 가 여덟 값만 받으므로(check 제약) 새 kind 를 만들지 않고 'other' 에 담습니다 */
  if (body.kind === 'revisit') {
    const t = typeof body.target === 'string' ? body.target : '';
    if (!재방문값.test(t)) return NextResponse.json({ ok: false, counted: false }, { status: 400 });
    const { error: 재방문오류 } = await supabase.from('page_hits').insert({
      day: seoulDay(),
      kind: 'other',
      device: MOBILE.test(ua) ? 'mobile' : 'desktop',
      target: t,
      day_key: 재방문키,
      by_admin: body.admin === true,
    });
    if (재방문오류) {
      console.error('[RAPO] 재방문 기록 실패:', 재방문오류.message);
      return NextResponse.json({ ok: false }, { status: 500 });
    }
    return NextResponse.json({ ok: true, counted: true });
  }

  /* ★ 2026-11-19 — 공유 단추 누름 (lib/share-hit.ts). 정해진 꼴만 받아 kind 'other' 로 담고,
     하루번호는 아래 화면 기록과 같은 길(아이피 해시)이라 같은 날 같은 주소·수단은 한 번만 셉니다 */
  if (body.kind === 'share') {
    const t = typeof body.target === 'string' ? body.target : '';
    if (!공유값.test(t)) return NextResponse.json({ ok: false, counted: false }, { status: 400 });
    body = { ...body, kind: 'other', target: t };
  }

  const kind = (KINDS as readonly string[]).includes(body.kind ?? '')
    ? (body.kind as Kind) : 'other';
  /* 브라우저가 보낸 `key` 는 **안 씁니다** (위 하루번호 머리말).
     옛 화면이 아직 보내고 있어도 조용히 버립니다 */
  const who = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const day = seoulDay();
  const target = body.target ? String(body.target).slice(0, 64) : null;
  const key = 하루번호(who, ua, day, target ?? '');

  /* 같은 날 · 같은 자리 · 같은 사람은 **한 번만** 셉니다 (세중님 2026-10-11).
     ★ 2026-11-18 — 전에는 넣기 전에 select 로 물었는데, 이 열쇠(비회원)는 page_hits 에
     insert 만 있어 **늘 빈 결과**였습니다 → 4,240줄 중 2,992줄이 겹친 줄(11/18 셈).
     이제 DB 의 「하루 한 번」 유일 색인(새 줄만 · sql/초안_1118/조회_하루한번_색인.sql)이
     겹침을 막고, 여기서는 그 23505 를 「이미 셈」으로 받습니다.
     이미 쌓인 겹친 줄은 지우지 않고 세는 함수가 distinct 로 거릅니다(RAPO노트 SQL_1113/ZZH) */

  const { error } = await supabase.from('page_hits').insert({
    day,
    kind,
    device: MOBILE.test(ua) ? 'mobile' : 'desktop',
    target,
    day_key: key,
    /* 관리자가 본 것은 숫자에서 뺍니다.
       이 값은 브라우저가 말해주는 것이라 완벽하지 않습니다 —
       다만 「내가 관리자다」라고 거짓말할 이유가 없는 자리라 이걸로 둡니다.
       광고 숫자에 우리가 섞이는 것만 막으면 됩니다 */
    by_admin: body.admin === true,
    회원갈래: (갈래들 as readonly string[]).includes(body.who ?? '') ? body.who : null,
    사람키: 사람키(who, ua, day),
  });

  if (error) {
    /* 23505 = 하루 한 번 색인에 걸림 — 오늘 이미 센 것입니다(탈이 아님) */
    if (error.code === '23505') return NextResponse.json({ ok: true, counted: false });
    console.error('[RAPO] 조회 기록 실패:', error.message);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  return NextResponse.json({ ok: true, counted: true });
}
