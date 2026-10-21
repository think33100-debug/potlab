/* 이미 담긴 공고의 첨부를 **다시 읽어 일곱 칸을 채웁니다** (2026-10-11).
 *
 *   node tools/첨부되메우기.mjs --마른                 세어만 봅니다 (기본)
 *   node tools/첨부되메우기.mjs --마른 --견본 5         견본도
 *   node tools/첨부되메우기.mjs --출처 GJ2 --몇개 30
 *   node tools/첨부되메우기.mjs --진짜                 **담습니다** (세중님 확인 뒤에만)
 *
 * ★ **기본이 마른 실행입니다.** `--진짜` 를 적어야 담습니다.
 *   세중님 지시 — 「마른 실행 → 칸별 전후 채움률 + 견본 5건 원문↔값 →
 *   제 확인 → 실행」.
 *
 * ── 지키는 것 ───────────────────────────────────────────────
 *   · `updated_at` 을 **안 바꿉니다** (지침 9절 — 알림·다리가 그 값을 봅니다)
 *   · `edited_fields` 에 걸린 칸과 `admin_locked` 공고는 **건너뜁니다**
 *   · `apply_to` 를 **안 덮습니다.** 공고문 값은 뽑은값에만 둡니다
 *     (지침 15절 — API 날짜와 공고문 날짜가 다릅니다)
 *   · 모집인원은 **그 공고 직군 줄의 것만.** 없으면 비워 둡니다
 *   · `job_attachments` 에 주소가 있는 공고만 봅니다. 없으면 먼저 수집기가
 *     주소를 담아야 합니다 (`POTJOB_ATTACH_WRITE=1`)
 */
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 첨부읽기, 칸뽑기, kordoc있나 } from './공고문읽기.mjs';
import { 그누보드새주소, 고친주소 } from './첨부주소고치기.mjs';
import { 쓴메모리MB, 바퀴중단인가, 워커셈 } from './kordoc워커.mjs';
import { 첨부받기 as 클린아이첨부받기, 기본간격 as 클린아이간격 } from './cleaneye-file.mjs';
import { 첨부받기 as 나라일터첨부받기, 기본간격 as 나라일터간격 } from './gojobs-file.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const 값 = (이름, 기본) => {
  const i = argv.indexOf(이름);
  return i > -1 && argv[i + 1] != null ? argv[i + 1] : 기본;
};
const 진짜 = argv.includes('--진짜');
const 몇개 = Number(값('--몇개', 40));
const 출처 = 값('--출처', '');
const 견본수 = Number(값('--견본', 5));

function env() {
  const out = {};
  for (const f of [path.join(여기, '..', '.env'), path.join(여기, '..', '.env.local')]) {
    if (!fs.existsSync(f)) continue;
    for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
      const m = l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*?)\s*$/);
      if (m && !out[m[1]]) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  }
  for (const k of Object.keys(process.env)) if (process.env[k]) out[k] = process.env[k];
  out.SUPABASE_URL = out.SUPABASE_URL || out.NEXT_PUBLIC_SUPABASE_URL;
  return out;
}
const cfg = env();
for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY']) {
  if (!cfg[k]) { console.error(k + ' 가 없습니다'); process.exit(1); }
}
if (!kordoc있나()) { console.error('kordoc 이 안 깔렸습니다 — cd tools/kordoc && npm ci'); process.exit(1); }
const H = { apikey: cfg.SUPABASE_SERVICE_KEY, Authorization: 'Bearer ' + cfg.SUPABASE_SERVICE_KEY };

/* PostgREST 는 limit 을 줘도 100줄에서 끊습니다 — Range 로 쪽을 넘깁니다 */
async function 전부(길, 뚜껑 = Infinity) {
  const 모두 = [];
  for (let 처음 = 0; 처음 < 뚜껑; 처음 += 100) {
    const r = await fetch(cfg.SUPABASE_URL + '/rest/v1/' + 길,
      { headers: { ...H, Range: `${처음}-${처음 + 99}`, 'Range-Unit': 'items' } });
    if (!r.ok) throw new Error(길.slice(0, 60) + ' HTTP ' + r.status + ' · ' + (await r.text()).slice(0, 200));
    const 한쪽 = await r.json();
    모두.push(...한쪽);
    if (한쪽.length < 100) break;
  }
  return 모두.slice(0, 뚜껑 === Infinity ? undefined : 뚜껑);
}

/* ── 볼 것 고르기 ────────────────────────────────────────────
   첨부 주소가 있고, 일곱 칸 중 하나라도 빈 공고 */
