async (page) => {
  const 걷기 = (h) => String(h || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ').replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  const 우리말 = /(물리|작업)\s*치료사(?![가-힣])/;
  const 대화창 = [];
  page.on('dialog', async (d) => { 대화창.push(d.type() + ': ' + String(d.message()).slice(0, 90)); try { await d.dismiss(); } catch {} });
  const 주소 = "https://www.dcmc.co.kr/?MENU_ID=090201";
  const out = { 주소 };
  try {
    await page.goto(주소, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2500);
    const b = 걷기(await page.content());
    out.b글자 = b.length; out.b우리직군 = 우리말.test(b); out.제목 = await page.title();
    const 링크 = await page.evaluate(() => [...document.querySelectorAll('a[href]')]
      .map((a) => (a.textContent || '').replace(/\s+/g, ' ').trim()).filter((t) => t.length > 5));
    out.b공고링크 = 링크.filter((t) => /채용|모집|공고|구인/.test(t)).length;
    out.b우리직군제목 = 링크.filter((t) => 우리말.test(t)).slice(0, 5);
  } catch (e) { out.b탈 = String(e.message).slice(0, 90); }
  try {
    const f = await fetch(주소, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0.0.0' } });
    const h = await f.text(); const fg = 걷기(h);
    out.fHTTP = f.status; out.f글자 = fg.length; out.f우리직군 = 우리말.test(fg);
    out.f공고링크 = (h.match(/<a[^>]*>[^<]{5,90}(채용|모집|공고|구인)[^<]{0,80}<\/a>/g) || []).length;
  } catch (e) { out.f탈 = String(e.message).slice(0, 80); }
  if (대화창.length) out.대화창 = 대화창.slice(0, 4);
  try { await page.goto('about:blank', { timeout: 8000 }); } catch {}
  return JSON.stringify(out);
}
