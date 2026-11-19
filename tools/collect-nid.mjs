/* 중앙치매센터 수집기 (ND2) — 시트를 거치지 않고 DB 에 바로 담습니다 (2026-09-30).
 *
 *   node tools/collect-nid.mjs --dry        담지 않고 견주기만
 *   node tools/collect-nid.mjs --dry --한줄  사흘 대조용 한 줄만
 *   node tools/collect-nid.mjs              정말로 담습니다 (source = ND2)
 *   node tools/collect-nid.mjs --쪽 5        5쪽 (한 쪽 10건)
 *
 * ── 어디서 받나 ──────────────────────────────────────────────
 * 중앙치매센터 채용공고 게시판. **열쇠가 없습니다** — 화면을 읽습니다.
 *   목록  https://www.nid.or.kr/notification/recruit_list.aspx
 *   상세  https://www.nid.or.kr/notification/recruit_view.aspx?no=<번호>
 *
 * 2026-09-30 에 원문을 찍어 꼴을 확인했습니다 —
 *   <tr class="first_tr">
 *     <th …><span class="num_icon">1567</span></th>
 *     <th class="th_title">
 *       <a href='recruit_view.aspx?no=1721&page=…'>
 *         <span style='color : blue;'>[채용중]</span>[경기도광역치매센터] 직원 채용 공고</a>
 *   <tr class="second_tr"><td><span>2026-09-29</span> … <img …>(첨부 아이콘)
 *
 * ── 왜 제목만 보면 안 되나 ───────────────────────────────────
 * 치매안심센터 공고는 제목에 직종을 안 씁니다 —
 *   「[경기도광역치매센터] 직원 채용 공고」
 *   「[강서구치매안심센터] 직원 채용 공고」
 * 나라일터 보건소 공고와 같은 문제입니다. 그래서 —
 *   ① 제목에 우리 직군이 있으면       → 바로
 *   ② 제목에 남의 직군만 있으면       → 버림 (까닭과 함께)
 *   ③ 「직원」 처럼 두루뭉술하면       → 상세를 열고, 첨부까지 읽습니다
 * 그래도 못 가리면 **보류함**으로. 버리지 않습니다.
 *
 * ── 규칙은 한 벌입니다 ───────────────────────────────────────
 *   갈래 판정   tools/sort-rule.mjs    직군 낱말  tools/gas-rules.mjs
 *   첨부 직군   tools/첨부직군.mjs      (모집 부분에 있는 것만 인정)
 *   첨부 글자   tools/ocr · tools/hwp
 *   쓰기       DB 의 collect_put() · 박동 collect_beat()
 */
import { 칸검사들 } from './칸검사.mjs';
import fs from 'node:fs';
/* ★ 2026-10-26 세중님 3번 — DB 조회는 **공용 받아보기()** 로 합니다.
   지나가는 401(PGRST303 "JWT issued at future")·408·429·5xx·연결 탈을 1·2초 뒤 다시
   두드립니다 (404·403 은 바로 올립니다). 자는 tools/쪽나눠받기.mjs 한 자리입니다. */
import { 받아보기 } from './쪽나눠받기.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { hwp글자, 한글파일인가 } from './hwp/index.mjs';
/* ★ kordoc — 표를 살려 읽습니다. 뽑는 규칙도 저기 한 벌입니다 (지침 6절) */
import { 첨부읽기, 칸뽑기, kordoc있나, 본문직군, 더담을칸 } from './공고문읽기.mjs';
import { sortJob } from './sort-rule.mjs';
import { 판정남기기, 지문 } from './순찰기억.mjs';
import { matchJob, notOurs, titleOtherOnly, 구운날 } from './gas-rules.mjs';
import { 첨부직군 } from './첨부직군.mjs';
import { createRequire } from 'node:module';

/* 접수기간 규칙 — HS 수집기와 **같은 한 벌**입니다 (2026-10-07).
 *
 * 세중님 지시는 「첨부 PDF 에서 접수기간을 읽어라」 였는데, 돌려 보니 **상세 화면에
 * 적혀 있었습니다** — 「- 접수 기한: 2026.10.2.(금)~2026.10.19.(월)」.
 * 치매센터 공고 11건 중 10건이 그렇습니다. 첨부 PDF 를 열 필요가 없습니다.
 * (제가 앞서 「본문이 비었다」 고 보고한 것은 「접수기간·원서접수·마감」 으로만
 *  찾아봤기 때문입니다. 이 사이트는 「접수 **기한**」 입니다) */
const require = createRequire(import.meta.url);
const { hsDetailDates, hs접수문장 } = require('./hosp/hs_dates.js');

/* 「2026.10.07」 ± 날수 */
function 날더하기(점날, 날수) {
  const [y, m, d] = String(점날).split('.').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 날수)).toISOString().slice(0, 10).replace(/-/g, '.');
}
/* 읽은 날짜가 쓸만한가 — HS 쪽 날짜쓸만한가() 와 같은 기준입니다.
   지난 마감일은 받습니다 (마감된 공고라는 올바른 정보입니다) */
function 날짜쓸만한가(d, 올린날, 오늘점) {
  if (!d || !d.to) return '';
  const 점 = (s) => String(s || '').replace(/-/g, '.');
  const to = 점(d.to), from = 점(d.from);
  if (!/^20\d{2}\.\d{2}\.\d{2}$/.test(to)) return '';
  if (from && from > to) return '';
  const 바닥 = 올린날 ? 점(올린날) : null;
  if (바닥 && to < 날더하기(바닥, -3)) return '';
  if (!바닥 && to < 날더하기(오늘점, -400)) return '';
  if (to > 날더하기(오늘점, 400)) return '';
  return to;
}

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const SOURCE = 'ND2';
const 바탕 = 'https://www.nid.or.kr';
const 목록URL = 바탕 + '/notification/recruit_list.aspx';
const 상세URL = 바탕 + '/notification/recruit_view.aspx';
/* 이름표 — 서버 .env 의 RAPO_UA_CONTACT 가 정해지기 전에는 이 옛 값 그대로 (tools/수집기이름표.mjs 한 자리) */
import { 이름표 } from './수집기이름표.mjs';
const UA = 이름표('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
  + '(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36');

