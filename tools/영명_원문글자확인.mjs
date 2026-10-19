/* 「0명」이 **원문에서도 숫자 0 인가** — 살아 있는 쪽을 열어 글자 코드를 찍습니다
 *   (2026-10-19 세중님 지시 — 「먼저 원문 글자 확인」)
 *
 *   node tools/영명_원문글자확인.mjs [공고ID …]
 *
 * ── 왜 ───────────────────────────────────────────────────────────
 * 공고문에는 「**○명**」(약간명)이 흔합니다. PDF·HWP 를 글자로 바꾸면서
 * ○(U+25CB) 가 0(U+0030) 으로 바뀌었을 수 있습니다. 우리 `job_body` 사본은
 * 넷 다 U+0030 이었는데(2026-10-19), **그것은 우리가 바꾼 뒤의 글자**입니다.
 * 그래서 **원문 쪽을 직접 열어** 그 자리의 바이트를 봅니다 (지침 2절).
 *
 * 아무것도 바꾸지 않습니다 — 찍기만 합니다.
 */
import fs from 'node:fs';

const cfg = {};
for (const 이름 of ['../.env', '../.env.local']) {
  const p = new URL(이름, import.meta.url);
  if (!fs.existsSync(p)) continue;
  for (const l of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z_0-9]+)=(.*)$/);
    if (m && !cfg[m[1]]) cfg[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}
const U = cfg.SUPABASE_URL; const K = cfg.SUPABASE_SERVICE_KEY;
if (!U || !K) { console.error('✗ SUPABASE_URL / SUPABASE_SERVICE_KEY 가 있어야 합니다'); process.exit(1); }
const H = { apikey: K, Authorization: 'Bearer ' + K };

const 아이디 = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const 볼것 = 아이디.length ? 아이디
  : ['HS1429957266', 'HS445523642', 'HS1650428387', 'HS2141664325'];

const r0 = await fetch(U + '/rest/v1/job_posts?select=id,source,org_name,title,url&id=in.('
  + 볼것.map(encodeURIComponent).join(',') + ')&order=id.asc', { headers: H });
const 공고 = await r0.json();

/** 글자 하나를 「글자 U+XXXX 이름」 꼴로 */
const 글자풀이 = (ch) => {
  const cp = ch.codePointAt(0);
  const 이름 = cp === 0x30 ? '숫자 0 (ASCII)'
    : cp === 0x4f ? '영문 대문자 O'
    : cp === 0x6f ? '영문 소문자 o'
    : cp === 0xff2f ? '전각 영문 Ｏ'
    : cp === 0xff10 ? '전각 숫자 ０'
    : cp === 0x25cb ? '★ 동그라미 ○ (WHITE CIRCLE)'
    : cp === 0x25ef ? '★ 큰 동그라미 ◯'
    : cp === 0x3007 ? '★ 한자 동그라미 〇 (IDEOGRAPHIC ZERO)'
    : cp === 0x26ac ? '★ 가운데 동그라미 ⚬'
    : cp === 0x2218 ? '★ 고리 ∘'
    : '그 밖';
  return '「' + ch + '」 U+' + cp.toString(16).toUpperCase().padStart(4, '0') + ' · ' + 이름;
};

/* 쪽을 열어 글자로 바꿉니다 — 수집기와 **같은 길**을 씁니다 (지침 12절) */
const { stripTags } = await import('./hosp/hs_test.js').catch(() => ({ stripTags: null }));
const 태그걷기 = stripTags || ((h) => String(h).replace(/<[^>]*>/g, ' '));

for (const x of 공고) {
  console.log('\n════ ' + x.id + ' [' + x.source + '] ' + x.org_name);
  console.log('  ' + String(x.title).slice(0, 60));
  console.log('  ' + x.url);
  if (!x.url) { console.log('  주소가 없습니다'); continue; }
  let html;
  try {
    const r = await fetch(x.url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; potjob/1.0)', 'Accept-Language': 'ko' },
      redirect: 'follow', signal: AbortSignal.timeout(25000),
    });
    const buf = Buffer.from(await r.arrayBuffer());
    const ct = r.headers.get('content-type') || '';
    const cs = (ct.match(/charset=["']?([\w-]+)/i) || [])[1]
      || (buf.subarray(0, 2048).toString('latin1').match(/charset=["']?([\w-]+)/i) || [])[1] || 'utf-8';
    try { html = new TextDecoder(cs.toLowerCase()).decode(buf); } catch { html = buf.toString('utf8'); }
    console.log('  HTTP ' + r.status + ' · ' + buf.length + '바이트 · charset ' + cs);
  } catch (e) { console.log('  ✗ 못 받음 · ' + String(e.message).slice(0, 60)); continue; }

  /* ① **HTML 원문 그대로** — 태그를 걷기 **전** */
  console.log('  ── ① HTML 원문에서 「…명」 자리 ──');
  let 찾음 = 0;
  for (const m of html.matchAll(/(.)\s*명/g)) {
    const ch = m[1];
    /* 한글 음절은 건너뜁니다 — 「면허증 명」 같은 말 */
    if (/[가-힣]/.test(ch)) continue;
    const 앞뒤 = html.slice(Math.max(0, m.index - 40), m.index + 12).replace(/\s+/g, ' ');
    console.log('     ' + 글자풀이(ch) + '   「…' + 앞뒤 + '…」');
    if (++찾음 >= 6) break;
  }
  if (!찾음) console.log('     (한글이 아닌 글자 + 명 이 없습니다)');

  /* ② 태그를 걷은 뒤 — 우리 수집기가 담는 글 */
  const 글 = 태그걷기(html).replace(/\s+/g, ' ');
  console.log('  ── ② 태그를 걷은 뒤 (수집기가 담는 글) ──');
  찾음 = 0;
  for (const m of 글.matchAll(/(.)\s*명/g)) {
    const ch = m[1];
    if (/[가-힣]/.test(ch)) continue;
    console.log('     ' + 글자풀이(ch) + '   「…'
      + 글.slice(Math.max(0, m.index - 40), m.index + 12) + '…」');
    if (++찾음 >= 6) break;
  }
  if (!찾음) console.log('     (없습니다)');

  /* ③ 엔티티로 적혀 있나 — `&#9675;`(○) · `&#48;`(0) */
  const 엔 = [...html.matchAll(/&#x?([0-9a-fA-F]{2,5});\s*명/g)].slice(0, 4);
  if (엔.length) {
    console.log('  ── ③ 엔티티 꼴 ──');
    for (const m of 엔) console.log('     ' + m[0].replace(/\s+/g, ' '));
  }
  await new Promise((r) => setTimeout(r, 1500));
}

console.log('\n아무것도 바꾸지 않았습니다.');