/* 읽기탈 칸은 창구 SQL 을 올린 뒤에 생깁니다 — 없으면 400 이 오니 물러섭니다 */
let 읽기탈있나 = true;
let 첨부들;
try {
  첨부들 = await 전부('job_attachments?select=job_id,url,kind,name,parsed_at,'
    + encodeURIComponent('읽기탈') + '&order=id.asc');
} catch (e) {
  if (!/42703|읽기탈/.test(String(e.message))) throw e;
  읽기탈있나 = false;
  첨부들 = await 전부('job_attachments?select=job_id,url,kind,name,parsed_at&order=id.asc');
  console.log('   (읽기탈 칸이 아직 없습니다 — 창구 SQL 을 올리면 생깁니다)');
}
if (!첨부들.length) {
  console.log('job_attachments 가 0줄입니다 — 먼저 수집기가 주소를 담아야 합니다');
  console.log('   POTJOB_ATTACH_WRITE=1 node tools/collect-nara.mjs --상세 30');
  process.exit(0);
}
const 공고별첨부 = new Map();
for (const a of 첨부들) {
  if (!공고별첨부.has(a.job_id)) 공고별첨부.set(a.job_id, []);
  공고별첨부.get(a.job_id).push(a);
}
console.log('첨부 주소가 있는 공고 ' + 공고별첨부.size + '곳 (첨부 ' + 첨부들.length + '줄)');
{
  const 읽음 = 첨부들.filter((a) => a.parsed_at && !a['읽기탈']).length;
  const 안됨 = 첨부들.filter((a) => a.parsed_at && a['읽기탈']).length;
  const 안본것 = 첨부들.filter((a) => !a.parsed_at).length;
  console.log('   읽은 것 ' + 읽음 + ' · 읽어 봤는데 안 된 것 ' + 안됨 + ' · 아직 안 본 것 ' + 안본것);
}

const 번호들 = [...공고별첨부.keys()];
const 공고들 = [];
for (let i = 0; i < 번호들.length; i += 60) {
  const 조각 = 번호들.slice(i, i + 60).map(encodeURIComponent).join(',');
  공고들.push(...await 전부('job_posts?select=id,source,org_name,title,job_group,headcount,'
    + 'apply_to,apply_to_time,work_place,detail,' + encodeURIComponent('뽑은값')
    + ',edited_fields,admin_locked,hidden,hold&id=in.(' + 조각 + ')'));
}

const 빈칸들 = (j) => {
  const p = j['뽑은값'] || {}; const d = j.detail || {};
  const 빈 = [];
  if (j.headcount == null) 빈.push('모집인원');
  if (!j.apply_to_time) 빈.push('마감시각');
  if (!j.work_place && !p['근무지']) 빈.push('근무지');
  if (!d['지원자격'] && !p['지원자격']) 빈.push('지원자격');
  if (!d['연봉'] && !p['예상연봉']) 빈.push('예상연봉');
  return 빈;
};

/* ★ 2026-10-21 — **차례를 돌립니다.** 전에는 앞에서 N건을 잘라, 바퀴마다 같은
   공고를 다시 읽고 「아직 안 본 것」은 차례가 안 왔습니다 (첫 바퀴 읽음 56 · 담음 0).
   그 공고 첨부의 parsed_at 이 **없는 것 먼저 · 오래된 것 다음**입니다 */
const 언제봤나 = (id) => {
  const 들 = (공고별첨부.get(id) || []).map((a) => a.parsed_at).filter(Boolean);
  return 들.length ? 들.sort().slice(-1)[0] : '';      /* 빈 글자가 가장 앞에 옵니다 */
};
const 볼것 = 공고들
  .filter((j) => !출처 || j.source === 출처)
  .filter((j) => !j.admin_locked)
  .filter((j) => 빈칸들(j).length)
  .sort((a, b) => 언제봤나(a.id).localeCompare(언제봤나(b.id)))
  .slice(0, 몇개);
console.log('볼 것 ' + 볼것.length + '건' + (출처 ? ' (출처 ' + 출처 + ')' : '')
  + ' · 관리자 잠금 건너뜀 ' + 공고들.filter((j) => j.admin_locked).length + '건'
  + (볼것.length ? ' · 가장 오래 안 본 것 ' + (언제봤나(볼것[0].id) || '아직 안 봄')
    + ' ~ ' + (언제봤나(볼것[볼것.length - 1].id) || '아직 안 봄') : ''));
console.log(진짜 ? '\n★ **진짜로 담습니다**' : '\n[마른] 아무것도 안 담습니다 — 담으려면 --진짜');

const 칸이름 = ['모집인원', '마감시각', '근무지', '지원자격', '예상연봉'];
const 견본 = []; const 보낼줄 = [];
let 읽음 = 0; let 빈손 = 0; let 초합 = 0; let 못받음 = 0;
const 빈손까닭 = new Map();
const 못받음까닭 = new Map();      /* 못 받은 까닭도 셉니다 (지침 2절) */
const 고침셈 = new Map();          /* 주소를 바로잡은 수 (첨부주소고치기) */
const 클린아이셈 = new Map();
const 나라일터셈 = new Map();      /* 나라일터 두 걸음 길 (gojobs-file.mjs · 2026-10-22) */

/* ★ 알리오 첨부는 **쿠키가 있어야** 받습니다. 없으면 파일 대신 포털 첫
   화면(8,333자 HTML)이 옵니다 — 2026-10-11 에 이 되메우기를 마른으로
   돌려 2건이 다 「빈손」으로 나와서 알았습니다 (collect-alio.mjs 의
   포털쿠키() 주석에 이미 적혀 있던 것입니다) */
