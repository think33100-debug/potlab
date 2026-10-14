/* 채용 목록 쪽이 **fetch 로도 서버가 그려 주나**를 봅니다 (2026-10-14 · 읽기만).
 *
 *   node tools/hosp/긁을수있나.mjs <주소> [찾을말]
 *
 * ── 왜 ───────────────────────────────────────────────────────
 * 브라우저로 보면 공고가 보이는데 `fetch` 로는 빈 껍데기만 오는 곳이 있습니다
 * (자바스크립트로 그리는 쪽 · 울산대병원 채용은 Vaadin 앱입니다).
 * 수집기는 `fetch` 로 받으니, **브라우저로 본 것은 근거가 아닙니다**
 * (지침 12절 — 시험은 보내는 쪽과 같은 도구로).
 *
 * 받는 길은 수집기와 같은 `글받기()` 입니다 — 인증서·인코딩이 거기 한 벌로
 * 있습니다. **DB 를 안 건드립니다.**
 *
 * 찍는 것
 *   · HTTP 코드 · 길이 · 인코딩
 *   · 자바스크립트 틀만 온 낌새 (본문 글자가 거의 없나)
 *   · 줄 후보 — <tr> · <li> · <dl> 이 몇 개인가
 *   · 찾을말이 원문에 있나, 있으면 **그 둘레 원문 1,000자** (지침 2절)
 */
import { 글받기 } from '../certs/index.mjs';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
  + '(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

const [주소, 찾을말] = process.argv.slice(2);
if (!주소) { console.error('주소를 주십시오'); process.exit(1); }

const g = await 글받기(주소, { headers: { 'User-Agent': UA, 'Accept-Language': 'ko' } });
const html = String(g.html || '');
console.log('HTTP ' + g.code + ' · ' + html.length + '자' + (g.왜 ? ' · 왜 ' + g.왜 : ''));

const 글 = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
console.log('태그 걷은 글 ' + 글.length + '자'
  + (글.length < 400 ? '  ★ 자바스크립트로 그리는 쪽일 수 있습니다' : ''));
console.log('');
for (const [이름, re] of [['<tr>', /<tr[\s>]/gi], ['<li>', /<li[\s>]/gi], ['<dl>', /<dl[\s>]/gi],
  ['<article>', /<article[\s>]/gi], ['onclick', /onclick=/gi]]) {
  console.log('  ' + 이름.padEnd(10) + (html.match(re) || []).length + '개');
}
console.log('');
console.log('── 태그 걷은 글 앞 500자 ──');
console.log(글.slice(0, 500));

/* --줄 <정규식> : 그 정규식에 걸리는 블록을 **원문 그대로** 몇 개 찍습니다.
   설정의 row·title·link 정규식을 짜기 전에 줄 생김새를 봐야 합니다 (지침 5절) */
const 줄자리 = process.argv.indexOf('--줄');
if (줄자리 > 0) {
  const re = new RegExp(process.argv[줄자리 + 1], 'g');
  const 것 = html.match(re) || [];
  console.log('');
  console.log('── --줄 에 걸린 블록 ' + 것.length + '개 중 앞 3개 (원문) ──');
  for (const b of 것.slice(0, 3)) {
    console.log('  ·········································');
    console.log('  ' + b.replace(/\s+/g, ' ').slice(0, 900));
  }
}

if (찾을말) {
  const i = html.indexOf(찾을말);
  console.log('');
  console.log('「' + 찾을말 + '」 원문에 있나 — ' + (i >= 0 ? '있습니다 (' + i + '자리)' : '없습니다'));
  if (i >= 0) {
    console.log('── 그 둘레 원문 1,000자 ──');
    console.log(html.slice(Math.max(0, i - 400), i + 600).replace(/\s+/g, ' '));
  }
}
