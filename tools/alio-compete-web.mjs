/* 알리오 **웹**에서 전형단계별 채용정보를 읽습니다 (2026-09-29).
 *
 *   node tools/alio-compete-web.mjs --dry --몇 5     5건만 받아 보고 안 담음
 *   node tools/alio-compete-web.mjs                  안 읽은 공고를 이어서 읽음
 *   node tools/alio-compete-web.mjs --분 30          30분까지만
 *   node tools/alio-compete-web.mjs --다시           이미 읽은 것도 다시
 *
 * ── 왜 API 를 안 쓰나 ─────────────────────────────────────
 * `/detail` 의 `steps` 가 **뒤쪽 단계를 비워 보냅니다.** 세중님이 근로복지공단
 * 공고 하나로 잡아내셨고, 연도별로 54건을 견줘 보니 이랬습니다.
 *
 *   sn 296899 근로복지 2026   API 6단계 전부 null    웹 1차 20/135 · 최종 4/19
 *   sn 264161 분당서울대 2023  API 1차만            웹 1차·2차·최종
 *   sn 262039 충남대   2023   API 1차·2차          웹 최종까지
 *
 * 2024~2026 표본 18건 중 12건이 「웹에만 있음」 이었고, 2018~2023 도 뒤쪽
 * 단계가 잘려 있었습니다. 그래서 **「2024년부터 기관이 결과를 안 올린다」 는
 * 틀린 결론이었습니다.** 기관은 올렸고 열린 자료에 안 실린 것입니다.
 *
 * ── 경쟁률 ────────────────────────────────────────────────
 * 웹이 「최종 경쟁률 33.75 대 1」 을 직접 적어 줍니다. 그걸 그대로 담고,
 * 없으면 첫 단계 응시 ÷ 마지막 단계 선발 로 냅니다 (웹이 쓰는 것과 같은 셈 —
 * 대조해 확인했습니다). 어느 쪽인지 `rt_src` 에 남깁니다. 지어내지 않습니다.
 *
 * robots.txt — job.alio.go.kr 은 비어 있고 www.alio.go.kr 은 Allow: / 입니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 웹읽기 } from './alio-web-check.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const SOURCE = 'AL2';
const 쉼 = (ms) => new Promise((y) => setTimeout(y, ms));

function env() {
  const out = {};
  for (const f of ['.env.local', '.env', 'web/.env.local'].map((x) => path.join(여기, '..', x))) {
    if (!fs.existsSync(f)) continue;
    fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((l) => {
      const m = l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*?)\s*$/); if (m && !out[m[1]]) out[m[1]] = m[2];
    });
  }
  Object.keys(process.env).forEach((k) => { if (process.env[k]) out[k] = process.env[k]; });
  out.SUPABASE_URL = out.SUPABASE_URL || out.NEXT_PUBLIC_SUPABASE_URL;
  out.SUPABASE_ANON_KEY = out.SUPABASE_ANON_KEY || out.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return out;
}
const cfg = env();

async function rpc(fn, body) {
  const k = cfg.SUPABASE_ANON_KEY;
  const r = await fetch(cfg.SUPABASE_URL + '/rest/v1/rpc/' + fn, {
    method: 'POST',
    headers: { apikey: k, Authorization: 'Bearer ' + k, 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(r.status + ' ' + t.slice(0, 250));
  return t ? JSON.parse(t) : null;
}

/* ── 직군 가리기 — tools/alio-compete.mjs 와 **같은 규칙** ──
   두 곳이 갈라지면 안 되므로 그대로 옮겨 둡니다. 고칠 때 둘 다 고칩니다. */
const 붙 = (s) => String(s || '').replace(/\s+/g, '');
function 직군가리기(이름) {
  const t = 붙(이름);
  const 물 = /물리치료/.test(t), 작 = /작업치료/.test(t);
  const 우리 = (물 && 작) ? '공통' : 물 ? '물리치료사' : 작 ? '작업치료사' : null;
  const 나열 = /[,，·ㆍ/]|또는|및/.test(String(이름 || ''));
  const 뭉뚱 = /일반직|공무직|기간제|계약직|업무지원|통합|전체|직원/.test(t) && !우리;
  return { 우리, 합쳐짐: 나열 || 뭉뚱 || (!우리 && !!이름) };
}

const 날 = (s) => {
  const m = String(s || '').match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
  return m ? m[1] + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0') : null;
};

