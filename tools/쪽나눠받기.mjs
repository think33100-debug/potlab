/* ═══════════════════════════════════════════════════════════════
 *  PostgREST 에서 100줄 넘게 받아오기 (2026-10-04)
 * ═══════════════════════════════════════════════════════════════
 *
 *  Supabase 는 한 번에 **100줄만** 돌려줍니다. `limit` 을 키워도 안 됩니다 —
 *  서버 쪽 max-rows 가 이깁니다. 2026-10-03 에 재 본 값 —
 *
 *    job_posts?select=id              → 100줄  Content-Range 0-99/2112
 *    job_posts?select=id&limit=5000   → 100줄  Content-Range 0-99/2112
 *    job_posts?select=id&limit=100000 → 100줄  Content-Range 0-99/2112
 *
 *  **오류가 안 납니다.** 101번째 줄부터 조용히 없는 것이 됩니다.
 *  그래서 `limit=2000` 같은 글자는 「넉넉히 받는다」가 아니라
 *  「안 잘린다고 믿게 만드는 글자」입니다. 더 위험합니다.
 *
 *  ── 쓰는 법 ──────────────────────────────────────────────────
 *    import { 모두받기 } from './쪽나눠받기.mjs';
 *    const 줄 = await 모두받기(URL + '/rest/v1/job_posts?source=eq.AL&select=id,title',
 *                              { apikey: 열쇠, Authorization: 'Bearer ' + 열쇠 });
 *
 *  ★ 차례를 꼭 정해야 합니다. `order=` 가 없으면 쪽마다 차례가 달라져
 *    같은 줄을 두 번 받거나 빠뜨립니다. 안 적으면 여기서 `id` 로 붙입니다.
 *
 *  ★★ **`order=` 가 있어도 그 칸이 고유하지 않으면 똑같이 샙니다.**
 *     동률인 줄들의 차례는 쪽마다 흔들립니다 (2026-10-19 에 또 데었습니다 —
 *     `order=db_insert_at.desc` 로 워크넷 724줄을 넘겼는데 **722줄**만 왔고,
 *     제목이 잘린 97건 중 **72건**만 보였습니다. `db_insert_at` 이 724줄 중
 *     **687줄에서 겹칩니다**(53묶음). 2026-10-12 에 `병원제목대조.mjs` 에서
 *     같은 일을 겪고 그 파일에만 적어 뒀는데, **여기 한 자리를 안 고쳐서**
 *     다시 났습니다 — 지침 6절).
 *     그래서 이제 **차례 끝에 고유한 칸을 붙입니다** (`,id.asc`).
 * ═══════════════════════════════════════════════════════════════ */

const 쪽크기 = 100;          // 서버가 못 넘게 막는 수. 올려도 소용없습니다

/** 주소의 `order=` 를 **고유하게** 만듭니다 — 차례가 없으면 넣고, 있으면 끝에 덧붙입니다.
 *
 *  자기 쪽매김을 쓰는 도구들이 이것만 부르면 같은 규칙을 씁니다 (지침 6절).
 *    const r = await fetch(U + '/rest/v1/' + 차례붙이기(길) + '&limit=100&offset=' + off, …);
 *
 *  `job_body` 처럼 `id` 가 없는 표는 둘째 인수로 고유한 칸을 적습니다 —
 *    차례붙이기('job_body?select=…', 'job_id.asc,ord.asc,kind.asc')
 */
/* ★ `id` 칸이 **없는** 표들. 안 적어 두면 `order=id` 가 붙어
     「column job_body.id does not exist」 로 400 이 납니다
     (2026-10-19 에 `고용형태_바로잡기` 가 그렇게 깨졌습니다 — 제가 깨뜨렸습니다).
   ★ 새 표를 쓰다 400 이 나면 **여기 한 줄**을 더합니다 (지침 6절). */
export const 표고유열쇠 = {
  job_body: 'job_id.asc,ord.asc,kind.asc',
  job_attachments: 'job_id.asc,kind.asc,url.asc',
  칸기록: 'id.asc',
  hira_org: 'ykiho.asc',        /* 심평원 기관 — 열쇠는 요양기관번호입니다 */
  hira_detail: 'ykiho.asc',
  hosp_sites: 'name.asc',
  기관주소: 'id.asc',
};

export function 차례붙이기(길, 차례칸) {
  if (차례칸 == null) {
    const 표 = (String(길).match(/^\/?([^?/]+)/) || [])[1] || '';
    차례칸 = 표고유열쇠[표] || 'id';
  }
  const 이미 = (길.match(/[?&]order=([^&]*)/) || [])[1];
  const 첫칸 = String(차례칸).split(',')[0].split('.')[0];
  const 벗긴 = 길.replace(/([?&])order=[^&]*&?/, (m, p1) => (m.endsWith('&') ? p1 : (p1 === '?' ? '?' : '')))
    .replace(/[?&]$/, '');
  const 찬차례 = 이미 == null ? 차례칸
    : (new RegExp('(^|,)' + 첫칸 + '(\\.|,|$)').test(decodeURIComponent(이미))
        ? decodeURIComponent(이미)
        : decodeURIComponent(이미) + ',' + 차례칸);
  return 벗긴 + (벗긴.includes('?') ? '&' : '?') + 'order=' + encodeURIComponent(찬차례);
}

