/* 미다스 채용 사이트 네 곳을 **브라우저로** 열어봅니다 (2026-09-26).
 *
 *   node tools/hosp/probe-browser.mjs
 *   (GitHub Actions 에서는 .github/workflows/probe-browser.yml 이 부릅니다)
 *
 * 알고 싶은 것은 하나입니다 —
 *   목록 HTML 이 오나 · 아니면 이 자리(GitHub IP)가 막히나
 *
 * **「됐다/안 됐다」 만 적지 않습니다.** 받은 쪽의 원문 앞 500자를 찍고,
 * 통째로 reports/browser/ 에 남깁니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 둘곳 = path.join(여기, 'reports', 'browser');
fs.mkdirSync(둘곳, { recursive: true });

const 곳들 = [
  { 이름: '세종충남대학교병원', 파일: 'cnuhinsa', url: 'https://cnuhinsa.recruiter.co.kr/career/apply',
    메모: '충남대병원 본원과 공용' },
  { 이름: '빛고을전남대학교병원', 파일: 'cnuh', url: 'https://cnuh.recruiter.co.kr/appsite/company/index',
    메모: '전남대병원 본원과 공용' },
  { 이름: '중앙대학교광명병원', 파일: 'caumc', url: 'https://caumc.recruiter.co.kr/career/home', 메모: '' },
  { 이름: '한양대학교구리병원', 파일: 'hyumcguri', url: 'https://hyumcguri.recruiter.co.kr/career/apply', 메모: '' },
];

let chromium;
try { ({ chromium } = await import('playwright')); }
catch { ({ chromium } = await import('playwright-core')); }

const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const ctx = await browser.newContext({
  locale: 'ko-KR', timezoneId: 'Asia/Seoul',
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
});

const 결과 = [];
for (const c of 곳들) {
  const 줄 = { ...c };
  const page = await ctx.newPage();
  /* 서버가 무엇을 돌려줬는지도 봅니다 — 화면이 비어도 200 일 수 있습니다 */
  const 응답들 = [];
  page.on('response', (r) => {
    const u = r.url();
    if (/\.(css|png|jpe?g|gif|svg|woff2?|ico)(\?|$)/i.test(u)) return;
    응답들.push(r.status() + ' ' + u.slice(0, 120));
  });

  try {
    const res = await page.goto(c.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    줄.code = res ? res.status() : 0;
    /* 목록이 그려질 틈을 줍니다. 특정 칸을 기다리지 않습니다 —
       미다스 화면 구조를 모르니 「글자가 늘어나는지」 로 봅니다 */
    let 앞 = 0;
    for (let i = 0; i < 12; i++) {
      await page.waitForTimeout(1000);
      const n = (await page.evaluate(() => document.body?.innerText?.length || 0));
      if (n > 400 && n === 앞) break;
      앞 = n;
    }
    줄.글자 = 앞;
    줄.본문 = (await page.evaluate(() => document.body?.innerText || '')).replace(/\n{2,}/g, '\n').trim();
    줄.html = await page.content();
  } catch (e) {
    줄.code = 0;
    줄.왜 = String(e && e.message || e).split('\n')[0].slice(0, 140);
  }
  await page.close();
  줄.응답 = 응답들.slice(0, 25);

  /* 판정 — 목록이 왔나, 자리가 막혔나 */
  const 공고말 = ((줄.본문 || '').match(/채용|모집|공고/g) || []).length;
  const 날짜 = ((줄.본문 || '').match(/20\d{2}[.\-/]\s?\d{1,2}[.\-/]\s?\d{1,2}|D-\d+|상시/g) || []).length;
  if (!줄.code) 줄.판정 = 'GitHub IP 차단 → 집에서 긁음 (접속 자체가 안 됨)';
  else if (줄.code === 403 || 줄.code >= 500) 줄.판정 = 'GitHub IP 차단 → 집에서 긁음 (HTTP ' + 줄.code + ')';
  else if (!줄.본문 || 줄.본문.length < 200) 줄.판정 = 'GitHub IP 차단 → 집에서 긁음 (빈 화면)';
  else if (공고말 >= 3 && 날짜 >= 1) 줄.판정 = '열림(브라우저)';
  else 줄.판정 = '열리긴 하는데 목록이 안 보입니다 — 손으로 봐야 합니다';
  줄.공고말 = 공고말; 줄.날짜 = 날짜;

  if (줄.html) fs.writeFileSync(path.join(둘곳, c.파일 + '.html'), 줄.html, 'utf8');
  if (줄.본문) fs.writeFileSync(path.join(둘곳, c.파일 + '.txt'), 줄.본문, 'utf8');

  console.log('\n══ ' + c.이름 + (c.메모 ? ' (' + c.메모 + ')' : ''));
  console.log('   ' + c.url);
  console.log('   HTTP ' + 줄.code + (줄.왜 ? ' · ' + 줄.왜 : '')
    + ' · 화면 글자 ' + (줄.본문 || '').length + '자 · 「채용/모집/공고」 ' + 공고말 + '번 · 날짜꼴 ' + 날짜 + '개');
  console.log('   판정 — ' + 줄.판정);
  console.log('   ── 화면 글자 앞 500자 ──');
  console.log('   ' + ((줄.본문 || '(비었습니다)').slice(0, 500).split('\n').join('\n   ')));
  if (줄.응답.length) {
    console.log('   ── 서버가 준 것 (앞 8개) ──');
    줄.응답.slice(0, 8).forEach((x) => console.log('     ' + x));
  }
  결과.push({ ...줄, html: undefined, 본문: (줄.본문 || '').slice(0, 2000) });
}

await browser.close();
fs.writeFileSync(path.join(둘곳, 'result.json'), JSON.stringify(결과, null, 1), 'utf8');

console.log('\n── 모아 보기 ──');
결과.forEach((r) => console.log('  ' + r.이름.padEnd(22) + r.판정));
console.log('\n받은 쪽 전체는 tools/hosp/reports/browser/ 에 있습니다');
