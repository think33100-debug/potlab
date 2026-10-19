/* 병원 홈페이지 수집기 (HS3) — 시트를 거치지 않고 DB 에 바로 담습니다 (2026-09-28).
 *
 *   node tools/collect-hosp.mjs --dry            담지 않고 옛 수집기(HS)와 대조만
 *   node tools/collect-hosp.mjs --dry --한줄      사흘 대조용 한 줄만
 *   node tools/collect-hosp.mjs                  정말로 담습니다 (source = HS3)
 *   node tools/collect-hosp.mjs --dry 한림 순천향  이름에 그 말이 든 곳만
 *   node tools/collect-hosp.mjs --상세 0          상세 열기를 끕니다
 *
 * ── 왜 옮기나 ────────────────────────────────────────────────
 * Apps Script 로는 안 되는 것이 넷이었습니다 —
 *   6분 제한      288줄을 한 번에 못 돕니다. 한 바퀴에 40시간 넘습니다
 *   구글 IP       병원 34곳이 막혀 `off` 로 꺼져 있었습니다
 *   인증서        중간 인증서가 빠진 10곳을 고칠 방법이 없습니다
 *   본문 저장     gas 는 Supabase 에 못 붙습니다
 * node 로 오니 34곳 중 34곳이 열립니다 (2026-09-28 · 집에서 잼).
 *
 * ── 규칙은 한 벌입니다. 여기서 만들지 않습니다 ────────────────
 *   설정 288줄    gas/wage.js 의 HOSP_SITES 를 **떼어** 씁니다 (안 베낍니다)
 *   사이트 받기   tools/hosp/sites.mjs   (html · appsite · cmc · schmc · greeting)
 *   받는 길       tools/certs/index.mjs  (중간 인증서 · 옛 암호 · 인코딩)
 *   갈래 판정     tools/sort-rule.mjs    (gas 와 같은 한 벌 · check-sort 가 지킵니다)
 *   직군 낱말     tools/gas-rules.mjs
 *   쓰기          DB 의 collect_put()    ← 유일한 쓰기 통로
 *   박동          DB 의 collect_beat()   ← 안 돌면 관리자 화면에 빨간 줄
 *
 * ── 열쇠 (서버의 .env) ────────────────────────────────────────
 *   SUPABASE_URL · SUPABASE_ANON_KEY · COLLECT_KEY_HS3
 *   ⚠ service_role 은 **서버에 두지 않습니다.**
 *
 * ── 2GB 에서 안 죽게 (세중님이 정한 조건) ─────────────────────
 *   · 한 번에 받는 곳 수를 묶음으로 제한합니다 (`--동시`, 기본 6)
 *   · 브라우저는 아직 안 씁니다. 붙일 때 「한 번에 1개 · 10~20곳마다 껐다 켜기」
 *   · 상세는 **사이트당 하루 50건** 까지 (세중님 결정)
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { 사이트줄 } from './hosp/sites.mjs';
import { 글받기 } from './certs/index.mjs';
import { sortJob } from './sort-rule.mjs';
import { 판정남기기, 지문 } from './순찰기억.mjs';
import { matchJob, notOurs, mixedTitle, 구운날 } from './gas-rules.mjs';
import { 본문직군, 칸뽑기 } from './공고문읽기.mjs';
import { 본문자르기 } from './hosp/본문자르기.mjs';   /* 2026-10-17 세중님 2-② */
/* 본문을 받아오는 주소가 목록 주소와 다른 곳 (인크루트 /jobcont/) — 한 자리 */
import { 상세주소 } from './hosp/상세주소.mjs';
/* ★ 2026-10-14 — 첨부 담기 (세중님 ㉯). `hs_files.js` 는 2026-10-11 에 만들어
   자기점검까지 통과했는데 **부르는 곳이 한 군데도 없었습니다** — 지침 6절의
   「코드가 저장소에 있어도 아무도 import 하지 않으면 없는 기능입니다」 그대로입니다 */
import { 첨부모으기 } from './첨부담기.mjs';
/* 보내기 전 줄마다 보고, 실패하면 반씩 나눠 문제 줄만 뺍니다 (세중님 0번) */
import { 반씩보내기 } from './보낼줄.mjs';

/* 접수기간 규칙 — tools/hosp/hs_dates.js 한 벌. CommonJS 라 require 로 끌어옵니다.
   2026-10-07 에 붙였습니다. 전에는 저 파일이 저장소에 있는데 아무도 안 불렀습니다 */
const require = createRequire(import.meta.url);
const { hs첨부주소 } = require('./hosp/hs_files.js');   /* 상세 HTML 에서 공고문 첨부 주소 */
const { hsDetailDates, hs접수문장, 너무먼날, 마감시각 } = require('./hosp/hs_dates.js');

/* 읽은 날짜가 쓸만한가 — 짐작으로 담지 않습니다.
 *
 * 2026-10-07 에 스물을 돌려 본 것 중 서산중앙병원이 `from 2021.08.12` 를 냈습니다.
 * 몇 해 전 공고 글이 게시판에 그대로 붙어 있어서입니다. 마감일은 안 나왔으니
 * 이번엔 안 담겼지만, 거르는 자리를 둡니다.
 *
 * 지난 마감일은 **받습니다** — 그건 「마감된 공고」 라는 올바른 정보이고,
 * DB 의 hide_stale_posts 가 보고 치웁니다 (세중님 2026-10-07 지시:
 * 「날짜가 생긴 공고 중 이미 지난 것은 지난 공고로 갑니다」).
 */
function 날짜쓸만한가(d, 올린날) {
  if (!d || !d.to) return '';
  const 점 = (s) => String(s || '').replace(/-/g, '.');
  const to = 점(d.to), from = 점(d.from);
  if (!/^20\d{2}\.\d{2}\.\d{2}$/.test(to)) return '';
  if (from && from > to) return '';                       // 시작이 마감보다 뒤
  const 바닥 = 올린날 ? 점(올린날) : null;
  /* 올린 날보다 사흘 넘게 이른 마감일은 옛 글의 날짜입니다 */
  if (바닥 && to < 더하기(바닥, -3)) return '';
  if (!바닥 && to < 더하기(오늘점, -400)) return '';        // 올린 날을 모를 때의 바닥
  if (to > 더하기(오늘점, 400)) return '';                  // 연도를 잘못 읽은 것
  return to;
}
/* 「2026.10.07」 ± 날수 */
function 더하기(점날, 날수) {
  const [y, m, d] = String(점날).split('.').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + 날수));
  return t.toISOString().slice(0, 10).replace(/-/g, '.');
}

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const SOURCE = 'HS3';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
  + '(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

/* ── 설정 ─────────────────────────────────────────────────── */
function env() {
  const out = {};
  for (const f of [path.join(여기, '..', '.env.local'), path.join(여기, '..', '.env'),
    path.join(여기, '..', 'web', '.env.local')]) {
    if (!fs.existsSync(f)) continue;
    fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((l) => {
      const m = l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*?)\s*$/);
      if (m && !out[m[1]]) out[m[1]] = m[2];
    });
  }
  Object.keys(process.env).forEach((k) => { if (process.env[k]) out[k] = process.env[k]; });
  out.SUPABASE_ANON_KEY = out.SUPABASE_ANON_KEY || out.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  out.SUPABASE_URL = out.SUPABASE_URL || out.NEXT_PUBLIC_SUPABASE_URL;
  return out;
}

/* ⚠ **anon 열쇠만 씁니다.** service_role 은 서버에 두지 않습니다.
   권한은 DB 함수 안의 COLLECT_KEY_HS3 검사로 봅니다 (AL2·CE2·JF·ALIVE 와 같은 방식) */
