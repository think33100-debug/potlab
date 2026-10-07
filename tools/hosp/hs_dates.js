// 상세 페이지 본문에서 접수 기간을 찾는 규칙. **이것이 실제로 쓰이는 한 벌입니다.**
//
// ★ 2026-10-07 — 이 파일은 2026-09 부터 「시험기」 로 저장소에 있었고, 아무 수집기도
//   부르지 않았습니다. 그래서 HS 출처 공고 313건의 마감일이 비어 「수시채용」 으로
//   떴습니다 (홈페이지_이전_지도.md:35 의 `✗` — 옮기려고 적어 두고 안 했습니다).
//   이제 두 수집기가 여기를 부릅니다 —
//     tools/collect-hosp.mjs   병원 게시판 (HS3)
//     tools/collect-nid.mjs    치매센터   (ND2)
//   **고치면 양쪽이 같이 바뀝니다.** 고치기 전에 시험을 돌리십시오 —
//     node tools/hosp/hs_날짜시험.mjs --앵커
//
// 사용(손으로 한 주소만 볼 때): node tools/hosp/hs_dates.js <url> [<url>...]
//   ⚠ 이 CLI 는 utf-8 로 못 박혀 있어 euc-kr 쪽을 빈손으로 냅니다.
//     수집기는 글받기()(tools/certs/index.mjs)로 받아 인코딩을 풀어 줍니다.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0.0.0';
function hsText(html) {
  return String(html || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ');
}
/* ★ 서버 hsDetailDates_ 와 글자 하나 다르지 않게 유지 */
function hsDetailDates(text) {
  text = String(text || '');
  const pad = function (n) { return ('0' + n).slice(-2); };
  const full = /(20\d{2})\s*[.년\-/]\s*(\d{1,2})\s*[.월\-/]\s*(\d{1,2})\s*일?/g;
  const anchors = /(원서\s*)?접수\s*(기간|기한|일정|마감|일시|일자|기일)|모집\s*기간|채용\s*기간|지원\s*기간|응시원서\s*접수|마감\s*일시|마감일|공고\s*기간/g;
  let a, best = null;
  while ((a = anchors.exec(text))) {
    const win = text.slice(a.index, a.index + 140);
    const ds = []; let m; full.lastIndex = 0;
    while ((m = full.exec(win))) ds.push({ i: m.index, e: m.index + m[0].length, v: m[1] + '.' + pad(m[2]) + '.' + pad(m[3]) });
    if (!ds.length) continue;
    const res = { from: '', to: '' };
    /* 두 날짜 사이가 「~」「-」「부터」 로 이어져야 시작~마감. 아니면(합격자 발표일 등이 뒤따르는 것) 첫 날짜만 씁니다 */
    const link = ds.length >= 2 ? win.slice(ds[0].e, ds[1].i) : '';
    if (ds.length >= 2 && link.length <= 30 && /[~\-–]|부터/.test(link)) { res.from = ds[0].v; res.to = ds[1].v; }
    else {
      /* 「2026. 9. 2.(수) ~ 9. 16.(수)」 처럼 두 번째 날짜에 연도가 없는 경우 */
      const after = win.slice(ds[0].e, ds[0].e + 40);
      const y = after.match(/^[^~\-–\d]{0,12}[~\-–]\s*(?:\([^)]*\)\s*)?(\d{1,2})\s*[.월]\s*(\d{1,2})/);
      if (y) { res.from = ds[0].v; res.to = ds[0].v.slice(0, 4) + '.' + pad(y[1]) + '.' + pad(y[2]); }
      /* ★ 2026-10-07 — 「날짜 ~ 채용시까지」 를 마감일로 읽던 버그를 고쳤습니다.
         백제병원 「접수기간 : 2026. 10. 01( 목 )~ 채용시까지」 에서 10.01 을
         **마감일**로 담고 있었습니다. 10.01 은 접수 **시작**이고 마감일은 없습니다
         (진짜 수시 공고입니다). 날짜와 「까지」 사이에 「~ · - · 부터」 가 끼어
         있으면 그 날짜는 시작입니다 */
      else if (/마감|기한|까지/.test(a[0]) || (/까지/.test(after)
        && !/[~\-–]|부터/.test(after.slice(0, after.indexOf('까지'))))) res.to = ds[0].v;
      else res.from = ds[0].v;
    }
    /* 「공고기간」 은 게시 기간이라 접수 마감과 다를 때가 많습니다 (경북대 공고기간 ~9.25 · 접수 ~9.16). 접수·모집 쪽을 우선합니다 */
    res.rank = /공고\s*기간/.test(a[0]) ? 1 : 0;
    if (res.to && res.rank === 0) return res;
    if (!best || (res.to && !best.to) || (res.rank < best.rank && res.to)) best = res;
  }
  return best || { from: '', to: '' };
}
if (require.main === module) {
  (async function () {
    for (const u of process.argv.slice(2)) {
      const r = await fetch(u, { headers: { 'User-Agent': UA } });
      const t = hsText(new TextDecoder('utf-8').decode(Buffer.from(await r.arrayBuffer())));
      console.log(u.slice(0, 80) + ' → ' + JSON.stringify(hsDetailDates(t)));
    }
  })();
}
module.exports = { hsDetailDates, hsText };
