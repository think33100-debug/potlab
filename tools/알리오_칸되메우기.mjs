/* 알리오 공고의 **첨부와 칸을 되메웁니다** (2026-10-19 세중님 2번 · 1순위 승인)
 *
 *   node tools/알리오_칸되메우기.mjs --칸마른     무엇이 채워질지만 (기본)
 *   node tools/알리오_칸되메우기.mjs --진짜       담습니다
 *   node tools/알리오_칸되메우기.mjs --몇개 30    몇 건만
 *
 * ── 왜 ───────────────────────────────────────────────────────────
 * 2026-10-19 에 재 보니 알리오 공고에 **본문이 하나도 없습니다** —
 *   AL   62건  첨부줄 0: 62   본문줄 0: 62
 *   AL2 483건  첨부줄 0: 436  본문줄 0: 483
 * 첨부를 담는 코드는 2026-10-10~11 에 들어왔고 **그 전에 들어온 공고는
 * 첨부가 안 적혀 있습니다.** 알리오는 전부 공공기관(1층)이라 1층 칸을 올릴
 * 가장 큰 자리입니다.
 *
 * ── /detail 응답에 무엇이 있나 (원문을 찍어 확인했습니다) ─────────
 * `tools/알리오_상세항목이름.mjs 306122` 로 항목 30개를 전부 찍었습니다 —
 *
 *   recrutNope          「1」                        → 모집인원
 *   pbancEndYmd         「20261026」                 → 접수마감
 *   scrnprcdrMthdExpln  「… 2026.10.26.(월) 10:00까지 …」 → **마감 시각**
 *   aplyQlfcCn          「(필수) 작업치료사 면허증 소지자 …」 → 지원자격
 *   steps               「보건직(작업치료사) (1)」    → 직군별 인원 (CLAUDE.md 4절)
 *   files               첨부 셋 (공고문 A · 지원서 B · 직무기술서 C)
 *
 * ★ **PDF 를 안 읽고도 칸이 채워집니다.** 첨부도 함께 담아 두면 첨부 읽기
 *   크론이 뒤에 더 자세히 읽습니다 — 두 길을 같이 엽니다.
 * ★ 호출은 공고 하나에 상세 **한 번**입니다. 알리오 상세는 하루 10만까지
 *   됩니다(CLAUDE.md — 응답 머리글로 확인한 값). 483건은 그 안입니다.
 * ★ 첨부를 받을 때는 **포털 쿠키**가 있어야 합니다 — 없으면 파일 대신
 *   포털 첫 화면(8,333바이트 HTML)이 옵니다 (지침 5절).
 *   첫 건만 오고 나머지가 HTML 이면 **멈추고 보고합니다**(세중님 조건).
 */
import fs from 'node:fs';
import { 첨부모으기 } from './첨부담기.mjs';
import { 시각읽기 } from './공고문읽기.mjs';
import { 직군인원 } from './알리오직군셈.mjs';   /* 직군 인원 셈은 한 자리 */
import { 우리직군줄, 자간풀기 } from './공고문읽기.mjs';   /* 우리 직군 줄 · 자간 — 한 자리 */
import { 차례붙이기 } from './쪽나눠받기.mjs';

const argv = process.argv.slice(2);
const 진짜 = argv.includes('--진짜');
const 몇개 = Number(argv.includes('--몇개') ? argv[argv.indexOf('--몇개') + 1] : 600) || 600;
/* ★ 2026-10-19 마른 실행에서 배운 것 — 알리오 공고 545건 중 **회원 화면은 5건**입니다
   (나머지는 마감이 지나 숨김). 과거 498건에 첨부를 담아도 **아무도 보지 않는 공고**를
   읽게 됩니다. 그래서 기본은 **회원 화면 것만** 담습니다.
   전부 담으려면 --전부 를 적습니다.
   ★ --고친것다시 : 내가 이미 쓴 공고(뽑은값에 알리오상세근거 가 붙은 것)를
     고친 규칙으로 **다시 덮습니다** */