const argv = process.argv.slice(2);
const 값 = (이름, 기본) => { const i = argv.indexOf(이름); return i > -1 && argv[i + 1] != null ? Number(argv[i + 1]) : 기본; };
const dry = argv.includes('--dry');
const 한줄 = argv.includes('--한줄');
const 최대쪽 = 값('--쪽', 3);

function env() {
  const out = {};
  for (const f of [path.join(여기, '..', '.env.local'), path.join(여기, '..', '.env'),
    path.join(여기, '..', 'web', '.env.local')]) {
    if (!fs.existsSync(f)) continue;
    fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((l) => {
      const m = l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*?)\s*$/);
      if (m && !out[m[1]]) out[m[1]] = m[2].replace(/^'|'$/g, '');
    });
  }
  Object.keys(process.env).forEach((k) => { if (process.env[k]) out[k] = process.env[k]; });
  out.SUPABASE_ANON_KEY = out.SUPABASE_ANON_KEY || out.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  out.SUPABASE_URL = out.SUPABASE_URL || out.NEXT_PUBLIC_SUPABASE_URL;
  /* ND2 열쇠는 HS3 서버 전용 값과 같은 값입니다 (값을 옮기지 않으려고) */
  out.COLLECT_KEY_ND2 = out.COLLECT_KEY_ND2 || out.COLLECT_KEY_HS3;
  return out;
}
const cfg = env();
const 쉼 = (ms) => new Promise((y) => setTimeout(y, ms));

const 태그빼기 = (s) => String(s || '').replace(/<[^>]*>/g, ' ');
const 풀기 = (s) => 태그빼기(s)
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/&#x?[0-9A-Fa-f]+;/g, ' ')
  .replace(/\s+/g, ' ').trim();

async function 받기(u, 다시 = 2) {
  for (let t = 0; t <= 다시; t++) {
    try {
      const r = await fetch(u, { headers: { 'User-Agent': UA } });
      const 글 = await r.text();
      if (r.ok) return { code: r.status, 글 };
      if (t === 다시) return { code: r.status, 글 };
    } catch (e) {
      if (t === 다시) return { code: 0, 글: '', 왜: String(e.message).slice(0, 90) };
    }
    await 쉼(1500 * (t + 1));
  }
  return { code: 0, 글: '' };
}

/* ── 본체 ─────────────────────────────────────────────────── */
const t0 = Date.now();
if (한줄) console.log = () => {};

console.log('치매센터 새 수집기 (' + SOURCE + ') · '
  + new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) + (dry ? ' · **--dry**' : ''));
console.log('  규칙 구운 날  ' + 구운날);
console.log('  열쇠          없음 (게시판 긁기) · Supabase '
  + (cfg.SUPABASE_ANON_KEY ? '있음' : '**없음**')
  + ' · collect_put ' + (cfg.COLLECT_KEY_ND2 ? '있음' : '**없음**'));
console.log('  첨부 읽기     kordoc (hwp·hwpx·pdf·docx·xlsx·그림 OCR) · 받침 tools/hwp');
if (!dry && !cfg.COLLECT_KEY_ND2) { console.error('COLLECT_KEY_ND2 가 없습니다'); process.exit(1); }

const 셈 = {
  읽은줄: 0, 마감: 0, 남의자리: 0, 상세연것: 0, 첨부연것: 0,
  제목으로: 0, 상세로: 0, 첨부로: 0, 가산점거름: 0, 못가림: 0,
  회원: 0, 보류: 0, 쓰레기: 0, 못받은쪽: 0,
};

/* ── ① 목록 ───────────────────────────────────────────────── */
console.log('\n① 목록 — ' + 최대쪽 + '쪽 (한 쪽 10건)');
const 모은것 = [];
for (let 쪽 = 1; 쪽 <= 최대쪽; 쪽++) {
  const u = 목록URL + (쪽 > 1 ? '?page=' + 쪽 : '');
  const r = await 받기(u);
  if (r.code !== 200 || !r.글) {
    셈.못받은쪽++;
    console.error('  ' + 쪽 + '쪽 HTTP ' + r.code + ' · ' + (r.왜 || '')
      + ' · 응답 앞 500자 — ' + String(r.글).replace(/\s+/g, ' ').slice(0, 500));
    break;
  }
  /* first_tr 한 덩어리 = 공고 한 건. 바로 뒤 second_tr 에 날짜가 있습니다.
     ⚠ 마감된 공고는 **링크가 없습니다** — <a href='javascript:end_alert();'> 입니다.
     그건 안 담는 게 맞지만 **세어는 둬야** 합니다. 안 그러면 「2쪽 0건」 처럼
     찍혀서 쪽 넘김이 고장난 줄 압니다 (2026-09-30 에 그렇게 헷갈렸습니다) */
  const 덩 = r.글.split(/<tr class="first_tr">/i).slice(1);
  if (!덩.length) { console.log('  ' + 쪽 + '쪽 — 줄이 없습니다. 여기서 멈춥니다'); break; }
  let 이쪽 = 0, 이쪽마감 = 0;
  for (const d of 덩) {
    const a = d.match(/<a\s+href=['"]recruit_view\.aspx\?no=(\d+)[^'"]*['"]\s*>([\s\S]*?)<\/a>/i);
    if (!a) {
      if (/end_alert|채용마감|마감/.test(d)) 이쪽마감++;
      continue;
    }
    const no = a[1];
    const 속 = a[2];
    const 상태 = (속.match(/\[([^\]]{1,6})\]/) || [])[1] || '';
    const 제목 = 풀기(속).replace(/^\[[^\]]{1,6}\]\s*/, '').trim();
    const 날 = (d.match(/<span>\s*(\d{4}-\d{2}-\d{2})\s*<\/span>/) || [])[1] || null;
    const 첨부있나 = /ico_file/.test(d);
    if (!제목) continue;
    모은것.push({ no, 제목, 상태, 날, 첨부있나 });
    이쪽++;
  }
  셈.읽은줄 += 이쪽;
  셈.마감 += 이쪽마감;
  console.log('  ' + 쪽 + '쪽 — 줄 ' + 덩.length + ' (접수중 ' + 이쪽 + ' · 마감 ' + 이쪽마감 + ')');
  await 쉼(600);
}
console.log('  접수중 ' + 셈.읽은줄 + '건 · 마감 ' + 셈.마감 + '건'
  + (셈.못받은쪽 ? ' · 못 받은 쪽 ' + 셈.못받은쪽 : ''));

