/* 쪽이 **본문을 따로 불러오나** — iframe·XHR·묶음 API 를 쪽 소스에서 찾습니다
 * (2026-10-22 세중님 1번)
 *
 *   node tools/본문길찾기.mjs <공고주소> [<공고주소> …]
 *   node tools/본문길찾기.mjs --두드려 <공고주소>     찾은 후보를 **두 번까지** 두드려 봅니다
 *
 * ── 왜 이 꼴인가 ─────────────────────────────────────────────
 * JobFlex 가 그랬습니다 — 공고 쪽 첫 HTML 에는 글이 없고(19KB · Next.js),
 * **그 쪽이 싣는 묶음 26개를 읽어** API 길을 찾았습니다
 * (`/position/v2/jobflex/{sn}` · 200 · 6,751자). 그 길을 그대로 씁니다.
 *
 * ★ 주소를 **지어내지 않습니다** (지침 3절). 쪽·묶음에 **적혀 있는 것**만 모읍니다.
 *   후보를 두 번 두드려 실패하면 멈추고 사람에게 넘깁니다.
 * ★ 읽기만 합니다. DB 를 안 건드립니다.
 */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
const argv = process.argv.slice(2);
const 두드려 = argv.includes('--두드려');
const 주소들 = argv.filter((x) => x.startsWith('http'));
const 자고 = (ms) => new Promise((y) => setTimeout(y, ms));

const 글자 = (h) => String(h || '').replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

/** 쪽글에서 **따로 불러오는 자리**를 모읍니다 */
export function 길후보(html, 바탕) {
  const 본것 = new Set();
  const 모음 = [];
  const 더하기 = (갈래, 값) => {
    const v = String(값 || '').replace(/&amp;/g, '&').trim();
    if (!v || v.length > 300) return;
    if (본것.has(갈래 + v)) return;
    본것.add(갈래 + v);
    let 온전 = v;
    try { 온전 = new URL(v, 바탕).href; } catch { /* 주소 꼴이 아니면 그대로 */ }
    모음.push({ 갈래, 값: v, 온전 });
  };
  /* ① iframe */
  for (const m of html.matchAll(/<iframe\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)) 더하기('iframe', m[1]);
  /* ② 쪽 안 스크립트의 부름 — fetch·ajax·axios·XHR·load */
  for (const m of html.matchAll(/(?:fetch|\$\.(?:get|post|ajax)|axios\.(?:get|post)|\.load)\s*\(\s*["'`]([^"'`]+)["'`]/g)) 더하기('부름', m[1]);
  for (const m of html.matchAll(/url\s*:\s*["'`]([^"'`]+)["'`]/g)) 더하기('ajax url', m[1]);
  for (const m of html.matchAll(/open\s*\(\s*["'](?:GET|POST)["']\s*,\s*["']([^"']+)["']/gi)) 더하기('XHR', m[1]);
  /* ③ API 처럼 보이는 길 (쪽 안에 적힌 것) */
  for (const m of html.matchAll(/["'`](\/(?:api|rest|json|ajax|data|service|svc)\/[^"'`\s]{2,120})["'`]/g)) 더하기('api 길', m[1]);
  for (const m of html.matchAll(/["'`]([^"'`\s]{2,120}\.(?:json|do|asp|jsp|php)\?[^"'`\s]{2,160})["'`]/g)) 더하기('물음표 길', m[1]);
  /* ④ 싣는 묶음 (뒤에서 읽습니다) */
  for (const m of html.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)) 더하기('묶음', m[1]);
  return 모음;
}

for (const 주소 of 주소들) {
  console.log('\n══ ' + 주소);
  let html;
  try {
    const r = await fetch(주소, { headers: { 'User-Agent': UA } });
    html = await r.text();
    console.log('  쪽 HTTP ' + r.status + ' · HTML ' + html.length + '자 · 글자 ' + 글자(html).length + '자');
  } catch (e) { console.log('  ✗ ' + String(e.message).slice(0, 60)); continue; }

  const 모음 = 길후보(html, 주소);
  const 묶음 = 모음.filter((x) => x.갈래 === '묶음');
  const 그밖 = 모음.filter((x) => x.갈래 !== '묶음');
  console.log('  쪽 안 후보 ' + 그밖.length + '개 · 싣는 묶음 ' + 묶음.length + '개');
  for (const x of 그밖.slice(0, 12)) console.log('    [' + x.갈래 + '] ' + x.값.slice(0, 120));

  /* ⑤ 묶음 안에서 길을 더 찾습니다 (우리 집 묶음만 · 최대 12개) */
  const 우리집 = (u) => { try { return new URL(u, 주소).host === new URL(주소).host; } catch { return false; } };
  const 묶음길 = new Set();
  for (const x of 묶음.filter((y) => 우리집(y.온전)).slice(0, 12)) {
    try {
      const s = await (await fetch(x.온전, { headers: { 'User-Agent': UA } })).text();
      for (const m of s.matchAll(/["'`](\/(?:api|rest|json|ajax|data|service|svc)\/[^"'`\s]{2,120})["'`]/g)) 묶음길.add(m[1]);
      for (const m of s.matchAll(/["'`]([^"'`\s]{2,80}\.(?:json|do|asp|jsp|php))["'`]/g)) 묶음길.add(m[1]);
    } catch { /* 못 받으면 넘깁니다 */ }
    await 자고(400);
  }
  if (묶음길.size) {
    console.log('  묶음 안 길 ' + 묶음길.size + '개 — ' + [...묶음길].slice(0, 10).join(' · ').slice(0, 300));
  }

  /* ⑥ 두드려 보기 — **두 번까지** (지침 3절) */
  if (두드려) {
    const 볼것 = [...그밖.filter((x) => /iframe|부름|XHR|api 길|물음표 길/.test(x.갈래))].slice(0, 2);
    for (const x of 볼것) {
      try {
        const r = await fetch(x.온전, { headers: { 'User-Agent': UA, Referer: 주소 } });
        const t = await r.text();
        console.log('    두드림 [' + x.갈래 + '] HTTP ' + r.status + ' · ' + t.length + '자 · 글자 '
          + 글자(t).length + '자 — ' + 글자(t).slice(0, 80));
      } catch (e) { console.log('    두드림 ✗ ' + String(e.message).slice(0, 50)); }
      await 자고(1500);
    }
  }
}