const 전부다 = argv.includes('--전부');
const 고친것다시 = argv.includes('--고친것다시');

const cfg = {};
for (const 이름 of ['../.env', '../.env.local']) {
  const p = new URL(이름, import.meta.url);
  if (!fs.existsSync(p)) continue;
  for (const l of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z_0-9]+)=(.*)$/);
    if (m && !cfg[m[1]]) cfg[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}
const U = cfg.SUPABASE_URL; const K = cfg.SUPABASE_SERVICE_KEY;
/* 자기점검은 **열쇠 없이** 돕니다 — API 도 DB 도 두드리지 않습니다 */
if (!process.argv.includes('--자기점검') && (!U || !K || !cfg.ALIO_DETAIL_KEY)) {
  console.error('✗ SUPABASE_URL / SUPABASE_SERVICE_KEY / ALIO_DETAIL_KEY 가 있어야 합니다');
  process.exit(1);
}
const H = { apikey: K, Authorization: 'Bearer ' + K, 'Content-Type': 'application/json' };
const UA = 'Mozilla/5.0 (compatible; potjob/1.0)';
const 상세URL = 'https://apis.data.go.kr/1051000/recruitment/detail';

/* 포털 쿠키 — collect-alio.mjs 의 포털쿠키() 와 같은 규칙 (지침 6절) */
const 담기 = (jar) => Object.entries(jar).map(([k, v]) => k + '=' + v).join('; ');
let _쿠키 = null;
async function 포털쿠키() {
  if (_쿠키 !== null) return _쿠키;
  const jar = {};
  let u = 'https://opendata.alio.go.kr/new/';
  for (let hop = 0; hop < 4 && u; hop++) {
    const r = await fetch(u, { redirect: 'manual', headers: { 'User-Agent': UA, Cookie: 담기(jar) } });
    (r.headers.getSetCookie?.() || []).forEach((x) => {
      const kv = String(x).split(';')[0], i = kv.indexOf('=');
      if (i > 0) jar[kv.slice(0, i).trim()] = kv.slice(i + 1).trim();
    });
    const loc = r.headers.get('location');
    u = (r.status >= 300 && r.status < 400 && loc)
      ? (/^https?:/.test(loc) ? loc : 'https://opendata.alio.go.kr' + loc) : '';
  }
  _쿠키 = 담기(jar);
  return _쿠키;
}

async function 전부(길) {
  const out = [];
  const 길2 = 차례붙이기(길);
  for (let off = 0; ; off += 100) {
    const r = await fetch(U + '/rest/v1/' + 길2 + '&limit=100&offset=' + off, { headers: H });
    if (!r.ok) throw new Error(길.slice(0, 50) + ' ' + r.status + ' ' + (await r.text()).slice(0, 200));
    const a = await r.json();
    out.push(...a);
    if (a.length < 100) break;
    if (off > 20000) break;
  }
  return out;
}

/** 「20261026」 → 「2026-10-26」. 꼴이 아니면 null */
export function 날짜8(v) {
  const s = String(v || '').replace(/\D/g, '');
  if (s.length !== 8) return null;
  const [y, m, d] = [s.slice(0, 4), s.slice(4, 6), s.slice(6, 8)];
  if (+m < 1 || +m > 12 || +d < 1 || +d > 31) return null;
  return y + '-' + m + '-' + d;
}

/** 모집인원 — `recrutNope`. 「0」·터무니없는 수는 안 믿습니다 */
export function 인원칸(v) {
  const s = String(v ?? '').replace(/[^0-9]/g, '');
  if (!s) return null;
  const n = Number(s);
  return n >= 1 && n <= 999 ? n : null;
}