/* ── ①-2 서울 구 센터 게시판 (2026-11-19 세중님) ─────────────────
 * 「강서구 치매안심센터 공고 떴는데 우린 없네」 — 중앙 게시판(www)에 **안 올린** 공고였습니다.
 *   https://gangseo.nid.or.kr/notice/recruit_view.aspx?no=1073 (작업치료사 포함 8명 · 12/6 마감)
 *   https://dongjak.nid.or.kr/notice/recruit_view.aspx?no=1066 (작업치료사만 · 11/27 마감)
 * 서울 25개 구 센터는 **○○.nid.or.kr 에 저마다 게시판**이 있고, 중앙 게시판에는
 * 센터가 따로 올릴 때만 뜹니다. 그날 진행중 6건 가운데 중앙에 있는 것은 4건이었습니다.
 * 구 게시판 번호는 **25곳이 한 줄로 이어 씁니다**(1066 동작 · 1073 강서 · 아무 곳 주소로
 * 열어도 같은 글) — 그래서 열쇠는 'NDA' + 번호입니다 (중앙 'ND' + 번호와 안 겹침).
 * 목록 꼴 (2026-11-19 원문) —
 *   <a href="javascript:page_move( 'recruit_view', { 'no': '1073' } )"> 강서구치매안심센터 채용 공고 (팀원)</a>
 *   <li><strong>진행현황</strong>2026-11-18 ~ 2026-12-06</li> <li><font color='red'>진행중<font/></li>
 * 1쪽(10줄)의 **진행중**만 봅니다. 중앙 게시판에도 있는 같은 공고는 ③ 뒤에 뺍니다 */
const 구센터 = {
  gangnam: '강남구', gangdong: '강동구', gangbuk: '강북구', gangseo: '강서구', gwanak: '관악구',
  gwangjin: '광진구', guro: '구로구', geumcheon: '금천구', nowon: '노원구', dobong: '도봉구',
  dongdaemun: '동대문구', dongjak: '동작구', mapo: '마포구', seodaemun: '서대문구', seocho: '서초구',
  seongdong: '성동구', seongbuk: '성북구', songpa: '송파구', yangcheon: '양천구', yeongdeungpo: '영등포구',
  yongsan: '용산구', eunpyeong: '은평구', jongno: '종로구', junggu: '중구', jungnang: '중랑구',
  /* seoul(서울광역)은 이 주소가 「페이지를 찾을 수 없습니다」 입니다 (2026-11-19) — 넣으면
     「못 받은 곳 1」 이 날마다 떠서 정찰이 늘 건너뜁니다. 서울광역 공고는 중앙 게시판에 옵니다 */
};
const 구주소 = (곳) => 'https://' + 곳 + '.nid.or.kr/notice/recruit_view.aspx';
셈.구게시판 = 0; 셈.구진행중 = 0; 셈.못받은구 = 0;
if (!argv.includes('--구센터끔')) {
  console.log('\n①-2 서울 구 센터 게시판 — ' + Object.keys(구센터).length + '곳 1쪽 (진행중만)');
  for (const [곳, 구] of Object.entries(구센터)) {
    const r = await 받기('https://' + 곳 + '.nid.or.kr/notice/recruit_list.aspx');
    await 쉼(600);
    if (r.code !== 200 || !r.글 || !/page_move|등록된 게시물이 없습니다/.test(r.글)) {
      셈.못받은구++;
      console.error('  ' + 곳 + ' HTTP ' + r.code + ' · ' + (r.왜 || '')
        + ' · 응답 앞 500자 — ' + String(r.글).replace(/\s+/g, ' ').slice(0, 500));
      continue;
    }
    셈.구게시판++;
    const 이름 = 구 + '치매안심센터';
    for (const d of r.글.split(/<tr>/i).slice(1)) {
      const a = d.match(/'no'\s*:\s*'(\d+)'\s*\}\s*\)\s*"\s*>([\s\S]*?)<\/a>/i);
      if (!a || !/진행중/.test(d)) continue;
      const 기간 = (d.match(/진행현황\s*<\/strong>\s*(\d{4}-\d{2}-\d{2})\s*~\s*(\d{4}-\d{2}-\d{2})?/) || []);
      let 제목 = 풀기(a[2]);
      /* 중앙 게시판과 같은 꼴 「[기관] 제목」 으로 맞춥니다 — ④ 가 거기서 기관을 뗍니다 */
      if (!/^\[/.test(제목)) 제목 = '[' + 이름 + '] ' + 제목.replace(new RegExp('^' + 이름 + '\\s*'), '');
      모은것.push({ no: a[1], 제목, 상태: '채용중', 날: 기간[1] || null, 끝: 기간[2] || null,
        첨부있나: null, 구: { 곳, 이름 } });
      셈.구진행중++;
    }
  }
  console.log('  읽은 게시판 ' + 셈.구게시판 + '곳 · 진행중 ' + 셈.구진행중 + '건'
    + (셈.못받은구 ? ' · 못 받은 곳 ' + 셈.못받은구 : ''));
}
/* 열쇠·주소는 이 둘로만 냅니다 — 중앙 ND+번호 · 구 NDA+번호 */
const 열쇠 = (x) => (x.구 ? 'NDA' : 'ND') + x.no;
const 원문주소 = (x) => (x.구 ? 구주소(x.구.곳) : 상세URL) + '?no=' + x.no;

