/* 경쟁사 비교 — **땡큐오티 하나 · 작업치료사 공고만** (2026-10-29 세중님 18:18)
 *
 *   node tools/경쟁사비교_1029.mjs --살펴보기     ① 쪽을 **한 번만** 받아 생김새를 찍습니다
 *   node tools/경쟁사비교_1029.mjs               ② 비교 (읽기만 · 우리 DB 쓰기 0)
 *   node tools/경쟁사비교_1029.mjs --자기점검
 *
 * ── 지키는 선 (세중님 블록 그대로) ──────────────────────────
 *   · **robots 를 먼저** 봅니다. 금지면 **그 자리에서 멈춥니다** (우회 금지)
 *   · **공개 화면만** 봅니다 — 로그인 안 합니다 · 상세 글은 열지 않습니다
 *   · 쪽 사이 **1~2초**를 띄웁니다
 *   · **읽기 전용** — 우리 DB 에 **한 줄도 안 씁니다** (출처로 안 담습니다)
 *   · 결과는 `docs/경쟁사비교_1029.md` 로 사람이 적습니다 (도구는 찍기만 합니다)
 *
 * ── 경쟁사 주소는 **저장소에 있던 것**입니다 (짐작 아님) ────
 *   `tools/rival-ty.mjs` → `export const 목록주소 = 'https://www.thankyouot.com/board1'`
 *   목록 읽는 자도 그 파일 것을 그대로 씁니다 (지침 6절 — 한 자리)
 *
 * ★ `tools/collect-rival.mjs` 는 **쓰는** 도구입니다 (rival_post 표) — 여기서 안 씁니다.
 *   그 표만 읽으면 **2층이 빠집니다** (그 수집기는 `볼분류` 만 담습니다) — 세중님 ⓒ 를
 *   낼 수 없어서, 목록을 **읽기만** 새로 받습니다.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { 목록읽기, 목록주소 } from './rival-ty.mjs';
import { robots읽기, 가도되나 } from './robots.mjs';

const argv = process.argv.slice(2);
const 살펴보기 = argv.includes('--살펴보기');
const 몇쪽 = Number(argv.includes('--쪽') ? argv[argv.indexOf('--쪽') + 1] : 3) || 3;
const UA = 'Mozilla/5.0 (compatible; potjob-check/1.0; +https://potjob.co.kr)';
const 자고 = (ms) => new Promise((r) => setTimeout(r, ms));

/** 작업치료사 공고인가 — **제목 글자만** 봅니다 (상세를 안 열기 때문입니다)
 *  ★ 땡큐오티는 작업치료사 쪽 게시판이라 제목에 직군을 안 적는 글이 많습니다.
 *    그래서 「작업치료사 말이 있다」와 「없다」를 **갈라서** 셉니다 — 없는 것을
 *    작업치료사로 **치지 않습니다** (지침 15절 · 짐작하지 않습니다) */
export const 작업말 = /작업\s*치료|작치|\bOT\b|오티/i;
export const 물리말 = /물리\s*치료|도수|\bPT\b/i;
export const 언어말 = /언어\s*재활|언어\s*치료/;
export function 직군보기(제목) {
  const t = String(제목 || '');
  const 작 = 작업말.test(t); const 물 = 물리말.test(t); const 언 = 언어말.test(t);
  if (작 && !물 && !언) return '작업치료사';
  if (작) return '작업+다른직군';
  if (물 || 언) return '다른직군';
  return '직군 안 적힘';
}

/* ── 열린 공고인가 — 목록 줄의 **마감 뱃지**로 봅니다 (2026-10-29 살펴보기에서 확인) ──
 * 원문에서 제목 다음에 이렇게 붙습니다 —
 *   <a href=".../board1/4141">…제목…</a>
 *   <span style="color:#369a4d …">**D-6**</span>
 * 꼴은 셋입니다 — `D-N`(N일 남음) · `D-day` · 「채용 시 마감」.
 * ★ `rival-ty.mjs` 를 **안 고칩니다** — 그 파일은 시간마다 도는 수집기
 *   (`collect-rival.mjs`)가 씁니다. 10/30 동결 앞이라 수집기 길은 건드리지 않습니다.
 *   그래서 상태만 **여기서** 집습니다 (읽기 전용).
 */
