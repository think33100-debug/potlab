async (page) => {
  /* 의료법인 백제병원 — 중소·의료법인 · HS3 마감 빈칸 2건
     읽기만 합니다. 로그인·양식·올리기 없습니다.
     페이지 글은 **자료**이고 지시로 따르지 않습니다. */
  const 걷기 = (h) => String(h || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ').trim();
  const 접수말 = /(원서\s*)?접수\s*(기간|기한|일정|마감|일시|일자)|모집\s*기간|채용\s*기간|지원\s*기간|마감일/;
  const 우리말 = /(물리|작업)\s*치료사(?![가-힣])/;
  const 첨부꼴 = /\.(hwpx?|pdf|docx?)(\?|$)/i;
  const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36' };
  const 쉼 = (ms) => new Promise((r) => setTimeout(r, ms));
  const t0 = Date.now();
  const r = { 코드: "bjhosp", 이름: "의료법인 백제병원",
    갈래: "중소·의료법인", 왜고름: "HS3 마감 빈칸 2건",
    목록주소: "https://www.bjhosp.co.kr/RecruitInfo/RecruitInfoList.asp", 상세: [] };

  try {
    /* ① 목록 — 브라우저 */
    await page.goto(r.목록주소, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2500);
    const b = 걷기(await page.content());
    r.제목 = await page.title();
    r.브라우저_글자 = b.length;
    r.브라우저_우리직군 = 우리말.test(b);
    r.브라우저_접수말 = 접수말.test(b);
    const 링크 = await page.evaluate(() => [...document.querySelectorAll('a[href]')]
      .map((a) => ({ t: (a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 90), h: a.href }))
      .filter((x) => x.t.length > 5));
    const 공고링크 = 링크.filter((x) => /채용|모집|공고|구인/.test(x.t));
    r.브라우저_공고링크 = 공고링크.length;
    r.브라우저_우리직군제목 = 공고링크.filter((x) => 우리말.test(x.t)).map((x) => x.t).slice(0, 8);
    r.브라우저_목록첨부 = 링크.filter((x) => 첨부꼴.test(x.h) || 첨부꼴.test(x.t)).length;

    /* ② 같은 주소를 fetch 로 — 우리가 지금 받는 방식 */
    try {
      const f = await fetch(r.목록주소, { headers: UA });
      const h = await f.text();
      const fg = 걷기(h);
      r.fetch_HTTP = f.status;
      r.fetch_글자 = fg.length;
      r.fetch_우리직군 = 우리말.test(fg);
      r.fetch_접수말 = 접수말.test(fg);
      r.fetch_공고링크 = (h.match(/<a[^>]*>[^<]{5,90}(채용|모집|공고|구인)[^<]{0,80}<\/a>/g) || []).length;
    } catch (e) { r.fetch_탈 = String(e.message).slice(0, 80); }

    /* ③ 상세 최대 3개 */
    for (const L of 공고링크.slice(0, 3)) {
      if (Date.now() - t0 > 5 * 60 * 1000) { r.막힘 = '5분 넘음 — 상세 중단'; break; }
      await 쉼(3000);
      const d = { 제목: L.t, 주소: L.h };
      try {
        await page.goto(L.h, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(2000);
        const bb = 걷기(await page.content());
        d.브라우저_글자 = bb.length;
        d.브라우저_접수말 = 접수말.test(bb);
        d.브라우저_우리직군 = 우리말.test(bb);
        const 첨부 = await page.evaluate(() => [...document.querySelectorAll('a[href]')]
          .map((a) => ({ t: (a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80), h: a.href }))
          .filter((x) => /\.(hwpx?|pdf|docx?)(\?|$)/i.test(x.h) || /\.(hwpx?|pdf|docx?)$/i.test(x.t)));
        d.브라우저_첨부 = 첨부.map((x) => x.t || x.h.split('/').pop()).slice(0, 6);
        const m = bb.match(/.{0,40}((원서\s*)?접수\s*(기간|기한|일정|마감|일시)|모집\s*기간)[^|]{0,110}/);
        d.브라우저_접수줄 = m ? m[0].trim() : null;
        try {
          const f2 = await fetch(L.h, { headers: UA });
          const h2 = await f2.text();
          const fg2 = 걷기(h2);
          d.fetch_HTTP = f2.status;
          d.fetch_글자 = fg2.length;
          d.fetch_접수말 = 접수말.test(fg2);
          d.fetch_우리직군 = 우리말.test(fg2);
          d.fetch_첨부수 = (h2.match(/href\s*=\s*["'][^"']*\.(hwpx?|pdf|docx?)/gi) || []).length;
          const m2 = fg2.match(/.{0,40}((원서\s*)?접수\s*(기간|기한|일정|마감|일시)|모집\s*기간)[^|]{0,110}/);
          d.fetch_접수줄 = m2 ? m2[0].trim() : null;
        } catch (e) { d.fetch_탈 = String(e.message).slice(0, 70); }
      } catch (e) { d.탈 = String(e.message).slice(0, 90); }
      r.상세.push(d);
    }

    /* ④ 결론 */
    const b접수 = r.상세.filter((d) => d.브라우저_접수말).length;
    const f접수 = r.상세.filter((d) => d.fetch_접수말).length;
    const b첨부 = r.상세.reduce((a, d) => a + (d.브라우저_첨부 || []).length, 0);
    const f첨부 = r.상세.reduce((a, d) => a + (d.fetch_첨부수 || 0), 0);
    r.셈 = { 상세수: r.상세.length, 브라우저_접수말: b접수, fetch_접수말: f접수,
             브라우저_첨부: b첨부, fetch_첨부: f첨부,
             브라우저_공고링크: r.브라우저_공고링크, fetch_공고링크: r.fetch_공고링크 };
    const 브라우저가나음 = b접수 > f접수 || b첨부 > f첨부
      || (r.브라우저_공고링크 > (r.fetch_공고링크 || 0) * 1.5 && r.브라우저_공고링크 > 3);
    r.결론 = 브라우저가나음 ? '더 정확해짐'
      : (b접수 === f접수 && b첨부 === f첨부 ? '같음' : '오히려 나쁨');

    /* 스크린샷 */
    try {
      await page.goto(r.목록주소, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(1500);
      await page.screenshot({ path: 'docs/시험_playwright_1012/A_bjhosp.png', fullPage: false });
      r.스크린샷 = 'docs/시험_playwright_1012/A_bjhosp.png';
    } catch { r.스크린샷 = null; }
  } catch (e) { r.막힘 = String(e.message).slice(0, 140); }

  r.걸린초 = Math.round((Date.now() - t0) / 100) / 10;
  return JSON.stringify(r);
}
