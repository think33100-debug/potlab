/* ═══════════════════════════════════════════════════════════════
 *  교육·학술 수집기 — 학회 교육과정과 학술대회
 *  2026-10-03
 * ═══════════════════════════════════════════════════════════════
 *   node tools/collect-edu.mjs            받아서 담습니다
 *   node tools/collect-edu.mjs --dry      받아서 세기만 (담지 않습니다)
 *   node tools/collect-edu.mjs --시험     파서 자가검사 (그물 안 씀)
 *
 *  ── 왜 있나 ──────────────────────────────────────────────────
 *  스펙쌓기의 「이수 교육」 칸(web/lib/signup-fields.ts COURSES_OT)은
 *  학회와 과정을 고르게 되어 있는데, **언제 어디서 열리는지가 없었습니다.**
 *
 *  ── robots.txt (2026-10-03 에 직접 확인) ─────────────────────
 *    ○ dysphagia.co.kr   없음(404)      → 긁습니다
 *    ○ ksdr.or.kr        없음(404)      → 긁습니다
 *    ○ kdys.or.kr        「allow: /」    → 긁습니다 (EUC-KR)
 *    △ cogsociety.org    「Disallow: /」 + 「Allow: /$ /index.asp /html」
 *       /lect/ · /notice/ · /board01/ 은 **막혀 있습니다.**
 *       허락된 첫 화면에 공지 제목·날짜가 실려 있어 그것만 담고
 *       상세는 학회 화면으로 보냅니다
 *    ✗ kaot.org          「Disallow: /」 전면 → **긁지 않습니다**
 *       (세중님이 넣으라 하신 곳이지만 robots 가 막습니다. 결정 대기)
 *
 *  ── 출처 이름을 함부로 바꾸지 마세요 ─────────────────────────
 *  `출처` 는 COURSES_OT 의 학회 이름과 **글자 그대로 같아야** 합니다.
 *  그래야 화면에서 「내가 고른 교육」과 이어집니다.
 *  (운전재활은 스스로 「한국운전재활학회」라 적습니다. 대한~ 이 아닙니다)
 *
 *  ── 열쇠 ─────────────────────────────────────────────────────
 *    COLLECT_KEY_EDU       교육담기() 가 보는 열쇠
 *    SUPABASE_URL · SUPABASE_SERVICE_KEY
 *  COLLECT_KEY_EDU 가 없으면 서버 열쇠로 collect_secret 에서 읽습니다.
 *  (값은 어디에도 찍지 않습니다)
 * ═══════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const 읽기 = (p) => {
  try {
    return Object.fromEntries(fs.readFileSync(p, 'utf8').split(/\r?\n/)
      .map((l) => l.match(/^\s*([A-Za-z_0-9]+)\s*=\s*(.*)$/))
      .filter(Boolean).map((m) => [m[1], m[2].trim().replace(/^["']|["']$/g, '')]));
  } catch { return {}; }
};
const cfg = {
  ...읽기(path.join(ROOT, '.env.local')),
  ...읽기(path.join(ROOT, 'web', '.env.local')),
  ...읽기(path.join(ROOT, '.env.server')),
  ...읽기(path.join(ROOT, '.env')),
  ...process.env,
};

const dry = process.argv.includes('--dry');
const 시험 = process.argv.includes('--시험');
const UA = 'Mozilla/5.0 (compatible; POTJOB/1.0; +https://potjob.co.kr)';

/* ── 글자 다루기 ───────────────────────────────────────────── */
const 풀기 = (s) => String(s || '')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/&sdot;/g, '·').replace(/&times;/g, '×');
const 글만 = (h) => 풀기(String(h || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

/* 날짜 — 되돌려 맞춰 봅니다 (봉사 수집기와 같은 방식).
   「2014-04-__」 「0000-00-00」 「2014-02-30」 을 전부 걸러냅니다 */
export function 날짜만(v) {
  const s = String(v || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '';
  const d = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s ? s : '';
}
/* 「2026-10-19」 「2026.10.19」 「26-08-04」 를 받습니다.
   두 자리 해는 20xx 로 봅니다 — 게시판이 그렇게만 씁니다 */
export function 날짜꼴(v) {
  const s = 풀기(v).trim();
  let m = s.match(/(\d{4})[-.\/](\d{1,2})[-.\/](\d{1,2})/);
  if (!m) {
    m = s.match(/(?:^|[^\d])(\d{2})[-.\/](\d{1,2})[-.\/](\d{1,2})(?:$|[^\d])/);
    if (m) m = [m[0], '20' + m[1], m[2], m[3]];
  }
  if (!m) return '';
  return 날짜만(m[1] + '-' + String(m[2]).padStart(2, '0') + '-' + String(m[3]).padStart(2, '0'));
}

/* 갈래 — 제목으로 봅니다. 애매하면 '공지' 입니다.
   「교육」으로 잘못 찍으면 회원이 신청하러 갔다 헛걸음합니다 */
export function 갈래보기(제목) {
  const t = String(제목 || '');
  if (/학술대회|집담회|심포지|학술집|총회|학회지|논문|공모/.test(t)) return '학술대회';
  if (/교육|강좌|과정|워크샵|워크숍|연수|실습|세미나/.test(t)) return '교육';
  return '공지';
}

/* ── 그물 ───────────────────────────────────────────────────── */
async function 받기(u, 이름) {
  const c = new AbortController();
  const id = setTimeout(() => c.abort(), 25000);
  try {
    const r = await fetch(u, { signal: c.signal, headers: { 'User-Agent': UA } });
    const b = Buffer.from(await r.arrayBuffer());
    if (!r.ok) return { 오류: 'HTTP ' + r.status };
    const euc = /euc-kr|ks_c_5601/i.test((r.headers.get('content-type') || '') + b.slice(0, 2000).toString('latin1'));
    return { html: new TextDecoder(euc ? 'euc-kr' : 'utf-8').decode(b), 바이트: b.length, 꼴: euc ? 'EUC-KR' : 'UTF-8' };
  } catch (e) { return { 오류: e.name + ': ' + e.message }; }
  finally { clearTimeout(id); }
}

/* ═══ 파서 다섯 — 전부 2026-10-03 에 받은 원문을 보고 썼습니다 ═══ */

/* ① 대한연하재활학회 교육신청 — 제일 좋은 자료입니다.
      카드 하나에 상태·교육명·일시·장소·모집인원이 다 있습니다 */
export function 연하재활교육(html) {
  const out = [];
  for (const m of html.matchAll(/<div class="card_right_contents">([\s\S]*?)<div class="card_contents_footer">/g)) {
    const c = m[1];
    const 상태 = 글만((c.match(/<span class="status_badge[^"]*">([\s\S]*?)<\/span>/) || [])[1]) || '모름';
    const a = c.match(/<a href="([^"]*bo_table=edu[^"]*wr_id=(\d+)[^"]*)"[^>]*>([\s\S]*?)<\/a>/);
    if (!a) continue;
    const 앞말 = 글만((c.match(/<span style="color:#1E5BB8[^"]*">([\s\S]*?)<\/span>/) || [])[1]);
    const 값 = (이름표) => {
      const r = new RegExp('<span class="info_label">' + 이름표 + '<\\/span>\\s*<span class="info_val[^"]*">([\\s\\S]*?)<\\/span>');
      return 글만((c.match(r) || [])[1]);
    };
    const 일시 = 값('교육일시');
    const 두날 = [...일시.matchAll(/\d{4}[-.\/]\d{1,2}[-.\/]\d{1,2}/g)].map((x) => 날짜꼴(x[0])).filter(Boolean);
    const 제목 = (앞말 ? 앞말 + ' ' : '') + 글만(a[3]);
    out.push({
      번호: '연하재활:' + a[2], 출처: '대한연하재활학회', 직군: '작업치료사', 갈래: '교육',
      제목, 시작: 두날[0] || '', 끝: 두날[1] || 두날[0] || '',
      장소: 값('장소'), 모집인원: 값('모집인원'),
      상태: /마감/.test(상태) ? '접수마감' : /진행|접수/.test(상태) ? '접수중' : /예정/.test(상태) ? '예정' : 상태,
      올린날: '', 링크: 풀기(a[1]), 원문: 글만(c).slice(0, 400),
    });
  }
  return out;
}

/* ② 그누보드 게시판 (연하재활 공지) — bo_tit + bo_date (26-08-04 꼴) */
export function 그누보드(html, 출처, 꼬리, 기본주소) {
  const out = [];
  for (const m of html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)) {
    const c = m[1];
    const a = c.match(/<a href="([^"]*wr_id=(\d+)[^"]*)"[^>]*class="bo_tit"[^>]*>([\s\S]*?)<\/a>/);
    if (!a) continue;
    const 제목 = 글만(a[3].replace(/<i[\s\S]*$/, ''));
    if (!제목) continue;
    out.push({
      번호: 꼬리 + ':' + a[2], 출처, 직군: '작업치료사', 갈래: 갈래보기(제목), 제목,
      시작: '', 끝: '', 장소: '', 모집인원: '', 상태: '모름',
      올린날: 날짜꼴((c.match(/<span class="bo_date">([\s\S]*?)<\/span>/) || [])[1]),
      링크: 풀기(a[1]).startsWith('http') ? 풀기(a[1]) : 기본주소 + 풀기(a[1]),
      원문: 글만(c).slice(0, 300),
    });
  }
  return out;
}

/* ③ 한국운전재활학회 공지 — 표 한 줄에 번호·제목·작성자·첨부·조회·등록일 */
export function 운전재활(html) {
  const out = [];
  for (const m of html.matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
    const c = m[1];
    const a = c.match(/<a href="(view\.php\?idx=(\d+)[^"]*)"[^>]*>([\s\S]*?)<\/a>/);
    if (!a) continue;
    const 제목 = 글만(a[3]);
    if (!제목) continue;
    const 날 = [...c.matchAll(/\d{4}-\d{2}-\d{2}/g)].map((x) => 날짜만(x[0])).filter(Boolean);
    out.push({
      번호: '운전재활:' + a[2], 출처: '한국운전재활학회', 직군: '작업치료사',
      갈래: 갈래보기(제목), 제목,
      시작: '', 끝: '', 장소: '', 모집인원: '', 상태: '모름',
      올린날: 날[날.length - 1] || '',
      링크: 'http://www.ksdr.or.kr/sub_notice/' + 풀기(a[1]),
      원문: 글만(c).slice(0, 300),
    });
  }
  return out;
}

/* ④ 대한연하장애학회 공지 (EUC-KR) — td title 에 제목이 그대로 있습니다 */
export function 연하장애(html) {
  const out = [];
  for (const m of html.matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
    const c = m[1];
    const a = c.match(/<a href="(\?num=(\d+)[^"]*code=notice[^"]*)"[^>]*>([\s\S]*?)<\/a>/);
    if (!a) continue;
    const 제목 = 글만((c.match(/<td class="text-left[^"]*" title="([^"]*)"/) || [])[1]) || 글만(a[3]);
    if (!제목) continue;
    const 날 = [...c.matchAll(/\d{4}-\d{2}-\d{2}/g)].map((x) => 날짜만(x[0])).filter(Boolean);
    out.push({
      번호: '연하장애:' + a[2], 출처: '대한연하장애학회', 직군: '작업치료사',
      갈래: 갈래보기(제목), 제목,
      시작: '', 끝: '', 장소: '', 모집인원: '', 상태: '모름',
      올린날: 날[0] || '',
      링크: 'http://www.kdys.or.kr/board/list.html?num=' + a[2] + '&code=notice',
      원문: 글만(c).slice(0, 300),
    });
  }
  /* 같은 글이 PC·휴대폰 칸에 두 번 나옵니다 — 번호로 한 번만 남깁니다 */
  const 본것 = new Set();
  return out.filter((x) => !본것.has(x.번호) && 본것.add(x.번호));
}

/* ⑤ 대한인지재활학회 — 첫 화면(robots 가 허락한 곳)의 공지 토막만.
      상세(/notice/view.asp)는 막혀 있어 **링크로만** 보냅니다 */
export function 인지재활(html) {
  const out = [];
  const 칸 = html.slice(html.indexOf('공지사항'), html.indexOf('main-bbs-container') + 4000);
  for (const m of 칸.matchAll(/<a href="(\/notice\/view\.asp\?Key=(\d+))">([\s\S]*?)<\/a>/g)) {
    const 날 = 날짜꼴((m[3].match(/<span class="date">([\s\S]*?)<\/span>/) || [])[1]);
    const 제목 = 글만(m[3].replace(/<span class="date">[\s\S]*?<\/span>/, ''));
    if (!제목) continue;
    out.push({
      번호: '인지재활:' + m[2], 출처: '대한인지재활학회', 직군: '작업치료사',
      갈래: 갈래보기(제목), 제목,
      시작: '', 끝: '', 장소: '', 모집인원: '', 상태: '모름',
      올린날: 날, 링크: 'https://cogsociety.org' + m[1], 원문: 제목,
    });
  }
  return out;
}

/* ═══ 자가검사 — 2026-10-03 에 받은 원문 조각으로 돕니다 ═══ */
if (시험) {
  let 참 = 0, 거짓 = 0;
  const 봐 = (이름, 된것, 바란것) => {
    const ok = JSON.stringify(된것) === JSON.stringify(바란것);
    console.log((ok ? '  ○ ' : '  ★ ') + 이름 + (ok ? '' : '\n      된것 ' + JSON.stringify(된것) + '\n      바란것 ' + JSON.stringify(바란것)));
    ok ? 참++ : 거짓++;
  };

  console.log('날짜 걸러내기');
  봐('멀쩡한 날', 날짜만('2026-10-19'), '2026-10-19');
  봐('빈 자리 날', 날짜만('2014-04-__'), '');
  봐('없는 날', 날짜만('2014-02-30'), '');
  봐('0000', 날짜만('0000-00-00'), '');
  봐('점으로 쓴 날', 날짜꼴('2026.10.19'), '2026-10-19');
  봐('두 자리 해', 날짜꼴('26-08-04'), '2026-08-04');
  봐('글자 섞인 날', 날짜꼴('등록일 2026-06-02 조회'), '2026-06-02');
  봐('날짜 아님', 날짜꼴('모집인원 100명'), '');

  console.log('\n갈래 보기');
  봐('교육과정', 갈래보기('2026년 제4차 연하재활 기능적전기자극치료 교육과정: 이론'), '교육');
  봐('워크샵', 갈래보기('2026년 제4차 구강운동촉진기술 워크샵'), '교육');
  봐('학술대회', 갈래보기('[대한연하장애학회] 제17회 추계학술대회 안내'), '학술대회');
  봐('집담회', 갈래보기('[대한연하장애학회]제29차 정기집담회 안내'), '학술대회');
  봐('그냥 공지', 갈래보기('대한연하재활학회 홈페이지 리뉴얼'), '공지');
  봐('환불 안내는 교육이 아님', 갈래보기('교육과정 신청 취소 및 환불 절차 안내'), '교육');

  console.log('\n연하재활 교육 카드 (받은 원문 그대로)');
  const 카드 = `<div class="card_right_contents">
    <div class="card_contents_header"><span class="status_badge badge_closed">접수마감</span></div>
    <div class="card_contents_body">
    <div class="info_row"><span class="info_label">교육명</span>
    <span class="info_val title_strong"><span style="color:#1E5BB8; font-weight:600;">[전기 이론과정]</span>
    <a href="http://www.dysphagia.co.kr/bbs/board.php?bo_table=edu&amp;wr_id=308&amp;tab=ing">2026년 제4차 연하재활 기능적전기자극치료 교육과정: 이론</a></span></div>
    <div class="info_row"><span class="info_label">교육일시</span><span class="info_val">2026-10-19 ~ 2026-10-25</span></div>
    <div class="info_row"><span class="info_label">장소</span><span class="info_val">온라인(치료과학 임상교육센터)</span></div>
    <div class="info_row"><span class="info_label">모집인원</span><span class="info_val">100명 (선착순)     </span></div>
    </div><div class="card_contents_footer">`;
  const c = 연하재활교육(카드)[0] || {};
  봐('번호', c.번호, '연하재활:308');
  봐('제목에 앞말까지', c.제목, '[전기 이론과정] 2026년 제4차 연하재활 기능적전기자극치료 교육과정: 이론');
  봐('시작', c.시작, '2026-10-19');
  봐('끝', c.끝, '2026-10-25');
  봐('장소', c.장소, '온라인(치료과학 임상교육센터)');
  봐('모집인원', c.모집인원, '100명 (선착순)');
  봐('상태', c.상태, '접수마감');
  봐('링크의 &amp; 풀기', c.링크, 'http://www.dysphagia.co.kr/bbs/board.php?bo_table=edu&wr_id=308&tab=ing');

  console.log('\n운전재활 표 한 줄');
  const tr = `<tr><td>4</td><td><a href="view.php?idx=405&page=1&board_name=notice&search=&find=">교육과정 신청 취소 및 환불 절차 안내</a></td>
    <td>관리자</td><td><a href="../NFUpload/nfupload_down.php?tmp_name=20260602082315_907acfa2_0.hwp"><i class="fas fa-save"></i></a></td>
    <td>474</td><td>2026-06-02</td></tr>`;
  const k = 운전재활(tr)[0] || {};
  봐('번호', k.번호, '운전재활:405');
  봐('제목', k.제목, '교육과정 신청 취소 및 환불 절차 안내');
  봐('올린날 — 첨부 파일이름의 20260602 에 안 속음', k.올린날, '2026-06-02');
  봐('링크', k.링크, 'http://www.ksdr.or.kr/sub_notice/view.php?idx=405&page=1&board_name=notice&search=&find=');

  console.log('\n연하장애 표 한 줄 (같은 글이 두 번 나오는 것)');
  const tr2 = `<tr><td>*</td>
    <td class="text-left m-list-section" title="[대한연하장애학회] 제17회 추계학술대회 안내">
    <span class="m-list-hide"><span class="subject"><a href="?num=2293&amp;start=0&amp;sort=top desc,reg_dt desc&amp;code=notice&amp;key=&amp;keyword=">[대한연하장애학회] 제17회 추계학술대회 안내</a></span></span>
    <div class="m-list-show"><span class="m-subject"> <a href="?num=2293&amp;code=notice">[대한연하장애학회] 제17회 추계학술대회 안내</a></span>
    <div class="m-span-list"><span>관리자</span><span>2026-09-08</span><span>529</span></div></div></td>
    <td>관리자</td><td>2026-09-08</td><td></td><td>529</td></tr>`;
  const y = 연하장애(tr2);
  봐('한 번만 남는지', y.length, 1);
  봐('제목', y[0] && y[0].제목, '[대한연하장애학회] 제17회 추계학술대회 안내');
  봐('갈래', y[0] && y[0].갈래, '학술대회');
  봐('올린날', y[0] && y[0].올린날, '2026-09-08');

  console.log('\n인지재활 첫 화면 토막');
  const li = `공지사항<div class="main-bbs"><ul class='list'><li>
    <a href="/notice/view.asp?Key=53">2026년 대한인지재활학회  아동 기본강좌 개최 건<span class="date">2026-09-14</span></a>
    </li></ul></div><div class="main-bbs-container">`;
  const g = 인지재활(li)[0] || {};
  봐('제목에서 날짜 떼기', g.제목, '2026년 대한인지재활학회 아동 기본강좌 개최 건');
  봐('올린날', g.올린날, '2026-09-14');
  봐('갈래', g.갈래, '교육');
  봐('링크', g.링크, 'https://cogsociety.org/notice/view.asp?Key=53');

  console.log('\n' + (거짓 ? '★ ' + 거짓 + '개 틀렸습니다 (' + 참 + '개 맞음)' : '○ ' + 참 + '개 다 맞았습니다'));
  process.exit(거짓 ? 1 : 0);
}

/* ═══ 받아오기 ═══ */
const 곳 = [
  { 이름: '연하재활 교육신청', u: 'http://www.dysphagia.co.kr/bbs/board.php?bo_table=edu', f: 연하재활교육 },
  { 이름: '연하재활 공지', u: 'http://www.dysphagia.co.kr/bbs/board.php?bo_table=notice',
    f: (h) => 그누보드(h, '대한연하재활학회', '연하재활공지', 'http://www.dysphagia.co.kr') },
  { 이름: '운전재활 공지', u: 'http://www.ksdr.or.kr/sub_notice/list.php', f: 운전재활 },
  { 이름: '연하장애 공지', u: 'http://www.kdys.or.kr/board/list.html?code=notice', f: 연하장애 },
  { 이름: '인지재활 첫 화면', u: 'https://cogsociety.org/', f: 인지재활 },
];

const 모두 = [];
const 막힌곳 = [];
for (const x of 곳) {
  const r = await 받기(x.u, x.이름);
  if (r.오류) {
    /* 한 곳이 막히면 그 곳만 멈추고 다음으로 갑니다 */
    막힌곳.push(x.이름 + ' — ' + r.오류);
    console.log('★ ' + x.이름.padEnd(18) + ' 못 받음: ' + r.오류);
    continue;
  }
  let 줄;
  try { 줄 = x.f(r.html); }
  catch (e) { 막힌곳.push(x.이름 + ' — 파서: ' + e.message); console.log('★ ' + x.이름 + ' 파서 터짐: ' + e.message); continue; }
  const 교육수 = 줄.filter((v) => v.갈래 === '교육').length;
  console.log('○ ' + x.이름.padEnd(18) + String(줄.length).padStart(3) + '건  (교육 ' + 교육수
    + ' · 학술 ' + 줄.filter((v) => v.갈래 === '학술대회').length
    + ' · 공지 ' + 줄.filter((v) => v.갈래 === '공지').length + ')  ' + r.바이트 + '바이트 ' + r.꼴);
  for (const v of 줄.slice(0, 3)) console.log('     · ' + v.갈래.padEnd(4) + ' ' + (v.시작 || v.올린날 || '날짜없음') + '  ' + v.제목.slice(0, 50));
  모두.push(...줄);
  await new Promise((s) => setTimeout(s, 1200));   // 학회 서버에 부담 안 주려고
}

/* 번호가 같은 것은 뒤에 온 것으로 (같은 글이 두 게시판에 걸릴 때) */
const 하나씩 = [...new Map(모두.map((x) => [x.번호, x])).values()];
console.log('\n모두 ' + 하나씩.length + '건 · 출처 ' + new Set(하나씩.map((x) => x.출처)).size + '곳');
for (const [s, n] of Object.entries(하나씩.reduce((a, x) => ((a[x.출처] = (a[x.출처] || 0) + 1), a), {})))
  console.log('   ' + String(n).padStart(3) + '  ' + s);

if (dry) { console.log('\n--dry 라 담지 않았습니다.'); process.exit(0); }

/* ── 담기 ── */
const URL_ = cfg.SUPABASE_URL || cfg.NEXT_PUBLIC_SUPABASE_URL;
const SK = cfg.SUPABASE_SERVICE_KEY;
if (!URL_ || !SK) { console.error('\n열쇠가 모자랍니다 — SUPABASE_URL · SUPABASE_SERVICE_KEY'); process.exit(1); }

const 부르기 = async (fn, body) => {
  const r = await fetch(URL_ + '/rest/v1/rpc/' + encodeURIComponent(fn), {
    method: 'POST',
    headers: { apikey: SK, Authorization: 'Bearer ' + SK, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const t = await r.text();
  if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + t.slice(0, 300));
  return t ? JSON.parse(t) : null;
};

/* 열쇠가 .env 에 없으면 서버 열쇠로 읽어 씁니다 — 값은 찍지 않습니다 */
let 열쇠 = cfg.COLLECT_KEY_EDU;
if (!열쇠) {
  const r = await fetch(URL_ + "/rest/v1/collect_secret?source=eq.EDU&select=secret",
    { headers: { apikey: SK, Authorization: 'Bearer ' + SK } });
  열쇠 = ((await r.json())[0] || {}).secret;
  if (!열쇠) { console.error('\nEDU 열쇠가 collect_secret 에 없습니다'); process.exit(1); }
  console.log('\n열쇠를 .env 에서 못 찾아 collect_secret 에서 읽었습니다 (값은 안 찍습니다).');
  console.log('서버 크론에서 돌리려면 .env 에 COLLECT_KEY_EDU 를 넣어 주십시오.');
}

let 담음 = 0;
for (let i = 0; i < 하나씩.length; i += 200) {
  const r = await 부르기('교육담기', { p_secret: 열쇠, p_교육: 하나씩.slice(i, i + 200) });
  담음 += (r && r.교육) || 0;
}
const 센것 = await 부르기('교육셈', { p_직군: null, p_출처: null, p_지난것: false });
const 전부 = await 부르기('교육셈', { p_직군: null, p_출처: null, p_지난것: true });
console.log('\n담았습니다 — 보낸 것 ' + 담음 + '건 · 표 전체 ' + 전부 + '건 · 아직 안 끝난 것 ' + 센것 + '건');
if (막힌곳.length) console.log('\n막힌 곳 ' + 막힌곳.length + ':\n  ' + 막힌곳.join('\n  '));
