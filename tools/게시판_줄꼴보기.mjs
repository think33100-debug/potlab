/* 채용 게시판의 **줄 꼴**을 찍습니다 — 설정을 쓰기 전에 (2026-10-19)
 *
 *   node tools/게시판_줄꼴보기.mjs <게시판주소> [<게시판주소> …]
 *
 * ★ 설정의 `row`·`title`·`link`·`date` 를 **원문을 보고** 씁니다 (지침 5절 —
 *   「응답 원문을 찍는 진단 함수 → 항목 확인 → 그다음에 코드」).
 * ★ robots.txt 를 먼저 봅니다. 전면 금지면 멈춥니다.
 * ★ 아무것도 바꾸지 않습니다.
 */
const UA = 'Mozilla/5.0 (compatible; potjob/1.0)';
const 자고 = (ms) => new Promise((r) => setTimeout(r, ms));

async function 받기(u) {
  const r = await fetch(u, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'ko' },
    redirect: 'follow', signal: AbortSignal.timeout(20000),
  });
  const buf = Buffer.from(await r.arrayBuffer());
  const ct = r.headers.get('content-type') || '';
  const cs = (ct.match(/charset=["']?([\w-]+)/i) || [])[1]
    || (buf.subarray(0, 3000).toString('latin1').match(/charset=["']?([\w-]+)/i) || [])[1] || 'utf-8';
  let 글; try { 글 = new TextDecoder(cs.toLowerCase()).decode(buf); } catch { 글 = buf.toString('utf8'); }
  return { code: r.status, 끝주소: r.url || u, charset: cs, 글, 바이트: buf.length };
}

for (const u0 of process.argv.slice(2).filter((a) => !a.startsWith('--'))) {
  let 기원; try { 기원 = new URL(u0).origin; } catch { console.log('\n✗ 주소 꼴이 아닙니다 — ' + u0); continue; }
  console.log('\n════════ ' + u0);

  try {
    const rb = await 받기(기원 + '/robots.txt');
    const 금지 = /User-agent:\s*\*[^\n]*\n(?:[^\n]*\n)*?\s*Disallow:\s*\/\s*(\n|$)/i.test(rb.글);
    console.log('  robots ' + rb.code + ' · ' + (금지 ? '★ 전면 금지 — 멈춥니다' : '전면 금지 아님'));
    if (금지) continue;
  } catch { console.log('  robots 못 받음 (없는 것으로 봅니다)'); }

  let r;
  try { r = await 받기(u0); } catch (e) { console.log('  ✗ ' + String(e.message).slice(0, 60)); continue; }
  console.log('  HTTP ' + r.code + ' · ' + r.바이트 + '바이트 · charset ' + r.charset
    + (r.끝주소 !== u0 ? ' · 끝 주소 ' + r.끝주소 : ''));
  if (r.code >= 400) continue;

  /* ① 줄을 이루는 태그 — `<tr>`·`<li>` 가 몇 개인가 */
  const tr = (r.글.match(/<tr[\s>]/gi) || []).length;
  const li = (r.글.match(/<li[\s>]/gi) || []).length;
  console.log('  <tr> ' + tr + '개 · <li> ' + li + '개');

  /* ② 글로 가는 링크 — 어떤 꼴인가 */
  const 링크 = [...r.글.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]{0,80}?)<\/a>/gi)]
    .map((m) => ({ h: m[1], t: m[2].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() }))
    .filter((x) => x.t.length > 3 && !/^(홈|home|이전|다음|처음|끝|로그인|검색|더보기)$/i.test(x.t));
  const 셈 = new Map();
  for (const x of 링크) {
    const 꼴 = x.h.replace(/\d+/g, 'N').replace(/[?&][^=]+=/g, (s) => s).slice(0, 60);
    셈.set(꼴, (셈.get(꼴) || 0) + 1);
  }
  console.log('  ── 링크 꼴 (많은 것부터) ──');
  for (const [꼴, n] of [...셈].sort((a, b) => b[1] - a[1]).slice(0, 6)) {
    console.log('     ' + String(n).padStart(3) + '개  ' + 꼴);
  }

  /* ③ 글 제목 견본 — 우리 직군이 있나 */
  console.log('  ── 글 제목 견본 ──');
  for (const x of 링크.slice(0, 10)) console.log('     「' + x.t.slice(0, 54) + '」  ' + x.h.slice(0, 54));
  const 우리 = 링크.filter((x) => /(물리|작업|도수)\s*치료/.test(x.t));
  console.log('  ★ 지금 우리 직군 글 — ' + (우리.length ? 우리.map((x) => x.t.slice(0, 34)).join(' · ') : '없음'));

  /* ④ 날짜 꼴 */
  const 날들 = [...new Set([...r.글.matchAll(/(20\d\d[.\-/]\s?\d{1,2}[.\-/]\s?\d{1,2})|(\b\d{2}-\d{2}\b)/g)]
    .map((m) => m[0]))].slice(0, 5);
  console.log('  날짜 꼴 — ' + (날들.length ? 날들.map((d) => '「' + d + '」').join(' · ') : '**없음**'));

  /* ⑤ 줄 하나의 원문 — 설정의 `row` 를 여기서 씁니다 */
  const 줄 = r.글.match(/<tr[\s>][\s\S]{40,900}?<\/tr>/i) || r.글.match(/<li[\s>][\s\S]{40,900}?<\/li>/i);
  if (줄) {
    console.log('  ── 줄 하나 원문 (앞 600자) ──');
    console.log('     ' + 줄[0].replace(/\s+/g, ' ').slice(0, 600));
  } else {
    console.log('  ── 줄을 이루는 <tr>·<li> 를 못 찾았습니다 — 쪽을 직접 봐야 합니다 ──');
    console.log('     앞 300자 — ' + r.글.replace(/\s+/g, ' ').slice(0, 300));
  }
  await 자고(1500);
}
console.log('\n아무것도 바꾸지 않았습니다.');