export function 상태집기(html, 번호) {
  const h = String(html || '');
  const i = h.indexOf('/board1/' + 번호);
  if (i < 0) return { 열림: null, 글: '' };
  /* ★ 창을 **다음 줄 앞까지**로 잡습니다 (2026-10-29 — 700자로 잘랐더니 다섯 줄의
     상태를 못 읽었습니다. 「채용 시 마감」 뱃지가 조회·댓글 뒤에 옵니다).
     다음 줄 앞까지면 **딴 줄 상태를 집을 일도 없습니다** */
  const 다음 = h.indexOf('/board1/', i + 10);
  const 끝 = 다음 > i ? 다음 : Math.min(h.length, i + 2500);
  const 뒤 = h.slice(i, 끝);
  const d = 뒤.match(/>\s*D-(\d+)\s*</);
  if (d) return { 열림: true, 글: 'D-' + d[1], 남은날: Number(d[1]) };
  if (/>\s*D-?day\s*</i.test(뒤)) return { 열림: true, 글: 'D-day', 남은날: 0 };
  if (/채용\s*시\s*마감/.test(뒤)) return { 열림: true, 글: '채용 시 마감' };
  if (/>\s*마감\s*</.test(뒤)) return { 열림: false, 글: '마감' };
  return { 열림: null, 글: '(상태 글자를 못 찾았습니다)' };
}

/** 1층인가 — **땡큐오티 분류 글자**로만 봅니다 (우리 기준은 CLAUDE.md 1층 대상) */
export const 일층분류 = ['대학병원', '공단·공공병원', '종합병원', '치매안심센터', '보건소', '공공기관'];
export const 이층분류 = ['재활·요양병원', '의원', '복지관', '주간보호', '센터', '학교', '기타'];
export function 층보기(분류) {
  const c = String(분류 || '').trim();
  if (일층분류.some((x) => c.includes(x))) return '1층';
  if (이층분류.some((x) => c.includes(x))) return '2층';
  return '모름';
}

/* 저쪽 제목에서 **기관 이름**을 집습니다 — 못 집으면 ⓔ 로 셉니다 (짐작 금지) */
export function 기관집기(제목) {
  const t = String(제목 || '');
  /* ★ 2026-10-29 — 처음에는 꼬리말에 **복지관·요양원이 빠져** 두 줄이 ⓔ(못 맞춤)로
     떨어졌습니다 (서울장애인종합복지관 · 교하효요양원). 자가 모자란 것을 「자료」로
     적으면 안 되니 꼬리말을 늘렸습니다 (지침 10-5 — 재는 자를 먼저 의심) */
  const m = t.match(/([가-힣A-Za-z0-9()·\s]{2,30}?(?:대학교병원|대학병원|의료원|요양병원|병원|보건소|보건지소|복지관|요양원|재활원|요양센터|복지센터|센터|의원))/);
  return m ? m[1].replace(/^[\s·]+/, '').trim() : '';
}

/** 우리 **분모**에 드는 갈래인가 — 치매안심센터는 1층이지만 **분모에서 뺀** 갈래입니다
 *  (공고가 `nid.or.kr` 중앙 게시판으로 모입니다 · CLAUDE.md 15절 ·
 *   `org_targets.커버리지분모 = false`). 그래서 「놓쳤다」로 세면 안 됩니다 */
export const 분모밖 = (분류) => /치매/.test(String(분류 || ''));

