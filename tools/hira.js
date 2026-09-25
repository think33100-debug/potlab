/* ═══════════════════════════════════════════════════════════════
 *  심평원 자료 받기 — 요양기호(ykiho)와 기관 상세정보
 * ═══════════════════════════════════════════════════════════════
 *
 *  열쇠는 .env.local 에서 읽습니다 (저장소에 안 올라갑니다).
 *    SUPABASE_URL · SUPABASE_SERVICE_KEY      ← 저장소 맨 위 .env.local
 *    HIRA_KEY_ENC                             ← web/.env.local
 *
 *  쓰는 법
 *    node tools/hira.js orgs              전국 기관 목록 · 요양기호 (8번 요청)
 *    node tools/hira.js detail targets     목표 기관부터 (1,677곳 · 3,354번)
 *    node tools/hira.js detail rest        나머지
 *    node tools/hira.js detail all         전부
 *    node tools/hira.js quota              오늘 몇 번 썼는지
 *
 *  ── 꼭 지킬 것 ────────────────────────────────────────────────
 *  hospital_data.json 은 **지우지 않습니다.** 2026Q2 자료판이고,
 *  API 값이 이상할 때 견줄 기준입니다. 이 도구는 그 파일을 안 건드립니다.
 *  API 값은 hira_org · hira_detail 에 따로 쌓고, 화면이 골라 씁니다.
 *
 *  ── 한도 ──────────────────────────────────────────────────────
 *  하루 10,000번입니다. **자료 건수가 아니라 요청 횟수입니다**
 *  (13,005건을 받은 뒤에도 그대로 됐습니다 · 2026-09-25 확인).
 *  기관 하나에 3번 씁니다 — 시설정보 · 기타인력수 · 전문과목별 전문의.
 *  목록 조회가 없어서 하나씩 물어야 합니다. ykiho 없이 부르면 0줄입니다.
 *
 *  ── 끊겨도 이어갑니다 ─────────────────────────────────────────
 *  hira_detail 에 줄이 있으면 받은 것으로 봅니다. 다시 돌리면 없는 것만 받습니다.
 *  한도가 차면 멈추고, 어디까지 했는지 찍습니다.
 *
 *  ── 받을 차례는 여기서 안 정합니다 ────────────────────────────
 *  종별코드와 차례는 **hira_cl_cd 표 한 곳**에 있습니다. 이 파일은 코드를
 *  해석하지 않고 그대로 옮기기만 합니다. 차례를 바꾸려면 그 표의 「차례」
 *  칸만 고치면 됩니다 — 코드가 여기저기 박혀 있으면 또 짐작으로 고칩니다.
 *  (실제로 한 번 틀렸습니다: 51 을 한방병원으로 봤는데 치과의원 19,426곳)
 * ═══════════════════════════════════════════════════════════════ */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

/* ── 열쇠 ── */
function readEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  fs.readFileSync(file, 'utf8').split(/\r?\n/).forEach((l) => {
    const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^"|"$/g, '');
  });
  return out;
}
const cfg = { ...readEnv(path.join(ROOT, '.env.local')), ...readEnv(path.join(ROOT, 'web', '.env.local')) };
for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'HIRA_KEY_ENC']) {
  if (!cfg[k]) { console.error(`.env.local 에 ${k} 가 없습니다.`); process.exit(1); }
}

/* 심평원 열쇠는 **이미 URL 인코딩돼 있습니다.** 다시 인코딩하면 %2B 가 %252B 가 됩니다.
   그래서 URL 객체나 URLSearchParams 를 쓰지 않고 문자열로 이어 붙입니다 */
const HIRA_KEY = cfg.HIRA_KEY_ENC;
const ORG_API = 'https://apis.data.go.kr/B551182/hospInfoServicev2/getHospBasisList';
/* 주소 끝의 2.8 은 그대로 씁니다. 2_8 도 28 도 아닙니다 */
const DTL_API = 'https://apis.data.go.kr/B551182/MadmDtlInfoService2.8';

const SB = cfg.SUPABASE_URL.replace(/\/$/, '');
const SBH = {
  apikey: cfg.SUPABASE_SERVICE_KEY,
  Authorization: 'Bearer ' + cfg.SUPABASE_SERVICE_KEY,
  'Content-Type': 'application/json',
};

/* ── 요청 세기 ── 하루 10,000번이라 남은 것이 보여야 합니다 ── */
const LIMIT = 10000;
let used = 0;          // 이번에 쓴 것
let usedBefore = 0;    // 오늘 앞서 쓴 것

const today = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);  // 한국 날짜

