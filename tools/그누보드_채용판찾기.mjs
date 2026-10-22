/* 그누보드 꼴 병원의 **채용 게시판 주소와 줄 꼴**을 쪽에서 확인합니다
 *   (2026-10-19 세중님 2번 — 「같은 꼴 묶음부터 새 기관 설정 추가」)
 *
 *   node tools/그누보드_채용판찾기.mjs <뿌리주소> [<뿌리주소> …]
 *
 * ★ 주소를 짐작하지 않습니다 — 뿌리 쪽에서 `bo_table=` 링크를 **찾아** 그중
 *   채용말이 붙은 것을 열어 봅니다. 열어 본 쪽의 **줄 원문**을 찍습니다.
 * ★ robots.txt 를 먼저 봅니다 — 금지면 거기서 멈춥니다 (지침).
 * ★ 아무것도 바꾸지 않습니다.
 */

/* ★ 2026-10-22 — robots 판정은 `robots.mjs` 한 자리에서 합니다 (지침 6절).
   길만()은 주소에서 경로+물음표만 떼 냅니다 — robots 는 경로로 가립니다 */
import { robots읽기, 가도되나 } from './robots.mjs';
const 길만 = (u) => {
  try { const x = new URL(u); return x.pathname + (x.search || ''); } catch { return '/'; }
};
const UA = 'Mozilla/5.0 (compatible; potjob/1.0)';
const 채용말 = /채용|인재|구인|입사|리크루트|recruit|job|모집/i;
const 자고 = (ms) => new Promise((r) => setTimeout(r, ms));

async function 받기(u) {
  const r = await fetch(u, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'ko' },
    redirect: 'follow', signal: AbortSignal.timeout(20000),
  });
  const buf = Buffer.from(await r.arrayBuffer());
  const ct = r.headers.get('content-type') || '';
  const cs = (ct.match(/charset=["']?([\w-]+)/i) || [])[1]
    || (buf.subarray(0, 2048).toString('latin1').match(/charset=["']?([\w-]+)/i) || [])[1] || 'utf-8';
  let 글; try { 글 = new TextDecoder(cs.toLowerCase()).decode(buf); } catch { 글 = buf.toString('utf8'); }
  return { code: r.status, 글, 끝주소: r.url || u, charset: cs };
}

for (const 뿌리 of process.argv.slice(2).filter((a) => !a.startsWith('--'))) {
  const 뿌 = 뿌리.replace(/\/+$/, '');
  let 기원; try { 기원 = new URL(뿌).origin; } catch { console.log('\n✗ 주소 꼴이 아닙니다 — ' + 뿌리); continue; }
  console.log('\n════════ ' + 기원);

  /* ① robots.txt — 금지면 멈춥니다 */
  try {
    const rb = await 받기(기원 + '/robots.txt');
    /* ★ 2026-10-22 — 판정은 robots.mjs 한 자리입니다 (지침 6절) */
    const 봄 = 가도되나(robots읽기(rb.글), 길만(뿌));
    console.log('  robots ' + rb.code + ' · ' + (봄.됨 ? '가도 됩니다 — ' + 봄.왜 : '★ 막힙니다 — ' + 봄.왜));
    if (!봄.됨) continue;
  } catch { console.log('  robots 못 받음 (없는 것으로 봅니다)'); }

  /* ② 뿌리에서 `bo_table=` 링크를 찾습니다 */
  let 뿌리글;
  try { const r = await 받기(뿌); 뿌리글 = r.글; console.log('  뿌리 ' + r.code + ' · ' + r.글.length + '자 · ' + r.charset); }
  catch (e) { console.log('  ✗ 뿌리 못 받음 — ' + String(e.message).slice(0, 50)); continue; }

  const 판들 = new Map();
  for (const m of 뿌리글.matchAll(/<a[^>]+href=["']([^"']*bo_table=([^&"'#]+)[^"']*)["'][^>]*>([\s\S]{0,70}?)<\/a>/gi)) {
    const 글자 = m[3].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    if (!판들.has(m[2])) 판들.set(m[2], { 주소: m[1], 글자 });
    else if (!판들.get(m[2]).글자 && 글자) 판들.get(m[2]).글자 = 글자;
  }
  console.log('  bo_table 링크 ' + 판들.size + '개 — '
    + [...판들].map(([t, v]) => t + (v.글자 ? '(' + v.글자.slice(0, 10) + ')' : '')).slice(0, 10).join(' · '));

  const 고른것 = [...판들].filter(([t, v]) => 채용말.test(v.글자) || 채용말.test(t));
  if (!고른것.length) { console.log('  ★ 채용으로 보이는 게시판이 없습니다 — 손으로 봐야 합니다'); continue; }

  /* ③ 그 게시판을 열어 **줄 원문**을 찍습니다 */
  for (const [표, v] of 고른것.slice(0, 2)) {
    const u = v.주소.startsWith('http') ? v.주소
      : 기원 + (v.주소.startsWith('/') ? v.주소 : '/' + v.주소);
    console.log('\n  ── 게시판 bo_table=' + 표 + ' 「' + v.글자.slice(0, 20) + '」');
    console.log('     ' + u);
    let r;
    try { r = await 받기(u); } catch (e) { console.log('     ✗ ' + String(e.message).slice(0, 50)); continue; }
    console.log('     HTTP ' + r.code + ' · ' + r.글.length + '자 · charset ' + r.charset);
    if (r.code >= 400) continue;

    /* 글 제목 링크(wr_id) 를 찍습니다 — 설정의 title·link 를 여기서 만듭니다 */
    const 글들 = [...r.글.matchAll(/<a[^>]+href=["']([^"']*wr_id=(\d+)[^"']*)["'][^>]*>([\s\S]{0,90}?)<\/a>/gi)]
      .map((m) => ({ 주소: m[1], id: m[2], 글자: m[3].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() }))
      .filter((x) => x.글자.length > 2);
    console.log('     글 링크 ' + 글들.length + '개');
    for (const g of 글들.slice(0, 6)) console.log('        wr_id=' + g.id + '  「' + g.글자.slice(0, 48) + '」');
    /* 날짜 꼴이 있나 */
    const 날 = r.글.match(/(20\d\d[.\-/]\s?\d{1,2}[.\-/]\s?\d{1,2})|(\d{2}-\d{2})/);
    console.log('     날짜 꼴 — ' + (날 ? '「' + 날[0] + '」' : '**없음** (목록에 날짜가 없습니다)'));
    /* 우리 직군 말이 지금 목록에 있나 */
    const 우리 = 글들.filter((g) => /(물리|작업|도수)\s*치료/.test(g.글자));
    console.log('     지금 우리 직군 글 — ' + (우리.length ? 우리.map((g) => g.글자.slice(0, 30)).join(' · ') : '없음'));
    await 자고(1200);
  }
  await 자고(1200);
}
console.log('\n아무것도 바꾸지 않았습니다.');
