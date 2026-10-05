/* 알리오 예전 경쟁률 모으기 (2026-09-29).
 *
 *   node tools/alio-compete.mjs --dry        받아만 보고 안 담습니다
 *   node tools/alio-compete.mjs              담습니다 (어디까지 했는지 기억합니다)
 *   node tools/alio-compete.mjs --분 20      이번에 20분까지만
 *   node tools/alio-compete.mjs --처음부터    기억을 지우고 1쪽부터
 *
 * ⚠ **화면에는 아직 안 붙입니다.** 모으기만 합니다 (세중님 지시).
 *
 * ── 어떻게 찾나 ───────────────────────────────────────────
 * 마감 공고가 **113,751건 · 1,138쪽**입니다. 다 긁으면 며칠 걸립니다.
 * 그런데 `/list` 에 **제목 검색(recrutPbancTtl)** 이 됩니다 —
 *   「물리치료사」 405건 · 「작업치료사」 289건
 * 제목에 그 말이 든 것만 정확히 옵니다 (1쪽 100건 전부 맞았습니다).
 * 그래서 「뽑을 단어」 ①②로 찾습니다. 1,138쪽을 다 볼 까닭이 없습니다.
 *
 * ── 어디까지 갔나 ─────────────────────────────────────────
 * 800쪽이 2020-07 ~ 2020-12 입니다. **2020년까지** 거슬러 갑니다.
 *
 * ── 하루 한도 ─────────────────────────────────────────────
 * 공공데이터포털은 열쇠마다 하루 한도가 있습니다. 한 번에 `--분` 만큼만 돌고
 * 어디까지 했는지 DB(alio_compete_state)에 적어 둡니다. 다음 실행이 이어갑니다.
 *
 * ── 0 을 함부로 세지 않습니다 ─────────────────────────────
 *   있음    진짜 숫자
 *   미등록   null · 또는 0 인데 결과 확정일이 없음
 *   진짜0    0 인데 결과 확정일이 있음
 * 모르면 모른다고 남깁니다. 숫자를 지어내지 않습니다.
 */
import fs from 'node:fs';
import { 공공부르기 } from './공공데이터부르기.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 확정, 가능성 } from './뽑을단어.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const SOURCE = 'AL2';                       // 열쇠는 알리오 경로 것을 씁니다
const 목록URL = 'https://apis.data.go.kr/1051000/recruitment/list';
const 상세URL = 'https://apis.data.go.kr/1051000/recruitment/detail';

/* 찾을 말 — 「뽑을 단어」 ①②에서 **제목에 실제로 쓰이는 것**만.
   「아동」 「요가」 같은 것은 병원 공고 제목에 거의 안 나오고 딴 것이 잔뜩 걸립니다.
   그래서 직군 이름 쪽만 씁니다. 늘리려면 여기 한 줄 더하면 됩니다. */