if (argv.includes('--자기점검')) {
  const 잼 = [];
  const 보 = (무엇, 참) => 잼.push([무엇, !!참]);
  보('작업치료사 제목을 가린다', 직군보기('○○대학교병원 작업치료사 채용') === '작업치료사');
  보('작치 줄임말도 본다', 직군보기('작치 선생님 모십니다') === '작업치료사');
  보('물리치료사만 있으면 다른직군', 직군보기('물리치료사 채용') === '다른직군');
  보('둘 다 있으면 작업+다른직군', 직군보기('물리치료사·작업치료사 채용') === '작업+다른직군');
  보('직군을 안 적은 글은 그렇게 적는다', 직군보기('계약직/정규직 선생님을 모십니다') === '직군 안 적힘');
  보('대학병원은 1층', 층보기('대학병원') === '1층');
  보('공단·공공병원은 1층', 층보기('공단·공공병원') === '1층');
  보('재활·요양병원은 2층', 층보기('재활·요양병원') === '2층');
  보('모르는 분류는 모름', 층보기('') === '모름');
  보('복지관 이름도 집는다', 기관집기('서울장애인종합복지관 작업치료사 정규직 채용') === '서울장애인종합복지관');
  보('요양원 이름도 집는다', 기관집기('[경기도 파주 운정] 교하효요양원 작업치료사 채용공고') === '교하효요양원');
  보('대학병원 이름을 집는다', 기관집기('가톨릭대학교 인천성모병원 작업치료사 채용') === '가톨릭대학교 인천성모병원');
  보('치매안심센터는 우리 분모 밖', 분모밖('치매안심센터') && !분모밖('보건소'));
  const 견본 = '<a href="https://www.thankyouot.com/board1/4141">제목</a>'
    + '<span style="color:#369a4d !important;">D-6</span>';
  보('D-N 을 집는다', 상태집기(견본, 4141).남은날 === 6 && 상태집기(견본, 4141).열림 === true);
  보('채용 시 마감도 열림', 상태집기('<a href="/board1/9">제목</a><span>채용 시 마감</span>', 9).열림 === true);
  보('마감은 닫힘', 상태집기('<a href="/board1/9">제목</a><span>마감</span>', 9).열림 === false);
  보('못 찾으면 null', 상태집기('<a href="/board1/9">제목</a>', 9).열림 === null);
  const 어긴것 = 잼.filter(([, ok]) => !ok);
  for (const [무엇, ok] of 잼) console.log((ok ? '  ○ ' : '  ✗ ') + 무엇);
  if (어긴것.length) { console.error('✗ 자기점검 ' + 어긴것.length + '가지 실패'); process.exit(1); }
  console.log('○ 자기점검 통과 — ' + 잼.length + '가지');
  process.exit(0);
}

/* ── robots 를 **먼저** ── */
const U = new URL(목록주소);
let 규칙 = null;
{
  const r = await fetch(U.origin + '/robots.txt', { headers: { 'User-Agent': UA },
    signal: AbortSignal.timeout(15000) });
  const 글 = r.ok ? await r.text() : '';
  규칙 = r.ok ? robots읽기(글) : null;
  console.log('── robots.txt — HTTP ' + r.status + (r.ok ? ' · ' + 글.length + '바이트' : ' (규칙 없음)'));
  if (r.ok) console.log('   원문 —\n' + 글.split(/\r?\n/).slice(0, 12).map((l) => '     ' + l).join('\n'));
  const 허락 = 규칙 ? 가도되나(규칙, U.pathname) : { 됨: true, 왜: 'robots.txt 가 없습니다' };
  console.log('   /board1 에 가도 되나 — ' + (허락.됨 ? '○ ' : '✗ ') + (허락.왜 || ''));
  if (!허락.됨) {
    console.error('\n✗ robots 가 막습니다 — **그 자리에서 멈춥니다** (우회하지 않습니다)');
    process.exit(1);
  }
  await 자고(1500);
}

/** 쪽 하나 받기 — 1.5초 띄우고 (세중님 1~2초) */
async function 쪽받기(주소) {
  const r = await fetch(주소, { headers: { 'User-Agent': UA, 'Accept-Language': 'ko' },
    signal: AbortSignal.timeout(20000), redirect: 'follow' });
  const html = await r.text();
  await 자고(1500);
  return { 됨: r.ok, 코드: r.status, html };
}

