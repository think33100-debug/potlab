/* 공고 5종을 시트 → Supabase 로 베낍니다 (2단계).
 *
 *   node tools/copy_jobs.js           전부
 *   node tools/copy_jobs.js --dry     붓지 않고 몇 건이 어떻게 나뉘는지만
 *   node tools/copy_jobs.js --show 3  공고 3건을 새 구조로 펼쳐 보여줍니다
 *
 * **시트가 원본입니다. 이 도구는 읽기만 합니다** — 시트를 건드리지 않습니다.
 * 자료는 Apps Script → 이 스크립트 → Supabase 로 바로 흐릅니다.
 *
 * .env.local 에서 읽습니다:
 *   SUPABASE_URL · SUPABASE_SERVICE_KEY · APPS_SCRIPT_URL · EXPORT_KEY
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const PAGE = 300, BATCH = 500;

function env() {
  const f = path.join(ROOT, '.env.local');
  if (!fs.existsSync(f)) { console.error('.env.local 이 없습니다.'); process.exit(1); }
  const out = {};
  fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((l) => {
    const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/); if (m) out[m[1]] = m[2];
  });
  ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'APPS_SCRIPT_URL', 'EXPORT_KEY'].forEach((k) => {
    if (!out[k]) { console.error('.env.local 에 ' + k + ' 가 없습니다.'); process.exit(1); }
  });
  return out;
}

/* ── 시트에서 한 장씩 ── */
let seq = 0;
async function page(cfg, sheet, from, count) {
  const cb = '__potlab_cb_' + (++seq) + '_' + Date.now();
  const u = cfg.APPS_SCRIPT_URL + '?callback=' + cb + '&action=exportRows'
          + '&args=' + encodeURIComponent(JSON.stringify([cfg.EXPORT_KEY, sheet, from, count]))
          + '&t=' + Date.now();
  const res = await fetch(u);
  const txt = await res.text();
  const m = txt.match(/^__potlab_cb_\d+_\d+\((.*)\);\s*$/s);
  if (!m) throw new Error('응답이 JSONP 가 아닙니다: ' + txt.slice(0, 300));
  const j = JSON.parse(m[1]);
  if (!j.ok) throw new Error(sheet + ' 내보내기 실패: ' + j.error);
  return j.data;
}
async function readSheet(cfg, sheet) {
  const first = await page(cfg, sheet, 0, PAGE);
  const head = first.head, total = first.total;
  let rows = first.rows;
  while (rows.length < total) {
    const nx = await page(cfg, sheet, rows.length, PAGE);
    if (!nx.rows.length) break;
    rows = rows.concat(nx.rows);
  }
  const idx = {}; head.forEach((h, i) => { idx[String(h).trim()] = i; });
  return { head, rows, total, get: (r, name) => (idx[name] === undefined ? '' : r[idx[name]]) };
}

/* ── 값 다루기 ── */
const s = (v) => { const t = String(v == null ? '' : v).trim(); return t === '' ? null : t; };
const num = (v) => { const t = String(v == null ? '' : v).replace(/[^\d-]/g, ''); return t === '' ? null : Number(t); };
const yes = (v) => /^(y|yes|예|o|true|1)$/i.test(String(v == null ? '' : v).trim());
/* 「2026.09.27」 「2026-09-27」 「20260927」 → 2026-09-27 · 아니면 null */
function date(v) {
  const t = String(v == null ? '' : v).trim();
  let m = t.match(/(\d{4})[.\-/]\s*(\d{1,2})[.\-/]\s*(\d{1,2})/);
  if (!m) m = t.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return y + '-' + String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0');
}
/* 「서울특별시 종로구 …」 → 시도·시군구 */
function region(v) {
  const t = String(v == null ? '' : v).trim();
  if (!t) return [null, null];
  const p = t.split(/\s+/);
  return [p[0] || null, p[1] || null];
}

/* ── 시트 칸 이름 → DB 칸 이름 (공고수정이 건드리는 것들) ── */
/* 공고ID 앞글자 → 출처 (2026-09-18 실제 662건을 세어 확인)
 *   WNK·WNKF·WNKJ… 376건  워크넷 (뒤 글자는 워크넷 공고번호의 일부라 WN 으로 묶습니다)
 *   HS 165 · 숫자 58(알리오) · GJ 47(나라일터) · ND 8(치매센터) · CE 7(클린아이) */