export const 찾을말 = [
  ...확정,                                   // 물리치료사 · 작업치료사 · 도수치료 · 작업치료 · 물리치료
  '재활치료', '재활치료실', '의료기술직', '의료기사', '보건직',
].filter((v, i, a) => a.indexOf(v) === i);

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
  /* 집 컴퓨터에서는 gas 안의 열쇠를 빌립니다. 서버에는 환경변수로 옵니다 */
  const gas = path.join(여기, '..', 'gas', 'wage.js');
  if (fs.existsSync(gas)) {
    const src = fs.readFileSync(gas, 'utf8');
    out.ALIO_DETAIL_KEY = out.ALIO_DETAIL_KEY
      || (src.match(/const JOB3_API = \{[\s\S]*?KEY:\s*'([^']+)'/) || [])[1] || '';
  }
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
const 쉼 = (ms) => new Promise((y) => setTimeout(y, ms));

/* 간격 · 429 재시도 · 하루 한도 가리기는 공공데이터부르기.mjs 한 곳에 있습니다.
   전에는 여기서 세 번 다시 했는데, 429 를 「너무 빨리」 와 「하루 한도」 로
   가르지 못해 한도가 끝난 뒤에도 2초씩 헛되이 기다렸습니다 (2026-09-30) */
async function 받기(u) {
  const r = await 공공부르기(u);
  if (r.code !== 200) return { 왜: (r.왜 || ('HTTP ' + r.code)) + ' · ' + r.글.slice(0, 160), 한도끝: r.한도끝 };
  try { return { j: JSON.parse(r.글) }; } catch { return { 왜: 'JSON 이 아닙니다 · ' + r.글.slice(0, 160) }; }
}

/* ── 값이 있는지, 미등록인지, 진짜 0 인지 ── */
function 어떻게봤나(v, 확정일) {
  if (v === null || v === undefined || v === '') return { 값: null, 봄: '미등록' };
  if (Number(v) === 0) return { 값: 0, 봄: 확정일 ? '진짜0' : '미등록' };
  return { 값: Number(v), 봄: '있음' };
}

/* ── 경쟁률 0 은 세 가지가 섞여 있습니다 (2026-09-29 에 934건을 갈라 봤습니다) ──
 *
 *   정규직 물리치료사   첫지원 43 · 끝선발 0 · cmpttRt 0
 *
 * 43명이 지원했는데 **뽑은 사람이 0명** 입니다. 43 ÷ 0 은 나눌 수가 없어
 * 알리오가 칸에 0 을 적어 둔 것입니다. 「아무도 안 왔다」 로 보여 주면 거꾸로입니다.
 * 934건 중 **933건이 이 경우**였고, 진짜로 아무도 안 온 것은 **1건**이었습니다.
 *
 *   있음      진짜 경쟁률
 *   못냄      끝선발이 0 — 나눌 수가 없음 (뽑지 않았거나 취소)
 *   진짜0     첫지원이 0 — 아무도 안 옴
 *   미등록    값이 비었거나, 0 인데 결과 확정일이 없음
 *   해당없음   중간 단계. 경쟁률은 묶음의 마지막에만 붙습니다
 *
 * 모르면 모른다고 남깁니다. 숫자를 지어내지 않습니다. */
function 경쟁률봤나(v, 확정일, 첫지원, 끝선발) {
  if (끝선발 === 0) return { 값: null, 봄: '못냄' };
  if (v === null || v === undefined || v === '') return { 값: null, 봄: '미등록' };
  if (Number(v) !== 0) return { 값: Number(v), 봄: '있음' };
  if (!확정일) return { 값: 0, 봄: '미등록' };
  return { 값: 0, 봄: 첫지원 === 0 ? '진짜0' : '못냄' };
}

/* ── cmpttRt 가 무엇인지 (2026-09-29 에 원문을 찍어 알아낸 것) ──
 *
 * 처음에 「그 단계의 경쟁률」 인 줄 알았습니다. **아닙니다.**
 *
 *   근로복지공단 sn 303793 · 공무직(물리치료사)
 *     1차  선발 26 · 지원 115 · cmpttRt null
 *     2차  선발  5 · 지원  17 · cmpttRt 23     ← 17/5 도 115/26 도 아님
 *
 *   115 ÷ 5 = 23 입니다.
 *
 * **cmpttRt = 첫 단계 지원자 ÷ 마지막 단계 선발 인원** — 공고 전체 경쟁률입니다.
 * 9개 묶음으로 맞춰 보니 9개 다 딱 맞았습니다 (소수점 아래 반올림).
 * 그래서 마지막 단계에만 붙습니다. 중간 단계의 null 은 「미등록」이 아니라
 * **「해당 없음」** 입니다. 섞으면 미등록 수가 부풀려집니다.
 *
 * ── 묶음은 sortNo 가 아니라 minStepSn~maxStepSn 입니다 ──
 * 한 공고에 직군이 여럿이면 각 직군이 제 단계 사슬을 가집니다.
 *   1241822~1241823  물리치료사 (1차 → 최종)
 *   1241824~1241825  작업치료사
 *   1241826~1241827  언어치료사
 * `steps` 배열의 맨 끝 하나만 「마지막」으로 보면 물리·작업치료사의 최종 단계를
 * 놓칩니다. minStepSn 으로 묶고, recrutStepSn === maxStepSn 이 그 묶음의 마지막입니다. */
function 묶기(steps) {
  const 묶음 = new Map();
  for (const s of steps) {
    const k = s.minStepSn ?? s.recrutStepSn;
    if (!묶음.has(k)) 묶음.set(k, []);
    묶음.get(k).push(s);
  }
  return 묶음;
}

/* ── 단계 이름이 우리 직군만인가, 여럿이 합쳐진 것인가 ── */
const 붙 = (s) => String(s || '').replace(/\s+/g, '');

/* ★ 다른 면허 직군 이름이 같이 적힌 것은 **우리 것으로 주장하지 않습니다** (2026-10-05).
   경상국립대 sn 262387 「치과기공사(물리치료사)」 — 우리 말이 들어 있어 물리치료사로
   찍혔는데 자리 이름은 「치과기공사」로 남았습니다. 그대로 두면 치과기공사
   경쟁률(30 대 1)이 물리치료사 평균에 섞여 회원에게 나갑니다.
   ★ 「사회복지직」처럼 **…직(직군 묶음 이름)** 은 해당 없습니다 —
     김해보훈요양원 「사회복지직(물리치료사)」 는 원문으로 확인한 진짜 물리치료사 자리입니다.
   ★ 「의사」는 목록에서 뺐습니다 — 「의사소통」 같은 말에 걸립니다.
   ★ 자료 16,533줄에 걸어 보니 걸리는 묶음이 이 하나뿐입니다 (엉뚱한 것 0건). */
const 다른면허직군 = /치과기공사|치과위생사|임상병리사|방사선사|간호조무사|간호사|사회복지사|영양사|약사|언어재활사|응급구조사|보건의료정보관리사|조리사|운동처방사|안경사|의무기록사|위생사/;

function 직군가리기(단계이름) {
  const t = 붙(단계이름);
  const 물 = /물리치료/.test(t), 작 = /작업치료/.test(t);
  let 우리 = (물 && 작) ? '공통' : 물 ? '물리치료사' : 작 ? '작업치료사' : null;
  const 남의것 = !!우리 && 다른면허직군.test(t.replace(/물리치료사|작업치료사|물리치료|작업치료/g, ''));
  if (남의것) 우리 = null;
  /* 여럿이 합쳐진 표시 — 나열했거나, 우리 말이 없는데 뭉뚱그린 이름.
     ⚠ 「간호사 또는 물리치료사 또는 작업치료사」 는 쉼표가 없어도 합쳐진 것입니다.
       2026-09-29 에 5건이 「공통」 으로만 찍혀 있어 「또는·및·/」 를 더했습니다. */
  const 나열 = /[,，·ㆍ/]|또는|및/.test(String(단계이름 || ''));
  const 뭉뚱 = /일반직|공무직|기간제|계약직|업무지원|통합|전체|직원/.test(t) && !우리;
  return { 우리, 합쳐짐: 나열 || 뭉뚱 || (!우리 && !!단계이름) };
}

/* ── 본체 ── */
const argv = process.argv.slice(2);
const dry = argv.includes('--dry');
const 처음부터 = argv.includes('--처음부터');
const 시간예산 = (argv.includes('--분') ? Number(argv[argv.indexOf('--분') + 1]) || 15 : 15) * 60000;
const t0 = Date.now();

if (!cfg.ALIO_DETAIL_KEY) { console.error('ALIO_DETAIL_KEY 가 없습니다'); process.exit(1); }
if (!dry && !cfg.COLLECT_KEY_AL2) { console.error('COLLECT_KEY_AL2 가 없습니다'); process.exit(1); }

console.log('알리오 경쟁률 모으기 — 찾을 말 ' + 찾을말.length + '개 · 이번 실행 '
  + Math.round(시간예산 / 60000) + '분까지' + (dry ? ' · --dry' : ''));
console.log('  ' + 찾을말.join(' · '));

/* 어디까지 했는지 */
let 기억 = [];
if (!dry) {
  try { 기억 = await rpc('alio_compete_state_get', { p_secret: cfg.COLLECT_KEY_AL2, p_source: SOURCE }) || []; }
  catch (e) { console.error('  기억을 못 읽었습니다 · ' + String(e.message).slice(0, 120)); }
}
const 기억집 = new Map(기억.map((x) => [x.말, x]));
if (처음부터) 기억집.clear();

/* ⚠ toISOString() 은 UTC 라 한국 아침에 어제 날짜가 찍힙니다. 서울로 봅니다 */
const 오늘 = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });

