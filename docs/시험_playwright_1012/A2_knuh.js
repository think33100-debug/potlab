async (page) => {
  const 시작 = Date.now();
  const 탈 = [];
  const 대화창 = [];
  page.on('dialog', async (d) => { 대화창.push(d.type() + ': ' + String(d.message()).slice(0, 120)); try { await d.dismiss(); } catch (e) {} });
  page.on('pageerror', (e) => { if (탈.length < 5) 탈.push(String(e.message).slice(0, 120)); });

  let 상태 = null;
  try {
    const r = await page.goto("https://www.knuh.or.kr/hospitalinfo/hospitalinfo_03_05_list.asp", { waitUntil: 'domcontentloaded', timeout: 30000 });
    상태 = r ? r.status() : null;
  } catch (e) {
    탈.push('goto — ' + String(e.message).slice(0, 160));
  }
  /* 자바스크립트로 그리는 목록을 기다립니다. networkidle 은 광고·추적 때문에
     영영 안 올 수 있으니 짧게 걸고 실패해도 넘어갑니다 */
  try { await page.waitForLoadState('networkidle', { timeout: 12000 }); } catch (e) {}
  await page.waitForTimeout(3000);

  let html = '';
  try { html = await page.content(); } catch (e) { 탈.push('content — ' + String(e.message).slice(0, 120)); }
  let 글자 = '';
  try { 글자 = await page.evaluate(() => document.body ? document.body.innerText : ''); } catch (e) {}

  try { await page.screenshot({ path: "docs/시험_playwright_1012/A2_knuh.png", fullPage: false }); } catch (e) {}
  /* 모달을 떨어내고 끝냅니다 — 안 하면 다음 명령이 막힙니다 */
  try { await page.goto('about:blank'); } catch (e) {}

  return JSON.stringify({
    코드: "knuh",
    이름: "강원대학교병원",
    주소: "https://www.knuh.or.kr/hospitalinfo/hospitalinfo_03_05_list.asp",
    갈래: "html",
    HTTP: 상태,
    HTML글자: html.length,
    본문글자: 글자.length,
    대화창, 탈,
    걸린초: Math.round((Date.now() - 시작) / 100) / 10,
    HTML: html.slice(0, 900000),
  });
}