/* ── ② 제목 판정 ──────────────────────────────────────────── */
const 볼것 = [];
for (const x of 모은것) {
  if (notOurs(x.제목) || titleOtherOnly(x.제목)) { 셈.남의자리++; continue; }
  const 직군 = matchJob(x.제목);
  if (직군) 셈.제목으로++;
  볼것.push({ x, 제목: x.제목, 직군, 근거: 직군 ? '제목' : '', 열까: !직군 });
}
console.log('\n② 제목 판정 — 볼 것 ' + 볼것.length + '건 (제목에 직군 ' + 셈.제목으로
  + ') · 남의 자리 ' + 셈.남의자리 + ' 건너뜀');

/* ── ③ 상세·첨부 ──────────────────────────────────────────── */
/* ★ 2026-10-07 — 상세를 **전부** 엽니다. 전에는 제목으로 직군을 못 가린 것만
   열었습니다. 접수기간이 상세 화면에 있어서 안 열면 마감일이 영영 빕니다
   (치매센터 공고 9건이 전부 「수시채용」 으로 떠 있었습니다).
   치매센터는 한 쪽에 10건이라 전부 열어도 요청이 몇십 건입니다 */
const 오늘점ND = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }).replace(/-/g, '.');
console.log('\n③ 상세 — ' + 볼것.length + '건을 전부 엽니다 (직군을 못 가린 것 '
  + 볼것.filter((v) => v.열까).length + '건 + 마감일 읽기)');