let 알리오쿠키 = null;
async function 머리(주소) {
  const 기본 = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0.0.0' };
  if (!/opendata\.alio\.go\.kr/.test(주소)) return 기본;
  if (알리오쿠키 === null) {
    const jar = {};
    let u = 'https://opendata.alio.go.kr/new/';
    const 담기 = () => Object.entries(jar).map(([k, v]) => k + '=' + v).join('; ');
    for (let hop = 0; hop < 4 && u; hop++) {
      const r = await fetch(u, { redirect: 'manual', headers: { ...기본, Cookie: 담기() } });
      (r.headers.getSetCookie?.() || []).forEach((x) => {
        const kv = String(x).split(';')[0]; const i = kv.indexOf('=');
        if (i > 0) jar[kv.slice(0, i).trim()] = kv.slice(i + 1).trim();
      });
      const loc = r.headers.get('location');
      u = (r.status >= 300 && r.status < 400 && loc)
        ? (/^https?:/.test(loc) ? loc : 'https://opendata.alio.go.kr' + loc) : '';
    }
    알리오쿠키 = 담기();
    console.log('   (알리오 포털 쿠키 ' + (알리오쿠키 ? 알리오쿠키.split(';').length + '개' : '없음') + ')');
  }
  return { ...기본, Cookie: 알리오쿠키, Referer: 'https://opendata.alio.go.kr/new/' };
}

/* ── 하루 상한과 「읽어 봤나」 (2026-10-18 세중님 수집기 순서 1) ──────────
   `parsed_at` 은 **마지막으로 읽어 본 때**, `읽기탈` 은 안 된 까닭입니다
   (창구 supabase/migrations/2026_10_18_첨부읽음표시_창구.sql).
   그 칸이 있어야 ① 같은 파일을 날마다 다시 받지 않고 ② 하루 상한을 걸 수 있습니다.
   ★ 상한 300 은 **첨부담기(주소 담기)와 같은 값**으로 맞췄습니다 (지침 6절 —
     기준을 두 벌로 만들지 않습니다). POTJOB_PARSE_MAX 로 바꿉니다. */
const 하루뚜껑 = Number(process.env.POTJOB_PARSE_MAX) || 300;
/* 다시 받아도 영영 안 되는 까닭 — 이런 줄은 건너뜁니다 */
/* ★ 2026-10-21 — 「읽을 수 있는 형식이 아닙니다 (**HTML** · 3,616바이트)」는
   **영영 안 되는 것이 아닙니다** — 파일이 아니라 **오류 쪽이 온 것**(받기 문제)입니다.
   그누보드 7건이 이 글귀로 **영영 건너뜀**이 되어 있었습니다. 쿠키·Referer 를
   붙이면 받아집니다. 그래서 HTML·모름이 든 글귀는 다시 봅니다 */
const 영영안됨 = (왜) => {
  const t = String(왜 || '');
  if (/섹션 파일을 찾을 수 없/.test(t)) return true;
  if (/형식이 아닙니다/.test(t)) return !/HTML|모름/.test(t);
  return false;
};
const 오늘KST = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const 날짜KST = (t) => (t ? new Date(new Date(t).getTime() + 9 * 3600e3).toISOString().slice(0, 10) : '');
const 표시할것 = [];                /* --진짜 일 때 창구로 보낼 {job_id,url,왜} */
/* ★ 이 둘은 날짜KST·오늘KST 가 선 **뒤에** 두어야 합니다 — 위에 두면
   const 의 TDZ 에 걸려 ReferenceError 가 납니다. node --check 는 못 잡습니다 */
const 오늘읽어본수 = 첨부들.filter((a) => 날짜KST(a.parsed_at) === 오늘KST).length;
let 상한에걸림 = false;

/* ── 같은 사이트는 3.5초 이상 띄웁니다 (지침 — 병원 사이트 3초 이상) ─────
   2026-10-18 — 전에는 틈이 없어 한 기관에 첨부가 여럿이면 1.2초 간격으로
   줄줄이 때렸습니다. 알리오·클린아이 포털만 돌 때는 안 드러났는데,
   병원 홈페이지로 넓히면 바로 문제가 됩니다.
   403·429·빈 응답이 **이어서 3번**이면 그 사이트를 멈추고 기록합니다. */
const 틈ms = Number(process.env.POTJOB_ATTACH_GAP_MS) || 3500;
const 받기제한초 = Number(process.env.POTJOB_ATTACH_FETCH_SEC) || 20;
const 끝때 = new Map();          /* host → 마지막 요청 시각 */
const 막힘 = new Map();          /* host → 이어진 막힘 수 */
const 멈춘사이트 = new Map();    /* host → 까닭 */
const 자고 = (ms) => new Promise((r) => setTimeout(r, ms));

function 어디(주소) { try { return new URL(주소).host; } catch { return ''; } }