function sourceOf(id) {
  const p = (String(id || '').match(/^[A-Za-z]+/) || [''])[0].toUpperCase();
  if (!p) return 'AL';                      // 숫자만 = 알리오
  if (p.indexOf('WN') === 0) return 'WN';   // 워크넷은 뒤 글자가 제각각
  return p.slice(0, 2);
}

const FIELD = {
  '기관명': 'org_name', '공고명': 'title', '채용구분': 'hire_type', '고용형태': 'employ_type',
  '근무지': 'work_place', '학력': 'edu', '인원': 'headcount', '접수시작': 'apply_from',
  '접수마감': 'apply_to', '링크': 'url', '직군': 'job_group', '형태': 'form'
};
const DETAIL_COLS   = ['일정','전형방법','지원자격','우대사항','결격사유','자격증','제출서류','접수방법','문의처','연봉','기관홈'];
const EVIDENCE_COLS = ['분류근거','직군근거','탭근거','보류사유'];

function toJobPost(g, r) {
  const wp = s(g(r, '근무지'));
  const [sido, sgg] = region(wp);
  const id = s(g(r, '공고ID'));
  const detail = {}, evidence = {};
  DETAIL_COLS.forEach((c) => { const v = s(g(r, c)); if (v) detail[c] = v; });
  EVIDENCE_COLS.forEach((c) => { const v = s(g(r, c)); if (v) evidence[c] = v; });
  return {
    id, source: id ? sourceOf(id) : null,
    org_name: s(g(r, '기관명')) || '(없음)', title: s(g(r, '공고명')) || '(없음)',
    hire_type: s(g(r, '채용구분')), employ_type: s(g(r, '고용형태')),
    work_place: wp, sido, sgg,
    edu: s(g(r, '학력')), headcount: num(g(r, '인원')),
    apply_from: date(g(r, '접수시작')), apply_to: date(g(r, '접수마감')),
    posted_at: date(g(r, '공고일')), url: s(g(r, '링크')) || '',
    job_group: s(g(r, '직군')), form: s(g(r, '형태')),
    org_kind: s(g(r, '기관종별')), tab: s(g(r, '탭분류')),
    hidden: yes(g(r, '숨김')), hold: yes(g(r, '보류')), notify: yes(g(r, '알림')),
    detail, evidence, edited_fields: [],
    collected_at: date(g(r, '수집일')) ? date(g(r, '수집일')) + 'T00:00:00+09:00' : null
  };
}