const 셈 = { 목록: 0, 상세: 0, 줄: 0, 공고: 0, 못받음: 0 };
const 담을것 = [];

for (const 말 of 찾을말) {
  const 앞 = 기억집.get(말);
  if (앞 && 앞.다한날) { console.log('\n「' + 말 + '」 — 이미 다 했습니다 (' + 앞.다한날 + ')'); continue; }
  let 쪽 = 앞 ? 앞.다음쪽 : 1;
  let 전체 = 앞 ? 앞.전체쪽 : null;
  console.log('\n「' + 말 + '」 — ' + 쪽 + '쪽부터');

  for (; ; 쪽++) {
    if (Date.now() - t0 > 시간예산) { console.log('   시간이 다 됐습니다 — 다음 실행이 ' + 쪽 + '쪽부터 잇습니다'); break; }
    const L = await 받기(목록URL + '?serviceKey=' + cfg.ALIO_DETAIL_KEY
      + '&numOfRows=100&pageNo=' + 쪽 + '&resultType=json&ongoingYn=N&recrutPbancTtl=' + encodeURIComponent(말));
    if (L.왜) { console.log('   ' + 쪽 + '쪽 못 받음 · ' + L.왜); 셈.못받음++; break; }
    셈.목록++;
    const 것 = L.j.result || [];
    if (전체 == null && L.j.totalCount != null) 전체 = Math.ceil(L.j.totalCount / 100);
    if (!것.length) {
      console.log('   ' + 쪽 + '쪽이 비었습니다 — 다 했습니다');
      if (!dry) await rpc('alio_compete_state_put', { p_secret: cfg.COLLECT_KEY_AL2, p_source: SOURCE,
        p_말: 말, p_다음쪽: 쪽, p_전체쪽: 전체, p_다한날: 오늘(), p_메모: null });
      break;
    }

    /* ⚠ 쪽을 **끝까지 다 봤을 때만** 다음 쪽으로 넘깁니다.
       시간이 다 돼서 쪽 한가운데서 멈췄는데 「다음쪽 = 쪽+1」 로 적으면
       그 쪽의 남은 공고가 **영영 안 들어옵니다.** 이 프로젝트는 빠지면 안 됩니다.
       다시 받으면 앞부분이 겹치지만, 담는 함수가 덮어쓰기라 겹쳐도 탈이 없습니다. */
    let 쪽끝까지 = true;
    for (const c of 것) {
      if (Date.now() - t0 > 시간예산) { 쪽끝까지 = false; break; }
      const D = await 받기(상세URL + '?serviceKey=' + cfg.ALIO_DETAIL_KEY
        + '&resultType=json&sn=' + c.recrutPblntSn);
      셈.상세++;
      if (D.왜) { 셈.못받음++; await 쉼(200); continue; }
      const 몸 = Array.isArray(D.j.result) ? D.j.result[0] : (D.j.result || D.j);
      const steps = 몸?.steps || [];
      if (!steps.length) { await 쉼(180); continue; }
      셈.공고++;
      const 끝 = String(c.pbancEndYmd || '');
      const 날 = (v) => (v && String(v).length === 8
        ? String(v).slice(0, 4) + '-' + String(v).slice(4, 6) + '-' + String(v).slice(6) : null);
      for (const [묶음키, g] of 묶기(steps)) {
        const 첫 = g[0], 마지막 = g[g.length - 1];
        g.forEach((s, i) => {
          const 확정일 = s.rsnOcrnYmd ? String(s.rsnOcrnYmd) : null;
          const 끝단계 = (s.recrutStepSn === (s.maxStepSn ?? 마지막.recrutStepSn)) || i === g.length - 1;
          const a = 어떻게봤나(s.recrutNope, 확정일);
          const b = 어떻게봤나(s.aplyNope, 확정일);
          /* 경쟁률은 마지막 단계에만 붙습니다. 중간 단계는 「해당없음」 */
          const cc = 끝단계
            ? 경쟁률봤나(s.cmpttRt, 확정일, 첫.aplyNope ?? null, 마지막.recrutNope ?? null)
            : { 값: null, 봄: '해당없음' };
          const j = 직군가리기(s.recrutPbancTtl);
          담을것.push({
            sn: c.recrutPblntSn, step_sn: s.recrutStepSn,
            inst_nm: c.instNm, pbanc_ttl: c.recrutPbancTtl, step_ttl: s.recrutPbancTtl,
            end_ymd: 날(끝), year: 끝.length === 8 ? Number(끝.slice(0, 4)) : null,
            sort_no: s.sortNo ?? null, step_order: i, is_last: 끝단계,
            group_key: 묶음키, group_steps: g.length,
            /* 경쟁률의 분모·분자 — 「115명이 지원해 5명 뽑음 = 23:1」 로 보여 주려고 같이 담습니다 */
            first_aply: 첫.aplyNope ?? null, final_nope: 마지막.recrutNope ?? null,
            recrut_nope: a.값, recrut_nope_state: a.봄,
            aply_nope: b.값, aply_nope_state: b.봄,
            cmptt_rt: cc.값, cmptt_rt_state: cc.봄,
            rsn_ymd: 날(확정일),
            our_job: j.우리, mixed: j.합쳐짐, raw: s,
          });
          셈.줄++;
        });
      }
      await 쉼(180);
    }

    if (!dry) {
      /* 100줄씩 담고 어디까지 했는지 적습니다 — 중간에 끊겨도 이어갑니다 */
      while (담을것.length >= 200) {
        const 묶음 = 담을것.splice(0, 200);
        await rpc('alio_compete_put', { p_secret: cfg.COLLECT_KEY_AL2, p_source: SOURCE, p_rows: 묶음 });
      }
      await rpc('alio_compete_state_put', { p_secret: cfg.COLLECT_KEY_AL2, p_source: SOURCE,
        p_말: 말, p_다음쪽: 쪽끝까지 ? 쪽 + 1 : 쪽, p_전체쪽: 전체, p_다한날: null, p_메모: null });
    }
    console.log('   ' + 쪽 + '/' + (전체 ?? '?') + '쪽 · 공고 ' + 셈.공고 + ' · 단계 ' + 셈.줄
      + (쪽끝까지 ? '' : '  (쪽 한가운데서 멈춤 — 이 쪽을 다시 받습니다)'));
    if (!쪽끝까지) break;
    if (전체 && 쪽 >= 전체) {
      if (!dry) await rpc('alio_compete_state_put', { p_secret: cfg.COLLECT_KEY_AL2, p_source: SOURCE,
        p_말: 말, p_다음쪽: 쪽 + 1, p_전체쪽: 전체, p_다한날: 오늘(), p_메모: null });
      console.log('   다 했습니다 (' + 전체 + '쪽)');
      break;
    }
  }
  if (Date.now() - t0 > 시간예산) break;
}