/** 상세 쪽을 한 번 받아 **쿠키**를 챕니다 (호스트마다 한 번 · 지침 — 3.5초 틈은 위에서) */
const 쿠키집 = new Map();
async function 상세쿠키(상세주소) {
  const host = 어디(상세주소);
  if (!host) return '';
  if (쿠키집.has(host)) return 쿠키집.get(host);
  let 쿠키 = '';
  try {
    const r = await fetch(상세주소, {
      headers: await 머리(상세주소),
      redirect: 'follow',
      signal: AbortSignal.timeout(받기제한초 * 1000),
    });
    /* ★ 2026-10-22 — **쪽글도 기억합니다.** 그누보드 nonce 를 여기서 새로 읽습니다 */
    try { 쪽글집.set(상세주소, await r.text()); } catch { /* 글은 없어도 쿠키는 씁니다 */ }
    const 들 = r.headers.getSetCookie?.() || [];
    쿠키 = 들.map((x) => String(x).split(';')[0]).filter(Boolean).join('; ');
    셈쿠키.set(host, 쿠키 ? '받음' : '없음');
  } catch (e) {
    셈쿠키.set(host, '탈 — ' + String((e && e.message) || e).slice(0, 30));
  }
  쿠키집.set(host, 쿠키);
  return 쿠키;
}
const 셈쿠키 = new Map();
let nonce새로 = 0;              /* 그누보드 nonce 를 새로 읽은 수 */
const 쪽글집 = new Map();     /* 상세주소 → 쪽글 (그누보드 nonce 새로 읽기 · 2026-10-22) */

async function 틈두고받기(주소, 받는법 = null) {   /* 주소는 안에서 새 nonce 로 바뀔 수 있습니다 */
  const host = 어디(주소);
  if (!host) return { 왜: '주소 꼴이 아님' };
  if ((막힘.get(host) || 0) >= 3) return { 왜: '그 사이트 막힘 3번 — 멈췄습니다' };
  const 지난 = Date.now() - (끝때.get(host) || 0);
  if (지난 < 틈ms) await 자고(틈ms - 지난);
  끝때.set(host, Date.now());
  let g;
  try {
    const 더 = {};
    if (받는법 && 받는법.Referer) 더.Referer = 받는법.Referer;
    /* ★ 상세 쪽 쿠키 — 그누보드는 세션이 있어야 파일을 줍니다 (없으면 오류 쪽 HTML) */
    if (받는법 && 받는법.쿠키 === '상세' && 받는법.Referer) {
      const c = await 상세쿠키(받는법.Referer);
      if (c) 더.Cookie = c;
      /* ★ 2026-10-22 — **nonce 를 쪽글에서 새로** 읽습니다. 담아 둔 nonce 는
         몇 시간 지나면 죽고 5~6KB HTML 이 옵니다 (셋째 표본 HS3 7건의 까닭) */
      const 쪽글 = 쪽글집.get(받는법.Referer);
      if (쪽글) {
        const 새 = 그누보드새주소(주소, 쪽글);
        if (새 !== 주소) { 주소 = 새; nonce새로++; }
      }
    }
    g = await fetch(주소, { headers: { ...(await 머리(주소)), ...더 },
      signal: AbortSignal.timeout(받기제한초 * 1000) });
  } catch (e) {
    return { 왜: String(e && e.message || e).slice(0, 60) };
  }
  if (g.status === 403 || g.status === 429) {
    const n = (막힘.get(host) || 0) + 1; 막힘.set(host, n);
    if (n >= 3) 멈춘사이트.set(host, 'HTTP ' + g.status + ' 3번');
    return { 왜: 'HTTP ' + g.status };
  }
  if (!g.ok) return { 왜: 'HTTP ' + g.status };
  /* ★ 2026-10-21 — 몸 읽기도 **받습니다.** 시간초과는 머리글을 받은 뒤에
     터지고, 그때 터지는 곳은 fetch 가 아니라 여기입니다. 받지 않으면
     한 건 때문에 바퀴 전체가 죽습니다 (그러면 그날 되메우기가 통째로 빕니다) */
  let buf;
  try {
    buf = Buffer.from(await g.arrayBuffer());
  } catch (e) {
    return { 왜: '몸 읽기 탈 — ' + String(e && e.message || e).slice(0, 50) };
  }
  if (!buf.length) {
    const n = (막힘.get(host) || 0) + 1; 막힘.set(host, n);
    if (n >= 3) 멈춘사이트.set(host, '빈 응답 3번');
    return { 왜: '빈 응답' };
  }
  막힘.set(host, 0);
  return { buf };
}

/* ★ 전·후를 **공고마다 한 줄씩 남겨 끝에 셉니다.**
   전에는 고리 안에서 세다가 `continue` 로 빠져 「전 100% → 후 0%」 같은
   헛숫자가 나왔습니다 (2026-10-11 마른 실행에서 잡았습니다) */
/** 부하가 높나 — load 1분값과 **쓴 메모리**를 봅니다 (2026-10-22 세중님 5번) */
const 부하뚜껑 = Number(process.env.POTJOB_LOAD_MAX) || 3;
const 메모리뚜껑MB = Number(process.env.POTJOB_MEM_MAX) || 1400;
function 부하높나() {
  const load = os.loadavg()[0];
  let 메모리 = 0;
  try { 메모리 = 쓴메모리MB(); } catch { 메모리 = 0; }
  if (load > 부하뚜껑) return 'load ' + Math.round(load * 100) / 100 + ' > ' + 부하뚜껑;
  if (메모리 > 메모리뚜껑MB) return '쓴 메모리 ' + 메모리 + 'MB > ' + 메모리뚜껑MB + 'MB';
  return '';
}
/** 높으면 60초씩 최대 10번 기다립니다. 그래도 높으면 바퀴를 끝냅니다 */
let 쉰횟수 = 0;
async function 부하기다리기() {
  for (let i = 0; i < 10; i++) {
    const 왜 = 부하높나();
    if (!왜) return '';
    쉰횟수++;
    console.log('   [부하] ' + 왜 + ' — 60초 쉽니다 (' + (i + 1) + '/10)');
    await 자고(60000);
  }
  return 부하높나();
}