/* ── Supabase ── */
async function sb(cfg, pathq, method, body) {
  const res = await fetch(cfg.SUPABASE_URL + '/rest/v1/' + pathq, {
    method,
    headers: { apikey: cfg.SUPABASE_SERVICE_KEY,
               Authorization: 'Bearer ' + cfg.SUPABASE_SERVICE_KEY,
               'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) throw new Error(res.status + ' ' + (await res.text()).slice(0, 400));
}
async function count(cfg, table) {
  const res = await fetch(cfg.SUPABASE_URL + '/rest/v1/' + table + '?select=*&limit=1', {
    headers: { apikey: cfg.SUPABASE_SERVICE_KEY,
               Authorization: 'Bearer ' + cfg.SUPABASE_SERVICE_KEY,
               Prefer: 'count=exact', Range: '0-0' } });
  return Number((res.headers.get('content-range') || '/0').split('/')[1]) || 0;
}
async function push(cfg, table, rows) {
  for (let i = 0; i < rows.length; i += BATCH) await sb(cfg, table, 'POST', rows.slice(i, i + BATCH));
}

/* 공고수정 시트를 job_posts 본문에 반영하고 이력을 만듭니다.
   빈 칸은 「안 고침」 · 원본과 값이 같으면 수정으로 안 셉니다.
   시험: node tools/copy_jobs_test.js */
function mergeFixes(byId, X) {
  const edits = [];
  let fixedPosts = 0, orphanFix = 0;
  X.rows.forEach((r) => {
    const id = s(X.get(r, '공고ID'));
    if (!id) return;
    const p = byId[id];
    if (!p) { orphanFix++; return; }          // 원본 공고가 사라진 수정 줄
    let touched = false;
    Object.keys(FIELD).forEach((ko) => {
      const nv = s(X.get(r, ko));
      if (nv == null) return;                  // 빈 칸 = 안 고침
      const col = FIELD[ko];
      const before = p[col];
      let after = nv;
      if (col === 'headcount') after = num(nv);
      else if (col === 'apply_from' || col === 'apply_to') after = date(nv);
      if (String(before == null ? '' : before) === String(after == null ? '' : after)) return;
      edits.push({ job_id: id, field: col,
                   old_value: before == null ? null : String(before),
                   new_value: after == null ? null : String(after),
                   edited_at: date(X.get(r, '수정일시'))
                     ? date(X.get(r, '수정일시')) + 'T00:00:00+09:00' : null });
      p[col] = after;                          // 본문을 직접 고칩니다
      if (p.edited_fields.indexOf(col) < 0) p.edited_fields.push(col);
      touched = true;
      if (col === 'work_place') { const [a, b] = region(after); p.sido = a; p.sgg = b; }
    });
    if (touched) fixedPosts++;
  });

  return { edits, fixedPosts, orphanFix };
}

if (require.main !== module) { module.exports = { mergeFixes, toJobPost, date, num, region, sourceOf, env, page, readSheet, sb, count }; return; }

(async function main() {
  const cfg = env();
  const dry = process.argv.includes('--dry');
  const showN = process.argv.includes('--show')
    ? Number(process.argv[process.argv.indexOf('--show') + 1]) || 3 : 0;
  const report = [];

  /* ① 채용공고 + ② 공고수정 → job_posts · job_post_edits */
  const J = await readSheet(cfg, '채용공고');
  const X = await readSheet(cfg, '공고수정');
  /* 시트는 같은 공고ID 가 두 번 있어도 받아줍니다. DB 는 기본열쇠라 안 됩니다.
     뒤에 있는 줄(더 나중에 수집된 것)을 남깁니다 — wage.js 의 dedupeJobs 와 같은 방향입니다. */
  const all = J.rows.map((r) => toJobPost(J.get, r)).filter((p) => p.id);
  const byId = {}; all.forEach((p) => { byId[p.id] = p; });
  const posts = Object.keys(byId).map((k) => byId[k]);
  const dupJobs = all.length - posts.length;

  const { edits, fixedPosts, orphanFix } = mergeFixes(byId, X);

  if (showN) {
    console.log('── 새 구조로 나뉜 모양 (' + showN + '건) ──');
    posts.slice(0, showN).forEach((p) => {
      const { detail, evidence, ...flat } = p;
      console.log('\n[' + p.id + '] ' + p.org_name + ' · ' + p.title);
      console.log('  공통칸   ' + JSON.stringify(flat));
      console.log('  detail   ' + JSON.stringify(detail).slice(0, 400));
      console.log('  evidence ' + JSON.stringify(evidence).slice(0, 300));
    });
    const fixed = posts.filter((p) => p.edited_fields.length);
    console.log('\n── 손으로 고친 공고 (' + fixed.length + '건 중 앞 ' + Math.min(showN, fixed.length) + ') ──');
    fixed.slice(0, showN).forEach((p) => {
      console.log('  [' + p.id + '] edited_fields = ' + JSON.stringify(p.edited_fields));
      edits.filter((e) => e.job_id === p.id).forEach((e) =>
        console.log('      ' + e.field + ' : ' + JSON.stringify(e.old_value) + ' → ' + JSON.stringify(e.new_value)));
    });
    console.log('');
  }

  /* ③ 나머지 셋 */
  const others = [
    { sheet: '버림규칙', table: 'drop_rules', map: (g, r) => ({
        key: s(g(r, '규칙키')), kind: s(g(r, '종류')), value: s(g(r, '값')), note: s(g(r, '설명')),
        evidence_n: num(g(r, '근거건수')) || 0, example: s(g(r, '예시')),
        enabled: !/^(끔|off|n)$/i.test(String(g(r, '상태') || '').trim()),
        blocked_n: num(g(r, '막은건수')) || 0, created_on: date(g(r, '만든날')),
        last_used_at: date(g(r, '마지막적용')) ? date(g(r, '마지막적용')) + 'T00:00:00+09:00' : null }),
      key: 'key' },
    { sheet: '수집 가능 기관', table: 'collectable_orgs', map: (g, r) => ({
        org_name: s(g(r, '기관명')), ok: String(g(r, '상태') || '').trim() === '됨',
        reason: s(g(r, '이유')), from_where: s(g(r, '어디서')),
        checked_on: date(g(r, '마지막 확인')), n: num(g(r, '건수')) || 0 }),
      key: 'org_name' },
    { sheet: 'WN판정', table: 'wn_verdicts', map: (g, r) => ({
        wanted_auth_no: s(g(r, 'wantedAuthNo')), verdict: s(g(r, '판정')) || '(없음)',
        reason: s(g(r, '근거')), org_name: s(g(r, '기관')), title: s(g(r, '제목')),
        decided_at: date(g(r, '판정일')) ? date(g(r, '판정일')) + 'T00:00:00+09:00' : null }),
      key: 'wanted_auth_no' }
  ];

  const loaded = [{ name: '채용공고 → job_posts', sheet: J.total, rows: posts.length, table: 'job_posts', data: posts }];
  for (const o of others) {
    const S2 = await readSheet(cfg, o.sheet);
    const seen = new Set();
    const rows = S2.rows.map((r) => o.map(S2.get, r)).filter((x) => {
      const k = x[o.key];
      if (!k || seen.has(k)) return false;     // 열쇠 없는/겹치는 줄은 버립니다
      seen.add(k); return true;
    });
    loaded.push({ name: o.sheet + ' → ' + o.table, sheet: S2.total, rows: rows.length, table: o.table, data: rows, dupKey: S2.total - rows.length });
  }
  loaded.push({ name: '공고수정 → job_post_edits', sheet: X.total, rows: edits.length, table: 'job_post_edits', data: edits, note: '수정 줄 ' + X.total + '개 → 실제로 달라진 칸 ' + edits.length + '개' });

  if (dry) {
    console.log('시트 → 만들어진 줄 (붓지 않았습니다)');
    loaded.forEach((l) => console.log('  ' + l.name.padEnd(30) + String(l.sheet).padStart(7) + ' → ' + String(l.rows).padStart(7)));
    console.log('  손으로 고친 공고 ' + fixedPosts + '건 · 원본이 없는 수정 줄 ' + orphanFix + '개');
    console.log('  공고ID 가 겹쳐 버린 줄 ' + dupJobs + '개');

    const bySrc = {};
    posts.forEach((p) => { bySrc[p.source] = (bySrc[p.source] || 0) + 1; });
    console.log(''); console.log('출처별  ' + Object.keys(bySrc).sort((a,b)=>bySrc[b]-bySrc[a])
      .map((k) => k + ' ' + bySrc[k]).join(' · '));

    const cols = ['hire_type','employ_type','work_place','sido','edu','headcount',
                  'apply_from','apply_to','posted_at','job_group','form','org_kind','tab'];
    console.log(''); console.log('칸이 얼마나 차 있나 (' + posts.length + '건 기준)');
    cols.forEach((c) => {
      const n = posts.filter((p) => p[c] !== null && p[c] !== undefined && p[c] !== '').length;
      console.log('  ' + c.padEnd(13) + String(n).padStart(5) + '건  ' + Math.round(n / posts.length * 100) + '%');
    });
    const dN = posts.filter((p) => Object.keys(p.detail).length).length;
    const eN = posts.filter((p) => Object.keys(p.evidence).length).length;
    console.log('  detail(본문)  ' + String(dN).padStart(4) + '건  ' + Math.round(dN/posts.length*100) + '%');
    console.log('  evidence(근거)' + String(eN).padStart(4) + '건  ' + Math.round(eN/posts.length*100) + '%');
    return;
  }

  console.log('표'.padEnd(26) + '시트'.padEnd(9) + 'DB'.padEnd(9) + '결과');
  console.log('─'.repeat(58));
  let bad = 0;
  for (const l of loaded) {
    /* 표마다 기본열쇠가 다릅니다. 조건 없는 DELETE 는 safeupdate 가 막습니다. */
    const DEL = { job_posts: 'id=neq.__none__', drop_rules: 'key=neq.__none__',
                  collectable_orgs: 'org_name=neq.__none__',
                  wn_verdicts: 'wanted_auth_no=neq.__none__', job_post_edits: 'id=gt.0' };
    await sb(cfg, l.table + '?' + (DEL[l.table] || 'id=gt.0'), 'DELETE');
    await push(cfg, l.table, l.data);
    const got = await count(cfg, l.table);
    const ok = got === l.rows;
    if (!ok) bad++;
    console.log(l.name.padEnd(26) + String(l.sheet).padEnd(9) + String(got).padEnd(9) + (ok ? '맞음' : '✗ ' + (got - l.rows)));
  }
  console.log('─'.repeat(58));
  console.log('손으로 고친 공고 ' + fixedPosts + '건 · 원본이 없는 수정 줄 ' + orphanFix + '개');
  console.log('공고ID 가 겹쳐 버린 줄 ' + dupJobs + '개');
  console.log(bad ? '어긋난 표 ' + bad + '개' : '전부 맞습니다.');
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error('실패: ' + e.message); process.exit(1); });