for (const v of 볼것) {
  if (Date.now() - t0 > 15 * 60000) { console.log('  15분이 넘어 여기서 멈춥니다'); break; }
  셈.상세연것++;
  const r = await 받기(원문주소(v.x));
  await 쉼(600);
  if (r.code !== 200 || !r.글) {
    if (v.열까) v.보류 = '상세를 못 받았습니다 (HTTP ' + r.code + ')';
    continue;
  }
  v.본문 = 풀기(r.글);

  /* 접수 안내 문장 — 판정은 DB 의 마감표시() 가 합니다 */
  v.접수문장 = hs접수문장(v.본문);

  /* 접수기간 — HS 와 같은 규칙입니다 (tools/hosp/hs_dates.js) */
  const dd = hsDetailDates(v.본문);
  const to = 날짜쓸만한가(dd, v.x.날, 오늘점ND);
  if (to) {
    v.to = to;
    v.from = dd.from || '';
    v.날짜출처 = dd.rank === 1 ? '본문 · 공고기간' : '본문 · 접수기간';
    셈.날짜채움 = (셈.날짜채움 || 0) + 1;
  } else if (dd.to) {
    셈.날짜버림 = (셈.날짜버림 || 0) + 1;
    console.log('    날짜 거름 no=' + v.x.no + ' 읽은값 ' + JSON.stringify(dd)
      + ' · 올린날 ' + (v.x.날 || '모름'));
  }
  /* 구 게시판은 목록의 「진행현황 시작 ~ 끝」 이 곧 접수기간입니다 (강서·동작 원문과 같음 · 2026-11-19).
     본문에서 못 읽었을 때만 씁니다 */
  if (!v.to && v.x.구 && v.x.끝) {
    const to2 = 날짜쓸만한가({ from: v.x.날, to: v.x.끝 }, v.x.날, 오늘점ND);
    if (to2) { v.to = to2; v.from = v.x.날 || ''; v.날짜출처 = '목록 · 진행현황'; 셈.날짜채움 = (셈.날짜채움 || 0) + 1; }
  }

  /* ★ 2026-11-19 세중님 「ⓐ부터 고쳐」 — 직군을 제목·본문으로 이미 가렸어도 **첨부를 엽니다.**
     전에는 여기서 끝냈습니다(「첨부까지 열지 않습니다」). 그래서 동작 NDA1066 처럼 본문에 「작업치료사」가
     있는 공고는 공고문을 안 열어 근무기간·모집인원·지원자격이 비었습니다.
     **칸만** 읽을 때는 직군을 바꾸지 않고, 첨부가 없거나 못 읽어도 보류함으로 보내지 않습니다 */
  let 칸만 = !v.열까;
  const 막힘 = (왜) => { if (칸만) 셈.칸만못읽음 = (셈.칸만못읽음 ?? 0) + 1; else v.보류 = 왜; };

  /* ★ 2026-10-14 — `matchJob` → `본문직군`. 본문은 **페이지 전체 글**이라
     사이트 메뉴·응시자격의 「○○치료학」까지 들어옵니다. `matchJob` 은 맨
     「작업치료」로도 걸려서, 서울광역치매센터 「연구위원(계약직)」 공고가
     응시자격의 「… 사회복지학, **작업치료학** 등의 분야 전공자」에 걸려
     「작업치료사 계약직 채용공고」로 회원 화면에 떠 있었습니다.
     `본문직군` 은 「치료사」를 요구합니다 (기준은 공고문읽기.mjs 한 자리 · 지침 6절) */
  if (!칸만) {
    const j = 본문직군(v.본문);
    if (j) { v.직군 = j; v.근거 = '상세'; 셈.상세로++; 칸만 = true; }
  }

  /* 첨부 — ⚠ **href 가 아니라 onclick 안에 있습니다.**
       <a href='javascript:return false;'
          onclick='location.href = "/download/download.aspx?path=…pdf&filename=…"'>
     href 만 보고 「첨부가 없다」 고 넘기고 있었습니다.
     CLAUDE.md 5번에 적힌 그 함정입니다 — 알리오에서 똑같이 겪었습니다 (2026-09-30) */
  const 첨부 = [...r.글.matchAll(/onclick\s*=\s*'[^']*location\.href\s*=\s*"([^"]+)"[^']*'[^>]*>([\s\S]{0,140}?)</gi)]
    .map((m) => ({ url: m[1], 이름: 풀기(m[2]) }))
    .filter((f) => /download|\.(pdf|hwpx?)(\?|&|$)/i.test(f.url));
  if (!첨부.length) { 막힘('첨부를 못 찾았습니다 (상세에 직군이 없습니다)'); continue; }
  /* 공고문으로 보이는 것을 먼저. 이름이 비면 주소의 filename 을 씁니다 */
  const 이름내기 = (f) => f.이름
    || decodeURIComponent((f.url.match(/filename=([^&]*)/) || [])[1] || '').replace(/\+/g, ' ');
  const 고른것 = 첨부.find((f) => /공고|모집|채용/.test(이름내기(f))) || 첨부[0];
  고른것.이름 = 이름내기(고른것);
  let u = 고른것.url.replace(/&amp;/g, '&');
  /* 구 게시판도 첨부는 www.nid.or.kr/download/… 절대주소입니다 (2026-11-19 원문).
     상대주소면 그 글을 연 쪽 자리에 붙입니다 */
  const 연곳 = v.x.구 ? 'https://' + v.x.구.곳 + '.nid.or.kr' : 바탕;
  if (!u.startsWith('http')) u = 연곳 + (u.startsWith('/') ? u : (v.x.구 ? '/notice/' : '/notification/') + u);

  셈.첨부연것++;
  if (칸만) 셈.칸만첨부 = (셈.칸만첨부 ?? 0) + 1;
  try {
    const f = await fetch(u, { headers: { 'User-Agent': UA, Referer: 원문주소(v.x) } });
    const buf = Buffer.from(await f.arrayBuffer());
    const 이름 = 고른것.이름 || '공고문';
    let 글 = '';
    let md = '';
    let 블록 = null;
    /* ★ 2026-10-11 — **kordoc 을 먼저** (세중님 1순위). 맨손 tools/hwp 는
       표를 뭉개서 어느 인원이 어느 직군 것인지 못 가립니다 */
    if (kordoc있나()) {
      const k = await 첨부읽기(buf, 이름);
      if (k.글 && k.글.length > 80) {
        글 = k.글; md = k.md; 블록 = k.blocks;
        셈.kordoc읽음 = (셈.kordoc읽음 ?? 0) + 1;
        셈.kordoc초 = Math.round(((셈.kordoc초 ?? 0) + k.초) * 100) / 100;
      } else { 셈.kordoc빈손 = (셈.kordoc빈손 ?? 0) + 1; }
    }
    if (글) { /* kordoc 이 읽었습니다 — 옛 길을 건너뜁니다 */ }
    else if (한글파일인가(이름) || buf.subarray(0, 2).toString('latin1') === 'PK'
      || buf.subarray(0, 4).toString('hex') === 'd0cf11e0') {
      글 = hwp글자(buf, 이름.replace(/\.[^.]*$/, '') + '.hwp').글 || '';
    } else if (buf.subarray(0, 5).toString('latin1') === '%PDF-') {
      /* ★ 2026-10-20 세중님 5번 — 옛 Apps Script OCR 호출을 끊었습니다.
         kordoc 이 빈손이면 `첨부읽기()` 가 ocr: 'force' 로 다시 봅니다 —
         옛 길은 404·500 으로 죽어 있습니다. gas/ 는 손대지 않았습니다 */
      막힘('PDF 인데 kordoc 이 빈손이고 OCR(force)로도 글자가 안 나왔습니다');
      continue;
    } else {
      막힘('첨부가 모르는 꼴입니다 (' + buf.length + '바이트 · 앞5 「'
        + buf.subarray(0, 5).toString('latin1') + '」)');
      continue;
    }
    if (!글) { 막힘('첨부를 못 읽었습니다'); continue; }

    /* ★ 2026-10-12 — 읽은 글을 **보관합니다** (세중님 지시).
       전에는 직군만 뽑고 버렸습니다. 그래서 2026-10-11 에 hs_dates 버그
       피해를 셀 때 ND2 4건을 **다시 확인할 수 없었습니다** (job_body 에
       HS3 상세 264줄·CE2 첨부 65줄만 있고 ND2 는 0줄).
       창구 `collect_body` 가 이미 있어 **부르기만** 하면 됩니다 —
       표를 새로 만들지 않습니다. 개인정보는 그 창구가 담기 전에 지웁니다.
       회원 화면에는 안 나갑니다 (job_body 는 anon 에게 권한이 없습니다) */
    v.원문 = 글;
    /* ★ 2026-10-11 — 공고문에서 **일곱 칸**도 뽑습니다 (세중님 1순위).
       규칙은 tools/공고문읽기.mjs 한 벌입니다 (지침 6절) */
    if (md) {
      try {
        const 칸 = 칸뽑기(블록?.length ? 블록 : md, 글);
        const 뭐든 = 칸.접수마감 || 칸.지원자격 || 칸.근무지 || 칸.예상연봉 || 칸.근무기간
          || Object.keys(칸.모집인원 || {}).length;
        if (뭐든) { v.칸 = 칸; 셈.칸뽑음 = (셈.칸뽑음 ?? 0) + 1; }
      } catch (e) { 셈.칸탈 = (셈.칸탈 ?? 0) + 1; }
    }
    /* 칸만 읽은 것은 직군을 다시 가리지 않습니다 — 제목·본문이 이미 정했습니다 */
    const g = 칸만 ? {} : 첨부직군(글);
    if (칸만) { /* 칸만 */ }
    else if (g.직군) { v.직군 = g.직군; v.근거 = '첨부 공고문 · 모집 부분'; v.걸린줄 = g.줄; 셈.첨부로++; }
    else if (g.어디 === '가산점') {
      셈.가산점거름++;
      v.가산점뿐 = '첨부의 가산점·우대 부분에만 「' + (g.후보 || '') + '」 가 있었습니다 · ' + g.까닭;
      v.걸린줄 = g.줄;
    } else if (g.어디 === '모름') {
      셈.못가림++;
      v.보류 = '첨부에 「' + (g.후보 || '') + '」 가 있는데 모집 부분인지 못 가렸습니다';
      v.걸린줄 = g.줄;
    }
  } catch (e) { 막힘('첨부를 못 받았습니다 · ' + String(e.message).slice(0, 80)); }
}
console.log('  연 것 ' + 셈.상세연것 + '건 · 첨부까지 ' + 셈.첨부연것 + '건'
  + ' (직군은 이미 가리고 칸만 읽으려고 연 것 ' + (셈.칸만첨부 ?? 0) + '건'
  + (셈.칸만못읽음 ? ' · 그중 못 읽음 ' + 셈.칸만못읽음 + '건(보류 안 함)' : '') + ')');