const 잰것 = [];

/* ★ 2026-10-21 — **끝남 이유 한 줄.** 갑자기 끝나도 남게 process exit 에 겁니다.
   오늘 시험에서 바퀴가 조용히 끝났습니다(끝값 13) — 로그 끝줄만으로는
   「다 봤다」와 「멎었다」가 구별되지 않았습니다 */
const 끝 = { 까닭: '까닭을 못 적었습니다 — 갑자기 끝났습니다', 담음: 0 };
process.on('exit', (코드) => {
  const w = (() => { try { return 워커셈(); } catch { return {}; } })();
  console.log('[바퀴 끝남] 본 것 ' + 잰것.length + ' · 읽음 ' + 읽음 + ' · 빈손 ' + 빈손
    + ' · 못받음 ' + 못받음 + ' · 담음 ' + 끝.담음
    + ' · 워커 교체 ' + (w.교체 ?? '?') + '(거둠 ' + (w.거둠 ?? '?')
    + ' · 강제 ' + (w.강제종료 ?? 0) + ' · 못거둠 ' + (w.못거둠 ?? 0) + ')'
    + (쉰횟수 ? ' · 부하로 쉼 ' + 쉰횟수 + '번' : '')
    + ' · 까닭 ' + 끝.까닭 + ' · 끝값 ' + 코드);
});