if (살펴보기) {
  const r = await 쪽받기(목록주소);
  console.log('\n── ① 목록 첫 쪽 — HTTP ' + r.코드 + ' · ' + r.html.length + '바이트');
  const 제목 = (r.html.match(/<title[^>]*>([\s\S]{0,120}?)<\/title>/i) || [])[1] || '';
  console.log('   제목 「' + 제목.replace(/\s+/g, ' ').trim() + '」');
  const 줄 = 목록읽기(r.html);
  console.log('   목록읽기 — ' + 줄.length + '줄');
  for (const x of 줄.slice(0, 10)) {
    console.log('     ' + String(x.번호).padStart(5) + ' [' + (x.분류 || '분류없음').padEnd(10) + '] '
      + (x.지역 || '').padEnd(4) + ' ' + 직군보기(x.제목).padEnd(9) + ' ' + x.제목.slice(0, 44));
  }
  /* 마감·상태 글자가 목록에 있나 — 「열린 공고」를 가릴 수 있는지 봅니다 */
  for (const 말 of ['채용 시 마감', '마감', '모집중', '진행중', '채용완료', '종료']) {
    const n = (r.html.match(new RegExp(말.replace(/ /g, '\\s*'), 'g')) || []).length;
    console.log('   「' + 말 + '」 ' + n + '번');
  }
  /* 첫 줄 앞뒤 원문 — 상태 뱃지가 어디 있나 봅니다 (지침 5절 — 응답을 보고 코드를) */
  const i = r.html.search(/<a\s+href=["']https?:\/\/[^"']*\/board1\/\d+["']/i);
  console.log('\n   ── 첫 줄 원문 (앞 200 ~ 뒤 1000자 · ⏎ 는 줄바꿈) ──');
  console.log(r.html.slice(Math.max(0, i - 200), i + 1000).replace(/\r?\n/g, ' ⏎ '));
  /* 쪽 넘기기가 되나 — 문서에 적힌 꼴 (수집기_옮길때_고칠것.md:187) */
  const 두쪽 = 목록주소.replace(/\/board1$/, '/bbs/board.php')
    + '?bo_table=board1&sst=wr_datetime&sod=desc&page=2';
  const r2 = await 쪽받기(두쪽);
  const 줄2 = r2.됨 ? 목록읽기(r2.html) : [];
  console.log('\n── ② 둘째 쪽 시험 — ' + 두쪽);
  console.log('   HTTP ' + r2.코드 + ' · ' + (r2.html || '').length + '바이트 · 목록읽기 ' + 줄2.length + '줄'
    + (줄2.length ? ' · 번호 ' + 줄2[0].번호 + '~' + 줄2[줄2.length - 1].번호 : ''));
  console.log('\n★ 아무것도 안 담았습니다 (읽기만). 생김새를 보고 비교 자를 짭니다');
  process.exit(0);
}