console.log('  ★ 상세에서 마감일을 채운 공고 ' + (셈.날짜채움 || 0) + '건'
  + (셈.날짜버림 ? ' · 읽었지만 거른 것 ' + 셈.날짜버림 + '건' : ''));
console.log('  ★ 상세로 가린 ' + 셈.상세로 + '건 · 첨부로 가린 ' + 셈.첨부로
  + '건 · 가산점이라 거른 ' + 셈.가산점거름 + '건 · 못 가려 보류 ' + 셈.못가림 + '건');
/* ★ 2026-10-11 — kordoc 이 얼마나 읽었나. 안 찍으면 돌았는지 알 수 없습니다 (지침 2절) */
console.log('  kordoc 읽음 ' + (셈.kordoc읽음 ?? 0) + ' · 빈손 ' + (셈.kordoc빈손 ?? 0)
  + ' · 걸린 시간 합 ' + (셈.kordoc초 ?? 0) + '초'
  + ' · 일곱 칸 뽑은 공고 ' + (셈.칸뽑음 ?? 0) + '건'
  + (셈.칸탈 ? ' · 칸 뽑다 탈 ' + 셈.칸탈 + '건' : ''));

/* ── ③-2 같은 공고 빼기 (2026-11-19) ─────────────────────────
 * 센터가 구 게시판과 중앙 게시판 **둘 다** 올리면 같은 공고가 두 벌입니다
 * (그날 양천·서대문·서초 셋이 그랬고, 셋 다 같은 기관 · 같은 마감일이었습니다).
 * 중앙 쪽(ND+번호)이 이미 담겨 온 열쇠라 **중앙을 남기고 구 쪽을 뺍니다.**
 * 같다고 보는 것 — 같은 기관 + 같은 마감일. 어느 쪽이든 마감일이 없으면 올린 날 사흘 안 */
const 기관떼기 = (t) => (String(t).match(/^\[([^\]]{2,30})\]/) || [])[1] || '';
const 날차 = (a, b) => (a && b) ? Math.abs((Date.parse(a) - Date.parse(b)) / 864e5) : 99;
const 점선 = (s) => String(s || '').replace(/\./g, '-');
const 중앙들 = 볼것.filter((v) => !v.x.구);
const 뺀구 = new Set();
for (const v of 볼것.filter((w) => w.x.구)) {
  const 짝 = 중앙들.find((c) => 기관떼기(c.제목) === v.x.구.이름
    && ((c.to && v.to) ? 점선(c.to) === 점선(v.to) : 날차(c.x.날, v.x.날) <= 3));
  if (짝) { 뺀구.add(v); console.log('  같은 공고라 뺌 — NDA' + v.x.no + ' = ND' + 짝.x.no + ' · ' + v.제목.slice(0, 40)); }
}
셈.구중복 = 뺀구.size;
for (let i = 볼것.length - 1; i >= 0; i--) if (뺀구.has(볼것[i])) 볼것.splice(i, 1);
console.log('  ★ 구 게시판에만 있는 공고 ' + 볼것.filter((v) => v.x.구).length + '건 · 중앙과 같아 뺀 것 ' + 셈.구중복 + '건');

