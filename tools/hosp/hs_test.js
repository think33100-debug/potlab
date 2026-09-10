// 병원 채용 게시판 설정 시험기 — Apps Script 의 hospParseHtml_ 와 같은 규칙으로 목록을 뽑아 봅니다.
// 사용: node hs_test.js cfg_N.json            (사이트를 실제로 받아서 파싱)
//       node hs_test.js cfg_N.json saved.html (받아둔 파일로 파싱)
// cfg 형식 (모든 정규식은 문자열 · JS 정규식 · 플래그는 따로 적지 않음 · 블록 정규식은 g 로 돎):
// {
//   "name": "심평원 병원목록의 기관명 그대로",      ← 반드시 목록 이름과 같아야 함 (예: 「강릉아산병원」 「연세대학교 원주세브란스기독병원」)
//   "type": "html",
//   "url": "목록 페이지 주소",
//   "enc": "UTF-8" | "EUC-KR",                       ← 선택
//   "base": "https://호스트",                         ← 상대 링크 앞에 붙일 것
//   "row":  "<tr[\\s\\S]*?<\\/tr>",                  ← 공고 한 줄(블록)을 잡는 정규식 (g 로 전체를 돎)
//   "title": "<a[^>]*>([\\s\\S]*?)<\\/a>",          ← 블록 안에서 제목 (첫 캡처)
//   "link":  "href=\"([^\"]+)\"",                    ← 블록 안에서 링크 (첫 캡처). onclick 만 있으면 그 안의 번호를 잡고 linkFmt 로 조립
//   "linkFmt": "https://host/view.do?id={1}",       ← 선택 · {1} 자리에 link 캡처를 넣음
//   "date":  "(20\\d{2}[.\\-/]\\d{1,2}[.\\-/]\\d{1,2})", ← 블록 안의 날짜들 (여러 개면 처음=시작, 마지막=마감)
//   "skip":  "공지|합격자|발표",                       ← 선택 · 제목에 있으면 건너뜀
//   "single": "posted" | "deadline",                 ← 선택 · 블록에 날짜가 하나뿐일 때 그것이 올린 날인지 마감일인지 (기본 posted)
//   "note":  "사람이 알아야 할 것"
// }
const fs = require('fs');
const path = require('path');
const cfg = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0.0.0';

function stripTags(s) {
  return String(s || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
}
function abs(href, base) {
  href = String(href || '').trim().replace(/&amp;/g, '&');
  if (/^https?:\/\//i.test(href)) return href;
  if (href.indexOf('//') === 0) return 'https:' + href;
  if (href.indexOf('/') === 0) return base.replace(/\/$/, '') + href;
  return base.replace(/\/$/, '') + '/' + href.replace(/^\.\//, '');
}
function ymd(s) {
  const m = String(s || '').match(/(20\d{2})[.\-/]\s?(\d{1,2})[.\-/]\s?(\d{1,2})/);
  return m ? m[1] + '.' + ('0' + m[2]).slice(-2) + '.' + ('0' + m[3]).slice(-2) : '';
}
/* ★ 이 함수는 Apps Script 의 hospParseHtml_ 와 글자 하나 다르지 않게 유지합니다 */
function hospParseHtml(html, cfg) {
  const out = [];
  const rowRe = new RegExp(cfg.row, 'g');
  const titleRe = new RegExp(cfg.title);
  const linkRe = cfg.link ? new RegExp(cfg.link) : null;
  const dateRe = cfg.date ? new RegExp(cfg.date, 'g') : null;
  const skipRe = cfg.skip ? new RegExp(cfg.skip) : null;
  let m;
  while ((m = rowRe.exec(html))) {
    const blk = m[0];
    const t = blk.match(titleRe);
    if (!t) continue;
    const title = stripTags(t[1]);
    if (title.length < 4) continue;
    if (skipRe && skipRe.test(title)) continue;
    let url = '';
    if (linkRe) {
      const l = blk.match(linkRe);
      if (l) url = cfg.linkFmt ? cfg.linkFmt.replace('{1}', l[1]).replace('{2}', l[2] || '') : abs(l[1], cfg.base || '');
    }
    const dates = [];
    if (dateRe) { let d; while ((d = dateRe.exec(blk))) { const v = ymd(d[1] || d[0]); if (v) dates.push(v); } }
    /* 날짜가 둘이면 시작~마감. 하나뿐이면 cfg.single 이 'deadline' 일 때만 마감으로, 아니면 올린 날(posted)로 봅니다 —
       등록일을 마감으로 오해하면 그 공고가 「지난 공고」 로 버려져 조용히 빠지기 때문입니다. */
    let from = '', to = '', posted = '';
    if (dates.length >= 2) { from = dates[0]; to = dates[dates.length - 1]; }
    else if (dates.length === 1) { if (cfg.single === 'deadline') to = dates[0]; else posted = dates[0]; }
    out.push({ title: title, url: url, from: from, to: to, posted: posted });
  }
  return out;
}
async function main() {
  let html;
  if (process.argv[3]) html = fs.readFileSync(process.argv[3], 'utf8');
  else {
    const res = await fetch(cfg.url, { headers: { 'User-Agent': UA } });
    const buf = Buffer.from(await res.arrayBuffer());
    html = new TextDecoder(cfg.enc || 'utf-8').decode(buf);
    console.log('HTTP ' + res.status + ' · ' + buf.length + '바이트');
  }
  const rows = hospParseHtml(html, cfg);
  console.log(cfg.name + ' · 뽑힌 줄 ' + rows.length);
  rows.slice(0, 12).forEach(function (r, i) { console.log((i + 1) + '. ' + r.title.slice(0, 60) + ' | ' + (r.from ? r.from + ' ~ ' : '') + (r.to || (r.posted ? '올림 ' + r.posted : '날짜없음')) + ' | ' + r.url.slice(0, 110)); });
  const bad = rows.filter(function (r) { return !r.url; }).length;
  if (bad) console.log('※ 링크 없는 줄 ' + bad);
}
main().catch(function (e) { console.error('오류 ' + e.message); process.exit(1); });
