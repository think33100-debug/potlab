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
 * ═══════════════════════════════════════════════════════════════ */

const 쪽크기 = 100;          // 서버가 못 넘게 막는 수. 올려도 소용없습니다

export async function 모두받기(주소, 머리, 옵션 = {}) {
  const 최대 = 옵션.최대 ?? 100000;     // 돌다 못 멈추는 일을 막는 울타리
  const 차례칸 = 옵션.차례 ?? 'id';
  const 이음 = 주소.includes('?') ? '&' : '?';
  const 차례붙임 = /[?&]order=/.test(주소) ? '' : 이음 + 'order=' + encodeURIComponent(차례칸);

  const 모두 = [];
  for (let off = 0; off < 최대; off += 쪽크기) {
    const u = 주소 + 차례붙임 + (주소.includes('?') || 차례붙임 ? '&' : '?')
      + 'limit=' + 쪽크기 + '&offset=' + off;
    const r = await fetch(u, { headers: 머리 });
    if (!r.ok) {
      const t = await r.text();
      throw new Error('HTTP ' + r.status + ' · 응답 앞 300자 — ' + t.slice(0, 300).replace(/\s+/g, ' '));
    }
    const 쪽 = await r.json();
    if (!Array.isArray(쪽)) throw new Error('줄 묶음이 아닙니다 — ' + JSON.stringify(쪽).slice(0, 200));
    모두.push(...쪽);
    if (쪽.length < 쪽크기) break;      // 마지막 쪽
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
    return { ok: true, json: async () => 줄 };
  };

  const 줄 = await 모두받기('https://x/rest/v1/t?select=id', {});
  봐('250줄을 다 받는지', 줄.length, 250);
  봐('첫 줄', 줄[0].id, 0);
  봐('끝 줄', 줄[249].id, 249);
  봐('세 번 불렀는지 (100+100+50)', 부른주소.length, 3);
  봐('차례를 붙였는지', /order=id/.test(부른주소[0]), true);
  봐('쪽 크기가 100인지', /limit=100/.test(부른주소[0]), true);
  봐('둘째 쪽 offset', /offset=100/.test(부른주소[1]), true);

  부른주소.length = 0;
  await 모두받기('https://x/rest/v1/t?select=id&order=created_at.desc', {});
  봐('이미 차례가 있으면 덧붙이지 않는지', (부른주소[0].match(/order=/g) || []).length, 1);

  globalThis.fetch = 진짜fetch;
  console.log('\n' + (거짓 ? '★ ' + 거짓 + '개 틀렸습니다' : '○ ' + 참 + '개 다 맞았습니다'));
  process.exit(거짓 ? 1 : 0);
}