/* ── ② 비교 — 우리 쪽은 **읽기만** (psql select) ── */
const 뿌리 = path.join(import.meta.dirname, '..');
const cfg = {};
for (const f of ['.env', '.env.local']) {
  const p = path.join(뿌리, f);
  if (!fs.existsSync(p)) continue;
  for (const l of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !cfg[m[1]]) cfg[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
if (!cfg.SUPABASE_DB_URL) { console.error('✗ SUPABASE_DB_URL 이 없습니다 (서버에서 돌리십시오)'); process.exit(1); }
const u = new URL(cfg.SUPABASE_DB_URL);
const env = { ...process.env,
  PGHOST: u.hostname, PGPORT: u.port || '5432',
  PGUSER: decodeURIComponent(u.username), PGPASSWORD: decodeURIComponent(u.password),
  PGDATABASE: decodeURIComponent(u.pathname.replace(/^\//, '')) || 'postgres',
  PGSSLMODE: u.searchParams.get('sslmode') || 'require' };
/** psql — **select 만** 보냅니다 (쓰기 글자가 있으면 스스로 막습니다) */
function psql(sql) {
  if (/\b(insert|update|delete|drop|alter|truncate|grant|revoke|create)\b/i.test(sql)) {
    console.error('✗ 이 도구는 **읽기 전용**입니다 — 쓰는 글이 섞였습니다'); process.exit(1);
  }
  const 임시 = path.join(os.tmpdir(), '경쟁사비교_' + process.pid + '.sql');
  fs.writeFileSync(임시, sql, 'utf8');
  const r = spawnSync('psql', ['-X', '-A', '-t', '-q', '-F', '\t', '-v', 'ON_ERROR_STOP=1', '-f', 임시],
    { encoding: 'utf8', maxBuffer: 1 << 26, env });
  fs.unlinkSync(임시);
  if (r.status) { console.error('✗ psql\n' + (r.stderr || '').slice(0, 900)); process.exit(1); }
  return (r.stdout || '').trimEnd();
}
const 줄로 = (sql) => psql(sql).split('\n').filter(Boolean).map((l) => l.split('\t'));
const 따옴 = (s) => String(s == null ? '' : s).replace(/'/g, "''");

/* 땡큐오티 목록 — 쪽을 몇 장 받습니다 (1.5초 띄우고)
   ★ 2026-10-29 살펴보기 — 문서에 적힌 `/bbs/board.php?…page=2` 는 **첫 쪽을 다시 줍니다**
     (번호 4141~4138 그대로). 그래서 쪽 넘기기 꼴을 **셋** 시험해 보고, 새 글이 오는
     것을 씁니다. 다 안 되면 **첫 쪽만** 보고 그렇게 적습니다 (짐작하지 않습니다) */
export const 쪽주소후보 = (p) => [
  목록주소 + '?page=' + p,
  목록주소 + '/p/' + p,
  목록주소.replace(/\/board1$/, '/bbs/board.php') + '?bo_table=board1&page=' + p,
];
const 저쪽 = [];
const 쪽글 = new Map();         /* 번호 → 그 줄이 있던 쪽 html (상태를 집으려고) */
let 쓰는꼴 = null;
let 두드림 = 0;
for (let p = 1; p <= 몇쪽; p++) {
  const 후보 = p === 1 ? [목록주소] : (쓰는꼴 ? [쓰는꼴(p)] : 쪽주소후보(p));
  let 새것 = []; let 쓴주소 = '';
  for (const 주소 of 후보) {
    if (두드림 >= 12) break;        /* 남의 서버 울타리 — 한 번에 12번까지 */
    const r = await 쪽받기(주소); 두드림++;
    if (!r.됨) { console.log('  ✗ ' + p + '쪽 — HTTP ' + r.코드 + ' · ' + 주소); continue; }
    const 줄 = 목록읽기(r.html);
    새것 = 줄.filter((x) => !저쪽.some((y) => y.번호 === x.번호));
    console.log('  ' + p + '쪽 — ' + 줄.length + '줄 (새 글 ' + 새것.length + ') · ' + 주소);
    if (새것.length) {
      for (const x of 새것) 쪽글.set(x.번호, r.html);
      쓴주소 = 주소;
      break;
    }
  }
  if (!새것.length) { console.log('  → 새 글이 없습니다. 여기서 멈춥니다'); break; }
  저쪽.push(...새것);
  if (p === 2 && 쓴주소) {
    /* 두 번째 쪽에서 먹힌 꼴을 뒤 쪽에도 씁니다 (같은 꼴을 세 번 시험하지 않게) */
    const 꼴 = 쪽주소후보(2).findIndex((a) => a === 쓴주소);
    if (꼴 >= 0) 쓰는꼴 = (n) => 쪽주소후보(n)[꼴];
  }
}
console.log('땡큐오티 목록 — 모두 ' + 저쪽.length + '줄 (두드림 ' + 두드림 + '번)');

/* 열림·마감을 **줄마다** 집습니다 (D-N · D-day · 채용 시 마감 · 마감) */
for (const x of 저쪽) {
  const s = 상태집기(쪽글.get(x.번호) || '', x.번호);
  x.열림 = s.열림; x.상태 = s.글;
}
const 상태셈 = {};
for (const x of 저쪽) 상태셈[x.상태] = (상태셈[x.상태] || 0) + 1;
console.log('   상태 — ' + Object.entries(상태셈).map(([k, v]) => k + ' ' + v).join(' · '));

/* **열린 것만** 셉니다 (세중님 「열린 공고 N」) — 마감으로 찍힌 줄은 빼고,
   상태를 못 읽은 줄은 **따로** 적습니다 (못 본 것을 열렸다고 하지 않습니다 · 지침 15절) */
const 닫힘 = 저쪽.filter((x) => x.열림 === false);
const 상태모름 = 저쪽.filter((x) => x.열림 === null);
const 열린것 = 저쪽.filter((x) => x.열림 === true);
console.log('   열린 것 ' + 열린것.length + ' · 마감 ' + 닫힘.length + ' · 상태 모름 ' + 상태모름.length);
const 작업것 = 열린것.filter((x) => 직군보기(x.제목).startsWith('작업'));
console.log('그 가운데 **작업치료사 공고** — ' + 작업것.length + '건'
  + ' (직군 안 적힌 글 ' + 열린것.filter((x) => 직군보기(x.제목) === '직군 안 적힘').length
  + ' · 다른 직군 ' + 열린것.filter((x) => 직군보기(x.제목) === '다른직군').length + ')');

/* 우리 쪽 — **작업치료사 · 회원 화면** 공고의 기관 이름 (읽기만) */
const 우리 = 줄로(`select coalesce(p.org_name,''), coalesce(p."기관번호",''), p.id,
       coalesce(to_char(p.first_seen,'MM-DD'),'')
  from job_posts p join job_posts_pub v on v.id = p.id
 where p.job_group in ('작업치료사','공통');`);
console.log('우리 회원 화면 작업치료사·공통 공고 — ' + 우리.length + '건');

/* 이름 맞추기 — `견줄이름` 한 자리를 씁니다 (우리 집 자 · 읽기만) */
/* 이름 맞추는 열쇠는 **우리 집 자**(`견줄이름`)를 씁니다 — 한 자리입니다 (지침 6절).
   ★ 전에는 줄마다 psql 을 띄웠습니다 — 빈 이름에서 터지고(결과 0줄) 느렸습니다.
     **한 번에** 물어 표로 들고 있습니다 */
const 이름키표 = new Map();
function 이름키채우기(이름들) {
  const 새것 = [...new Set(이름들.filter(Boolean))].filter((n) => !이름키표.has(n));
  for (let i = 0; i < 새것.length; i += 200) {
    const 묶음 = 새것.slice(i, i + 200);
    const 값 = 묶음.map((n) => "('" + 따옴(n) + "')").join(',');
    for (const [이름, k] of 줄로(`select v.n, coalesce("견줄이름"(v.n),'')
        from (values ${값}) as v(n);`)) 이름키표.set(이름, k);
    for (const n of 묶음) if (!이름키표.has(n)) 이름키표.set(n, '');
  }
}
const 이름키 = (s) => (s ? (이름키표.get(s) ?? '') : '');

/* 이름 열쇠를 **한 번에** 받아 둡니다 (우리 쪽 + 저쪽 제목에서 집은 기관) */
이름키채우기([...우리.map(([이름]) => 이름), ...작업것.map((x) => 기관집기(x.제목))]);
const 우리키 = new Map();
for (const [이름, 번호, id, 본날] of 우리) {
  const k = 이름키(이름);
  if (!k) continue;
  if (!우리키.has(k)) 우리키.set(k, []);
  우리키.get(k).push({ 이름, 번호, id, 본날 });
}

/* 갈래 이름 — ⓐ둘다 ⓑ놓침 ⓒ이층 ⓓ우리만 ⓔ못맞춤 (동그라미 글자는 변수 이름에 못 씁니다) */
const 갈래 = { 둘다: [], 놓침: [], 이층: [], 우리만: [], 못맞춤: [] };
for (const x of 작업것) {
  const 층 = 층보기(x.분류);
  const 기관 = 기관집기(x.제목);
  if (!기관) { 갈래.못맞춤.push({ ...x, 왜: '제목에서 기관 이름을 못 집었습니다' }); continue; }
  const k = 이름키(기관);
  const 우리것 = 우리키.get(k) || [];
  if (우리것.length) 갈래.둘다.push({ ...x, 기관, 우리: 우리것[0] });
  else if (층 === '1층') 갈래.놓침.push({ ...x, 기관, 층 });
  else if (층 === '2층') 갈래.이층.push({ ...x, 기관, 층 });
  else 갈래.못맞춤.push({ ...x, 기관, 왜: '분류가 「' + (x.분류 || '없음') + '」 — 1층인지 2층인지 못 가립니다' });
}
/* ⓓ 우리만 — 저쪽 목록에 **이름이 없는** 우리 공고 */
const 저쪽키 = new Set(작업것.map((x) => 이름키(기관집기(x.제목))).filter(Boolean));
for (const [k, 줄들] of 우리키) if (!저쪽키.has(k)) 갈래.우리만.push(...줄들);

const N = 작업것.length;
const a = 갈래.둘다.length; const b = 갈래.놓침.length; const c = 갈래.이층.length; const d = 갈래.우리만.length;
console.log('\n══ 한 줄 요약 ══');
console.log('땡큐오티 작업치료사 열린 공고 ' + N + ' · 우리도 있음 ' + a
  + '(' + (N ? Math.round((a / N) * 100) : 0) + '%) · 1층인데 놓침 ' + b
  + ' · 2층(범위 밖) ' + c + ' · 우리만 ' + d);
console.log('   (기관 못 맞춤 ⓔ ' + 갈래.못맞춤.length + ')');

console.log('\n══ ⓑ 1층인데 놓친 것 — 전부 ══');
console.log('| 번호 | 분류 | 지역 | 기관 | 제목 | 고용형태 | 우리 분모 | 표본 40 후보 | 링크 |');
console.log('|---:|---|---|---|---|---|---|---|---|');
for (const x of 갈래.놓침) {
  const 밖 = 분모밖(x.분류);
  console.log('| ' + x.번호 + ' | ' + x.분류 + ' | ' + x.지역 + ' | ' + x.기관 + ' | '
    + x.제목.slice(0, 50) + ' | ' + (x.고용형태 || '') + ' | '
    + (밖 ? '**분모 밖** (nid 중앙 게시판)' : '분모 안') + ' | '
    + (밖 ? '✗' : '**○**') + ' | ' + x.링크 + ' |');
}
console.log('  ★ 「표본 40 후보」는 **표시만** 했습니다 — 고치지 않았습니다 (세중님).');
for (const [이름, 목록] of [['ⓒ 2층(범위 밖)', 갈래.이층], ['ⓔ 기관 못 맞춤', 갈래.못맞춤]]) {
  console.log('\n── ' + 이름 + ' ' + 목록.length + '건 ──');
  for (const x of 목록) {
    console.log('  ' + String(x.번호).padStart(5) + ' [' + (x.분류 || '분류없음') + '] '
      + (x.기관 || '').slice(0, 16).padEnd(17) + x.제목.slice(0, 40) + (x.왜 ? '  ← ' + x.왜 : ''));
  }
}
console.log('\n── ⓐ 둘 다 있는 것 ' + 갈래.둘다.length + '건 (늦은 날 수는 땡큐오티가 **게시 날짜를 안 줘서** 못 셉니다) ──');
for (const x of 갈래.둘다) {
  console.log('  ' + String(x.번호).padStart(5) + ' ' + (x.기관 || '').slice(0, 16).padEnd(17)
    + '우리 ' + x.우리.id + ' (처음 본 날 ' + x.우리.본날 + ')');
}
console.log('\n── ⓓ 우리만 ' + 갈래.우리만.length + '건 ──');
for (const x of 갈래.우리만.slice(0, 40)) {
  console.log('  ' + x.이름.slice(0, 24).padEnd(25) + x.id + ' (처음 본 날 ' + x.본날 + ')');
}
if (갈래.우리만.length > 40) console.log('  … 그밖 ' + (갈래.우리만.length - 40) + '건');
console.log('\n★ 우리 DB 에 **한 줄도 안 썼습니다** (select 만 · 쓰는 글자는 도구가 막습니다)');
