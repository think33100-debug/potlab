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
  /* ★ 2026-10-13 — **오늘 + 2년보다 뒤면 그 날짜를 안 믿습니다** (세중님 승인).
     병원이 「채용시까지」 를 먼 날짜로 적습니다 —
       길병원 「접수기간 2026.02.06(금) 08:00 ~ 2099.12.31(목) 00:00 D-26742」
     우리 코드가 지어낸 값이 아니라 **사이트에 그렇게 적혀 있습니다.** 그래서
     막는 자리가 「넣기」 가 아니라 **「읽을 때 안 믿기」** 입니다.
     2년으로 잡은 까닭 — 「2026-12-31」 처럼 그해 말을 적는 공고가 146건 있습니다.
     그것까지 버리면 멀쩡한 마감일을 잃습니다. 2년을 넘는 것은 사람이 적은
     날짜가 아닙니다 (2026-10-13 에 본 7건이 전부 2050·2099·2400 이었습니다).
     버린 날짜는 `to원문` 에 남깁니다 — 수집기가 deadline_src 에 적습니다. */
  const 두해뒤 = (function () {
    const d = new Date(Date.now() + 730 * 86400e3);
    return d.getFullYear() + '.' + pad(d.getMonth() + 1) + '.' + pad(d.getDate());
  }());
  /* 'YYYY.MM.DD' 는 자리를 채운 글자라 그대로 견주면 됩니다 */
  const 너무먼날 = function (v) { return !!v && String(v) > 두해뒤; };
  const 뚜껑 = function (res) {
    if (res && 너무먼날(res.to)) { res.to원문 = res.to; res.to = ''; }
    return res;
  };
  const anchors = /(원서\s*)?접수\s*(기간|기한|일정|마감|일시|일자|기일)|모집\s*기간|채용\s*기간|지원\s*기간|응시원서\s*접수|마감\s*일시|마감일|공고\s*기간/g;
  let a, best = null;
  while ((a = anchors.exec(text))) {
    const win = text.slice(a.index, a.index + 140);
    const ds = []; let m; full.lastIndex = 0;
    while ((m = full.exec(win))) ds.push({ i: m.index, e: m.index + m[0].length, v: m[1] + '.' + pad(m[2]) + '.' + pad(m[3]) });
    if (!ds.length) continue;
    const res = { from: '', to: '' };
    /* ★ 2026-10-11 — **연도 없는 둘째 날짜를 먼저** 봅니다.
     *
     * 전에는 ds[1](연도 있는 다음 날짜)을 먼저 봤습니다. 그런데 공공기관
     * 공고의 일정 표는 이렇게 생겼습니다 (고양시 GJ305079 에서 잡았습니다) —
     *
     *   원서접수 | 1차 서류전형 합격자 발표일 | …
     *   2026. 10. 19.(월) ~ 10. 23.(금) [5일간] | 2026. 11. 3.(화) 전·후 | …
     *
     * 「10. 23.」 은 연도가 없어 full 정규식(20\d\d 요구)이 **건너뜁니다.**
     * 그래서 ds[1] 이 **합격자 발표일 2026.11.3** 이 되고, 둘 사이 글
     * 「.(월) ~ 10. 23.(금) [5일간]」 에 `~` 가 있어 link 검사를 통과해
     * **발표일을 마감으로** 담았습니다. API 값은 10-23 인데 11-03 이 나왔습니다.
     *
     * 고친 뒤: ds[0] 바로 뒤에 「~ M. D」 가 붙어 있으면 **그것이 마감**입니다.
     * 그 꼴이 없을 때만 ds[1] 을 봅니다. */
    const after = win.slice(ds[0].e, ds[0].e + 40);
    /* 「2026. 9. 2.(수) ~ 9. 16.(수)」 처럼 둘째 날짜에 연도가 없는 꼴 */
    const y = after.match(/^[^~\-–\d]{0,12}[~\-–]\s*(?:\([^)]*\)\s*)?(\d{1,2})\s*[.월]\s*(\d{1,2})/);
    /* 두 날짜 사이가 「~」「-」「부터」 로 이어져야 시작~마감.
       아니면(합격자 발표일 등이 뒤따르는 것) 첫 날짜만 씁니다 */
    const link = ds.length >= 2 ? win.slice(ds[0].e, ds[1].i) : '';

    if (y) {
      /* ①을 **먼저** 봅니다 — 위 설명(고양시 GJ305079)의 까닭입니다 */
      res.from = ds[0].v;
      res.to = ds[0].v.slice(0, 4) + '.' + pad(y[1]) + '.' + pad(y[2]);
    } else if (ds.length >= 2 && link.length <= 30 && /[~\-–]|부터/.test(link)) {
      res.from = ds[0].v; res.to = ds[1].v;
    } else if (/마감|기한|까지/.test(a[0]) || (/까지/.test(after)
      && !/[~\-–]|부터/.test(after.slice(0, after.indexOf('까지'))))) {
      /* ★ 2026-10-07 — 「날짜 ~ 채용시까지」 를 마감일로 읽던 버그를 고쳤습니다.
         백제병원 「접수기간 : 2026. 10. 01( 목 )~ 채용시까지」 에서 10.01 을
         **마감일**로 담고 있었습니다. 10.01 은 접수 **시작**이고 마감일은 없습니다
         (진짜 수시 공고입니다). 날짜와 「까지」 사이에 「~ · - · 부터」 가 끼어
         있으면 그 날짜는 시작입니다 */
      res.to = ds[0].v;
    } else {
      res.from = ds[0].v;
    }
    /* 「공고기간」 은 게시 기간이라 접수 마감과 다를 때가 많습니다 (경북대 공고기간 ~9.25 · 접수 ~9.16). 접수·모집 쪽을 우선합니다 */
    res.rank = /공고\s*기간/.test(a[0]) ? 1 : 0;
    뚜껑(res);
    if (res.to && res.rank === 0) return res;
    if (!best || (res.to && !best.to) || (res.rank < best.rank && res.to)) best = res;
  }
  return 뚜껑(best) || { from: '', to: '' };
}

/* 접수 안내 문장만 떼어 옵니다 — **판정하지 않습니다** (2026-10-07).
 *
 * 「수시채용인가」 판정은 DB 의 마감표시() 한 곳에만 둡니다 (세중님 지시).
 * 그래서 여기서는 낱말을 보지 않고, 접수 안내가 적힌 문장을 그대로 떼어
 * `evidence.접수문장` 에 담습니다. 판정은 DB 가 그 문장에 합니다.
 * 이렇게 하면 「채용시까지」 같은 낱말 목록이 코드와 DB 에 두 벌 생기지 않습니다.
 *
 * 돌려주는 것 — 앵커 둘레 글 (최대 240자). 없으면 빈 문자열.
 */
function hs접수문장(text) {
  const t = String(text || '');
  const anchors = /(원서\s*)?접수\s*(기간|기한|일정|마감|일시|일자|기일)|모집\s*기간|채용\s*기간|지원\s*기간|응시원서\s*접수|마감\s*일시|마감일|전형\s*일정/g;
  let a, 모음 = [];
  while ((a = anchors.exec(t)) && 모음.length < 2) 모음.push(t.slice(a.index, a.index + 160).trim());
  return 모음.join(' / ').slice(0, 240);
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
module.exports = { hsDetailDates, hsText, hs접수문장 };