for (const j of 볼것) {
  /* ★ 2026-10-22 — **부하가 높으면 쉽니다** (세중님 5번). 상한을 풀면 150건을
     쉬지 않고 읽어 서버가 숨을 못 쉽니다 (07:36 에 SSH 가 네 번 끊겼습니다) */
  {
    const 아직 = await 부하기다리기();
    if (아직) {
      끝.까닭 = '부하가 10분 넘게 높습니다 — ' + 아직;
      console.log('   [부하] ' + 아직 + ' — 10분을 기다려도 높아 이 바퀴를 끝냅니다');
      break;
    }
  }
  const 잠김 = new Set(j.edited_fields || []);
  const 지금빈 = new Set(빈칸들(j));
  const 한줄 = { id: j.id, 지금빈, 채울것: {} };
  잰것.push(한줄);

  /* 공고문 쪽 첨부를 고릅니다 — 지원서·서식은 뒤로 */
  const 점수 = (nm) => (/지원서|응시원서|서식|양식|이력서|직무기술/.test(nm) ? 0 : /공고|모집|채용/.test(nm) ? 2 : 1);
  /* 영영 안 되는 까닭이 적힌 줄은 건너뜁니다 (png·섹션 없는 hwpx 등) */
  const 쓸만한 = 공고별첨부.get(j.id).filter((a) => !(a['읽기탈'] && 영영안됨(a['읽기탈'])));
  const 고른것 = [...쓸만한].sort((a, b) => 점수(b.name || '') - 점수(a.name || ''))[0];
  if (!고른것) { 한줄.왜 = '쓸 수 있는 첨부가 없습니다 (영영 안 되는 것만)'; continue; }

  /* 하루 상한 — 넘으면 **거기서 멈춥니다.** 줄이지 않고 멈추는 쪽이
     「많이 잡혔다 = 못 읽은 것」을 숨기지 않습니다 (첨부담기와 같은 생각) */
  if (오늘읽어본수 + 표시할것.length >= 하루뚜껑) {
    상한에걸림 = true;
    한줄.왜 = '하루 상한 ' + 하루뚜껑 + '건에 걸렸습니다';
    continue;
  }

  /* ★ 2026-10-21 — **주소를 바로잡고 받습니다** (tools/첨부주소고치기.mjs).
     능력시험에서 「HTML 이 옴」 12건이 거의 다 **잘못된 주소 줄**이었습니다 —
     상세 쪽 주소 · 빈 열쇠 · 서버 파일 경로 · 알리오 opendata 내려받기. */
  /* ★ 2026-10-21 — **클린아이는 두 걸음으로 받습니다** (tools/cleaneye-file.mjs 한 자리).
   *   첨부 주소가 **공고 화면 주소**라 그냥 받으면 HTML 이 옵니다 —
   *   밤 바퀴 못받음 27건 가운데 **22건**이 그 꼴이었습니다.
   *     ① 그 화면에서 fn_FileDown('<UPLOAD>','<ORIGINAL>','<PATH>')
   *     ② POST /file/FileDownload.do  그 셋 + Referer
   *   통이 15건·2분이라 **10초 간격**을 지킵니다 (그 모듈의 기본간격). */
  let 받음클린아이 = null;
  if (/job[.]cleaneye[.]go[.]kr/.test(String(고른것.url || '') + ' ' + String(j.url || ''))) {
    const 쪽주소 = /ypCareersData[.]do/.test(String(고른것.url || '')) ? 고른것.url : (j.url || 고른것.url);
    const 지난c = Date.now() - (끝때.get('job.cleaneye.go.kr') || 0);
    if (지난c < 클린아이간격) await 자고(클린아이간격 - 지난c);
    끝때.set('job.cleaneye.go.kr', Date.now());
    const rc = await 클린아이첨부받기(쪽주소, { 다시: 0 });
    if (rc && rc.buf && rc.buf.length) {
      받음클린아이 = { buf: rc.buf };
      고른것.name = rc.이름 || 고른것.name || '공고문';
      클린아이셈.set('받음', (클린아이셈.get('받음') || 0) + 1);
    } else {
      const 왜c = String((rc && rc.왜) || '못 받음').slice(0, 44);
      클린아이셈.set(왜c, (클린아이셈.get(왜c) || 0) + 1);
      못받음++; 한줄.왜 = '클린아이 — ' + 왜c;
      못받음까닭.set(한줄.왜, (못받음까닭.get(한줄.왜) ?? 0) + 1);
      표시할것.push({ job_id: j.id, url: 고른것.url, 왜: 한줄.왜 });
      continue;
    }
  }

  /* ★ 2026-10-22 — **나라일터도 두 걸음입니다** (tools/gojobs-file.mjs 한 자리).
   *   첨부 주소가 `javascript:gfn_fileDown('이름','uuid','갈래')` 라서 담을 주소가
   *   없습니다. 그래서 첨부 줄에는 **쪽 주소**를 담아 두고(클린아이와 같은 꼴),
   *   받을 때 쪽을 다시 열어 그 쪽이 말하는 uuid 로 `POST /downFile.do` 합니다.
   *   원문으로 확인 — 304423 공고문 663,103바이트 %PDF-1.4 (2026-10-22) */
  if (!받음클린아이 && /gojobs[.]go[.]kr/.test(String(고른것.url || '') + ' ' + String(j.url || ''))) {
    const 쪽주소 = /apmView[.]do/.test(String(고른것.url || '')) ? 고른것.url : (j.url || 고른것.url);
    const 지난g = Date.now() - (끝때.get('www.gojobs.go.kr') || 0);
    if (지난g < 나라일터간격) await 자고(나라일터간격 - 지난g);
    끝때.set('www.gojobs.go.kr', Date.now());
    const rg = await 나라일터첨부받기(쪽주소);
    if (rg && rg.buf && rg.buf.length) {
      받음클린아이 = { buf: rg.buf };          /* 아래 길을 그대로 씁니다 */
      고른것.name = rg.이름 || 고른것.name || '공고문';
      나라일터셈.set('받음', (나라일터셈.get('받음') || 0) + 1);
    } else {
      const 왜g = String((rg && rg.왜) || '못 받음').slice(0, 44);
      나라일터셈.set(왜g, (나라일터셈.get(왜g) || 0) + 1);
      못받음++; 한줄.왜 = '나라일터 — ' + 왜g;
      못받음까닭.set(한줄.왜, (못받음까닭.get(한줄.왜) ?? 0) + 1);
      표시할것.push({ job_id: j.id, url: 고른것.url, 왜: 한줄.왜 });
      continue;
    }
  }

  const 고친 = 고친주소(고른것.url, j.url || '');
  if (!받음클린아이 && 고친.받는법 && 고친.받는법.꼴 === 'POST못함') {
    못받음++; 한줄.왜 = 고친.받는법.왜;
    못받음까닭.set(한줄.왜, (못받음까닭.get(한줄.왜) ?? 0) + 1);
    continue;                                  /* 읽음 표시도 안 남깁니다 — 길이 생기면 다시 봅니다 */
  }
  if (!받음클린아이 && 고친.버릴것) {
    못받음++; 한줄.왜 = '주소를 버렸습니다 — ' + 고친.왜;
    못받음까닭.set(한줄.왜, (못받음까닭.get(한줄.왜) ?? 0) + 1);
    표시할것.push({ job_id: j.id, url: 고른것.url, 왜: 한줄.왜 });
    continue;
  }
  if (고친.url !== 고른것.url) 고침셈.set(고친.왜 || '고침', (고침셈.get(고친.왜 || '고침') || 0) + 1);
  const 받음 = 받음클린아이 || await 틈두고받기(고친.url, 고친.받는법);
  if (받음.왜) {
    못받음++; 한줄.왜 = 받음.왜;
    못받음까닭.set(받음.왜, (못받음까닭.get(받음.왜) ?? 0) + 1);
    표시할것.push({ job_id: j.id, url: 고른것.url, 왜: 받음.왜 });
    continue;
  }
  const buf = 받음.buf;

  const k = await 첨부읽기(buf, 고른것.name || '공고문');
  초합 += k.초 || 0;
  if (!k.글) {
    빈손++; 한줄.왜 = k.왜 || '빈손';
    빈손까닭.set(한줄.왜, (빈손까닭.get(한줄.왜) ?? 0) + 1);
    표시할것.push({ job_id: j.id, url: 고른것.url, 왜: 한줄.왜 });
    continue;
  }
  읽음++;
  표시할것.push({ job_id: j.id, url: 고른것.url, 왜: '' });

  const 칸 = 칸뽑기(k.md, k.글);
  const 내직군인원 = j.job_group ? 칸.모집인원?.[j.job_group] : null;

  /* 무엇이 새로 채워지나 */
  const 채울것 = 한줄.채울것;
  if (지금빈.has('모집인원') && !잠김.has('headcount') && 내직군인원 != null) 채울것.모집인원 = 내직군인원;
  if (지금빈.has('마감시각') && !잠김.has('apply_to_time') && 칸.접수시각) 채울것.마감시각 = 칸.접수시각;
  if (지금빈.has('근무지') && !잠김.has('work_place') && 칸.근무지) 채울것.근무지 = 칸.근무지;
  if (지금빈.has('지원자격') && 칸.지원자격) 채울것.지원자격 = 칸.지원자격;
  if (지금빈.has('예상연봉') && 칸.예상연봉) 채울것.예상연봉 = 칸.예상연봉;

  if (Object.keys(채울것).length) {
    보낼줄.push({ j, 칸, 채울것, 내직군인원, 파일: 고른것.name || '' });
    if (견본.length < 견본수) {
      견본.push({ id: j.id, 기관: j.org_name, 제목: String(j.title).slice(0, 48),
        직군: j.job_group || '(없음)', 파일: (고른것.name || '').slice(0, 56),
        채울것, 근거: 칸.근거 });
    }
  }
}