export async function 모두받기(주소, 머리, 옵션 = {}) {
  const 최대 = 옵션.최대 ?? 100000;     // 돌다 못 멈추는 일을 막는 울타리
  const 차례칸 = 옵션.차례 ?? 'id';
  /* 차례는 `차례붙이기()` 한 자리에서 정합니다 */
  const 주소2 = 차례붙이기(주소, /\./.test(차례칸) ? 차례칸 : 차례칸 + '.asc');

  const 모두 = [];
  let 실제 = null;        /* 서버가 말한 전체 줄 수 (Content-Range 의 뒷자리) */
  for (let off = 0; off < 최대; off += 쪽크기) {
    const u = 주소2 + '&limit=' + 쪽크기 + '&offset=' + off;
    /* 첫 쪽에만 `count=exact` 를 겁니다 — **받은 줄 수를 실제와 맞춰 보려고**.
       차례가 흔들려 새면 두 수가 다릅니다 (2026-10-19 에 724 → 722 였습니다) */
    const r = await fetch(u, { headers: off === 0 ? { ...머리, Prefer: 'count=exact' } : 머리 });
    if (off === 0) {
      const cr = r.headers?.get?.('content-range');
      const m = cr && String(cr).match(/\/(\d+)\s*$/);
      if (m) 실제 = Number(m[1]);
    }
    if (!r.ok) {
      const t = await r.text();
      throw new Error('HTTP ' + r.status + ' · 응답 앞 300자 — ' + t.slice(0, 300).replace(/\s+/g, ' '));
    }
    const 쪽 = await r.json();
    if (!Array.isArray(쪽)) throw new Error('줄 묶음이 아닙니다 — ' + JSON.stringify(쪽).slice(0, 200));
    모두.push(...쪽);
    if (쪽.length < 쪽크기) break;      // 마지막 쪽
  }
  /* ★ 셈을 맞춰 봅니다. 다르면 **조용히 넘어가지 않고 멈춥니다** —
     줄이 샌 채로 「N건입니다」 를 보고하는 것이 가장 나쁩니다 (지침 15절) */
  if (실제 != null && 모두.length !== 실제 && 모두.length < 최대) {
    throw new Error('줄이 샜습니다 — 받은 것 ' + 모두.length + '줄 · 서버가 말한 것 '
      + 실제 + '줄. 차례(order)가 고유하지 않아 동률이 흔들린 것입니다. 주소 — '
      + 주소2.replace(/apikey=[^&]*/, 'apikey=‹가림›').slice(0, 160));
  }
  return 모두;
}

/* 함수(rpc)는 POST 라 offset 을 주소에 못 붙입니다.
   함수 쪽은 **함수 자체가 쪽을 받게** 만들어야 합니다 (봉사목록·교육목록처럼
   `p_page` 를 받는 꼴). 그래서 여기서는 표만 다룹니다. */