let 담음 = 0;
if (!dry && 담을것.length) {
  for (let i = 0; i < 담을것.length; i += 200) {
    const r = await rpc('alio_compete_put', { p_secret: cfg.COLLECT_KEY_AL2, p_source: SOURCE, p_rows: 담을것.slice(i, i + 200) });
    담음 += r['담음'] || 0;
  }
}
/* 묶음(직군) 칸을 raw 에서 다시 채웁니다 — API 를 다시 두드리지 않습니다.
   담는 함수는 한 줄씩 보므로 「묶음의 마지막이 어디인지」를 모릅니다. 다 담은 뒤에 한 번에 셉니다. */
if (!dry) {
  const f = await rpc('alio_compete_fix', { p_secret: cfg.COLLECT_KEY_AL2, p_source: SOURCE });
  console.log('\n묶음 고침 ' + f['고침'] + '줄 · 직군 묶음 ' + f['묶음']
    /* ★ 열쇠 이름은 「있음」입니다 — 「경쟁률값있음」을 읽어 undefined 가 찍혔습니다.
       alio_compete_fix 가 돌려주는 것은 고침·묶음·있음·미등록·진짜0·못냄·안맞음 입니다 */
    + ' · 경쟁률 값 있음 ' + f['있음']
    + ' · 우리 계산과 안 맞음 ' + f['안맞음'] + (f['안맞음'] ? '  ⚠' : ''));
}

console.log('\n── 목록 ' + 셈.목록 + '쪽 · 상세 ' + 셈.상세 + '건 · 공고 ' + 셈.공고
  + ' · 단계 ' + 셈.줄 + ' · 못 받음 ' + 셈.못받음
  + ' · ' + Math.round((Date.now() - t0) / 1000) + '초');
if (dry) console.log('   --dry 라 담지 않았습니다 (받은 줄 ' + 담을것.length + '개)');