/* ★ 고리를 다 돈 까닭 — 끝남 한 줄에 실립니다 */
끝.까닭 = 바퀴중단인가()
  ? ('워커를 못 거둬 바퀴를 멈췄습니다 — ' + 바퀴중단인가())
  : 상한에걸림 ? ('하루 상한 ' + 하루뚜껑 + '건에 걸렸습니다')
    : ('볼 것 ' + 볼것.length + '건을 다 봤습니다');

const 전 = {}; const 후 = {};
for (const k of 칸이름) {
  전[k] = 잰것.filter((x) => !x.지금빈.has(k)).length;
  후[k] = 잰것.filter((x) => !x.지금빈.has(k) || x.채울것[k] != null).length;
}

console.log('\n── 읽기 ─────────────────────────────────────────');
console.log('  kordoc 읽음 ' + 읽음 + ' · 빈손 ' + 빈손 + ' · 못 받음 ' + 못받음
  + ' · 걸린 시간 합 ' + Math.round(초합 * 10) / 10 + '초');
console.log('  하루 상한 ' + (오늘읽어본수 + 표시할것.length) + '/' + 하루뚜껑
  + ' (오늘 이미 ' + 오늘읽어본수 + '건)' + (상한에걸림 ? '  ★ 상한에 걸려 멈췄습니다' : ''));
/* 「몇 건 왔다」만 찍는 진단은 쓸모없습니다 (지침 2절) — 까닭을 적습니다 */
for (const [왜, n] of [...빈손까닭].sort((a, b) => b[1] - a[1])) {
  console.log('     빈손 ' + String(n).padStart(3) + '건  ' + 왜);
}
for (const [왜, n] of [...못받음까닭].sort((a, b) => b[1] - a[1])) {
  console.log('   못받음 ' + String(n).padStart(3) + '건  ' + 왜);
}
for (const [왜, n] of [...고침셈].sort((a, b) => b[1] - a[1])) {
  console.log('   주소고침 ' + String(n).padStart(3) + '건  ' + 왜);
}
if (nonce새로) console.log('   그누보드 nonce 새로 읽음 ' + nonce새로 + '건');
if (나라일터셈.size) {
  console.log('   나라일터 두 걸음 — ' + [...나라일터셈].map(([k, v]) => k + ' ' + v).join(' · ').slice(0, 150));
}
if (클린아이셈.size) {
  console.log('   클린아이 두 걸음 — ' + [...클린아이셈].map(([k, v]) => k + ' ' + v).join(' · ').slice(0, 150));
}
if (셈쿠키.size) {
  console.log('   상세 쿠키 — ' + [...셈쿠키].map(([h, v]) => h + ' ' + v).join(' · ').slice(0, 160));
}
if (멈춘사이트.size) {
  console.log('  ★ 멈춘 사이트 ' + 멈춘사이트.size + '곳 — ' +
    [...멈춘사이트].map(([h, 왜]) => h + '(' + 왜 + ')').join(' · '));
}

console.log('\n── 칸별 채움률 (대상 ' + 볼것.length + '건) ──');
console.log('  칸          전        →  후');
for (const k of 칸이름) {
  const p = (n) => String(Math.round(100 * n / Math.max(1, 볼것.length))).padStart(3) + '%';
  console.log('  ' + k.padEnd(10) + p(전[k]) + ' (' + String(전[k]).padStart(3) + ')  →'
    + p(후[k]) + ' (' + String(후[k]).padStart(3) + ')');
}