/* ── ④ 갈래 ───────────────────────────────────────────────── */
const 회원 = [], 보류 = [], 쓰레기 = [];
for (const v of 볼것) {
  const 기관 = (v.제목.match(/^\[([^\]]{2,30})\]/) || [])[1] || '중앙치매센터';
  const 줄 = {
    id: 열쇠(v.x),                     /* 중앙 ND+번호(옛 수집기와 같은 규칙) · 구 게시판 NDA+번호 */
    external_id: v.x.no,
    org_name: 기관,
    title: v.제목,
    posted_at: v.x.날,
    /* ★ 2026-10-07 — 접수기간을 담습니다. 전에는 이 칸이 아예 없어서
       치매센터 공고가 전부 「수시채용」 으로 떴습니다 */
    apply_from: v.from ? String(v.from).replace(/\./g, '-') : null,
    apply_to: v.to ? String(v.to).replace(/\./g, '-') : null,
    /* 마감일을 어디서 얻었나 (2026-10-13). 전에는 창구가 이 칸을 안 받아
       evidence.날짜출처 에만 적었습니다. 이제 둘 다 보냅니다 */
    deadline_src: v.날짜출처 || (v.to ? '본문' : null),
    url: 원문주소(v.x),
    job_group: v.직군 || '',
    org_kind: '공공',
    detail: { 근거: v.근거 || '제목', ...(v.걸린줄 ? { 걸린줄: String(v.걸린줄).slice(0, 300) } : {}) },
    evidence: {
      ...(v.보류 ? { 보류사유: v.보류 } : {}),
      ...(v.날짜출처 ? { 날짜출처: v.날짜출처 } : {}),
      ...(v.접수문장 ? { 접수문장: v.접수문장 } : {}),
    },
  };

  /* ★ 2026-10-11 — 공고문(kordoc)에서 뽑은 칸을 싣습니다 (세중님 1순위).
     모집인원은 **우리 직군 줄의 것만**. 그 공고 직군에 맞는 것이 없으면
     비워 둡니다 (통합공고 전체 인원 안 씀 · 지침 15절).
     이 수집기는 상세에서 마감일을 채우니(v.날짜출처) **apply_to 는 안 덮습니다** */
  if (v.칸) {
    const 내직군인원 = v.직군 ? v.칸.모집인원?.[v.직군] : null;
    if (내직군인원 != null) 줄.headcount = 내직군인원;
    if (v.칸.접수시각) 줄.apply_to_time = v.칸.접수시각;
    if (v.칸.근무지 && !줄.work_place) 줄.work_place = v.칸.근무지;
    줄.detail = { ...(줄.detail || {}),
      ...(v.칸.지원자격 ? { 지원자격: v.칸.지원자격 } : {}),
      ...(v.칸.예상연봉 ? { 연봉: v.칸.예상연봉 } : {}) };
    줄.뽑은값 = {
      ...(v.칸.접수마감 ? { 공고문_접수마감: v.칸.접수마감 } : {}),
      ...(v.칸.접수시각 ? { 공고문_접수시각: v.칸.접수시각 } : {}),
      ...(Object.keys(v.칸.모집인원 || {}).length ? { 직군별인원: v.칸.모집인원 } : {}),
      ...(v.칸.지원자격 ? { 지원자격: v.칸.지원자격 } : {}),
      ...(v.칸.근무지 ? { 근무지: v.칸.근무지 } : {}),
      ...(v.칸.예상연봉 ? { 예상연봉: v.칸.예상연봉 } : {}),
      ...더담을칸(v.칸),   /* 근무기간 · 근무기간덧말 · 보수덧말 (2026-11-13) */
      근거: v.칸.근거 || {}, 읽은법: 'kordoc',
    };
    줄.뽑은법 = 'kordoc';
  }
  /* 다시 받아야 할 까닭이면 판정을 기억하지 않습니다 (알리오·클린아이와 같은 규칙) */
  const 적기 = (판정) => { v.__판정 = (v.보류 && /못 읽|못 받|OCR 실패/.test(v.보류)) ? '' : 판정; };
  if (v.가산점뿐) { 적기('쓰레기통'); 쓰레기.push({ id: 줄.id, org_name: 기관, title: v.제목, url: 줄.url, why: v.가산점뿐 }); continue; }
  if (v.보류) { 적기('보류함'); 줄.hold = true; 보류.push(줄); continue; }
  const 갈래 = sortJob(v.제목, v.직군 || '', null);
  if (갈래.갈래 === '회원목록') { 적기('회원목록'); 회원.push(줄); continue; }
  if (갈래.갈래 === '보류함') { 적기('보류함'); 줄.hold = true; 보류.push(줄); continue; }
  적기('쓰레기통');
  쓰레기.push({ id: 줄.id, org_name: 기관, title: v.제목, url: 줄.url, why: 갈래.왜 || '우리 직군 아님' });
}
셈.회원 = 회원.length; 셈.보류 = 보류.length; 셈.쓰레기 = 쓰레기.length;
/* 내린 판정을 기억에 남깁니다 — 10/3 짝 대조용 (2026-10-02)
 *
 * ★ 2026-10-07 — **같은 번호를 한 번만** 보냅니다. 전에는 그대로 보내서
 *   HTTP 500 이 났습니다 —
 *     "ON CONFLICT DO UPDATE command cannot affect row a second time"
 *   목록 화면이 쪽을 넘겨도 같은 글을 다시 내주는 때가 있어서 같은 번호가
 *   두 번 들어갑니다. 한 insert 안에 같은 열쇠가 두 줄이면 Postgres 가 거절합니다.
 *   그동안 ND 쪽 정찰 기억이 하나도 안 쌓이고 있었습니다. */
if (!dry) {
  const 본번호 = new Set();
  const 줄들 = 볼것.filter((v) => v.__판정 && v.x && v.x.no)
    .filter((v) => { const k = (v.x.구 ? 'A' : '') + v.x.no; if (본번호.has(k)) return false; 본번호.add(k); return true; })
    .map((v) => ({ 번호: (v.x.구 ? 'A' : '') + v.x.no, 판정: v.__판정,
      지문: 지문({ t: v.제목, d: v.x.날 || '' }) }));
  await 판정남기기(cfg, { 열쇠: cfg.COLLECT_KEY_ND2 || cfg.COLLECT_KEY_HS3 || '', source: SOURCE, 줄들 });
}
console.log('\n④ 갈래 — 회원 목록 ' + 셈.회원 + ' · 보류함 ' + 셈.보류 + ' · 쓰레기통 ' + 셈.쓰레기);
if (회원.length) {
  console.log('\n  ★ 회원 목록에 올라갈 것 —');
  회원.slice(0, 12).forEach((r) => console.log('     ' + String(r.job_group).padEnd(8)
    + String(r.posted_at || '날짜없음').padEnd(12) + r.org_name.slice(0, 20).padEnd(22) + r.title.slice(0, 44)
    + ' · 근무기간 ' + (r.뽑은값?.근무기간 || '-') + ' · 인원 ' + (r.headcount ?? '-')));
}
if (보류.length) {
  console.log('\n  보류함으로 갈 것 —');
  보류.slice(0, 12).forEach((r) => console.log('     ' + r.id.padEnd(9) + r.title.slice(0, 40)
    + ' · ' + String(r.evidence?.보류사유 || '갈래 규칙').slice(0, 60)));
}