async function rpc(cfg, fn, body) {
  const k = cfg.SUPABASE_SERVICE_KEY || cfg.SUPABASE_ANON_KEY;   /* 창구는 service_role 로 (2026-10-11) */
  if (!k) throw new Error('SUPABASE_ANON_KEY 가 없습니다');
  const r = await fetch(cfg.SUPABASE_URL + '/rest/v1/rpc/' + fn, {
    method: 'POST',
    headers: { apikey: k, Authorization: 'Bearer ' + k, 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(r.status + ' ' + t.slice(0, 300));
  return t ? JSON.parse(t) : null;
}

/* ── 설정 288줄을 gas 에서 떼어 옵니다 ─────────────────────── */
function 사이트들() {
  const p = path.join(여기, '..', 'gas', 'wage.js');
  const 구운것 = path.join(여기, 'hosp', 'hosp-sites.json');
  if (fs.existsSync(p)) {
    const GAS = fs.readFileSync(p, 'utf8');
    const i0 = GAS.indexOf('const HOSP_SITES = [');
    if (i0 < 0) throw new Error('gas 에서 HOSP_SITES 를 못 찾았습니다');
    let d = 0, end = -1;
    for (let k = GAS.indexOf('[', i0); k < GAS.length; k++) {
      if (GAS[k] === '[') d++; else if (GAS[k] === ']' && --d === 0) { end = k + 1; break; }
    }
    const S = new Function('return ' + GAS.slice(GAS.indexOf('[', i0), end))();
    /* 서버에는 gas/ 가 없습니다. 집에서 구워 두면 서버가 그걸 씁니다 */
    fs.writeFileSync(구운것, JSON.stringify({ 구운날: new Date().toISOString().slice(0, 10), 사이트: S }, null, 0) + '\n');
    return S;
  }
  if (!fs.existsSync(구운것)) {
    throw new Error('gas/wage.js 도 tools/hosp/hosp-sites.json 도 없습니다. '
      + '집 컴퓨터에서 node tools/collect-hosp.mjs --dry --n 1 을 한 번 돌려 구우세요');
  }
  return JSON.parse(fs.readFileSync(구운것, 'utf8')).사이트;
}

/* ── cfgs 에만 있는 새 곳을 더합니다 (2026-10-13) ─────────────
 *
 * 설정의 뿌리는 `tools/hosp/cfgs/*.json` 입니다 —
 *   cfgs → build_sites.js → hosp_sites.js → replace_sites.js → gas/wage.js
 * 그런데 `gas/wage.js` 는 **옛 앱(심사 중)** 파일이라 못 건드립니다
 * (세중님 지시). 그래서 새 병원 cfg 를 넣어도 wage.js 까지 못 가고,
 * 위 `사이트들()` 은 wage.js 만 보니 **새 곳이 영영 안 들어옵니다.**
 *
 * 그 틈을 여기서 메웁니다 — cfgs 를 훑어 **이름이 아직 없는 곳만** 더합니다.
 * 이미 있는 곳은 건드리지 않습니다 (wage.js 쪽 규칙이 더 새것일 수 있습니다).
 * wage.js 가 다시 구워지면 이 더하기는 저절로 0곳이 됩니다.
 *
 * 2026-10-13 에 이 길로 들어온 곳 — 강동경희대학교병원 (cfgs/khnmc.json).
 * 대학병원인데 어느 출처에도 공고가 **한 건도** 없었습니다. 홈페이지
 * www.khnmc.or.kr 의 「온라인채용」이 인크루트 채용관 khnmc 로 갑니다 —
 * 경희대학교병원(khmc)과 같은 판이라 설정을 그대로 썼습니다. */
function cfgs더하기(S) {
  const 터 = path.join(여기, 'hosp', 'cfgs');
  if (!fs.existsSync(터)) return S;
  const 이름 = new Set(S.map((x) => x.name));
  const 더한것 = [];
  for (const f of fs.readdirSync(터).filter((x) => x.endsWith('.json')).sort()) {
    let c;
    try { c = JSON.parse(fs.readFileSync(path.join(터, f), 'utf8')); } catch { continue; }
    if (!c || !c.name || 이름.has(c.name)) continue;
    if (!c.type) c.type = 'html';
    이름.add(c.name); S.push(c); 더한것.push(c.name);
  }
  if (더한것.length) console.log('  cfgs 에서 더함  ' + 더한것.length + '곳 — ' + 더한것.join(' · '));
  return S;
}

/* ── 공고ID — gas 와 **같은 규칙**이라야 겹치지 않습니다 ────── */
function 해시(s) {
  let h = 0;
  const t = String(s || '');
  for (let i = 0; i < t.length; i++) { h = ((h << 5) - h) + t.charCodeAt(i); h |= 0; }
  return h;
}
const 공고ID = (기관, url, 제목) => 'HS' + Math.abs(해시(기관 + '|' + url + '|' + 제목));

/* ── 같은 공고인지 — gas 의 sameJob_ 과 같은 뜻 ─────────────── */
const 붙이기 = (s) => String(s || '').replace(/\s+/g, '').replace(/[^가-힣A-Za-z0-9]/g, '');
const 같은공고 = (기관, 제목) => 붙이기(기관) + '|' + 붙이기(제목);

/* ── 주소를 같은 꼴로 ──────────────────────────────────────
   공고ID 는 `기관|주소|제목` 해시라, 같은 공고라도 주소가
   `www.` 있고 없고로 갈리면 번호가 둘 생깁니다. 강진의료원이 그랬고
   대조가 매일 「gas 에만 3」 을 냈습니다 (2026-10-01).

   **공고ID 규칙은 안 건드립니다.** 건드리면 모든 번호가 바뀌어
   새 공고가 쏟아집니다. 대조할 때만 주소를 맞춰 봅니다.

   맞추는 것 — www 유무 · http/https · 끝의 / · 대소문자 · 기본 포트 */
function 주소맞추기(u) {
  const t = String(u || '').trim();
  if (!t) return '';
  try {
    const x = new URL(t);
    const 집 = x.hostname.replace(/^www\./i, '').toLowerCase();
    const 포트 = (x.port && x.port !== '80' && x.port !== '443') ? ':' + x.port : '';
    const 길 = x.pathname.replace(/\/+$/, '');
    return 집 + 포트 + 길 + x.search;          // 물음표 뒤는 순서까지 그대로 봅니다
  } catch {
    return t.replace(/^https?:\/\//i, '').replace(/^www\./i, '')
      .replace(/\/+$/, '').toLowerCase();
  }
}
/* 대조용 열쇠 — 주소가 있으면 주소로, 없으면 옛날처럼 번호로 */
const 대조키 = (기관, url, id) => (url ? 붙이기(기관) + '|' + 주소맞추기(url) : 'ID:' + String(id));

/* ── 스스로 하는 검사 — node tools/collect-hosp.mjs --주소검사 ── */
if (process.argv.includes('--주소검사')) {
  const 짝 = [
    /* 강진의료원 — 실제로 번호가 갈렸던 그 짝 (2026-10-01) */
    ['https://www.gjmc.or.kr/board/view.do?no=18', 'http://gjmc.or.kr/board/view.do?no=18', true],
    ['https://gjmc.or.kr/board/', 'https://gjmc.or.kr/board', true],
    /* 물음표 뒤의 / 는 값의 일부라 **지우면 안 됩니다** */
    ['https://gjmc.or.kr/view.do?no=18/', 'https://gjmc.or.kr/view.do?no=18', false],
    ['https://WWW.GJMC.or.kr/Board/view.do?no=18', 'https://gjmc.or.kr/Board/view.do?no=18', true],
    ['https://gjmc.or.kr:443/a', 'http://gjmc.or.kr/a', true],
    /* 갈려야 하는 것 — 글 번호가 다르면 다른 공고입니다 */
    ['https://gjmc.or.kr/board/view.do?no=18', 'https://gjmc.or.kr/board/view.do?no=19', false],
    ['https://gjmc.or.kr/a', 'https://gjmc.or.kr/b', false],
    /* 주소가 아닌 글자도 죽지 않아야 합니다 */
    ['javascript:go(3)', 'javascript:go(3)', true],
  ];
  let 틀림 = 0;
  for (const [a, b, 같아야] of 짝) {
    const 같나 = 주소맞추기(a) === 주소맞추기(b);
    if (같나 !== 같아야) 틀림++;
    console.log((같나 === 같아야 ? '○ ' : '★ ') + (같아야 ? '같아야' : '달라야') + ' — '
      + 주소맞추기(a) + (같나 ? '  ==  ' : '  !=  ') + 주소맞추기(b));
  }
  /* 주소가 없으면 번호로 떨어지는지 */
  const 번호로 = 대조키('강진의료원', '', 'HS123');
  if (번호로 !== 'ID:HS123') { 틀림++; console.log('★ 주소 없을 때 번호로 안 떨어짐 — ' + 번호로); }
  else console.log('○ 주소가 없으면 번호로 — ' + 번호로);
  console.log(틀림 ? '\n★ ' + 틀림 + '개 틀렸습니다' : '\n○ 다 맞습니다');
  process.exit(틀림 ? 1 : 0);
}

/* ── 본체 ── */
const argv = process.argv.slice(2);
const dry = argv.includes('--dry');
const 한줄 = argv.includes('--한줄');
const 동시 = Number(argv.includes('--동시') ? argv[argv.indexOf('--동시') + 1] : 6) || 6;
const 상세몫 = argv.includes('--상세') ? Number(argv[argv.indexOf('--상세') + 1]) : 50;

/* 첨부는 `--마른` 이거나 `POTJOB_ATTACH_WRITE` 가 안 켜져 있으면 안 담습니다.
   `--dry` 와 따로 둡니다 — 나라일터도 그렇게 합니다 (collect-nara.mjs:81) */
const 마른첨부 = argv.includes('--마른') || dry;

/* ★ 2026-10-14 세중님 0번 시험용 — **NUL 이 든 가짜 줄 하나를 섞습니다.**
   `--나쁜줄시험` 을 줄 때만 섞이고, 그 줄은 `TEST` 로 시작해 실제 공고와
   섞이지 않습니다. 담길 일도 없습니다 — 보내기 전에 걸러집니다.
   「시험 자료는 실제 회원 계정에 넣지 않습니다」(지침 8-9)와 같은 결로,
   되돌릴 필요가 없는 쪽으로 짭니다 */
const 나쁜줄시험 = argv.includes('--나쁜줄시험');
/* 2026-10-19 — 회원 화면 공고만 건너뛰기에서 빼고 다시 엽니다 (까닭은 쓰는 자리 주석) */
const 회원것다시 = argv.includes('--회원것다시');
const 찾을말 = argv.filter((x, i) => !x.startsWith('--')
  && !['--동시', '--상세'].includes(argv[i - 1]));

const cfg = env();
const 첨부모음 = 첨부모으기(SOURCE, { 마른: 마른첨부 });
const t0 = Date.now();
const 오늘 = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
const 원래log = console.log;
if (한줄) console.log = () => {};

const 전부 = cfgs더하기(사이트들());
const 볼것 = 찾을말.length ? 전부.filter((s) => 찾을말.some((w) => s.name.includes(w))) : 전부;

console.log('병원 홈페이지 수집 (HS3) — ' + 볼것.length + '줄 · ' + 오늘
  + ' · 동시 ' + 동시 + ' · 상세 사이트당 ' + 상세몫 + '건' + (dry ? ' · --dry' : ''));
console.log('  규칙 구운 날  ' + 구운날);
console.log('  열쇠          Supabase ' + (cfg.SUPABASE_ANON_KEY ? '있음' : '**없음**')
  + ' · collect_put ' + (cfg.COLLECT_KEY_HS3 ? '있음' : '**없음**'));
if (!dry && !cfg.COLLECT_KEY_HS3) { console.error('COLLECT_KEY_HS3 가 없습니다'); process.exit(1); }

/* ── ① 목록 받기 ─────────────────────────────────────────── */
console.log('\n① 목록 —');
const 셈 = { 못받음: 0, 규칙0: 0, 줄: 0, 꺼짐: 0, 주소없음: 0 };
const 주소없는곳 = new Map();
const 모은것 = [];
const 곳별 = [];
const 못받은곳 = [];

for (let i = 0; i < 볼것.length; i += 동시) {
  await Promise.all(볼것.slice(i, i + 동시).map(async (s) => {
    /* ⚠ `off` 는 **구글 IP 라서** 꺼둔 것입니다. node 에서는 열립니다.
       「다른 경로로 들어옴」 이라고 적힌 곳만 건너뜁니다 */
    if (s.off && /알리오로 들어옴|클린아이로 들어옴/.test(String(s.off))) {
      셈.꺼짐++; 곳별.push({ 이름: s.name, 건너뜀: '다른 경로로 들어옴' }); return;
    }
    if (!s.url && !s.host) { 곳별.push({ 이름: s.name, 건너뜀: '주소가 없음' }); return; }

    const g = await 사이트줄(s);
    if (g.err) {
      셈.못받음++;
      못받은곳.push({ 이름: s.name, 왜: g.err });
      곳별.push({ 이름: s.name, 왜: g.err });
      return;
    }
    let rows = g.rows;
    if (s.only) rows = rows.filter((r) => new RegExp(s.only).test(r.title));
    if (s.not) rows = rows.filter((r) => !new RegExp(s.not).test(r.title));
    if (!rows.length) 셈.규칙0++;
    셈.줄 += rows.length;
    곳별.push({ 이름: s.name, 줄: rows.length, raw: g.raw });
    /* ⚠ 주소가 없는 줄은 담을 수 없습니다. **그런데 말없이 버리면 안 됩니다** —
       강진의료원이 link 규칙 하나 때문에 7줄을 통째로 잃고 있었는데
       「줄 7」 이라고만 찍혀서 두 주 동안 아무도 몰랐습니다 (2026-09-30). */
    rows.forEach((r) => {
      if (r.title && r.url) { 모은것.push({ ...r, 곳: s }); return; }
      셈.주소없음++;
      주소없는곳.set(s.name, (주소없는곳.get(s.name) || 0) + 1);
    });
  }));
}
console.log('  줄 ' + 셈.줄 + ' · 못 받음 ' + 셈.못받음 + '곳 · 한 줄도 못 뽑음 ' + 셈.규칙0
  + '곳 · 건너뜀 ' + 셈.꺼짐 + '곳');
if (셈.주소없음) {
  console.log('  ★ 주소를 못 뽑아 버린 줄 ' + 셈.주소없음 + '건 — link 규칙을 봐야 합니다');
  [...주소없는곳.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
    .forEach(([이름, n]) => console.log('      ' + 이름.slice(0, 26).padEnd(28) + n + '건'));
}
if (못받은곳.length) {
  console.log('  못 받은 곳 —');
  못받은곳.slice(0, 12).forEach((x) => console.log('    ✗ ' + x.이름.slice(0, 24).padEnd(26) + x.왜.slice(0, 56)));
  if (못받은곳.length > 12) console.log('    … 그리고 ' + (못받은곳.length - 12) + '곳 더');
}

/* ── ② 갈래 판정 — 규칙은 sort-rule 한 벌 ─────────────────── */
/* 마감이 지난 것은 뺍니다. 담는 것은 다 담되 **버리지는 않습니다** —
   30일·180일 규칙은 DB 의 hide_stale_posts 가 「감추기」 로 합니다 */
const 오늘점 = 오늘.replace(/-/g, '.');
const 올해 = Number(오늘.slice(0, 4));

/* ⚠ **제목에 옛 연도가 적힌 글을 뺍니다** (2026-09-28).
 *
 * 병원 게시판에는 몇 해 전 공고가 그대로 붙어 있습니다. 날짜 칸이 비어 있으면
 * 마감으로도 못 거르고, `first_seen` 이 **오늘**이 되어 30일 동안 새 공고처럼 뜹니다.
 * 광혜병원 「4 [접수마감] 2022년 물리치료사 채용공고」 가 그렇게 올라갈 뻔했습니다.
 * (그 글은 「접수마감」 으로도 걸리게 고쳤지만, 마감 표시가 없는 옛 글도 있습니다)
 *
 * 작년치는 남깁니다 — 1월에 「2025년 하반기…」 가 아직 살아 있을 수 있습니다.
 * 날짜가 적혀 있는 글은 **건드리지 않습니다.** 날짜가 하나도 없을 때만 봅니다. */
function 옛글인가(r) {
  if (r.to || r.from || r.posted) return false;          // 날짜가 있으면 그쪽을 믿습니다
  const 해들 = [...String(r.title || '').matchAll(/(20\d{2})\s*년/g)].map((m) => Number(m[1]));
  if (!해들.length) return false;
  return Math.max(...해들) < 올해 - 1;
}
const 옛글 = 모은것.filter(옛글인가);
const 살아있는것 = 모은것.filter((r) => !(r.to && r.to < 오늘점) && !옛글인가(r));
console.log('\n② 판정 — 마감 지난 것 '
  + (모은것.length - 살아있는것.length - 옛글.length) + '건 · 제목이 ' + (올해 - 1)
  + '년보다 옛날인 것 ' + 옛글.length + '건 뺐습니다');
if (옛글.length) {
  옛글.slice(0, 4).forEach((r) => console.log('    옛글 ' + r.곳.name.slice(0, 16).padEnd(18) + r.title.slice(0, 48)));
}

/* 같은 공고가 여러 곳에서 들어옵니다 — 기관+제목으로 한 번만 */
const 본것 = new Set();
const 결과 = [];
for (const r of 살아있는것) {
  const id = 공고ID(r.곳.name, r.url, r.title);
  const 열쇠 = 같은공고(r.곳.name, r.title);
  if (본것.has(id) || 본것.has(열쇠)) continue;
  본것.add(id); 본것.add(열쇠);
  const 직군 = (matchJob(r.title) && !notOurs(r.title)) ? matchJob(r.title) : '';
  결과.push({ ...r, id, 직군, 갈래: sortJob(r.title, 직군, null) });
}
const 회원 = 결과.filter((x) => x.갈래.갈래 === '회원목록');
const 보류 = 결과.filter((x) => x.갈래.갈래 === '보류함');
const 쓰레기 = 결과.filter((x) => x.갈래.갈래 === '쓰레기통');
console.log('  회원 목록 ' + 회원.length + ' · 보류함 ' + 보류.length + ' · 쓰레기통 ' + 쓰레기.length
  + ' · 쌓아둠 ' + 결과.filter((x) => x.갈래.갈래 === '숨김보관').length);

/* ── ③ 상세 열기 — 사이트당 하루 상세몫 건 ──────────────────
 *
 * ★ 2026-10-07 — 상세를 **두 가지** 까닭으로 엽니다 (세중님 지시).
 *     ① 제목만으로 직군을 못 가린 것      ← 전부터 하던 것
 *     ② 담을 것인데 **마감일이 없는 것**   ← 새로 더한 것
 *   ②가 없어서 HS 출처 공고 313건의 마감일이 비어 「수시채용」 으로 떴습니다.
 *   옛 앱의 hospFillDates 가 하던 일인데 옮기지 않았습니다
 *   (홈페이지_이전_지도.md:35 의 `✗`).
 */
let 상세연것 = 0, 상세로가림 = 0, 날짜채움 = 0, 날짜버림 = 0, 제목이거름 = 0;
let 선택자못찾음 = 0;   /* 2026-10-17 — 본문선택자를 넣었는데 쪽에서 못 찾은 수 */
/* 2026-10-19 — 상세 본문에서 칸을 뽑은 공고 수 · 뽑은 칸 수 · 탈난 수 */
let 본문칸뽑음 = 0, 본문칸수 = 0, 본문칸탈 = 0;
if (상세몫 > 0) {
  const 곳마다 = new Map();
  /* ★ 2026-10-14 세중님 — **담을 것은 전부 상세를 엽니다.**
   *
   * 전에는 「직군을 못 가린 것 + **마감일이 없는 것**」만 열었습니다
   * (2026-10-07 에 마감일 빈칸을 메우려고 더한 조건입니다).
   * 그래서 **목록에서 마감일이 나온 공고는 상세를 한 번도 안 열었습니다** —
   * 마감일 말고도 지원자격·모집인원·예상연봉이 거기 있는데 못 받았습니다.
   *
   *   삼성서울 재활치료실 계약직 물리치료사   목록에 마감 2026-10-14 → 본문 0자
   *   부민 [구포] 작업치료사 휴직대체          목록에 마감 2026-10-31 → 본문 0자
   *   중앙보훈 기간제 직원 채용 공고(10월)     목록에 마감 2026-10-16 → 본문 0자
   *
   * 1층 공고의 지원자격이 32% 밖에 안 차는 가장 큰 까닭입니다.
   * 사이트당 하루 뚜껑(`상세몫`, 기본 50)은 그대로라 품이 터지지 않습니다 —
   * 한 사이트에서 담을 공고가 50건을 넘는 일이 없습니다.
   *
   * 숨김보관(임상병리사·방사선사 쌓아두기)은 안 엽니다 — 회원에게 안 보이는
   * 것이라 칸을 채울 까닭이 없습니다. */
  const 열어야할것 = 결과.filter((x) => x.갈래.갈래 !== '쓰레기통' && x.갈래.갈래 !== '숨김보관');
  const 날짜없는것 = 결과.filter((x) => x.갈래.갈래 !== '쓰레기통' && !x.to);

  /* ★ 2026-10-14 세중님 1번 — **병원 사이트를 덜 두드립니다.**
   *
   * 「담을 것은 전부」로 넓히니 한 바퀴에 167번, 하루 16바퀴면 약 2,670번을
   * 두드리게 됐습니다. 부담도 부담이고 차단 위험이 있습니다.
   *
   * 매 바퀴 여는 것 — **처음 본 공고**와 **본문이 비었거나 메뉴뿐인 공고**.
   * 이미 쓸 만한 본문을 받은 공고는 **하루 한 번만** 엽니다.
   *
   * 「쓸 만한」을 글자 수로 가르지 않습니다 — 그러면 왼쪽 메뉴가 「원문 있음」이
   * 됩니다 (2026-10-14 에 17건을 그렇게 셀 뻔했습니다 · 지침 15절).
   * **「치료사」가 본문에 있는지**를 봅니다. 판정은 DB 의 `상세건너뛸공고()`
   * 한 자리이고 「직군 의심」 그물과 같은 잣대입니다 (지침 6절).
   *
   * 열쇠가 없거나 창구가 탈나면 **전부 엽니다** — 덜 여는 쪽으로 실수하면
   * 칸이 조용히 안 채워집니다. 많이 여는 쪽이 안전합니다.
   *
   * ★ 그리고 **그때 가린 직군을 함께 받아 씁니다.** 처음 판은 id 만 받았는데,
   *   상세를 건너뛴 공고의 직군이 **매 바퀴 다시 사라져** 보류함으로 갔습니다
   *   (회원 화면 39 → 34). 그 직군은 상세 본문에서 가린 것이라, 상세를 안 열면
   *   수집기가 「직군 못 가림」으로 봅니다. 돌려 보고 알았습니다 (지침 12절). */
  const 건너뛸것 = new Map();      /* id → 그때 가린 직군 */
  if (cfg.COLLECT_KEY_HS3) {
    try {
      const s = await rpc(cfg, '상세건너뛸공고', {
        p_secret: cfg.COLLECT_KEY_HS3, p_source: SOURCE,
      });
      for (const x of ((s || {})['건너뛸것'] || [])) 건너뛸것.set(x.id, x['직군'] || '');
    } catch (e) {
      console.log('  상세 건너뛸 목록을 못 받았습니다 — 전부 엽니다 · '
        + String(e.message || e).slice(0, 90));
    }
  }
  /* 건너뛰는 공고는 **아는 직군을 그대로 씁니다** — 안 그러면 보류함으로 갑니다 */
  let 직군이어받음 = 0;
  for (const x of 결과) {
    const j = 건너뛸것.get(x.id);
    if (!j || x.직군) continue;
    x.직군 = j;
    x.갈래 = sortJob(x.title, j, null);
    x.근거 = '오늘 받은 상세에서 가린 직군을 이어받음: ' + j;
    직군이어받음++;
  }
  if (직군이어받음) console.log('  상세를 건너뛰며 직군을 이어받은 공고 ' + 직군이어받음 + '건');

  /* ★ 2026-10-19 — `--회원것다시` 를 적으면 **회원 화면에 보이는 공고만**
   * 건너뛰기에서 빼고 다시 엽니다.
   *
   * 왜 필요한가 — 칸뽑기를 연결한 날(2026-10-19)에 61건에서 94개 칸이 들어왔는데
   * **전부 접수마감·접수시각**이었고 지원자격·근무지·예상연봉은 0건이었습니다.
   * 까닭은 두 겹입니다 —
   *   ① 상세를 여는 대상이 주로 **보류함**(직군 못 가린 것)이고, 거기에는 우리
   *      직군 말이 없어서 `칸뽑기` 가 그 칸들을 **일부러 안 냅니다**(설계대로)
   *   ② 회원 화면 공고는 「오늘 이미 쓸 만한 본문을 받았다」고 **건너뜁니다**
   *      (2026-10-14 에 넣은 규칙) — 연결 전 바퀴에서 이미 받았으니 그날은
   *      한 번도 안 열립니다
   * 그래서 칸을 채우려면 **그 공고들을 한 번 다시 열어야** 합니다.
   *
   * 평소에는 쓰지 않습니다 — 사이트를 더 두드리기 때문입니다. 사이트당 하루
   * 뚜껑(`상세몫`)은 그대로 걸립니다. */
  if (회원것다시) {
    let 되살림 = 0;
    for (const x of 결과) {
      if (x.갈래.갈래 === '회원목록' && 건너뛸것.has(x.id)) { 건너뛸것.delete(x.id); 되살림++; }
    }
    console.log('  --회원것다시 — 건너뛰기에서 뺀 회원 화면 공고 ' + 되살림 + '건');
  }
  const 뽑을것 = [...new Set([...보류, ...열어야할것])].filter((x) => !건너뛸것.has(x.id));
  const 열것 = 뽑을것.filter((x) => {
    const n = 곳마다.get(x.곳.name) || 0;
    if (n >= 상세몫) return false;
    곳마다.set(x.곳.name, n + 1);
    return true;
  });
  console.log('\n③ 상세 — 담을 것 ' + 열어야할것.length + '건(직군 못 가린 것 ' + 보류.length
    + ' 포함 · 그중 마감일 없는 것 ' + 날짜없는것.length + ')'
    + ' · 오늘 이미 받은 것 ' + 건너뛸것.size + '건은 건너뜁니다'
    + ' → ' + 열것.length + '건을 엽니다 (사이트당 ' + 상세몫 + '건까지)');
  for (let i = 0; i < 열것.length; i += 동시) {
    await Promise.all(열것.slice(i, i + 동시).map(async (x) => {
      const g = await 글받기(상세주소(x.url), { headers: { 'User-Agent': UA, 'Accept-Language': 'ko' }, enc: x.곳.enc });
      상세연것++;
      if (g.왜 || g.code !== 200) { x.상세왜 = g.왜 || ('HTTP ' + g.code); return; }
      /* ★ 2026-10-12 — **`<style>` 과 주석도 걷습니다.**
         전에는 `<script>` 만 걷어서 CSS 가 본문으로 들어왔습니다 —
         본문 28건·기관 11곳이 평균 **56,128자**(중괄호 505개)로 부풀었고,
         대청병원 한 건은 **464,949자**였습니다. 저장·읽기 부담만 늘고
         뽑기에도 방해가 됩니다.
         같은 일을 하는 `hosp/hs_dates.js` 의 `hsText()` 는 이미 걷습니다 —
         **기준이 두 자리였습니다** (지침 6절). 여기를 그쪽에 맞춥니다.
         (다만 이것이 마감일 빈칸의 원인은 아닙니다 — 걷어도 접수말이
          드러나는 공고는 0건이었습니다. 부피만 줄이는 고침입니다) */
      /* ★ 2026-10-17 세중님 2-② — **본문 영역만 자릅니다** (사이트 설정의 `본문선택자`).
         없으면 지금까지처럼 쪽 전체를 씁니다 — 설정이 있는 곳만 달라집니다.
         못 찾으면 `본문자르기` 가 null 을 주고, 그때도 전체를 씁니다.
         다만 **못 찾았다는 것을 남깁니다** — 조용히 전체로 돌아가면
         선택자가 틀려도 안 드러납니다 (지침 2절). */
      let 쪽 = g.html;
      if (x.곳 && x.곳.본문선택자) {
        const 잘린 = 본문자르기(g.html, x.곳.본문선택자);
        if (잘린 == null) { x.본문선택자못찾음 = true; 선택자못찾음++; }
        else 쪽 = 잘린;
      }
      const 글 = 쪽.replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<!--[\s\S]*?-->/g, ' ')
        /* ★ 2026-10-19 — **줄바꿈을 살립니다.** 아래에서 `\s+` 를 한 칸으로
           누르고 있었는데, 그러면 `칸뽑기` 가 번호 꼭지를 못 끊습니다 —
           `끊자격` 의 첫 패턴이 `\n\s*(?:\d{1,2}\s*[.)])` 이기 때문입니다.
           직군 판정(`본문직군`)은 정규식 검사라 줄바ꈈ과 무관하고,
           본문이 사람 눈에도 읽기 쉬워집니다. 걷는 것(NUL·script·style)은
           그대로입니다 */
        .replace(/<\/(?:p|div|tr|li|h[1-6]|table|dd|dt)>/gi, '\n')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
        /* ★ 2026-10-14 — **제어 글자를 걷습니다.** 22:00 정시 실행이
           `22P05 unsupported Unicode escape sequence · \u0000 cannot be
           converted to text` 로 통째로 탈났습니다 (담음 0). PostgreSQL 의
           `text` 는 NUL 을 못 받습니다. `\s` 에 NUL 이 안 들어가서
           `replace(/\s+/g,' ')` 로는 안 걷힙니다.
           상세를 더 열기 시작하면서(이날 ③) NUL 이 든 쪽을 처음 만났습니다 —
           한 건이 **그 바퀴 전체**를 죽입니다. 줄 단위가 아니라 한 번에
           보내기 때문입니다. */
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
        /* 빈칸만 누르고 **줄바꿈은 남깁니다** (바로 위 주석) */
        .replace(/[^\S\n]+/g, ' ')
        .replace(/ *\n */g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      x.본문 = 글;

      /* ★ 2026-10-14 세중님 ㉯ — **공고문 첨부 주소를 모읍니다.**
         규칙은 `hosp/hs_files.js` 한 벌입니다 (공고문 > 그밖 > 지원서·서식).
         주소를 규칙으로 못 만듭니다 — 상세 HTML 에서 긁는 수밖에 없습니다
         (충주의료원은 해시가 셋 들어갑니다 · 지침 3절).
         담는 것은 `첨부담기.mjs` 가 하고, 하루 상한·마른 실행도 그쪽 규칙입니다.
         ⚠ `글`(태그 걷은 것) 이 아니라 **`g.html`(원본)** 을 줍니다 — 주소는
            태그 안에 있어서 걷은 글에는 없습니다 */
      try {
        for (const a of hs첨부주소(g.html, 상세주소(x.url))) {
          첨부모음.더하기({ job_id: x.id, kind: a.kind || '공고문', name: a.이름 || a.name || '', url: a.url || a.주소 || a });
          x.첨부수 = (x.첨부수 || 0) + 1;
        }
      } catch (e) {
        /* 조용히 버리지 않습니다 (지침 2절) */
        console.log('    첨부 못 모음 ' + String(x.곳.name).slice(0, 14).padEnd(16)
          + String(e.message || e).slice(0, 80));
      }

      /* ★ 접수기간 채우기 (2026-10-07). 규칙은 tools/hosp/hs_dates.js 한 벌입니다.
         목록에서 날짜가 나온 공고는 건드리지 않습니다 — 목록 쪽이 더 믿을만합니다 */
      /* 접수 안내 문장을 떼어 둡니다 — 판정은 DB 의 마감표시() 가 합니다.
         「채용시까지」 처럼 날짜가 아닌 말이 적혀 있으면 그게 진짜 수시 공고입니다 */
      x.접수문장 = hs접수문장(글);

      if (!x.to) {
        const d = hsDetailDates(글);
        const to = 날짜쓸만한가(d, x.posted || x.from);
        if (to) {
          x.to = to;
          if (!x.from && d.from) x.from = d.from;
          x.날짜출처 = d.rank === 1 ? '본문 · 공고기간' : '본문 · 접수기간';
          날짜채움++;
        } else if (d.to) {
          /* 읽었는데 거른 것 — 조용히 버리지 않고 셉니다 (지침 2절) */
          날짜버림++;
          console.log('    날짜 거름 ' + x.곳.name.slice(0, 14).padEnd(16)
            + '읽은값 ' + JSON.stringify(d) + ' · 올린날 ' + (x.posted || '모름'));
        }
      }

      /* ★ 2026-10-14 — 두 가지를 고쳤습니다 (세중님께 보고).
       *
       * ① `matchJob(글)` → `본문직군(글)`.
       *    `matchJob` 은 맨 「물리치료」로도 걸려서 **왼쪽 메뉴의
       *    「물리치료센터」·「물리치료실」**에 걸렸습니다. 강진의료원 7건과
       *    한국병원 「[모집]심뇌혈관센터 방사선사」 1건이 그렇게 올라왔습니다.
       *    `본문직군` 은 「치료사」를 요구합니다 (기준은 공고문읽기.mjs 한 자리).
       *
       * ② 갈래를 손으로 '회원목록' 이라고 적지 않고 **`sortJob` 을 지나게** 했습니다.
       *    전에는 여기서 바로 회원목록으로 못 박아서, 제목의 마감·결과·시험장소
       *    걸러내기(⓪-0)가 **다시 안 걸렸습니다.** 첨부로 직군을 찾은 자리는
       *    이미 sortJob 을 지나는데 본문 자리만 빠져 있었습니다 (지침 6절). */
      const j = 본문직군(글);
      if (j) {
        const g2 = sortJob(x.title, j, null);
        if (g2.갈래 === '회원목록') {
          x.직군 = j;
          x.갈래 = { 갈래: '회원목록', 단계: 1, 왜: '1단계 · 상세 본문에 직군이 적혀 있음', 걸린단어: [], 메모: '' };
          x.근거 = '병원 게시판 제목 · 보류 → 상세 본문: ' + j;
          상세로가림++;
        } else {
          /* 본문에 우리 직군이 있어도 **제목이 「아니다」라고 말하면** 그쪽을 따릅니다.
             조용히 버리지 않고 셉니다 (지침 2절) */
          x.갈래 = g2;
          x.근거 = '상세 본문에 ' + j + ' 가 있지만 제목이 거릅니다 · ' + (g2.왜 || '');
          제목이거름++;
        }
      }

      /* ★ 2026-10-19 세중님 ③ 승인 — **상세 본문에서 칸을 뽑습니다.**
       *
       * 그때까지 이 자리는 상세를 열어 **직군만** 가리고 본문을 버렸습니다.
       * 그래서 HS·HS3 우리 직군 공고 100건의 지원자격·예상연봉이 **0.0%**
       * 였습니다 (모집인원 5.0 · 근무지 36.0 · 접수마감 41.0).
       * 칸을 뽑는 `칸뽑기()` 는 `공고문읽기.mjs` 에 **이미 있었고 아무도 안
       * 불렀습니다** — 지침 6절 「import 하지 않으면 없는 기능입니다」.
       *
       * 꼭지 끊기를 먼저 고쳤습니다(2026-10-19) — 전에는 「3. 전형 절차」가
       * 지원자격에 섞여 들어왔습니다. 마른 실행 12건에서 틀린 값 0 을 보고
       * 연결합니다 (docs/HS3_일곱칸_0퍼센트_1019.md).
       *
       * ★ **빈 값으로 덮지 않습니다** — `collect_put` 의 가드 8칸이 막습니다.
       *   여기서는 **뽑힌 것만** 보냅니다(null 은 아예 안 담습니다).
       * ★ 첨부(kordoc)로 뽑은 값이 더 믿을 만하므로 `뽑은값` 은 **병합**이고
       *   같은 열쇠는 새 값이 이깁니다 — 창구 쪽 규칙 그대로입니다. */
      try {
        const 칸 = 칸뽑기('', 글);
        const 담을것 = {};
        if (칸.접수마감) 담을것.공고문_접수마감 = 칸.접수마감;
        if (칸.접수시각) 담을것.공고문_접수시각 = 칸.접수시각;
        if (칸.지원자격) 담을것.지원자격 = 칸.지원자격;
        if (칸.근무지) 담을것.근무지 = 칸.근무지;
        if (칸.예상연봉) 담을것.예상연봉 = 칸.예상연봉;
        if (Object.keys(칸.모집인원 || {}).length) 담을것.직군별인원 = 칸.모집인원;
        if (Object.keys(담을것).length) {
          담을것.근거 = 칸.근거 || {};
          담을것.읽은법 = '상세 본문';
          x.본문칸 = 담을것;
          본문칸뽑음++;
          본문칸수 += Object.keys(담을것).filter((k) => k !== '근거' && k !== '읽은법').length;
        }
      } catch (e) {
        /* 한 건이 탈나도 바퀴 전체를 죽이지 않습니다 — 셈만 올립니다 */
        본문칸탈++;
        if (본문칸탈 <= 3) console.log('    [본문칸] ' + x.id + ' — ' + String(e.message || e).slice(0, 80));
      }
    }));
  }
  console.log('  연 것 ' + 상세연것 + '건 · ★ 상세를 읽고 나서 직군이 가려진 공고 ' + 상세로가림 + '건'
    + (선택자못찾음 ? ' · ⚠ 본문선택자를 못 찾은 것 ' + 선택자못찾음 + '건 (쪽 전체를 썼습니다)' : ''));
  if (제목이거름) console.log('  ★ 본문에 직군이 있는데 제목이 거른 것 ' + 제목이거름 + '건 (마감·결과·시험장소)');
  console.log('  ★ 상세에서 마감일을 채운 공고 ' + 날짜채움 + '건'
    + (날짜버림 ? ' · 읽었지만 거른 것 ' + 날짜버림 + '건' : ''));
  /* 2026-10-19 — 상세 본문에서 뽑은 칸 (세중님 ③) */
  console.log('  ★ 상세 본문에서 칸을 뽑은 공고 ' + 본문칸뽑음 + '건 · 뽑은 칸 ' + 본문칸수 + '개'
    + (본문칸뽑음 ? ' (건당 ' + (본문칸수 / 본문칸뽑음).toFixed(1) + '칸)' : '')
    + (본문칸탈 ? ' · ⚠ 탈난 것 ' + 본문칸탈 + '건' : ''));
}

/* 상세로 바뀐 것을 다시 셉니다 */
const 회원2 = 결과.filter((x) => x.갈래.갈래 === '회원목록');
const 보류2 = 결과.filter((x) => x.갈래.갈래 === '보류함');
const 쓰레기2 = 결과.filter((x) => x.갈래.갈래 === '쓰레기통');
/* 임상병리사·방사선사 — 버리지 않고 **화면에 안 보이게 쌓아둡니다** (2026-09-20 결정).
   나중에 값을 매길 자료이고, 버리면 되살릴 수 없습니다 */
const 쌓을것 = 결과.filter((x) => x.갈래.갈래 === '숨김보관');
/* 내린 판정을 기억에 남깁니다 — 10/3 짝 대조용 (2026-10-02 세중님 지시).
   병원 홈페이지는 바깥 번호가 없어서 **공고ID 그대로** 적습니다.
   지문은 안 바뀌는 칸(제목·주소·마감일)으로만 잽니다 — 긁은 쪽 전체로 재면
   사이트가 꾸밈을 조금 바꿔도 지문이 달라집니다 */
if (!dry) {
  const 열쇠2 = cfg.COLLECT_KEY_HS3 || '';
  await 판정남기기(cfg, { 열쇠: 열쇠2, source: SOURCE, 줄들: 결과
    .filter((x) => x.id && x.갈래 && x.갈래.갈래)
    .map((x) => ({ 번호: String(x.id), 판정: x.갈래.갈래,
      지문: 지문({ t: x.title, u: x.url, d: x.to || x.from || '' }) })) });
}
if (회원2.length) {
  console.log('\n  ★ 회원 목록에 올라갈 것 —');
  회원2.forEach((x) => console.log('     ' + (x.직군 || '?').padEnd(7)
    + (x.to || x.from || '날짜없음').padEnd(12)
    + x.곳.name.slice(0, 18).padEnd(20) + x.title.slice(0, 44)));
}

/* ── ④ 담을 줄 ───────────────────────────────────────────── */
const 이제 = new Date().toISOString();
const 날 = (v) => (v ? String(v).replace(/\./g, '-') : null);
/* ★ 2026-10-14 — **목록 줄에서 온 마감일에도 두 해 뚜껑을 씌웁니다** (세중님 지시).
 *
 * 전에는 뚜껑이 `hs_dates.hsDetailDates()` 안에만 있어서 **상세 본문**을 읽어
 * 얻은 날짜에만 걸렸습니다. 목록(appsite·html)에서 바로 온 날짜는 그냥
 * 들어갔습니다 — 2026-10-14 에 조선대병원이 그랬습니다
 *   「결핵관리 국책사업 전담 간호사(계약직) 채용 재공고 | 2026.06.29 ~ 2099.12.31」
 * 이제 규칙은 `hs_dates` 의 `너무먼날()` **한 자리**이고 여기서 그것을 부릅니다.
 *
 * 버린 날짜는 지우지 않고 `deadline_src` 에 남깁니다 — 왜 비었는지 보이게
 * (2026-10-13 에 이미 담긴 7건을 그렇게 고쳤습니다). */
const 오늘글 = new Date().toISOString().slice(0, 10);
const 먼마감 = [];
/* ★ 2026-10-14 — **마감 시각도 함께 정합니다.**
 *
 * 일곱 칸 가운데 마감시각이 1.1% 로 가장 낮았는데, 세어 보니 HS3 공고
 * **53건의 접수문장에 시각이 적혀** 있으면서 apply_to_time 이 비어
 * 있었습니다(49건). `collect-hosp` 가 그 칸을 **아예 안 보내고** 있었습니다.
 * 첨부를 읽기 전에 이미 가진 글에서 얻을 수 있는 값이었습니다.
 * 규칙은 `hs_dates` 의 `마감시각()` 한 자리입니다 (자기 점검 8개). */
const 시각찾음 = [];
const 마감과출처 = (x) => {
  if (너무먼날(x.to)) {
    먼마감.push({ 곳: x.곳.name, 제목: x.title, 원문: x.to });
    return { apply_to: null, deadline_src: '원문 날짜 ' + 날(x.to) + ' → 채용시까지로 봄 (' + 오늘글 + ')' };
  }
  const 시 = x.접수문장 ? 마감시각(x.접수문장, x.to) : '';
  if (시) 시각찾음.push({ 곳: x.곳.name, 제목: x.title, 시: 시, 문장: String(x.접수문장).slice(0, 56) });
  return {
    apply_to: 날(x.to),
    deadline_src: x.날짜출처 || (x.to ? '목록' : null),
    ...(시 ? { apply_to_time: 시 } : {}),
  };
};
const 담을것 = 회원2.concat(보류2).concat(쌓을것).map((x) => ({
  id: x.id,
  external_id: String(x.id).slice(2),
  org_name: x.곳.name, title: x.title,
  hire_type: '', employ_type: '', work_place: '', sido: null, sgg: null, edu: '',
  headcount: null,
  /* ★ 2026-10-19 세중님 ③ — **상세 본문에서 뽑은 칸**을 담습니다.
   * 위 두 줄의 빈 값·null 을 **덮어씁니다** (아래가 이깁니다 — 객체 뒤쪽이 이기는
   * 자리이므로 순서가 중요합니다).
   * ★ 뽑힌 것만 담습니다 — 안 뽑힌 칸은 아예 안 넣어 `collect_put` 의 가드가
   *   기존 값을 지키게 둡니다 (null 을 보내면 가드가 막아 주지만, 애초에
   *   안 보내는 것이 뜻이 분명합니다).
   * ★ 모집인원은 **직군이 확실한 공고에서 그 직군 수만** 씁니다. 통합공고의
   *   전체 인원을 우리 직군 인원으로 쓰면 안 됩니다 (지침 15절). */
  ...(x.본문칸 && x.본문칸.근무지 ? { work_place: x.본문칸.근무지 } : {}),
  ...(x.본문칸 && x.직군 && x.본문칸.직군별인원
      && x.본문칸.직군별인원[x.직군] != null
    ? { headcount: x.본문칸.직군별인원[x.직군] } : {}),
  ...(x.본문칸 ? { '뽑은값': x.본문칸, '뽑은법': '상세 본문' } : {}),
  apply_from: 날(x.from),
  /* 마감일과 그 출처는 **함께** 정합니다 (2026-10-13 · 2026-10-14).
     전에는 창구가 deadline_src 를 안 받아 evidence.날짜출처 에만 적었습니다.
     마감과출처() 가 두 해 뚜껑까지 함께 봅니다 — 규칙은 hs_dates 한 자리 */
  ...마감과출처(x),
  /* 원래 올린 날 — job_posts 의 트리거가 이걸로 first_seen 을 잡습니다 */
  posted_at: 날(x.from || x.posted),
  url: x.url,
  job_group: x.갈래.갈래 === '회원목록' ? (x.직군 || null) : null,
  form: (x.직군 && !mixedTitle(x.title)) ? null : '포함',
  hidden: x.갈래.갈래 === '숨김보관',      // 쌓아두되 회원 화면에는 안 보입니다
  hold: x.갈래.갈래 === '보류함',
  /* 화면과 셈이 읽는 자리에 맞춰 둡니다 — 되메우기(첨부되메우기.mjs)가 쓰는
     열쇠와 **같은 이름**이라야 두 길이 어긋나지 않습니다 (지침 6절) */
  detail: {
    기관홈: x.곳.base || x.곳.host || '',
    ...(x.본문칸 && x.본문칸.지원자격 ? { 지원자격: x.본문칸.지원자격 } : {}),
    ...(x.본문칸 && x.본문칸.예상연봉 ? { 연봉: x.본문칸.예상연봉 } : {}),
  },
  evidence: {
    직군근거: x.근거 || (x.직군 ? '병원 게시판 제목 · 담음(' + x.직군 + ')' : ''),
    /* 마감일을 어디서 얻었나 (2026-10-07). job_posts.deadline_src 칸이 있지만
       collect_put 창구가 그 칸을 안 받습니다 — 창구를 고치는 대신 근거에 적습니다.
       관리자 화면이 근거를 이미 펼쳐 보여 줍니다 */
    ...(x.날짜출처 ? { 날짜출처: x.날짜출처 } : {}),
    /* 접수 안내 문장 그대로. DB 의 마감표시() 가 여기에 「채용시까지·상시·수시…」 가
       있는지 보고 「수시채용」 인지 「마감일 공고문 확인」 인지 가릅니다 */
    ...(x.접수문장 ? { 접수문장: x.접수문장 } : {}),
    갈래: x.갈래.갈래, 단계: String(x.갈래.단계 || ''), 사유: x.갈래.왜 || '',
    걸린단어: (x.갈래.걸린단어 || []).join(','),
    보류사유: x.갈래.갈래 === '보류함' ? (x.상세왜 ? x.갈래.왜 + ' · 상세 ' + x.상세왜 : x.갈래.왜) : '',
    사이트갈래: x.곳.type,
  },
  collected_at: 이제,
}));
const 버릴것 = 쓰레기2.map((x) => ({
  id: x.id, org_name: x.곳.name, title: x.title, url: x.url,
  why: x.갈래.왜 + ((x.갈래.걸린단어 || []).length ? ' — ' + x.갈래.걸린단어.join(',') : ''),
  trashed_at: 이제,
}));
/* 읽은 상세 본문은 버리지 않고 보관합니다 (회원 화면에 안 나갑니다.
   담기 전에 DB 의 개인정보지움() 을 지납니다) */
const 원문들 = 결과.filter((x) => x.본문 && x.본문.length > 200).map((x) => ({
  job_id: x.id, kind: '상세', ord: 0, url: x.url, body: x.본문,
}));
/* ★ 2026-10-14 세중님 0번 시험 — NUL 이 든 가짜 줄 하나를 **한가운데** 섞습니다.
   `--나쁜줄시험` 일 때만. 나머지가 담기는지 보는 것이 목적입니다 */
if (나쁜줄시험 && 원문들.length) {
  원문들.splice(Math.floor(원문들.length / 2), 0, {
    job_id: 'TEST나쁜줄', kind: '상세', ord: 0,
    url: 'https://example.com/시험', body: '앞\u0000뒤 '.repeat(80),
  });
  console.log('  ★ --나쁜줄시험 — NUL 이 든 가짜 줄 하나를 섞었습니다 (TEST나쁜줄)');
}

/* ── ⑤ 담거나, 옛것과 대조하거나 ─────────────────────────── */
/* 옛 수집기(HS)가 담은 것을 읽습니다.
   ⚠ job_posts 를 anon 으로 바로 읽으면 401 입니다 (통째로 열어 두지 않습니다).
     대조에 필요한 넷만 돌려주는 collect_peek 창구를 씁니다 */
async function 옛것() {
  if (!cfg.COLLECT_KEY_HS3) { console.log('  (COLLECT_KEY_HS3 가 없어 대조를 못 합니다)'); return null; }
  try {
    return await rpc(cfg, 'collect_peek', {
      p_secret: cfg.COLLECT_KEY_HS3, p_source: SOURCE, p_of: 'HS',
    });
  } catch (e) { console.log('  옛것을 못 읽었습니다 · ' + String(e.message).slice(0, 120)); return null; }
}

let 담음 = 0, 버림 = 0, 보관 = 0, 탈 = '';
/* ★ 2026-10-14 — 담지 못한 줄 (한 줄 때문에 바퀴가 죽지 않게 · 세중님 0번) */
let 못담음 = 0; const 못담은것 = [];
if (dry) {
  const 옛 = await 옛것();
  if (!옛) console.log('\n옛 수집기 것을 못 읽었습니다 (대조 못 함)');
  else {
    /* 번호가 아니라 **주소**로 맞춥니다 (2026-10-01).
       번호는 주소를 해시한 것이라 `www.` 하나에 갈립니다 */
    const 옛집 = new Map(옛.map((x) => [대조키(x.org_name, x.url, x.id), x]));
    const 새집 = new Map(담을것.map((x) => [대조키(x.org_name, x.url, x.id), x]));
    const 같음 = [...새집.keys()].filter((k) => 옛집.has(k));
    const 새것만 = [...새집.keys()].filter((k) => !옛집.has(k));
    const 옛것만 = [...옛집.keys()].filter((k) => !새집.has(k));
    /* 마감된 옛 공고는 우리가 안 담으므로 차이가 아닙니다 */
    const 살아있는옛것만0 = 옛것만.filter((k) => {
      const v = 옛집.get(k);
      return !v.apply_to || String(v.apply_to) >= 오늘;
    });
    /* ⚠ **gas 가 예전에 담아 둔 줄**과 **지금 우리가 못 찾은 줄**은 다릅니다 (2026-09-28).
       규칙을 조인 뒤(「접수마감」 · 옛 연도)라, gas 시트에는 남아 있지만 지금 규칙으로는
       안 담는 것이 섞입니다 — 「물리치료실 물리치료사 모집마감」 같은 것들.
       그건 차이가 아니라 **우리가 일부러 안 담는 것**입니다. 갈라서 보여줍니다.
       통과 기준(「gas 에만 0」)은 **아래 「진짜 못 찾은 것」** 으로 봅니다. */
    const 우리가버릴것 = 살아있는옛것만0.filter((k) => sortJob(String(옛집.get(k).title), '', null).갈래 === '쓰레기통');
    const 남은것 = 살아있는옛것만0.filter((k) => !우리가버릴것.includes(k));

    /* ⚠ **오늘 그 사이트에 없는 글은 우리 잘못이 아닙니다** (2026-09-28).
       gas 시트는 며칠치가 쌓여 있고 우리는 **오늘 1쪽**만 봅니다.
       그래서 「gas 에만」 에는 이런 것이 섞입니다 —
         · 사이트에서 이미 내려간 글 (청주의료원 제26-8회 · 제주한라 임상심리사)
         · 제목이 바뀐 글 (한국병원 → 지금은 「[마감]재활치료센터 물리치료사」)
       오늘 그 기관에서 우리가 받은 제목들과 대보면 갈립니다.
       통과 기준(「gas 에만 0」)은 **아래 「진짜 못 찾은 것」** 으로 봅니다. */
    const 오늘본제목 = new Map();
    for (const r of 모은것) {
      const k = 붙이기(r.곳.name);
      if (!오늘본제목.has(k)) 오늘본제목.set(k, []);
      오늘본제목.get(k).push(붙이기(r.title));
    }
    const 내려간것 = 남은것.filter((k) => {
      const v = 옛집.get(k);
      const 있는것 = 오늘본제목.get(붙이기(v.org_name));
      if (!있는것) return false;                       // 그 기관을 아예 못 받았으면 진짜 차이
      return !있는것.includes(붙이기(v.title));        // 오늘 목록에 그 제목이 없음
    });
    const 살아있는옛것만 = 남은것.filter((k) => !내려간것.includes(k));

    if (우리가버릴것.length) {
      console.log('  ※ ' + 우리가버릴것.length + '건은 **지금 규칙으로는 일부러 안 담는 것**입니다 (마감·결과 표시 등)');
    }
    if (내려간것.length) {
      console.log('  ※ ' + 내려간것.length + '건은 **오늘 그 사이트 목록에 없습니다** (내려갔거나 제목이 바뀜) — 우리 잘못이 아닙니다');
      내려간것.slice(0, 5).forEach((k) => {
        const v = 옛집.get(k);
        console.log('      ' + String(v.org_name).slice(0, 18).padEnd(20) + String(v.title).slice(0, 44));
      });
    }
    원래log('HS3 vs gas: 같음 ' + 같음.length
      + ' · **gas 에만 ' + 살아있는옛것만.length + '** ← 이게 0 이어야 통과'
      + '  (HS3 에만 ' + 새것만.length + ')'
      + '  상세로 가린 것 ' + 상세로가림 + '건'
      + '   [' + 오늘 + ']');
    if (한줄) process.exit(0);
    console.log('\n━━ 옛 수집기(HS)와 대조 — 공고 번호로');
    console.log('  같음 ' + 같음.length + ' · HS3 에만 ' + 새것만.length
      + ' · gas 에만 ' + 옛것만.length + ' (그중 아직 모집중 ' + 살아있는옛것만.length + ' ← 진짜 차이)');
    const 보기 = (이름, 열쇠들, 집) => {
      if (!열쇠들.length) return;
      /* 8 은 **보여주는 수**지 건수가 아닙니다. 건수를 8 로 찍던 것을 고쳤습니다 (2026-10-01) */
      console.log('\n  ' + 이름 + ' ' + 열쇠들.length + '건'
        + (열쇠들.length > 8 ? ' (앞 8건만)' : '') + ' —');
      열쇠들.slice(0, 8).forEach((k) => {
        const v = 집.get(k);
        console.log('    ' + String(v.id).padEnd(14) + String(v.org_name).slice(0, 20).padEnd(22)
          + String(v.title).slice(0, 46));
      });
    };
    보기('HS3 에만', 새것만, 새집);
    보기('gas 에만 (아직 모집중)', 살아있는옛것만, 옛집);
  }
  console.log('\n--dry 라 담지 않았습니다. ' + Math.round((Date.now() - t0) / 1000) + '초');
} else {
  try {
    /* ★ 2026-10-14 세중님 0번 — **한 줄 때문에 바퀴가 통째로 죽지 않게.**
       보내기 전에 줄마다 보고, 그래도 묶음이 실패하면 반씩 나눠 문제 줄만
       뺍니다. 뺀 줄은 셈과 까닭이 남습니다 (tools/보낼줄.mjs 한 자리) */
    const p = await 반씩보내기({
      줄들: 담을것, 묶음: 200, 이름: 'collect_put',
      보내기: (조각) => rpc(cfg, 'collect_put', {
        p_secret: cfg.COLLECT_KEY_HS3, p_source: SOURCE, p_rows: 조각,
      }),
    });
    담음 += p.담음;
    못담음 += p.못담음;
    못담은것.push(...p.뺀줄.map((x) => ({ ...x, 어디: 'collect_put' })),
                  ...p.못담은줄.map((x) => ({ ...x, 어디: 'collect_put' })));
    p.건너뜀.slice(0, 5).forEach((x) => console.error('  건너뜀 ' + x.id + ' · ' + x.why));
    console.log('\n씀          ' + 담음 + '건');
    if (못담음) {
      console.log('담지 못한 줄  ⚠ ' + 못담음 + '건 — 나머지는 담았습니다 (까닭은 위에)');
    }
    /* 두 해 넘는 마감일을 안 믿고 비운 것 — 몇 건이고 무엇이었나 (2026-10-14) */
    if (시각찾음.length) {
      console.log('마감 시각 찾음 ' + 시각찾음.length + '건 (접수문장에서 · 첨부를 안 열고)');
      시각찾음.slice(0, 5).forEach((x) => console.log('     ' + x.시 + '  '
        + x.곳.slice(0, 16).padEnd(18) + x.문장));
    }
    if (먼마감.length) {
      console.log('먼 마감 비움  ' + 먼마감.length + '건 (두 해 넘는 날짜 · deadline_src 에 원문을 남깁니다)');
      먼마감.slice(0, 6).forEach((x) => console.log('     ' + x.원문 + '  '
        + x.곳.slice(0, 18).padEnd(20) + String(x.제목).slice(0, 44)));
    }

    const tr = await 반씩보내기({
      줄들: 버릴것, 묶음: 200, 이름: 'collect_trash',
      보내기: (조각) => rpc(cfg, 'collect_trash', {
        p_secret: cfg.COLLECT_KEY_HS3, p_source: SOURCE, p_rows: 조각,
      }),
    });
    버림 += tr.담음;
    못담음 += tr.못담음;
    못담은것.push(...tr.뺀줄.map((x) => ({ ...x, 어디: 'collect_trash' })),
                  ...tr.못담은줄.map((x) => ({ ...x, 어디: 'collect_trash' })));
    if (버림) console.log('쓰레기통    ' + 버림 + '건 (지우지 않고 까닭과 함께 남깁니다)');

    /* ★ 원문 보관이 **22:00 에 바퀴를 죽인 그 자리**입니다 — NUL 이 든 본문 하나로
       `22P05` 가 나면서 담음 0 이 됐습니다. 여기가 가장 먼저 필요했습니다 */
    const bd = await 반씩보내기({
      줄들: 원문들, 묶음: 50, 이름: 'collect_body',
      보내기: (조각) => rpc(cfg, 'collect_body', {
        p_secret: cfg.COLLECT_KEY_HS3, p_source: SOURCE, p_rows: 조각,
      }),
    });
    보관 += bd.담음;
    못담음 += bd.못담음;
    못담은것.push(...bd.뺀줄.map((x) => ({ ...x, 어디: 'collect_body' })),
                  ...bd.못담은줄.map((x) => ({ ...x, 어디: 'collect_body' })));
    if (보관) console.log('원문 보관    ' + 보관 + '건 (회원 화면에 안 나갑니다)');

    /* 주소가 www 로만 갈린 같은 공고 — 옛 줄을 숨깁니다 (지우지 않습니다).
       강진의료원이 그랬습니다 (2026-09-30). 짝이 없으면 0건입니다 */
    try {
      const t = await rpc(cfg, 'hide_www_twins', {
        p_secret: cfg.COLLECT_KEY_HS3, p_source: SOURCE,
      });
      if ((t || {})['숨긴 줄']) console.log('쌍둥이 숨김  ' + t['숨긴 줄'] + '건 (주소가 www 로만 다른 옛 줄)');
    } catch (e) {
      console.error('쌍둥이 숨김 못 함 · ' + String(e.message).slice(0, 120));
    }

    const a = await rpc(cfg, 'collect_after', {
      p_secret: cfg.COLLECT_KEY_HS3, p_source: SOURCE, p_days: 45, p_rolling_days: 180,
    });
    const h = (a || {})['감춤'] || {};
    const 말 = Object.entries(h).filter(([k]) => !/기준일|며칠/.test(k))
      .filter(([, v]) => Number(v) > 0).map(([k, v]) => k + ' ' + v + '건');
    console.log('감춤 정리    ' + (말.length ? 말.join(' · ') : '바뀐 것 없음'));
    const L = (a || {})['회원화면'] || {};
    if (L['샘']) {
      console.error('\n  ██ 회원 화면에 있으면 안 될 공고가 있습니다 ██');
      console.error('     마감 지남 ' + L['마감 지남'] + ' · 신호 없이 30일 넘음 ' + L['신호 없이 30일 넘음']);
    } else {
      console.log('회원 화면    ' + L['회원 화면 전체'] + '건 · 마감 지난 것 0 · 신호 없이 30일 넘은 것 0 ○');
    }
  } catch (e) {
    탈 = String(e && e.message || e).slice(0, 500);
    console.error('\n✗ 담다가 탈났습니다 · ' + 탈);
  }

  /* ── ⑥ 박동 — 안 남기면 관리자 화면이 「안 돌았다」 로 봅니다 ── */
  try {
    await rpc(cfg, 'collect_beat', {
      p_secret: cfg.COLLECT_KEY_HS3, p_source: SOURCE,
      p_beat: {
        took_ms: Date.now() - t0, ok: !탈, 왜: 탈,
        본곳: 볼것.length, 담음, 보류: 보류2.length, 버림, 못받음: 셈.못받음,
        /* ★ 2026-10-14 세중님 0번 — 「담지 못한 줄」을 박동에 남깁니다.
           하루 요약 메일이 이 칸을 읽습니다 (tools/hold-digest.mjs) */
        메모: { 줄: 셈.줄, 규칙0: 셈.규칙0, 상세연것, 상세로가림, 원문보관: 보관,
          못담음, 못담은것: 못담은것.slice(0, 20) },
      },
    });
  } catch (e) { console.error('박동 남기기 실패 · ' + String(e.message).slice(0, 160)); }
}

console.log('\n── ' + 볼것.length + '줄 · 줄 ' + 셈.줄 + ' · 회원 ' + 회원2.length
  + ' · 보류 ' + 보류2.length + ' · 쓰레기통 ' + 쓰레기2.length
  + ' · ' + Math.round((Date.now() - t0) / 1000) + '초');

/* 첨부 — 0줄이어도 셈을 찍습니다 (지침 2절) */
if (첨부모음.줄들.length && 첨부모음.마른) await 첨부모음.형식확인(40);
await 첨부모음.끝내기(cfg);

fs.writeFileSync(path.join(여기, 'hosp', 'reports', 'collect-hosp.json'),
  JSON.stringify({ 잰날: 오늘, 셈, 곳별, 못받은곳 }, null, 1), 'utf8');
if (탈) process.exit(1);
