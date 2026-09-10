// 상세 페이지 본문에서 접수 기간을 찾는 규칙 시험기 — 서버 hsDetailDates_ 와 같은 코드.
// 사용: node hs_dates.js <url> [<url>...]
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
      else if (/마감|기한|까지/.test(a[0]) || /까지/.test(after)) res.to = ds[0].v;
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
