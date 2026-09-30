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
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pdf글자, 쓸수있나 as OCR쓸수있나, 이름표 as OCR이름표 } from './ocr/index.mjs';
import { hwp글자, 한글파일인가 } from './hwp/index.mjs';
import { sortJob } from './sort-rule.mjs';
import { matchJob, notOurs, titleOtherOnly, 구운날 } from './gas-rules.mjs';
import { 첨부직군 } from './첨부직군.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const SOURCE = 'ND2';
const 바탕 = 'https://www.nid.or.kr';
const 목록URL = 바탕 + '/notification/recruit_list.aspx';
const 상세URL = 바탕 + '/notification/recruit_view.aspx';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
  + '(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

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
console.log('  첨부 읽기     한글 tools/hwp · PDF ' + OCR이름표);
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
console.log('\n③ 상세 — 제목만으로 못 가린 ' + 볼것.filter((v) => v.열까).length + '건을 엽니다');
for (const v of 볼것) {
  if (!v.열까) continue;
  if (Date.now() - t0 > 15 * 60000) { console.log('  15분이 넘어 여기서 멈춥니다'); break; }
  셈.상세연것++;
  const r = await 받기(상세URL + '?no=' + v.x.no);
  await 쉼(600);
  if (r.code !== 200 || !r.글) { v.보류 = '상세를 못 받았습니다 (HTTP ' + r.code + ')'; continue; }
  v.본문 = 풀기(r.글);

  const j = matchJob(v.본문);
  if (j) { v.직군 = j; v.근거 = '상세'; 셈.상세로++; continue; }

  /* 첨부 — ⚠ **href 가 아니라 onclick 안에 있습니다.**
       <a href='javascript:return false;'
          onclick='location.href = "/download/download.aspx?path=…pdf&filename=…"'>
     href 만 보고 「첨부가 없다」 고 넘기고 있었습니다.
     CLAUDE.md 5번에 적힌 그 함정입니다 — 알리오에서 똑같이 겪었습니다 (2026-09-30) */
  const 첨부 = [...r.글.matchAll(/onclick\s*=\s*'[^']*location\.href\s*=\s*"([^"]+)"[^']*'[^>]*>([\s\S]{0,140}?)</gi)]
    .map((m) => ({ url: m[1], 이름: 풀기(m[2]) }))
    .filter((f) => /download|\.(pdf|hwpx?)(\?|&|$)/i.test(f.url));
  if (!첨부.length) { v.보류 = '첨부를 못 찾았습니다 (상세에 직군이 없습니다)'; continue; }
  /* 공고문으로 보이는 것을 먼저. 이름이 비면 주소의 filename 을 씁니다 */
  const 이름내기 = (f) => f.이름
    || decodeURIComponent((f.url.match(/filename=([^&]*)/) || [])[1] || '').replace(/\+/g, ' ');
  const 고른것 = 첨부.find((f) => /공고|모집|채용/.test(이름내기(f))) || 첨부[0];
  고른것.이름 = 이름내기(고른것);
  let u = 고른것.url.replace(/&amp;/g, '&');
  if (!u.startsWith('http')) u = 바탕 + (u.startsWith('/') ? u : '/notification/' + u);

  셈.첨부연것++;
  try {
    const f = await fetch(u, { headers: { 'User-Agent': UA, Referer: 상세URL } });
    const buf = Buffer.from(await f.arrayBuffer());
    const 이름 = 고른것.이름 || '공고문';
    let 글 = '';
    if (한글파일인가(이름) || buf.subarray(0, 2).toString('latin1') === 'PK'
      || buf.subarray(0, 4).toString('hex') === 'd0cf11e0') {
      글 = hwp글자(buf, 이름.replace(/\.[^.]*$/, '') + '.hwp').글 || '';
    } else if (buf.subarray(0, 5).toString('latin1') === '%PDF-') {
      if (!OCR쓸수있나()) { v.보류 = 'PDF 인데 OCR 을 맡길 곳이 없습니다'; continue; }
      글 = (await pdf글자(buf, 이름.replace(/\.[^.]*$/, '') + '.pdf',
        { ctype: f.headers.get('content-type') || '', 공고: v.x.no })).글 || '';
    } else {
      v.보류 = '첨부가 모르는 꼴입니다 (' + buf.length + '바이트 · 앞5 「'
        + buf.subarray(0, 5).toString('latin1') + '」)';
      continue;
    }
    if (!글) { v.보류 = '첨부를 못 읽었습니다'; continue; }
    const g = 첨부직군(글);
    if (g.직군) { v.직군 = g.직군; v.근거 = '첨부 공고문 · 모집 부분'; v.걸린줄 = g.줄; 셈.첨부로++; }
    else if (g.어디 === '가산점') {
      셈.가산점거름++;
      v.가산점뿐 = '첨부의 가산점·우대 부분에만 「' + (g.후보 || '') + '」 가 있었습니다 · ' + g.까닭;
      v.걸린줄 = g.줄;
    } else if (g.어디 === '모름') {
      셈.못가림++;
      v.보류 = '첨부에 「' + (g.후보 || '') + '」 가 있는데 모집 부분인지 못 가렸습니다';
      v.걸린줄 = g.줄;
    }
  } catch (e) { v.보류 = '첨부를 못 받았습니다 · ' + String(e.message).slice(0, 80); }
}
console.log('  연 것 ' + 셈.상세연것 + '건 · 첨부까지 ' + 셈.첨부연것 + '건');
console.log('  ★ 상세로 가린 ' + 셈.상세로 + '건 · 첨부로 가린 ' + 셈.첨부로
  + '건 · 가산점이라 거른 ' + 셈.가산점거름 + '건 · 못 가려 보류 ' + 셈.못가림 + '건');