/** 지원자격 — `aplyQlfcCn` 에서 **우리 직군 줄만**. 빈 것은 null
 *
 * ★ 2026-10-19 — 처음에는 글 전체를 넣었습니다. 그랬더니 통합 공고에서
 *   남의 직군 글이 우리 공고의 지원자격 칸에 들어갔습니다 —
 *     「1. 방사선사(영상의학과) - 상근(1명) ㅁ 방사선사 면허증 소지자
 *       2. 치과위생사(외래지원부) …」
 *     「1.사무원(부서미정)-상근(3명) ㅁ 컴퓨터활용능력 1·2급 …」
 *   세중님 규칙 그대로입니다 — 「통합공고는 **우리 직군 줄**로」
 *   (모집인원도 같은 규칙입니다 · CLAUDE.md 15절).
 *   우리 직군 줄이 없으면 **안 넣습니다.** 빈 칸이 틀린 값보다 낫습니다.
 */
export function 자격칸(v) {
  /* ★ 먼저 **쪼개진 글자를 되붙입니다** — 알리오가 HWP 자간 꼴로 주는 공고가
     있습니다(「물 리 치 료 사」). 안 붙이면 `우리직군줄()` 이 못 찾고,
     찾아도 회원 화면에 저렇게 보입니다 (2026-10-19) */
  const s = 자간풀기(String(v ?? '').replace(/\r/g, '')).replace(/[ \t]+/g, ' ').trim();
  if (!s) return null;
  /* ★ `우리직군줄()` 은 **글자열**을 돌려줍니다(줄 하나면 그 줄 그대로).
     배열로 알고 `[...줄]` 로 펼치면 **글자 하나씩** 쪼개집니다 —
     2026-10-19 마른 실행에서 「3\n)\n의\n료…」 가 나오려던 자리입니다 */
  const 낸것 = 우리직군줄(s);
  const 줄 = Array.isArray(낸것) ? 낸것 : (낸것 ? String(낸것).split('\n') : []);
  if (!줄.length) return null;
  /* 우리 직군 줄 + 「공통」 머리글 아래 줄은 함께 둡니다 — 공통 자격이 거기 있습니다 */
  const 공통 = s.split('\n').filter((l) => /\[?공통/.test(l));
  return [...줄, ...공통].join('\n').replace(/\n{2,}/g, '\n').slice(0, 300);
}

/* ── 스스로 하는 검사 — node tools/알리오_칸되메우기.mjs --자기점검 ───
   API 를 두드리지 않습니다. 2026-10-19 마른 실행에서 **네 번** 틀린 값을
   잡았고, 그 넷을 그대로 견본으로 둡니다 */
if (process.argv.includes('--자기점검')) {
  const 어긴것 = [];
  const 봐 = (말, 참) => { if (!참) 어긴것.push(말); };

  /* ① 우리 직군 줄만 — 남의 직군 글이 들어오면 안 됩니다 */
  const 통합 = ['1.사무원(부서미정)-상근(3명)',
    'ㅁ사무 관련 자격증 소지자 * 자격증 : 컴퓨터활용능력 1·2급',
    '2. 방사선사(영상의학과) - 상근(1명)',
    'ㅁ 방사선사 면허증 소지자',
    '3. 작업치료사(어린이재활치료부) - 상근(1명)',
    'ㅁ 작업치료사 면허증 소지자'].join('\n');
  const 자 = 자격칸(통합);
  봐('★ 우리 직군 줄이 들어온다', /작업치료사/.test(자 || ''));
  봐('★ 사무원 글은 안 들어온다', !/사무원|컴퓨터활용능력/.test(자 || ''));
  봐('★ 방사선사 글도 안 들어온다', !/방사선사/.test(자 || ''));

  /* ② 우리 직군이 없으면 **빈 칸** — 틀린 값보다 낫습니다 */
  봐('우리 직군이 없으면 null',
    자격칸('1. 사무원 - 상근(3명)\nㅁ 컴퓨터활용능력 1·2급\n2. 조리원 - 상근(2명)') === null);
  봐('빈 값은 null', 자격칸('') === null && 자격칸(null) === null);

  /* ③ 자간 꼴 — 되붙여야 우리 직군을 찾습니다 */
  const 자간 = ' 3 ) 의 료 기 사 ( 물 리 치 료 사 ) : 물 리 치 료 사 면 허 취 득 후 경 력 3 년 이 상 인 자';
  const 자2 = 자격칸(자간);
  봐('★ 자간 꼴에서 우리 직군을 찾는다', /물리치료사/.test(자2 || ''));
  봐('★ 돌려준 값에 자간이 안 남는다', !/물 리 치 료/.test(자2 || ''));

  /* ④ 글자 하나씩 쪼개지지 않는다 — `우리직군줄()` 이 글자열을 줍니다 */
  봐('★ 글자 하나씩 쪼개지지 않는다', !/\n.\n.\n/.test(자2 || ''));
  봐('한 줄이면 한 줄로', (자2 || '').split('\n').length <= 3);

  /* ⑤ 모집인원 — 「0명」·세 자리 넘는 수는 안 믿습니다 */
  봐('0 은 null', 인원칸(0) === null && 인원칸('0') === null);
  봐('1 은 1', 인원칸(1) === 1);
  봐('1000 은 null', 인원칸(1000) === null);
  봐('빈 값은 null', 인원칸('') === null && 인원칸(null) === null);

  /* ⑥ 날짜 8자리 */
  봐('20261026 → 2026-10-26', 날짜8('20261026') === '2026-10-26');
  봐('꼴이 아니면 null', 날짜8('2026-10') === null && 날짜8('') === null);
  봐('말도 안 되는 달이면 null', 날짜8('20261326') === null);

  if (어긴것.length) {
    console.error('✗ 알리오_칸되메우기 자기점검 실패 ' + 어긴것.length + '가지');
    for (const x of 어긴것) console.error('   · ' + x);
    process.exit(1);
  }
  console.log('○ 알리오_칸되메우기 자기점검 통과 — 15가지 (API 를 두드리지 않았습니다)');
  process.exit(0);
}


/* ── 어느 공고를 볼까 ────────────────────────────────────────────
   첨부줄이 **없는** 알리오 공고. 회원 화면 것을 먼저 봅니다 — 회원이 보는
   자리가 먼저입니다 (세중님) */
const 첨부있는것 = new Set((await 전부('job_attachments?select=job_id')).map((x) => x.job_id));
const 보임 = new Set((await 전부('job_posts_pub?select=id')).map((x) => x.id));
const 다 = await 전부('job_posts?select=id,source,org_name,title,apply_to,apply_to_time,'
  + 'headcount,detail,edited_fields,admin_locked,뽑은값&source=in.(AL,AL2)');
const 후보 = 고친것다시
  ? 다.filter((x) => x["뽑은값"] && x["뽑은값"]["알리오상세근거"])
  : 다.filter((x) => !첨부있는것.has(x.id) && (전부다 || 보임.has(x.id)));
const 볼것 = 후보.sort((a, b) => (보임.has(b.id) ? 1 : 0) - (보임.has(a.id) ? 1 : 0)).slice(0, 몇개);
console.log('알리오 공고 ' + 다.length + '건 · 첨부줄이 없는 것 '
  + 다.filter((x) => !첨부있는것.has(x.id)).length + '건 → 볼 것 ' + 볼것.length + '건'
  + ' (그중 회원 화면 ' + 볼것.filter((x) => 보임.has(x.id)).length + '건)\n');

const 첨부모음 = 첨부모으기('AL2', { 마른: !진짜 });
const 칸줄 = [];
const 셈 = { 상세받음: 0, 상세탈: 0, 첨부더함: 0, 첨부없음: 0 };
const 채울것 = { 모집인원: 0, 접수마감: 0, 마감시각: 0, 지원자격: 0 };
const 견본 = [];
let HTML받음 = 0; let 파일받음 = 0;
const 자고 = (ms) => new Promise((r) => setTimeout(r, ms));

for (const [i, x] of 볼것.entries()) {
  const sn = String(x.id).replace(/[^0-9]/g, '');
  if (!sn) continue;
  let box;
  try {
    const r = await fetch(상세URL + '?serviceKey=' + encodeURIComponent(cfg.ALIO_DETAIL_KEY) + '&sn=' + sn,
      { headers: { accept: 'application/json', 'User-Agent': UA }, signal: AbortSignal.timeout(20000) });
    const t = await r.text();
    if (r.status !== 200) { 셈.상세탈++; await 자고(200); continue; }
    const j = JSON.parse(t);
    box = Array.isArray(j && j.result) ? j.result[0] : (j && j.result) || j;
    if (!box || !box.recrutPblntSn) { 셈.상세탈++; await 자고(200); continue; }
    셈.상세받음++;
  } catch { 셈.상세탈++; await 자고(200); continue; }

  /* ── ① 첨부 주소 ── */
  const files = Array.isArray(box.files) ? box.files : [];
  if (!files.length) 셈.첨부없음++;
  for (const f of files) {
    const 주소 = f.url || f.fileUrl || f.atchFileUrl || '';
    if (!주소) continue;
    /* 첨부유형 A=공고문 B=지원서 C=직무기술서 (CLAUDE.md 4절) */
    const kind = f.atchFileType === 'A' ? '공고문'
      : f.atchFileType === 'B' ? '지원서' : f.atchFileType === 'C' ? '직무기술서' : '첨부';
    첨부모음.더하기({ job_id: x.id, kind, name: f.atchFileNm || f.fileNm || '', url: 주소 });
    셈.첨부더함++;
  }

  /* ── ② 칸 — PDF 를 안 읽고 /detail 만으로 ── */
  const 줄 = { id: x.id };
  const 뽑은값 = {};
  /* ★ 모집인원 — `recrutNope` 는 **공고 전체 인원**입니다. 통합 공고에서는
     우리 직군 인원이 아닙니다 (CLAUDE.md 15절). 2026-10-19 마른 실행에서
     계약직의사 21 · 약무직 20 · 진료전담교수 14 가 그대로 들어오려 했습니다.
     그래서 **`steps` 에서 우리 직군 단계만 센 값**만 씁니다 —
     셈은 `알리오직군셈.mjs` 의 `직군인원()` **한 자리**입니다 (지침 6절).
     steps 를 못 본 공고는 **비웁니다** — 틀린 숫자가 빈 칸보다 나쁩니다 */
  const 단계이름 = (Array.isArray(box.steps) ? box.steps : [])
    .map((s) => String(s.recrutPbancTtl || '').trim()).filter(Boolean);
  if (x.headcount == null && 단계이름.length) {
    const 센것 = 직군인원(단계이름);
    const 합 = 센것 && 센것.셈
      ? (Number(센것.셈.물리치료사 || 0) + Number(센것.셈.작업치료사 || 0)) : 0;
    const n = 인원칸(합);
    if (n) {
      줄.headcount = n; 채울것.모집인원++;
      줄._인원근거 = (센것.근거 || []).slice(0, 3).join(' / ').slice(0, 150);
    }
  }
  /* ★ 접수마감 — **뚜껑**을 둡니다. 「상시모집」 공고가 pbancEndYmd 20501231
     처럼 터무니없는 날짜를 줍니다(2026-10-19 마른 실행에서 봤습니다).
     `collect_put` 에는 뚜껑이 있지만 `칸되메우기` 에는 없어서 여기서 막습니다 */
  const 마감 = 날짜8(box.pbancEndYmd);
  const 뚜껑 = new Date(Date.now() + 400 * 86400e3).toISOString().slice(0, 10);
  if (마감 && x.apply_to == null) {
    if (마감 > 뚜껑) {
      셈.마감터무니없음 = (셈.마감터무니없음 || 0) + 1;
      if ((셈.마감견본 ||= []).length < 4) 셈.마감견본.push(x.id + ' ' + 마감 + ' — ' + String(x.title).slice(0, 36));
    } else {
      줄.apply_to = 마감; 줄.마감일출처 = '알리오 상세 pbancEndYmd'; 채울것.접수마감++;
    }
  }
  /* 마감 시각 — 전형방법 글에 「10:00까지」 가 있습니다. 읽는 자리는
     `공고문읽기.mjs` 의 `시각읽기()` 한 자리입니다 (지침 6절) */
  if (x.apply_to_time == null && box.scrnprcdrMthdExpln) {
    /* ★ 글 전체에 `시각읽기()` 를 걸면 엉뚱한 숫자를 집습니다
       (「면접점수 60점」·「2026.10.16.」 같은 것). **접수 마감을 말하는 줄만**
       골라 거기서만 읽습니다 — 틀린 값이 채움률보다 먼저입니다 (세중님) */
    const 마감줄 = String(box.scrnprcdrMthdExpln).split(/\n|(?<=\.)\s(?=\d\.)/)
      .find((l) => /(접수|제출|마감|원서)/.test(l) && /까지/.test(l) && /\d\s*[:시]/.test(l));
    const 시각 = 마감줄 ? 시각읽기(마감줄.slice(마감줄.search(/까지/) > 0
      ? Math.max(0, 마감줄.search(/까지/) - 12) : 0)) : null;
    if (시각) { 줄.apply_to_time = 시각; 줄._시각근거 = 마감줄.replace(/\s+/g, ' ').trim(); 채울것.마감시각++; }
  }
  const 자격 = 자격칸(box.aplyQlfcCn);
  /* 이미 찬 지원자격 — 표의 `뽑은값` 칸과 `detail` 둘 다 봅니다
     (창구는 `뽑은값` 칸에 씁니다) */
  const 이미자격 = (x['뽑은값'] && x['뽑은값'].지원자격)
    || (x.detail && (x.detail['뽑은값']?.지원자격 || x.detail.지원자격)) || null;
  if (자격 && (고친것다시 || !이미자격)) { 뽑은값.지원자격 = 자격; 채울것.지원자격++; }
  if (Object.keys(뽑은값).length) {
    뽑은값.알리오상세근거 = { 지원자격: '알리오 상세 aplyQlfcCn' };
    줄.뽑은값 = 뽑은값;
  }
  if (Object.keys(줄).length > 1) {
    칸줄.push(줄);
    if (견본.length < 10) 견본.push({ x, 줄, box });
  }
  process.stderr.write('\r  ' + (i + 1) + '/' + 볼것.length + ' — 칸 ' + 칸줄.length
    + ' · 첨부 ' + 셈.첨부더함 + '   ');
  await 자고(200);
}
process.stderr.write('\n');

console.log('── 상세 ──');
console.log('  받음 ' + 셈.상세받음 + ' · 탈 ' + 셈.상세탈 + ' · 첨부가 없는 공고 ' + 셈.첨부없음);
if (셈.마감터무니없음) {
  console.log('  ★ 마감일이 뚜껑(오늘+400일)을 넘어 **안 넣은 것** ' + 셈.마감터무니없음 + '건 — 「상시모집」 꼴');
  for (const v of (셈.마감견본 || [])) console.log('     ' + v);
}
console.log('  첨부 주소 ' + 셈.첨부더함 + '개 모았습니다');
console.log('\n── 채워질 칸 ──');
for (const [k, v] of Object.entries(채울것)) console.log('  ' + k.padEnd(6) + v + '건');

console.log('\n── 견본 (앞 10건) ──');
for (const { x, 줄, box } of 견본) {
  console.log('  ' + x.id + ' [' + x.source + '] ' + String(x.org_name).slice(0, 18)
    + (보임.has(x.id) ? ' (회원 화면)' : ''));
  console.log('     ' + String(x.title).slice(0, 60));
  if (줄.headcount) {
    console.log('     모집인원 → ' + 줄.headcount + '   근거 steps 「'
      + String(줄._인원근거 || '').slice(0, 80) + '」');
  }
  if (줄.apply_to) console.log('     접수마감 → ' + 줄.apply_to + '   근거 pbancEndYmd ' + box.pbancEndYmd);
  if (줄.apply_to_time) {
    console.log('     마감시각 → ' + 줄.apply_to_time + '   근거 「'
      + String(줄._시각근거 || '').slice(0, 90) + '」');
  }
  if (줄.뽑은값?.지원자격) console.log('     지원자격 → 「' + 줄.뽑은값.지원자격.replace(/\s+/g, ' ').slice(0, 70) + '」');
}

/* ★ 포털 쿠키가 듣는지 — 첨부 셋만 앞 8글자를 받아 봅니다 (세중님 조건) */
if (첨부모음.줄들.length) {
  console.log('\n── 포털 쿠키 시험 (첨부 앞 3개만 받아 봅니다) ──');
  const 쿠키 = await 포털쿠키();
  for (const r of 첨부모음.줄들.slice(0, 3)) {
    try {
      const rr = await fetch(r.url, {
        headers: { 'User-Agent': UA, Cookie: 쿠키, Referer: 'https://opendata.alio.go.kr/new/', Range: 'bytes=0-15' },
      });
      const b = Buffer.from(await rr.arrayBuffer());
      const s = b.subarray(0, 5).toString('latin1');
      const 꼴 = s.startsWith('%PDF-') ? 'PDF' : s.startsWith('PK\u0003\u0004') ? 'zip/hwpx'
        : b.subarray(0, 4).toString('hex') === 'd0cf11e0' ? '옛 hwp/ole'
          : /^\s*<(!doctype|html)/i.test(b.toString('utf8')) ? 'HTML' : '모름 ' + s.replace(/[^\x20-\x7e]/g, '.');
      console.log('  ' + 꼴 + ' · ' + b.length + '바이트 · 「' + String(r.name).slice(0, 44) + '」');
      if (꼴 === 'HTML') HTML받음++; else 파일받음++;
    } catch (e) { console.log('  ✗ ' + String(e.message).slice(0, 50)); }
  }
  if (HTML받음 && !파일받음) {
    console.error('\n★ 첨부가 전부 HTML 로 옵니다 — **포털 쿠키가 안 듣습니다.** 멈춥니다 (세중님 조건).');
    console.error('  지침 5절 · 첨부담기.mjs:150 을 보고 쿠키 규칙을 다시 맞춰야 합니다');
    process.exit(1);
  }
}

if (!진짜) {
  console.log('\n[칸마른] 아무것도 안 담습니다 — 담으려면 --진짜');
  process.exit(0);
}

/* ── 담기 — 창구로만 ── */
console.log('\n첨부를 담습니다 —');
await 첨부모음.끝내기(cfg);
console.log('\n칸을 담습니다 — ' + 칸줄.length + '건');
let 함 = 0;
for (let i = 0; i < 칸줄.length; i += 50) {
  const r = await fetch(U + '/rest/v1/rpc/' + encodeURIComponent('칸되메우기'), {
    method: 'POST', headers: H,
    /* `_시각근거` 는 보고용이라 창구에 안 보냅니다 */
    body: JSON.stringify({ p_rows: 칸줄.slice(i, i + 50)
      .map(({ _시각근거, _인원근거, ...나머지 }) => 나머지) }),
  });
  const t = await r.text();
  if (!r.ok) { console.error('✗ 칸되메우기 ' + r.status + ' · ' + t.slice(0, 250)); process.exit(1); }
  함 += 칸줄.slice(i, i + 50).length;
  if (i === 0) console.log('  창구가 답한 것 — ' + t.slice(0, 260));
}
console.log('  ' + 함 + '/' + 칸줄.length);
