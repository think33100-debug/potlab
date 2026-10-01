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
import { fileURLToPath } from 'node:url';
import { 사이트줄 } from './hosp/sites.mjs';
import { 글받기 } from './certs/index.mjs';
import { sortJob } from './sort-rule.mjs';
import { 판정남기기, 지문 } from './순찰기억.mjs';
import { matchJob, notOurs, mixedTitle, 구운날 } from './gas-rules.mjs';

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
  const k = cfg.SUPABASE_ANON_KEY;
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
const 찾을말 = argv.filter((x, i) => !x.startsWith('--')
  && !['--동시', '--상세'].includes(argv[i - 1]));

const cfg = env();
const t0 = Date.now();
const 오늘 = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
const 원래log = console.log;
if (한줄) console.log = () => {};

const 전부 = 사이트들();
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
   45일·180일 규칙은 DB 의 hide_stale_posts 가 「감추기」 로 합니다 */
const 오늘점 = 오늘.replace(/-/g, '.');
const 올해 = Number(오늘.slice(0, 4));

/* ⚠ **제목에 옛 연도가 적힌 글을 뺍니다** (2026-09-28).
 *
 * 병원 게시판에는 몇 해 전 공고가 그대로 붙어 있습니다. 날짜 칸이 비어 있으면
 * 마감으로도 못 거르고, `first_seen` 이 **오늘**이 되어 45일 동안 새 공고처럼 뜹니다.
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

/* ── ③ 상세 열기 — 제목만으로 못 가린 것만, 사이트당 하루 상세몫 건 ── */
let 상세연것 = 0, 상세로가림 = 0;
if (상세몫 > 0) {
  const 곳마다 = new Map();
  const 열것 = 보류.filter((x) => {
    const n = 곳마다.get(x.곳.name) || 0;
    if (n >= 상세몫) return false;
    곳마다.set(x.곳.name, n + 1);
    return true;
  });
  console.log('\n③ 상세 — 제목만으로 못 가린 ' + 보류.length + '건 중 ' + 열것.length + '건을 엽니다'
    + ' (사이트당 ' + 상세몫 + '건까지)');
  for (let i = 0; i < 열것.length; i += 동시) {
    await Promise.all(열것.slice(i, i + 동시).map(async (x) => {
      const g = await 글받기(x.url, { headers: { 'User-Agent': UA, 'Accept-Language': 'ko' }, enc: x.곳.enc });
      상세연것++;
      if (g.왜 || g.code !== 200) { x.상세왜 = g.왜 || ('HTTP ' + g.code); return; }
      const 글 = g.html.replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
      x.본문 = 글;
      const j = matchJob(글);
      if (j) {
        x.직군 = j;
        x.갈래 = { 갈래: '회원목록', 단계: 1, 왜: '1단계 · 상세 본문에 직군이 적혀 있음', 걸린단어: [], 메모: '' };
        x.근거 = '병원 게시판 제목 · 보류 → 상세 본문: ' + j;
        상세로가림++;
      }
    }));
  }
  console.log('  연 것 ' + 상세연것 + '건 · ★ 상세를 읽고 나서 직군이 가려진 공고 ' + 상세로가림 + '건');
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
const 담을것 = 회원2.concat(보류2).concat(쌓을것).map((x) => ({
  id: x.id,
  external_id: String(x.id).slice(2),
  org_name: x.곳.name, title: x.title,
  hire_type: '', employ_type: '', work_place: '', sido: null, sgg: null, edu: '',
  headcount: null,
  apply_from: 날(x.from), apply_to: 날(x.to),
  /* 원래 올린 날 — job_posts 의 트리거가 이걸로 first_seen 을 잡습니다 */
  posted_at: 날(x.from || x.posted),
  url: x.url,
  job_group: x.갈래.갈래 === '회원목록' ? (x.직군 || null) : null,
  form: (x.직군 && !mixedTitle(x.title)) ? null : '포함',
  hidden: x.갈래.갈래 === '숨김보관',      // 쌓아두되 회원 화면에는 안 보입니다
  hold: x.갈래.갈래 === '보류함',
  detail: { 기관홈: x.곳.base || x.곳.host || '' },
  evidence: {
    직군근거: x.근거 || (x.직군 ? '병원 게시판 제목 · 담음(' + x.직군 + ')' : ''),
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
    for (let i = 0; i < 담을것.length; i += 200) {
      const r = await rpc(cfg, 'collect_put', {
        p_secret: cfg.COLLECT_KEY_HS3, p_source: SOURCE, p_rows: 담을것.slice(i, i + 200),
      });
      담음 += r['담음'] || 0;
      (r['건너뛴것'] || []).slice(0, 5).forEach((x) => console.error('  건너뜀 ' + x.id + ' · ' + x.why));
    }
    console.log('\n씀          ' + 담음 + '건');

    for (let i = 0; i < 버릴것.length; i += 200) {
      const r = await rpc(cfg, 'collect_trash', {
        p_secret: cfg.COLLECT_KEY_HS3, p_source: SOURCE, p_rows: 버릴것.slice(i, i + 200),
      });
      버림 += r['담음'] || 0;
    }
    if (버림) console.log('쓰레기통    ' + 버림 + '건 (지우지 않고 까닭과 함께 남깁니다)');

    for (let i = 0; i < 원문들.length; i += 50) {
      const r = await rpc(cfg, 'collect_body', {
        p_secret: cfg.COLLECT_KEY_HS3, p_source: SOURCE, p_rows: 원문들.slice(i, i + 50),
      });
      보관 += r['담음'] || 0;
    }
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
      console.error('     마감 지남 ' + L['마감 지남'] + ' · 45일 넘음 ' + L['45일 넘음']);
    } else {
      console.log('회원 화면    ' + L['회원 화면 전체'] + '건 · 마감 지난 것 0 · 45일 넘은 것 0 ○');
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
        메모: { 줄: 셈.줄, 규칙0: 셈.규칙0, 상세연것, 상세로가림, 원문보관: 보관 },
      },
    });
  } catch (e) { console.error('박동 남기기 실패 · ' + String(e.message).slice(0, 160)); }
}

console.log('\n── ' + 볼것.length + '줄 · 줄 ' + 셈.줄 + ' · 회원 ' + 회원2.length
  + ' · 보류 ' + 보류2.length + ' · 쓰레기통 ' + 쓰레기2.length
  + ' · ' + Math.round((Date.now() - t0) / 1000) + '초');

fs.writeFileSync(path.join(여기, 'hosp', 'reports', 'collect-hosp.json'),
  JSON.stringify({ 잰날: 오늘, 셈, 곳별, 못받은곳 }, null, 1), 'utf8');
if (탈) process.exit(1);