/* ── ⑤ 담기 · 박동 ────────────────────────────────────────── */
async function rpc(fn, body) {
  const k = cfg.SUPABASE_SERVICE_KEY || cfg.SUPABASE_ANON_KEY;   /* 창구는 service_role 로 (2026-10-11) */
  const r = await 받아보기(cfg.SUPABASE_URL + '/rest/v1/rpc/' + fn, {
    method: 'POST',
    headers: { apikey: k, Authorization: 'Bearer ' + k, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(fn + ' HTTP ' + r.status + ' · ' + t.slice(0, 250));
  try { return JSON.parse(t); } catch { return t; }
}

if (dry) {
  console.log('\n--dry 라 담지 않았습니다. ' + Math.round((Date.now() - t0) / 1000) + '초');
} else {
  let 담음 = 0;
  const 넣을것 = [...회원, ...보류];
  칸검사들(넣을것, SOURCE);   /* 저장 직전 칸 검사 한 자리 (tools/칸검사.mjs · 2026-11-19) */
  for (let i = 0; i < 넣을것.length; i += 100) {
    const r = await rpc('collect_put', { p_secret: cfg.COLLECT_KEY_ND2, p_source: SOURCE, p_rows: 넣을것.slice(i, i + 100) });
    담음 += r['담음'] || 0;
  }
  console.log('\n씀          ' + 담음 + '건');

  /* ★ 2026-10-12 — 읽은 첨부 글을 `job_body` 에 보관합니다 (창구 collect_body).
     표를 새로 만들지 않습니다 — 이미 HS3·CE2 가 쓰는 표입니다.
     회원 화면에는 안 나갑니다. 개인정보는 창구가 담기 전에 지웁니다.
     담긴 공고만 보관합니다 (쓰레기통 줄은 FK 가 없습니다) */
  const 담은번호 = new Set(넣을것.map((x) => x.id));
  const 원문들 = 볼것
    .filter((v) => v.원문 && v.x && v.x.no && 담은번호.has(열쇠(v.x)))
    .map((v) => ({ job_id: 열쇠(v.x), kind: '첨부', ord: 0,
      url: v.첨부주소 || null, file_name: v.첨부이름 || null,
      body: String(v.원문).slice(0, 400000) }));
  if (원문들.length) {
    let 보관 = 0; let 바이트 = 0;
    for (let i = 0; i < 원문들.length; i += 50) {
      try {
        const r = await rpc('collect_body', {
          p_secret: cfg.COLLECT_KEY_ND2, p_source: SOURCE, p_rows: 원문들.slice(i, i + 50),
        });
        보관 += r['담음'] || 0; 바이트 += r['바이트'] || 0;
      } catch (e) { console.log('   원문 보관 못 함 — ' + String(e.message).slice(0, 110)); break; }
    }
    console.log('원문 보관    ' + 보관 + '건 · ' + Math.round(바이트 / 1024) + 'KB');
  } else {
    console.log('원문 보관    0건 (읽은 글이 없거나 담긴 공고가 아닙니다)');
  }

  if (쓰레기.length) {
    let 버림 = 0;
    for (let i = 0; i < 쓰레기.length; i += 200) {
      const r = await rpc('collect_trash', { p_secret: cfg.COLLECT_KEY_ND2, p_source: SOURCE, p_rows: 쓰레기.slice(i, i + 200) });
      버림 += r['담음'] || 0;
    }
    console.log('쓰레기통     ' + 버림 + '건 (지우지 않고 까닭과 함께 남깁니다)');
  }
  /* ── 정찰 (목록에서 빠진 것) ─────────────────────────────
     치매센터 목록은 **마감된 공고에 링크를 안 겁니다**
     (<a href='javascript:end_alert();'>). 그래서 모은것 에는 접수중만 들어옵니다.
     「어제 있던 번호가 오늘 접수중 목록에 없다 = 마감됐거나 내려갔다」 입니다.
     요청을 한 번도 더 하지 않는 공짜 정찰입니다.
     ⚠ 쪽을 하나라도 못 받았으면 건너뜁니다 — 그 쪽 공고가 전부 「빠졌다」 가 됩니다 */
  /* 구 게시판을 하나라도 못 받았으면 그곳 공고가 「빠졌다」 가 되니 같이 건너뜁니다 (2026-11-19) */
  if (셈.못받은쪽 || 셈.못받은구) {
    console.log('정찰        건너뜀 — 쪽을 ' + 셈.못받은쪽 + '개 · 구 게시판을 ' + 셈.못받은구 + '곳 못 받았습니다');
  } else {
    try {
      const r = await rpc('목록빠짐표시', {
        p_secret: cfg.COLLECT_KEY_ND2, p_source: SOURCE,
        p_본것: 모은것.map(열쇠),
      });
      console.log('정찰        ' + Object.entries(r || {})
        .filter(([k]) => !/기준일/.test(k)).map(([k, v]) => k + ' ' + v).join(' · '));
    } catch (e) { console.error('정찰 못 함 · ' + String(e.message).slice(0, 150)); }
  }

  console.log(Math.round((Date.now() - t0) / 1000) + '초');
  try {
    await rpc('collect_beat', {
      p_secret: cfg.COLLECT_KEY_ND2, p_source: SOURCE,
      p_beat: { took_ms: Date.now() - t0, ok: true, 본곳: 1, 담음: 셈.회원 + 셈.보류,
        보류: 셈.보류, 버림: 셈.쓰레기, 못받음: 셈.못받은쪽,
        메모: { 읽은줄: 셈.읽은줄, 상세연것: 셈.상세연것, 첨부연것: 셈.첨부연것 } },
    });
  } catch (e) { console.error('박동 못 남김 · ' + String(e.message).slice(0, 120)); }
}

if (한줄) {
  console.error('── ' + SOURCE + ' · 읽은 줄 ' + 셈.읽은줄 + ' · 담은 줄 ' + (셈.회원 + 셈.보류)
    + ' · 회원 ' + 셈.회원 + ' · 보류 ' + 셈.보류 + ' · 쓰레기통 ' + 셈.쓰레기
    + ' · ' + Math.round((Date.now() - t0) / 1000) + '초');
}