/** 웹 묶음 하나 → 담을 줄들 */
function 줄만들기(sn, gi, g) {
  const 단계 = g.단계;
  if (!단계.length) return [];
  const 첫응시 = 단계[0].응시 ?? null;
  const 끝선발 = 단계[단계.length - 1].선발 ?? null;
  const j = 직군가리기(g.이름);

  /* 경쟁률 — 웹이 적어 준 것이 먼저. 없으면 우리가 같은 셈으로 냅니다 */
  let 률 = null, 갈래, 출처 = null;
  if (끝선발 === 0) { 갈래 = '못냄'; }
  else if (g.경쟁률 != null) { 률 = g.경쟁률; 출처 = '웹'; 갈래 = 률 === 0 ? (첫응시 === 0 ? '진짜0' : '못냄') : '있음'; }
  else if (첫응시 != null && 끝선발) { 률 = Math.round((첫응시 / 끝선발) * 100) / 100; 출처 = '우리셈'; 갈래 = 률 === 0 ? '진짜0' : '있음'; }
  else 갈래 = '미등록';

  return 단계.map((s, i) => {
    const 끝인가 = i === 단계.length - 1;
    return {
      sn, group_no: gi, step_no: i,
      group_name: g.이름, step_name: s.구분,
      recrut_nope: s.선발, aply_nope: s.응시, rsn_ymd: 날(s.확정일),
      is_last: 끝인가, group_steps: 단계.length,
      first_aply: 첫응시, final_nope: 끝선발,
      cmptt_rt: 끝인가 ? 률 : null,
      cmptt_rt_state: 끝인가 ? 갈래 : '해당없음',
      rt_src: 끝인가 ? 출처 : null,
      our_job: j.우리, mixed: j.합쳐짐,
    };
  });
}

/* ── 본체 ── */
const argv = process.argv.slice(2);
const dry = argv.includes('--dry');
const 다시 = argv.includes('--다시');
const 뽑 = (이름, 기본) => (argv.includes(이름) ? Number(argv[argv.indexOf(이름) + 1]) || 기본 : 기본);
const 시간예산 = 뽑('--분', 40) * 60000;
const 몇개 = 뽑('--몇', 0);
const 간격 = 뽑('--간격', 600);
const t0 = Date.now();

if (!cfg.COLLECT_KEY_AL2) { console.error('COLLECT_KEY_AL2 가 없습니다'); process.exit(1); }

let 할것 = await rpc(다시 ? 'alio_compete_web_all' : 'alio_compete_web_todo',
  { p_secret: cfg.COLLECT_KEY_AL2, p_source: SOURCE, p_limit: 5000 }).catch(async (e) => {
    if (!다시) throw e;
    return rpc('alio_compete_web_todo', { p_secret: cfg.COLLECT_KEY_AL2, p_source: SOURCE, p_limit: 5000 });
  });
if (몇개) 할것 = 할것.slice(0, 몇개);

console.log('알리오 웹 전형단계 읽기 — 할 것 ' + 할것.length + '건 · '
  + Math.round(시간예산 / 60000) + '분까지 · ' + 간격 + 'ms 간격' + (dry ? ' · --dry' : ''));

const 셈 = { 읽음: 0, 줄: 0, 묶음: 0, 값있음: 0, 빈표: 0, 못읽음: 0 };
let 담을것 = [];
const 담기 = async () => {
  while (담을것.length >= 300) {
    const 묶 = 담을것.splice(0, 300);
    await rpc('alio_compete_web_put', { p_secret: cfg.COLLECT_KEY_AL2, p_source: SOURCE, p_rows: 묶 });
  }
};

for (const c of 할것) {
  if (Date.now() - t0 > 시간예산) { console.log('시간이 다 됐습니다 — 다음 실행이 이어갑니다'); break; }
  const w = await 웹읽기(c.sn);
  셈.읽음++;
  if (w.왜) {
    셈.못읽음++;
    담을것.push({ sn: c.sn, 왜: w.왜, 묶음수: 0 });
  } else if (!w.묶음.length || !w.묶음.some((g) => g.단계.length)) {
    셈.빈표++;
    담을것.push({ sn: c.sn, 왜: '전형단계 표가 비어 있습니다', 묶음수: w.묶음.length });
  } else {
    w.묶음.forEach((g, gi) => {
      const 줄 = 줄만들기(c.sn, gi, g);
      if (!줄.length) return;
      셈.묶음++;
      if (줄[줄.length - 1].cmptt_rt_state === '있음') 셈.값있음++;
      담을것.push(...줄); 셈.줄 += 줄.length;
    });
    담을것.push({ sn: c.sn, 묶음수: w.묶음.length, 왜: null });
  }
  if (!dry) await 담기();
  if (셈.읽음 % 100 === 0) {
    console.log('  ' + 셈.읽음 + '/' + 할것.length + '건 · 묶음 ' + 셈.묶음
      + ' · 값 있음 ' + 셈.값있음 + ' · 빈 표 ' + 셈.빈표 + ' · 못 읽음 ' + 셈.못읽음
      + ' · ' + Math.round((Date.now() - t0) / 1000) + '초');
  }
  await 쉼(간격);
}

if (!dry && 담을것.length) {
  for (let i = 0; i < 담을것.length; i += 300) {
    await rpc('alio_compete_web_put', { p_secret: cfg.COLLECT_KEY_AL2, p_source: SOURCE,
      p_rows: 담을것.slice(i, i + 300) });
  }
}

console.log('\n── 읽음 ' + 셈.읽음 + '건 · 묶음 ' + 셈.묶음 + ' · 줄 ' + 셈.줄
  + ' · 경쟁률 값 있음 ' + 셈.값있음 + ' · 빈 표 ' + 셈.빈표 + ' · 못 읽음 ' + 셈.못읽음
  + ' · ' + Math.round((Date.now() - t0) / 1000) + '초');
if (dry) console.log('   --dry 라 담지 않았습니다');