console.log('\n── 견본 — 원문 근거 ↔ 채울 값 ────────────────────');
for (const s of 견본) {
  console.log('\n  ' + s.id + '  ' + s.기관 + '  [' + s.직군 + ']');
  console.log('    제목  ' + s.제목);
  console.log('    파일  ' + s.파일);
  for (const [k, v] of Object.entries(s.채울것)) {
    console.log('    ' + k.padEnd(8) + ' → ' + JSON.stringify(v).slice(0, 150));
    const 근거열쇠 = k === '모집인원' ? ('모집인원.' + s.직군) : (k === '마감시각' ? '접수시각' : k);
    if (s.근거[근거열쇠]) console.log('             근거  ' + String(s.근거[근거열쇠]).slice(0, 150));
  }
}

if (!진짜) {
  console.log('\n[마른] 담을 수 있는 공고 ' + 보낼줄.length + '건. 담으려면 --진짜');
  끝.까닭 = 상한에걸림 ? '하루 상한에 걸렸습니다 (마른 실행)' : '마른 실행이라 담지 않았습니다';
  process.exit(0);
}

/* ── 진짜로 담기 ────────────────────────────────────────────
   `updated_at` 을 안 바꾸려고 **창구 하나**로 보냅니다.
   그 창구(`칸되메우기`)가 없으면 여기서 멈춥니다 — 표를 직접 안 씁니다 */
console.log('\n담습니다 — ' + 보낼줄.length + '건');
const 줄들 = 보낼줄.map(({ j, 칸, 채울것, 내직군인원 }) => ({
  id: j.id,
  ...(채울것.모집인원 != null ? { headcount: 내직군인원 } : {}),
  ...(채울것.마감시각 ? { apply_to_time: 칸.접수시각 } : {}),
  ...(채울것.근무지 ? { work_place: 칸.근무지 } : {}),
  detail: { ...(j.detail || {}),
    ...(채울것.지원자격 ? { 지원자격: 칸.지원자격 } : {}),
    ...(채울것.예상연봉 ? { 연봉: 칸.예상연봉 } : {}) },
  뽑은값: {
    ...(칸.접수마감 ? { 공고문_접수마감: 칸.접수마감 } : {}),
    ...(칸.접수시각 ? { 공고문_접수시각: 칸.접수시각 } : {}),
    ...(Object.keys(칸.모집인원 || {}).length ? { 직군별인원: 칸.모집인원 } : {}),
    ...(칸.지원자격 ? { 지원자격: 칸.지원자격 } : {}),
    ...(칸.근무지 ? { 근무지: 칸.근무지 } : {}),
    ...(칸.예상연봉 ? { 예상연봉: 칸.예상연봉 } : {}),
    근거: 칸.근거 || {}, 읽은법: 'kordoc',
  },
}));
let 담음 = 0;
for (let i = 0; i < 줄들.length; i += 50) {
  const r = await fetch(cfg.SUPABASE_URL + '/rest/v1/rpc/' + encodeURIComponent('칸되메우기'), {
    method: 'POST',
    headers: { ...H, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_rows: 줄들.slice(i, i + 50) }),
  });
  const t = await r.text();
  if (!r.ok) {
    console.error('✗ 창구가 막혔습니다 — HTTP ' + r.status + ' · ' + t.slice(0, 300));
    console.error('  창구 `칸되메우기(p_rows jsonb)` 가 아직 없으면 먼저 만들어야 합니다.');
    console.error('  **표를 직접 쓰지 않습니다** (지침 — 창구로만).');
    끝.까닭 = '창구(칸되메우기)가 막혔습니다';
    process.exit(1);
  }
  try { 담음 += (JSON.parse(t) || {})['담음'] || 0; } catch { /* 모양이 다르면 그대로 */ }
}
끝.담음 = 담음;
console.log('담았습니다 — ' + 담음 + '건 (updated_at 은 안 바꿨습니다)');

/* ── 첨부 쪽에 「읽어 봤다」 를 남깁니다 — 표를 직접 안 씁니다 ──────────
   이 표시가 없으면 같은 파일을 날마다 다시 받고, 하루 상한도 못 겁니다 */
if (표시할것.length) {
  let 표시 = null;
  for (let i = 0; i < 표시할것.length; i += 100) {
    const r = await fetch(cfg.SUPABASE_URL + '/rest/v1/rpc/' + encodeURIComponent('첨부읽음표시'), {
      method: 'POST', headers: { ...H, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_rows: 표시할것.slice(i, i + 100) }),
    });
    const t = await r.text();
    if (!r.ok) {
      console.error('✗ 읽음 표시 창구가 막혔습니다 — HTTP ' + r.status + ' · ' + t.slice(0, 200));
      console.error('  창구 `첨부읽음표시(p_rows jsonb)` 가 아직 없으면 먼저 올려야 합니다');
      console.error('  (supabase/migrations/2026_10_18_첨부읽음표시_창구.sql)');
      break;
    }
    try { 표시 = JSON.parse(t); } catch { /* 모양이 다르면 그대로 */ }
  }
  if (표시) console.log('읽음 표시 — ' + JSON.stringify(표시));
}

/* 끝남 한 줄의 까닭을 마무리합니다 — 여기까지 왔으면 곱게 끝난 것입니다 */
끝.까닭 = 끝.까닭 + ' · 끝까지 돌았습니다';
