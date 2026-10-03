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
const 시작한때 = Date.now();      // 박동에 「얼마나 걸렸나」를 남기려고
const UA = 'Mozilla/5.0 (compatible; POTJOB/1.0; +https://potjob.co.kr)';

/* ── 글자 다루기 ───────────────────────────────────────────── */
const 풀기 = (s) => String(s || '')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/&sdot;/g, '·').replace(/&times;/g, '×');
const 글만 = (h) => 풀기(String(h || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

/* 게시판 제목에 붙어 오는 덤을 뗍니다.
   그누보드는 댓글 수를 **제목 링크 안에** 넣습니다 —
   `<span class="sound_only">댓글</span><span class="cnt_cmt">1</span><span class="sound_only">개</span>`
   그대로 두면 제목이 「… 자격시험 공고 댓글 1 개」 가 됩니다 (2026-10-03 에 봤습니다) */
const 제목정리 = (h) => 글만(String(h || '')
  .replace(/<span class="sound_only">[\s\S]*?<\/span>/gi, '')
  .replace(/<span class="cnt_cmt">[\s\S]*?<\/span>/gi, '')
  .replace(/<i[\s\S]*$/, ''));

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
  /* ★ 이 줄이 먼저입니다. 「교육」 이라는 낱말이 들어 있어도 **교육이 아닌**
     글이 많습니다 — 「등록대상자 발표」 「환불 절차 안내」 「교육신청 안내사항」.
     이것들을 교육으로 찍으면 회원이 신청하러 갔다 헛걸음하고,
     그러면 「교육」 딱지 자체를 못 믿게 됩니다.
     「2026 … 교육과정 안내」 처럼 진짜 모집 글은 **안내**만으로 안 걸립니다 */
  if (/발표|취소|환불|안내사항|리뉴얼|등급|변경 안내|연기|마감 안내/.test(t)) return '공지';
  if (/학술대회|집담회|심포지|학술집|총회|학회지|논문|공모/.test(t)) return '학술대회';
  /* 물리치료 쪽 학회는 과정 이름을 영어로 적는 일이 많습니다 —
     「Intermediate course of Lumbar spine 접수안내」 「BLP&IPG코스 신청안내」.
     한국말 낱말만 보면 이런 **진짜 모집 글이 공지로 떨어집니다**
     (2026-10-03 밤에 /edu 를 눌러 보고 찾았습니다) */
  if (/교육|강좌|특강|과정|코스|course|워크샵|워크숍|연수|실습|세미나|스터디/i.test(t)) return '교육';
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
    const 제목 = 제목정리(a[3]);
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
    const 제목 = 제목정리(a[3]);
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

/* ═══ 물리치료 쪽 다섯 (2026-10-03 저녁에 더함) ═══
   전부 robots.txt 를 먼저 받아 보고 넣었습니다 — 자세한 것은 위 머리말. */

/* 번호가 없는 곳(보바스)을 위한 짧은 지문.
   제목·장소·기간이 같으면 같은 줄로 봅니다 — 다시 받아도 안 쌓입니다 */
function 지문(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/* 「2026. 09. 26 ~ 10. 24」 → 「접수 9월 26일 ~ 10월 24일」
   ★ 이것은 **교육 날짜가 아니라 접수 기간**입니다. 보바스는 「일 시」 를
   「-」 로 비워두고 등록 기간만 적습니다. 교육 날짜인 척 넣으면 회원이
   날짜를 잘못 적게 되므로 시작·끝 칸에는 **안 넣습니다.** */
export function 접수기간(v) {
  const s = String(v || '').replace(/\s+/g, '');
  const m = s.match(/(\d{4})\.(\d{1,2})\.(\d{1,2})~(?:(\d{4})\.)?(\d{1,2})\.(\d{1,2})/);
  if (!m) return '';
  return '접수 ' + Number(m[2]) + '월 ' + Number(m[3]) + '일 ~ ' + Number(m[5]) + '월 ' + Number(m[6]) + '일';
}

/* ⑥ 한국보바스협회 — 첫 화면의 「접수진행중인 교육프로그램」.
      글마다 주소가 없습니다(javascript:void(0)) — 교육일정 쪽으로 보냅니다.
      ★ 출처를 「한국보바스협회」로 적습니다. 고르는 목록에서 작업치료 쪽은
      「보바스」, 물리치료 쪽은 「한국보바스협회」인데 같은 단체입니다.
      그래서 직군을 **공통**으로 둬 양쪽 탭에 다 나오게 합니다. */
export function 보바스(html) {
  const out = [];
  const i = html.indexOf('id="main-schedule-list"');
  if (i < 0) return out;
  const 칸 = html.slice(i, i + 12000);
  for (const m of 칸.matchAll(/<li>([\s\S]*?)<\/li>/g)) {
    const c = m[1];
    const 값 = (이름표) => {
      const r = new RegExp('<dt>' + 이름표 + '<\\/dt>\\s*<dd>([\\s\\S]*?)<\\/dd>');
      return 글만((c.match(r) || [])[1]);
    };
    const 제목 = 값('교육명');
    if (!제목) continue;
    const 장소 = 값('장 소');
    const 등록 = 값('등 록');
    const 일시 = 값('일 시');
    const 두날 = [...일시.matchAll(/\d{4}[-.\/]\s*\d{1,2}[-.\/]\s*\d{1,2}/g)]
      .map((x) => 날짜꼴(x[0].replace(/\s/g, ''))).filter(Boolean);
    out.push({
      번호: '보바스:' + 지문(제목 + '|' + 장소 + '|' + 등록),
      출처: '한국보바스협회', 직군: '공통', 갈래: '교육', 제목,
      시작: 두날[0] || '', 끝: 두날[1] || 두날[0] || '',
      장소, 모집인원: 접수기간(등록), 상태: '접수중', 올린날: '',
      링크: 'https://www.kbobath.com/program/schedule',
      원문: 글만(c).slice(0, 300),
    });
  }
  return out;
}

/* ⑦ 그누보드 표 꼴 (정형도수 · 칼텐본 지회) — td_subject 안에 글 링크.
      ★ 칼텐본 지회는 날짜를 「01-15」 처럼 **해 없이** 적습니다.
        날짜꼴() 이 그런 것을 빈 값으로 돌려주므로 올린날이 비어 남습니다.
        아무 해나 붙이지 않습니다 (해를 지어내면 지난 글이 올해 것이 됩니다) */
export function 그누보드표(html, 출처, 꼬리, 직군) {
  const out = [];
  for (const m of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const c = m[1];
    const a = c.match(/<td class="td_subject"[^>]*>\s*<a href="([^"]*wr_id=(\d+)[^"]*)"[^>]*>([\s\S]*?)<\/a>/);
    if (!a) continue;
    const 제목 = 제목정리(a[3]);
    if (!제목) continue;
    /* 글쓴이 칸에 메일 주소·쪽지 링크가 섞여 있어 날짜는 날짜 칸에서만 봅니다 */
    const 날칸 = c.match(/<td class="td_date(?:time)?"[^>]*>([\s\S]*?)<\/td>/);
    out.push({
      번호: 꼬리 + ':' + a[2], 출처, 직군, 갈래: 갈래보기(제목), 제목,
      시작: '', 끝: '', 장소: '', 모집인원: '', 상태: '모름',
      올린날: 날짜꼴(날칸 ? 글만(날칸[1]) : ''),
      링크: 풀기(a[1]), 원문: 제목,
    });
  }
  return out;
}

/* 상세 글에서 **올린 날**을 꺼냅니다 (2026-10-03 밤).

   정형도수·칼텐본은 목록에 날짜를 「09-28」처럼 해 없이 적습니다.
   그런데 **상세 글에는 해가 있습니다** — 「26-09-28 12:48」.

   ★ 아무 데서나 긁으면 안 됩니다. 같은 쪽에 **댓글 날짜**도 같은 꼴로
     있습니다 (정형도수 2727번은 글 26-08-23, 댓글 26-09-21).
     댓글 날짜는 `bo_vc_hdinfo` 안에 있고, 글 날짜는 `bo_v_info` 칸의
     「작성일」 바로 뒤 <strong> 입니다. 그 칸 안에서만 찾습니다. */
export function 상세날짜(html) {
  const i = html.search(/id="bo_v_info"/);
  if (i < 0) return '';
  /* 그 칸이 끝나는 곳까지만 봅니다 — 댓글 쪽으로 넘어가지 않게 */
  const 칸 = html.slice(i, i + 4000).split(/<\/section>/)[0];
  const m = 칸.match(/작성일<\/span>\s*<strong>([^<]*)<\/strong>/)
    || 칸.match(/작성일\s*<strong>([^<]*)<\/strong>/);
  return m ? 날짜꼴(글만(m[1])) : '';
}

/* ⑧ 대한PNF학회 — 글 주소가 /notice/105 꼴입니다 */
export function pnf(html) {
  const out = [];
  for (const m of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const c = m[1];
    const a = c.match(/<a href="(https?:\/\/kspnf\.org\/notice\/(\d+))"[^>]*>([\s\S]*?)<\/a>/);
    if (!a) continue;
    const 제목 = 제목정리(a[3]);
    if (!제목) continue;
    const 날 = [...c.matchAll(/\d{4}-\d{2}-\d{2}/g)].map((x) => 날짜만(x[0])).filter(Boolean);
    out.push({
      번호: 'PNF:' + a[2], 출처: '대한고유수용성신경근촉진법학회', 직군: '물리치료사',
      갈래: 갈래보기(제목), 제목,
      시작: '', 끝: '', 장소: '', 모집인원: '', 상태: '모름',
      올린날: 날[0] || '', 링크: a[1], 원문: 제목,
    });
  }
  return out;
}

/* ⑨ 국제수중치료협회 — 글 주소가 없습니다. `page_view(1215)` 를 눌러야 열립니다.
      번호만 받아 목록 쪽으로 보냅니다. **https 는 인증서가 자기서명이라
      안 됩니다 — http 로 읽습니다. 검증은 끄지 않았습니다** */
export function 수중치료(html) {
  const out = [];
  for (const m of html.matchAll(/<tr[^>]*id="mylist(\d+)"[^>]*>([\s\S]*?)<\/tr>/g)) {
    const c = m[2];
    const a = c.match(/<a href='javascript:page_view\(\d+\);'[^>]*class='bold'>([\s\S]*?)<\/a>/);
    if (!a) continue;
    const 제목 = 글만(a[1]);
    if (!제목) continue;
    const 날 = [...c.matchAll(/20\d{2}\.\d{1,2}\.\d{1,2}/g)].map((x) => 날짜꼴(x[0])).filter(Boolean);
    out.push({
      번호: '수중치료:' + m[1], 출처: '국제수중치료협회', 직군: '물리치료사',
      갈래: 갈래보기(제목), 제목,
      시작: '', 끝: '', 장소: '', 모집인원: '', 상태: '모름',
      올린날: 날[0] || '',
      링크: 'http://www.iatakorea.org/bbs/list.php?b_id=8&ffid=03-02',
      원문: 제목,
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
  /* 아래 넷 — 「교육」 이 들어 있지만 교육이 아닌 글입니다 (받은 31건에 실제로 있던 제목) */
  봐('환불 안내는 교육 아님', 갈래보기('교육과정 신청 취소 및 환불 절차 안내'), '공지');
  봐('등록대상자 발표는 교육 아님', 갈래보기('2026년 연하재활전문가 : 제4차 성인기본과정 등록대상자 발표'), '공지');
  봐('안내사항은 교육 아님', 갈래보기('교육신청 안내사항'), '공지');
  봐('회원 등급 안내사항', 갈래보기('회원 등급 안내사항'), '공지');
  /* 그래도 진짜 모집 글은 남아야 합니다 */
  봐('진짜 교육과정 안내는 교육', 갈래보기('2026 고령자안전운전지도사 자격(2급) 교육과정 안내'), '교육');
  봐('양성교육 안내도 교육', 갈래보기('2025년 운전재활전문가 양성교육 안내'), '교육');
  봐('기본강좌 개최도 교육', 갈래보기('2026년 대한인지재활학회 아동 기본강좌 개최 건'), '교육');
  /* 영어로 적은 과정 이름 — 한국말 낱말만 보면 공지로 떨어집니다 */
  봐('영어 course', 갈래보기('[대전지부] 2026 Intermediate course of Lumbar spine 접수안내'), '교육');
  봐('「코스」', 갈래보기('2026년도 강원도회 10월 BLP&IPG코스 신청안내'), '교육');
  봐('「스터디」', 갈래보기('26.2.8 상부척추 기본과정 스터디 접수'), '교육');
  봐('「특강」', 갈래보기('울산시회 9월 특강(기능적 테이핑)'), '교육');
  /* 그래도 교육이 아닌 것은 그대로 공지여야 합니다 */
  봐('합격자 발표는 그대로 공지', 갈래보기('2025년 정형도수전문물리치료사 합격자 발표'), '공지');
  봐('연회비 안내는 그대로 공지', 갈래보기('연회비 입금 안내'), '공지');
  봐('취소 공지는 그대로 공지', 갈래보기('26년 8월 서울/경기 하지 기본과정 취소공지'), '공지');

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

  console.log('\n보바스 (첫 화면 토막 · 받은 원문 그대로)');
  const bo = `<ul class="m-schedule-list" id="main-schedule-list">
    <li><a href="javascript:void(0);">
    <dl class="title"><dt>교육명</dt><dd>특강(인체동작의 이해) (Pelvis &amp; Core Stability)</dd></dl>
    <dl class="option day"><dt>일 시</dt><dd>-</dd></dl>
    <dl class="option day"><dt>등 록</dt><dd>2026. 08. 24 ~ 10. 18</dd></dl>
    <dl class="option jangso"><dt>장 소</dt><dd>분당 보바스기념병원</dd></dl>
    </a></li></ul>`;
  const b1 = 보바스(bo)[0] || {};
  봐('제목의 &amp; 풀기', b1.제목, '특강(인체동작의 이해) (Pelvis & Core Stability)');
  봐('장소', b1.장소, '분당 보바스기념병원');
  /* ★ 등록 기간을 **시작·끝에 안 넣는지**가 핵심입니다 */
  봐('교육 날짜 칸은 비어야 함', b1.시작 + '|' + b1.끝, '|');
  봐('접수 기간은 따로', b1.모집인원, '접수 8월 24일 ~ 10월 18일');
  봐('직군 공통 (작업·물리 양쪽)', b1.직군, '공통');
  봐('두 번 받아도 같은 번호', 보바스(bo)[0].번호, b1.번호);

  console.log('\n그누보드 표 (정형도수)');
  const kao = `<tr class="bo_notice"><td class="td_num"><strong>공지</strong></td>
    <td class="td_subject"><a href="http://www.kaomt.or.kr/bbs/board.php?bo_table=0201&amp;wr_id=2743">
    2026대한정형도수물리치료학회 강사(복구)신청</a><img src="x.gif" alt="첨부파일"></td>
    <td class="td_name sv_use"><a href="http://www.kaomt.or.kr/bbs/formmail.php?mb_id=admin&amp;email=YWRtaW4=">메일보내기</a></td>
    <td class="td_date">2026-09-30</td><td class="td_num">123</td></tr>`;
  const k1 = 그누보드표(kao, '대한정형도수물리치료학회', '정형도수', '물리치료사')[0] || {};
  봐('번호', k1.번호, '정형도수:2743');
  봐('제목', k1.제목, '2026대한정형도수물리치료학회 강사(복구)신청');
  봐('올린날', k1.올린날, '2026-09-30');
  봐('링크의 &amp; 풀기', k1.링크, 'http://www.kaomt.or.kr/bbs/board.php?bo_table=0201&wr_id=2743');

  /* 그누보드는 댓글 수를 **제목 링크 안에** 넣습니다. 안 떼면 제목이
     「… 자격시험 공고 댓글 1 개」 가 됩니다 (2026-10-03 에 실제로 그랬습니다) */
  const kao2 = `<tr class=""><td class="td_subject">
    <a href="http://www.kaomt.or.kr/bbs/board.php?bo_table=0201&amp;wr_id=2727">
    26년 제26차 정형도수전문물리치료사 자격시험 공고
    <span class="sound_only">댓글</span><span class="cnt_cmt">1</span><span class="sound_only">개</span></a></td>
    <td class="td_date">09-28</td></tr>`;
  봐('제목에서 댓글 수 떼기',
    (그누보드표(kao2, '대한정형도수물리치료학회', '정형도수', '물리치료사')[0] || {}).제목,
    '26년 제26차 정형도수전문물리치료사 자격시험 공고');

  console.log('\n상세 글에서 해 찾기 — 댓글 날짜에 안 속는지');
  /* 정형도수 2727번 원문 꼴: 글은 26-08-23, 댓글은 26-09-21 입니다 */
  const 상세 = `<section id="bo_v_info"><h2>페이지 정보</h2>
    작성자 <strong><span class="sv_member">관리자</span></strong>
    <span class="sound_only">작성일</span><strong>26-08-23 11:24</strong>
    조회<strong>506회</strong>댓글<strong>1건</strong>
    </section><!-- 댓글 -->
    <span class="bo_vc_hdinfo"><time datetime="2026-09-21T16:18:00+09:00">26-09-21 16:18</time></span>`;
  봐('글 날짜를 집는지 (댓글 아님)', 상세날짜(상세), '2026-08-23');
  봐('칼텐본 2024년 글', 상세날짜('<section id="bo_v_info">작성자 <strong>관리자</strong>'
    + '<span class="sound_only">작성일</span><strong>24-01-15 09:45</strong></section>'), '2024-01-15');
  봐('칼텐본 2020년 글', 상세날짜('<section id="bo_v_info">'
    + '<span class="sound_only">작성일</span><strong>20-02-06 15:21</strong></section>'), '2020-02-06');
  봐('그 칸이 없으면 빈 값', 상세날짜('<div>아무것도 없음</div>'), '');

  console.log('\n칼텐본 지회 — 해 없는 날짜(01-15)를 지어내지 않는지');
  const kal = `<tr class="bo_notice"><td class="td_num"><strong>공지</strong></td>
    <td class="td_subject"><a href="http://kaltenbornevjenthomt.co.kr/2016/bbs/board.php?bo_table=education02&amp;wr_id=179">
    2024년 전국 및 지역별 전체 교육일정</a></td>
    <td class="td_name sv_use"><span class="sv_member">관리자</span></td>
    <td class="td_date">01-15</td><td class="td_num">4577</td></tr>`;
  const k2 = 그누보드표(kal, '칼텐본-에비언스학회', '칼텐본', '물리치료사')[0] || {};
  봐('번호', k2.번호, '칼텐본:179');
  봐('해를 모르면 비워 둠', k2.올린날, '');
  봐('갈래', k2.갈래, '교육');

  console.log('\n대한PNF학회');
  const pn = `<tr class=""><td class="pc_vw">18</td>
    <td class="td_subject tal" style="padding-left:0px">
    <a href="https://kspnf.org/notice/105">2026년도 대한PNF학회 학술대회<i class="fa fa-download"></i></a></td>
    <td class="pc_vw"><span class="sv_member">사무국</span></td><td>2026-09-03</td></tr>`;
  const p1 = pnf(pn)[0] || {};
  봐('번호', p1.번호, 'PNF:105');
  봐('제목에서 아이콘 떼기', p1.제목, '2026년도 대한PNF학회 학술대회');
  봐('올린날', p1.올린날, '2026-09-03');
  봐('출처는 고르는 목록 이름으로', p1.출처, '대한고유수용성신경근촉진법학회');

  console.log('\n국제수중치료협회');
  const ia = `<tr onmouseover="this.style.backgroundColor='#fafafa'" id="mylist1215">
    <td class="sml_text_en">160</td>
    <td class="bold txt_l"><span class='somb_'><a href='javascript:page_view(1215,8,"");'><img src='./imgFd/sm_1.png'/></a>&nbsp;&nbsp;</span><a href='javascript:page_view(1215);' class='bold'>2026년 전반기 수중치료 강좌일정</a>&nbsp;<img src='/bbs/images/common/file.gif'/></td>
    <td class="sml_text">임현주</td><td class="sml_text_en">2026.01.06</td><td class="sml_text_en">3276</td></tr>`;
  const i1 = 수중치료(ia)[0] || {};
  봐('번호', i1.번호, '수중치료:1215');
  봐('제목 (그림 링크에 안 속음)', i1.제목, '2026년 전반기 수중치료 강좌일정');
  봐('올린날 (2026.01.06 꼴)', i1.올린날, '2026-01-06');
  봐('갈래', i1.갈래, '교육');

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

  /* ── 물리치료 쪽 (2026-10-03 저녁) ── */
  { 이름: '보바스 접수중', u: 'https://www.kbobath.com/', f: 보바스 },
  { 이름: '정형도수 학회공지', u: 'http://www.kaomt.or.kr/bbs/board.php?bo_table=0201',
    f: (h) => 그누보드표(h, '대한정형도수물리치료학회', '정형도수', '물리치료사') },
  { 이름: 'PNF 공지사항', u: 'https://kspnf.org/notice', f: pnf },
  { 이름: '칼텐본 교육일정', u: 'http://kaltenbornevjenthomt.co.kr/2016/bbs/board.php?bo_table=education02&me_code=2020',
    f: (h) => 그누보드표(h, '칼텐본-에비언스학회', '칼텐본', '물리치료사') },
  { 이름: '칼텐본 교육안내', u: 'http://kaltenbornevjenthomt.co.kr/2016/bbs/board.php?bo_table=education01&me_code=20',
    f: (h) => 그누보드표(h, '칼텐본-에비언스학회', '칼텐본', '물리치료사') },
  /* ★ https 는 인증서가 자기서명이라 연결이 끊깁니다. 검증은 **끄지 않고**
     http 로 읽습니다 (2026-10-03 확인). robots.txt 는 없습니다 */
  { 이름: '수중치료 교육일정', u: 'http://www.iatakorea.org/bbs/list.php?b_id=8&ffid=03-02', f: 수중치료 },
];

/* 서버(클라우드) 주소를 막는 곳.

   대한정형도수물리치료학회(kaomt.or.kr)는 **Lightsail 주소를 통째로 막습니다** —
   robots.txt 조차 403 입니다. 어느 User-Agent 로도 안 됩니다.
   집 컴퓨터에서는 200 입니다 (2026-10-04 양쪽에서 재 봤습니다).

   그래서 이곳이 막힌 것은 **「이번 바퀴가 탈났다」로 안 셉니다.**
   안 그러면 /admin/beat 이 날마다 빨간 줄이 되고, 그러면 아무도
   빨간 줄을 안 믿게 됩니다. 대신 박동 메모에 남기고
   「손으로 확인할 곳」에 적어 둡니다.

   ★ 이미 담긴 27건은 그대로 있습니다 — 수집기는 덮어쓰기만 하고
     지우지 않습니다. 집에서 한 번씩 돌리면 새로 고쳐집니다. */
const 서버에서막힘 = ['정형도수 학회공지'];

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

/* ── 해 없는 날짜 메우기 (2026-10-03 밤) ──────────────────────────
   정형도수·칼텐본은 목록에 「09-28」처럼 해를 안 적습니다.
   상세 글에는 「26-09-28 12:48」로 해가 있어서, **날짜가 빈 줄만**
   상세를 한 번 열어 채웁니다.

   ★ 이미 날짜를 알아낸 줄은 다시 안 엽니다 — 표에서 먼저 물어봅니다.
     안 그러면 크론이 돌 때마다 쉰 번씩 남의 서버를 두드립니다. */
const 날짜없는것 = 하나씩.filter((x) => !x.올린날 && !x.시작 && /wr_id=\d+/.test(x.링크));
if (날짜없는것.length && !process.argv.includes('--상세없이')) {
  const URL0 = cfg.SUPABASE_URL || cfg.NEXT_PUBLIC_SUPABASE_URL;
  const SK0 = cfg.SUPABASE_SERVICE_KEY;
  /* ★ 전에 알아낸 날짜를 **그대로 들고 옵니다.**
     처음에는 「아는 것은 건너뛰기」만 했는데, 그러면 그 줄의 올린날이 빈
     채로 다시 담겨 **표에 있던 날짜를 null 로 덮어썼습니다**
     (교육담기 가 `올린날 = excluded.올린날` 이라 빈 값도 그대로 들어갑니다).
     2026-10-03 밤에 두 번 돌려 보고 잡았습니다. 건너뛰려면 값을 가져와야 합니다 */
  /* ★ 쪽을 넘겨 가며 받습니다. PostgREST 가 **100줄에서 자릅니다** —
     `limit=5000` 을 붙여도 서버 쪽 max-rows 가 이깁니다.
     이걸 몰랐을 때 102줄 중 100줄만 받아, 남은 2줄을 날마다 다시
     열고 있었습니다 (2026-10-03 밤에 세어 보고 잡았습니다).
     이 프로젝트에서 같은 한도에 걸린 게 두 번째입니다 — 봉사목록 도 그랬습니다 */
  let 아는날짜 = new Map();
  if (URL0 && SK0) {
    try {
      for (let off = 0; ; off += 100) {
        const r = await fetch(URL0 + '/rest/v1/' + encodeURIComponent('교육')
          + '?select=' + encodeURIComponent('번호,올린날')
          + '&' + encodeURIComponent('올린날') + '=not.is.null'
          + '&order=' + encodeURIComponent('번호') + '&limit=100&offset=' + off,
          { headers: { apikey: SK0, Authorization: 'Bearer ' + SK0 } });
        if (!r.ok) break;
        const 쪽 = await r.json();
        for (const x of 쪽) 아는날짜.set(x.번호, x.올린날);
        if (쪽.length < 100) break;
      }
    } catch { /* 못 물어보면 그냥 다 엽니다 */ }
  }
  const 열것 = [];
  for (const x of 날짜없는것) {
    const 전에 = 아는날짜.get(x.번호);
    if (전에) x.올린날 = 전에;        // 들고 옵니다 — 덮어쓰기 사고 막기
    else 열것.push(x);
  }
  console.log('\n해 없는 날짜 ' + 날짜없는것.length + '건 중 ' + 열것.length
    + '건을 상세로 확인합니다 (전에 알아낸 ' + (날짜없는것.length - 열것.length) + '건은 그 값을 씁니다)');
  let 찾음 = 0;
  for (const x of 열것) {
    const r = await 받기(x.링크, x.번호);
    if (r.오류) { console.log('   · ' + x.번호 + ' 못 받음: ' + r.오류); continue; }
    const d = 상세날짜(r.html);
    if (d) { x.올린날 = d; 찾음++; }
    await new Promise((s) => setTimeout(s, 700));   // 남의 서버에 부담 안 주려고
  }
  console.log('   해를 찾은 것 ' + 찾음 + '건 · 못 찾은 것 ' + (열것.length - 찾음) + '건(비워 둡니다)');
}
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

/* ── 박동 — 안 남기면 /admin/beat 이 「안 돌았다」를 못 알아챕니다 ──
   다른 수집기(collect-hosp 등)와 같은 꼴입니다.

   ⚠ `collect_source` 에 EDU 줄이 있어야 들어갑니다.
      아직 없습니다 — sql/2026-10-04_수집경로_봉사교육.sql 를 올려야 합니다.
      그때까지는 아래가 조용히 실패하고 수집 자체는 그대로 끝납니다.
      (박동 하나 때문에 수집을 망치지 않습니다) */
try {
  await 부르기('collect_beat', {
    p_secret: 열쇠,
    p_source: 'EDU',
    p_beat: {
      took_ms: Date.now() - 시작한때,
      /* 알려진 막힘(클라우드 주소 차단)은 탈로 안 셉니다 — 위 설명을 보십시오 */
      ok: 막힌곳.filter((x) => !서버에서막힘.some((k) => x.startsWith(k))).length === 0,
      왜: 막힌곳.filter((x) => !서버에서막힘.some((k) => x.startsWith(k))).join(' · '),
      본곳: 곳.length,
      담음,
      메모: { 막힌곳: 막힌곳, 출처수: new Set(하나씩.map((x) => x.출처)).size, 안끝난것: 센것, 표전체: 전부 },
    },
  });
} catch (e) {
  console.log('\n박동을 못 남겼습니다 — ' + String(e.message).slice(0, 160));
  console.log('(수집은 끝났습니다. collect_source 에 EDU 줄이 없으면 이렇게 됩니다)');
}