/* 스스로 검사 — node tools/쪽나눠받기.mjs --시험 */
if (process.argv.includes('--시험')) {
  let 참 = 0, 거짓 = 0;
  const 봐 = (이름, 된것, 바란것) => {
    const ok = JSON.stringify(된것) === JSON.stringify(바란것);
    console.log((ok ? '  ○ ' : '  ★ ') + 이름 + (ok ? '' : '  된것 ' + JSON.stringify(된것)));
    ok ? 참++ : 거짓++;
  };

  /* 가짜 서버 — 250줄을 100씩 돌려줍니다 */
  const 진짜fetch = globalThis.fetch;
  const 부른주소 = [];
  globalThis.fetch = async (u) => {
    부른주소.push(u);
    const off = Number((u.match(/offset=(\d+)/) || [])[1] ?? 0);
    const 끝 = Math.min(off + 100, 250);
    const 줄 = [];
    for (let i = off; i < 끝; i++) 줄.push({ id: i });
    return { ok: true, json: async () => 줄,
      headers: { get: (k) => (k.toLowerCase() === 'content-range' ? '0-99/250' : null) } };
  };

  const 줄 = await 모두받기('https://x/rest/v1/t?select=id', {});
  봐('250줄을 다 받는지', 줄.length, 250);
  봐('첫 줄', 줄[0].id, 0);
  봐('끝 줄', 줄[249].id, 249);
  봐('세 번 불렀는지 (100+100+50)', 부른주소.length, 3);
  봐('차례를 붙였는지', /order=id/.test(부른주소[0]), true);
  봐('차례붙이기 — 차례가 없으면 넣는지',
    차례붙이기('t?select=id'), 't?select=id&order=id');
  봐('차례붙이기 — 있으면 덧붙이는지',
    decodeURIComponent(차례붙이기('t?order=db_insert_at.desc&select=id')),
    't?select=id&order=db_insert_at.desc,id');
  봐('차례붙이기 — 이미 id 면 그대로',
    decodeURIComponent(차례붙이기('t?order=id.asc')), 't?order=id.asc');
  봐('차례붙이기 — id 없는 표',
    decodeURIComponent(차례붙이기('job_body?select=x', 'job_id.asc,ord.asc')),
    'job_body?select=x&order=job_id.asc,ord.asc');
  /* ★ 2026-10-19 — **차례칸을 안 줘도** id 없는 표를 알아야 합니다.
     안 그러면 order=id 가 붙어 「column job_body.id does not exist」 400 입니다 */
  봐('차례붙이기 — job_body 는 차례칸을 안 줘도 id 를 안 붙인다',
    decodeURIComponent(차례붙이기('job_body?select=job_id,body&job_id=in.(A,B)')),
    'job_body?select=job_id,body&job_id=in.(A,B)&order=job_id.asc,ord.asc,kind.asc');
  봐('차례붙이기 — job_attachments 도',
    /order=job_id.asc,kind.asc,url.asc/.test(decodeURIComponent(차례붙이기('job_attachments?select=url'))), true);
  봐('차례붙이기 — 모르는 표는 id',
    decodeURIComponent(차례붙이기('job_posts?select=id')), 'job_posts?select=id&order=id');
  봐('차례붙이기 — 앞에 슬래시가 있어도',
    /order=job_id.asc,ord.asc,kind.asc/.test(decodeURIComponent(차례붙이기('/job_body?select=x'))), true);
  봐('쪽 크기가 100인지', /limit=100/.test(부른주소[0]), true);
  봐('둘째 쪽 offset', /offset=100/.test(부른주소[1]), true);

  /* ★ 2026-10-19 — **고유하지 않은 차례에 고유한 칸을 덧붙이는지** */
  부른주소.length = 0;
  await 모두받기('https://x/rest/v1/t?select=id&order=created_at.desc', {});
  봐('order 는 한 번만 적히는지', (부른주소[0].match(/order=/g) || []).length, 1);
  봐('고유하지 않은 차례에 id 를 덧붙이는지',
    decodeURIComponent(부른주소[0]).includes('order=created_at.desc,id.asc'), true);
  봐('select 는 그대로 남는지', /select=id/.test(부른주소[0]), true);

  /* 이미 id 로 차례가 잡혀 있으면 두 번 붙이지 않습니다 */
  부른주소.length = 0;
  await 모두받기('https://x/rest/v1/t?select=id&order=id.asc', {});
  봐('이미 id 면 그대로', decodeURIComponent(부른주소[0]).includes('order=id.asc'), true);
  봐('id 를 두 번 안 붙이는지',
    (decodeURIComponent(부른주소[0]).match(/id\.asc/g) || []).length, 1);

  /* 차례가 둘인 경우에도 끝에 붙입니다 */
  부른주소.length = 0;
  await 모두받기('https://x/rest/v1/t?order=source.asc,apply_to.desc&select=id', {});
  봐('차례가 둘이어도 끝에 붙이는지',
    decodeURIComponent(부른주소[0]).includes('order=source.asc,apply_to.desc,id.asc'), true);

  /* ★ 셈이 안 맞으면 **멈추는지** — 줄이 샌 것을 조용히 넘기지 않아야 합니다.
     200줄만 주면서 「실제는 250줄」이라고 말하는 가짜 서버로 봅니다 */
  globalThis.fetch = async (u) => {
    const off = Number((u.match(/offset=(\d+)/) || [])[1] ?? 0);
    const 끝 = Math.min(off + 100, 200);
    const 줄 = [];
    for (let i = off; i < 끝; i++) 줄.push({ id: i });
    return { ok: true, json: async () => 줄,
      headers: { get: (k) => (k.toLowerCase() === 'content-range' ? '0-99/250' : null) } };
  };
  let 멈췄나 = '';
  try { await 모두받기('https://x/rest/v1/t?select=id', {}); } catch (e) { 멈췄나 = e.message; }
  봐('셈이 안 맞으면 멈추는지', /줄이 샜습니다/.test(멈췄나), true);
  봐('몇 줄인지 말하는지', /받은 것 200줄.*말한 것 250줄/.test(멈췄나), true);

  globalThis.fetch = 진짜fetch;
  console.log('\n' + (거짓 ? '★ ' + 거짓 + '개 틀렸습니다' : '○ ' + 참 + '개 다 맞았습니다'));
  process.exit(거짓 ? 1 : 0);
}