async function loadQuota() {
  const r = await fetch(`${SB}/rest/v1/hira_quota?day=eq.${today()}&select=requests`, { headers: SBH });
  const j = await r.json();
  usedBefore = Array.isArray(j) && j[0] ? j[0].requests : 0;
}
async function saveQuota(note) {
  await fetch(`${SB}/rest/v1/hira_quota`, {
    method: 'POST',
    headers: { ...SBH, Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify([{ day: today(), requests: usedBefore + used, note: note || null }]),
  });
}
const left = () => LIMIT - usedBefore - used;

/* ── 심평원 부르기 ── */
async function hira(url) {
  used++;
  const r = await fetch(url);
  const t = await r.text();
  let j = null;
  try { j = JSON.parse(t); } catch { /* XML 로 왔거나 오류 */ }
  if (!j) return { rows: [], err: t.slice(0, 200) };
  const code = j?.response?.header?.resultCode;
  if (code !== '00') return { rows: [], err: j?.response?.header?.resultMsg || t.slice(0, 200) };
  const it = j?.response?.body?.items?.item;
  return { rows: it == null || it === '' ? [] : (Array.isArray(it) ? it : [it]), total: j.response.body.totalCount };
}

/* 이름 다듬기 — gas/wage.js 의 hospLoose_ 와 같은 규칙이어야
   옛 짝맞추기 결과와 견줄 수 있습니다 */
const LEGAL = /\(주\)|㈜|\(의\)|\(재\)|\(사\)|\(학\)|\(의료법인\)|\(재단법인\)|의료법인|재단법인|사회복지법인|학교법인|사단법인|특수법인|주식회사|유한회사/g;
const nameKey = (v) => String(v || '')
  .replace(/（/g, '(').replace(/）/g, ')')
  .replace(LEGAL, '')
  .replace(/[\s·・\-–—,()\[\]]/g, '')
  .toLowerCase();

const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
const ymd = (v) => {
  const s = String(v ?? '');
  return /^\d{8}$/.test(s) ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6)}` : null;
};

async function push(table, rows, onConflict) {
  /* 같은 열쇠가 한 묶음에 두 번 들어가면 Postgres 가 거절합니다
     (ON CONFLICT DO UPDATE cannot affect row a second time) */
  const seen = new Set();
  rows = rows.filter((r) => (seen.has(r[onConflict]) ? false : seen.add(r[onConflict])));
  for (let i = 0; i < rows.length; i += 500) {
    const r = await fetch(`${SB}/rest/v1/${table}?on_conflict=${onConflict}`, {
      method: 'POST',
      headers: { ...SBH, Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(rows.slice(i, i + 500)),
    });
    if (!r.ok) { console.error(`  ${table} 넣기 실패 ${r.status}: ${(await r.text()).slice(0, 300)}`); process.exit(1); }
  }
}

/* ═══ 1. 전국 기관 목록 · 요양기호 ═══
   한 번에 10,000줄까지 옵니다. 전국 79,874곳이면 8번입니다 */
async function loadOrgs() {
  console.log('전국 기관 목록을 받습니다 (한 쪽에 10,000줄)');
  const all = [];
  for (let p = 1; p <= 20; p++) {
    if (left() <= 0) { console.log('  한도가 찼습니다. 멈춥니다'); break; }
    const t0 = Date.now();
    const { rows, total, err } = await hira(
      `${ORG_API}?serviceKey=${HIRA_KEY}&numOfRows=10000&pageNo=${p}&_type=json`);
    if (err) { console.error('  ' + err); break; }
    all.push(...rows);
    console.log(`  ${p}쪽  ${String(rows.length).padStart(5)}줄  누적 ${String(all.length).padStart(6)} / ${total}  ${((Date.now() - t0) / 1000).toFixed(0)}초`);
    if (rows.length === 0 || all.length >= Number(total)) break;
  }
  if (!all.length) return;

  const rows = all.map((r) => ({
    ykiho: r.ykiho,
    yadm_nm: r.yadmNm,
    cl_cd: r.clCd == null ? null : String(r.clCd),
    cl_cd_nm: r.clCdNm ?? null,
    sido_cd: num(r.sidoCd), sido_nm: r.sidoCdNm ?? null,
    sggu_cd: num(r.sgguCd), sggu_nm: r.sgguCdNm ?? null,
    emdong_nm: r.emdongNm ?? null,
    addr: r.addr ?? null, tel: r.telno == null ? null : String(r.telno),
    hosp_url: r.hospUrl ?? null,
    estb_dd: ymd(r.estbDd),
    x_pos: num(r.XPos), y_pos: num(r.YPos),
    name_key: nameKey(r.yadmNm),
    fetched_at: new Date().toISOString(),
  })).filter((r) => r.ykiho);

  await push('hira_org', rows, 'ykiho');
  console.log(`  hira_org 에 ${rows.length}줄 넣었습니다 · 홈페이지 있는 곳 ${rows.filter((r) => r.hosp_url).length}곳`);
}

/* ═══ 2. 기관 상세 ═══
   ykiho 하나씩만 됩니다. 기관당 3번 요청합니다 */
async function loadDetail(which) {
  /* 아직 안 받은 기관을 고릅니다 — 끊겨도 이어가려고 */
  const want = {
    targets: '목표 기관',
    rest: '목표 밖 기관',
    all: '전체',
  }[which];
  if (!want) { console.error('targets · rest · all 중에 고르세요'); process.exit(1); }

  const todo = await pickTodo(which);
  console.log(`${want} 중 아직 안 받은 곳 ${todo.length}곳 · 기관당 3번 = ${todo.length * 3}번 필요`);
  console.log(`오늘 남은 요청 ${left()}번`);
  if (!todo.length) return;

  let done = 0, 빈곳 = 0;
  const batch = [];
  for (const o of todo) {
    if (left() < 3) { console.log(`\n  한도가 찼습니다. ${done}곳까지 했습니다. 내일 다시 돌리면 이어서 받습니다`); break; }

    const q = (op) => `${DTL_API}/${op}?serviceKey=${HIRA_KEY}&ykiho=${encodeURIComponent(o.ykiho)}&numOfRows=50&pageNo=1&_type=json`;
    const [eqp, hst, sdr] = await Promise.all([
      hira(q('getEqpInfo2.8')), hira(q('getEtcHstInfo2.8')), hira(q('getSpcSbjtSdrInfo2.8')),
    ]);

    const e = eqp.rows[0] ?? {};
    const by = (cd) => {
      const h = hst.rows.find((x) => String(x.gnlNopDtlCd).padStart(3, '0') === cd);
      return h ? num(h.gnlNopCnt) : null;
    };
    /* 재활의학과 전문의. 없으면 null — 0 과 다릅니다 */
    const reh = sdr.rows.find((x) => String(x.dgsbjtCdNm || '').includes('재활의학'));

    const now = new Date().toISOString();
    batch.push({
      ykiho: o.ykiho,
      perm_sbd: num(e.permSbdCnt), std_sbd: num(e.stdSickbdCnt), ptrm_cnt: num(e.ptrmCnt),
      org_ty_cd: e.orgTyCd == null ? null : String(e.orgTyCd), org_ty_nm: e.orgTyCdNm ?? null,
      pt: by('100'), ot: by('110'), pharm: by('071'), social: by('200'),
      rehab_sdr: reh ? num(reh.dtlSdrCnt) : null,
      /* 「받았는데 비어 있다」와 「아직 안 받았다」를 가릅니다.
         의원급은 기타인력수가 원래 없습니다 — 오류가 아닙니다 */
      eqp_at: eqp.err ? null : now,
      hst_at: hst.err ? null : now,
      sdr_at: sdr.err ? null : now,
      updated_at: now,
    });
    if (!hst.rows.length) 빈곳++;
    done++;

    if (batch.length >= 200) { await push('hira_detail', batch.splice(0), 'ykiho'); await saveQuota(which); }
    if (done % 200 === 0) console.log(`  ${done} / ${todo.length}곳 · 요청 ${used}번 · 남은 ${left()}번`);
  }
  if (batch.length) await push('hira_detail', batch, 'ykiho');
  console.log(`\n  ${done}곳 받았습니다 · 그중 기타인력수가 빈 곳 ${빈곳}곳 (의원급은 원래 비어 있습니다)`);
}

/* 아직 안 받은 기관 고르기 — 이어받기의 핵심 */
async function pickTodo(which) {
  const out = [];
  const 조건 = which === 'targets' ? '&is_target=is.true'
             : which === 'rest' ? '&is_target=is.false' : '';
  /* 서버가 한 번에 100줄까지만 줍니다 (max-rows). 그 크기에 맞춰 넘깁니다 —
     1,000 으로 달라고 하면 100줄만 받고 다 받은 줄 압니다 */
  const N = 100;
  for (let from = 0; ; from += N) {
    /* 차례대로 받습니다 — 치료사가 일할 자리가 있는 곳부터 (뷰가 정합니다).
       순서를 박아야 쪽을 넘길 때 같은 줄이 두 번 오지 않습니다 */
    const r = await fetch(`${SB}/rest/v1/hira_todo?select=ykiho${조건}&order=차례,ykiho`, {
      headers: { ...SBH, Range: `${from}-${from + N - 1}` },
    });
    const j = await r.json();
    if (!Array.isArray(j)) { console.error(JSON.stringify(j).slice(0, 300)); process.exit(1); }
    out.push(...j);
    if (j.length < N) break;
  }
  return out;
}

async function showQuota() {
  await loadQuota();
  console.log(`오늘(${today()}) 쓴 요청 ${usedBefore}번 · 남은 ${LIMIT - usedBefore}번`);
}

(async () => {
  const [cmd, arg] = process.argv.slice(2);
  await loadQuota();
  if (usedBefore) console.log(`오늘 이미 ${usedBefore}번 썼습니다 · 남은 ${LIMIT - usedBefore}번\n`);

  try {
    if (cmd === 'orgs') await loadOrgs();
    else if (cmd === 'detail') await loadDetail(arg);
    else if (cmd === 'quota') { await showQuota(); return; }
    else {
      console.log('쓰는 법:\n  node tools/hira.js orgs\n  node tools/hira.js detail targets|rest|all\n  node tools/hira.js quota');
      return;
    }
  } finally {
    if (used) { await saveQuota(cmd + (arg ? ' ' + arg : '')); console.log(`\n이번에 요청 ${used}번 · 오늘 모두 ${usedBefore + used}번 · 남은 ${LIMIT - usedBefore - used}번`); }
  }
})();