/* ── ④ 갈래 ───────────────────────────────────────────────── */
const 회원 = [], 보류 = [], 쓰레기 = [];
for (const v of 볼것) {
  const 기관 = (v.제목.match(/^\[([^\]]{2,30})\]/) || [])[1] || '중앙치매센터';
  const 줄 = {
    id: 'ND' + v.x.no,                 /* 옛 수집기와 같은 규칙 — 겹치면 덮지 않습니다 */
    external_id: v.x.no,
    org_name: 기관,
    title: v.제목,
    posted_at: v.x.날,
    url: 상세URL + '?no=' + v.x.no,
    job_group: v.직군 || '',
    org_kind: '공공',
    detail: { 근거: v.근거 || '제목', ...(v.걸린줄 ? { 걸린줄: String(v.걸린줄).slice(0, 300) } : {}) },
    evidence: v.보류 ? { 보류사유: v.보류 } : {},
  };
  if (v.가산점뿐) { 쓰레기.push({ id: 줄.id, org_name: 기관, title: v.제목, url: 줄.url, why: v.가산점뿐 }); continue; }
  if (v.보류) { 줄.hold = true; 보류.push(줄); continue; }
  const 갈래 = sortJob(v.제목, v.직군 || '', null);
  if (갈래.갈래 === '회원목록') { 회원.push(줄); continue; }
  if (갈래.갈래 === '보류함') { 줄.hold = true; 보류.push(줄); continue; }
  쓰레기.push({ id: 줄.id, org_name: 기관, title: v.제목, url: 줄.url, why: 갈래.왜 || '우리 직군 아님' });
}
셈.회원 = 회원.length; 셈.보류 = 보류.length; 셈.쓰레기 = 쓰레기.length;
console.log('\n④ 갈래 — 회원 목록 ' + 셈.회원 + ' · 보류함 ' + 셈.보류 + ' · 쓰레기통 ' + 셈.쓰레기);
if (회원.length) {
  console.log('\n  ★ 회원 목록에 올라갈 것 —');
  회원.slice(0, 12).forEach((r) => console.log('     ' + String(r.job_group).padEnd(8)
    + String(r.posted_at || '날짜없음').padEnd(12) + r.org_name.slice(0, 20).padEnd(22) + r.title.slice(0, 44)));
}

/* ── ⑤ 담기 · 박동 ────────────────────────────────────────── */
async function rpc(fn, body) {
  const k = cfg.SUPABASE_ANON_KEY;
  const r = await fetch(cfg.SUPABASE_URL + '/rest/v1/rpc/' + fn, {
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
  for (let i = 0; i < 넣을것.length; i += 100) {
    const r = await rpc('collect_put', { p_secret: cfg.COLLECT_KEY_ND2, p_source: SOURCE, p_rows: 넣을것.slice(i, i + 100) });
    담음 += r['담음'] || 0;
  }
  console.log('\n씀          ' + 담음 + '건');
  if (쓰레기.length) {
    let 버림 = 0;
    for (let i = 0; i < 쓰레기.length; i += 200) {
      const r = await rpc('collect_trash', { p_secret: cfg.COLLECT_KEY_ND2, p_source: SOURCE, p_rows: 쓰레기.slice(i, i + 200) });
      버림 += r['담음'] || 0;
    }
    console.log('쓰레기통     ' + 버림 + '건 (지우지 않고 까닭과 함께 남깁니다)');
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
