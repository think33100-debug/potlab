/* 옛 쪽 시트 → Supabase 다리 (2026-09-20).
 *
 *   node tools/sync_jobs.js          평소 — 시트 끝쪽만 읽어 담습니다
 *   node tools/sync_jobs.js --full   전체를 훑습니다 (하루 한 번)
 *   node tools/sync_jobs.js --dry    담지 않고 몇 건인지만
 *
 * copy_jobs.js 와 무엇이 다른가 —
 *   copy_jobs.js   한 번 쓰고 버리는 이사용. 전부 지우고 다시 넣습니다
 *   sync_jobs.js   30분마다 도는 다리. 지우지 않고 id 로 맞춰 담습니다
 *
 * 원본과 고친 값을 나눠 둡니다 —
 * 공고 말고도 세 장을 같이 나릅니다 (2026-09-26) —
 *   쓰레기통 → job_trash · 사이트점검 → site_checks · 사이트상태 → site_state
 *   어느 시트를 나르는지는 copy_jobs.js 의 EXTRA_SHEETS 한 곳에만 적습니다.
 *
 *   job_posts        옛 쪽 시트가 말한 것. 이 도구가 마음대로 덮어씁니다
 *   job_post_edits   관리자가 고친 것. 여기는 건드리지 않습니다
 *   job_hides        사람이 내린 것. 여기도 안 건드립니다
 *   화면은 job_posts_pub 뷰를 봅니다 — 셋을 합쳐서 보여줍니다
 *
 * .env.local (또는 환경변수) 에서 읽습니다:
 *   SUPABASE_URL · SUPABASE_SERVICE_KEY · APPS_SCRIPT_URL · EXPORT_KEY
 */
'use strict';
const { toJobPost, sb, count, EXTRA_SHEETS } = require('./copy_jobs.js');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const SHEET = '채용공고';
const PAGE = 300;          // 한 번에 받아오는 줄 수 (Apps Script 가 500 까지 줍니다)
const TAIL = 300;          // 평소에 볼 「시트 끝쪽」 줄 수
const BATCH = 500;         // 한 번에 담는 줄 수

/* ── 설정 ── */
function env() {
  const out = {};
  const f = path.join(ROOT, '.env.local');
  if (fs.existsSync(f)) {
    fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((l) => {
      const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
      if (m) out[m[1]] = m[2];
    });
  }
  /* GitHub Actions 에서는 파일이 없고 환경변수로 옵니다 */
  ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'APPS_SCRIPT_URL', 'EXPORT_KEY'].forEach((k) => {
    if (process.env[k]) out[k] = process.env[k];
    if (!out[k]) { console.error(k + ' 가 없습니다.'); process.exit(1); }
  });
  return out;
}

/* ── 옛 쪽 시트 한 조각 ── */
let seq = 0;
async function page(cfg, from, cnt, sheet) {
  const cb = '__potlab_cb_' + (++seq) + '_' + Date.now();
  const url = cfg.APPS_SCRIPT_URL
    + (cfg.APPS_SCRIPT_URL.includes('?') ? '&' : '?')
    + 'callback=' + cb
    + '&action=exportRows'
    + '&args=' + encodeURIComponent(JSON.stringify([cfg.EXPORT_KEY, sheet || SHEET, from, cnt]))
    + '&t=' + Date.now();
  const res = await fetch(url, { redirect: 'follow' });
  const txt = await res.text();
  const m = txt.match(/^__potlab_cb_\d+_\d+\((.*)\);\s*$/s);
  if (!m) throw new Error('JSONP 가 아닙니다: ' + txt.slice(0, 300));
  const j = JSON.parse(m[1]);
  if (!j.ok) throw new Error('내보내기 거절: ' + j.error);
  return j.data;
}

/* from 번째부터 cnt 줄을 (여러 쪽에 걸쳐) 읽습니다 */
async function readRange(cfg, from, cnt) {
  const first = await page(cfg, from, Math.min(cnt, PAGE));
  const head = first.head, total = first.total;
  let rows = first.rows;
  while (rows.length < cnt && from + rows.length < total) {
    const nx = await page(cfg, from + rows.length, Math.min(cnt - rows.length, PAGE));
    if (!nx.rows.length) break;
    rows = rows.concat(nx.rows);
  }
  const idx = {}; head.forEach((h, i) => { idx[String(h).trim()] = i; });
  return { total, rows, get: (r, name) => (idx[name] === undefined ? '' : r[idx[name]]) };
}

/* ── Supabase 읽기 ── */
async function get(cfg, pathq) {
  const res = await fetch(cfg.SUPABASE_URL + '/rest/v1/' + pathq, {
    headers: { apikey: cfg.SUPABASE_SERVICE_KEY,
               Authorization: 'Bearer ' + cfg.SUPABASE_SERVICE_KEY }
  });
  if (!res.ok) throw new Error(res.status + ' ' + (await res.text()).slice(0, 300));
  return res.json();
}
/* 있으면 고치고 없으면 넣습니다 (id 가 기본열쇠) */
async function upsert(cfg, table, rows, onConflict) {
  for (let i = 0; i < rows.length; i += BATCH) {
    const res = await fetch(cfg.SUPABASE_URL + '/rest/v1/' + table
                            + '?on_conflict=' + onConflict, {
      method: 'POST',
      headers: { apikey: cfg.SUPABASE_SERVICE_KEY,
                 Authorization: 'Bearer ' + cfg.SUPABASE_SERVICE_KEY,
                 'Content-Type': 'application/json',
                 Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(rows.slice(i, i + BATCH))
    });
    if (!res.ok) throw new Error(res.status + ' ' + (await res.text()).slice(0, 400));
  }
}

/* ── 어디까지 봤는지 ── */
async function loadState(cfg) {
  const r = await get(cfg, 'collector_state?key=eq.job_sync&select=value');
  return (r[0] && r[0].value) || {};
}
async function saveState(cfg, value) {
  await upsert(cfg, 'collector_state',
    [{ key: 'job_sync', value, updated_at: new Date().toISOString() }], 'key');
}
async function log(cfg, row) {
  try { await sb(cfg, 'job_sync_log', 'POST', [row]); }
  catch (e) { console.error('기록 실패(넘어갑니다): ' + e.message); }
}

/* 옛 쪽에서 넘어온 「관리자가 고침」 표시를 job_post_edits 로 옮깁니다.
   한 번만 하면 됩니다 — 옮기고 나면 edited_fields 를 안 봅니다.
   시트 값과 지금 값이 다를 때만, 그리고 아직 기록이 없을 때만 넣습니다. */
async function keepOldEdits(cfg, bySheet) {
  /* 「한 줄이라도 고친 것」만 받습니다.
     not.is.null 로 받으면 빈 배열([])까지 딸려와 630줄이 됩니다 —
     그런데 Supabase 의 Max rows 가 100 이라 앞 100줄에서 잘립니다.
     오류는 안 나고 조용히 잘립니다. 실제로 이것 때문에 고친 값 하나를
     날렸습니다 (2026-09-20). 받는 줄 수를 늘 서버에서 좁혀야 합니다. */
  const cur = await get(cfg,
    'job_posts?edited_fields=neq.{}&select=id,edited_fields,job_group,title,'
    + 'headcount,apply_to,apply_from,employ_type&limit=1000');
  if (!cur.length) return 0;
  const ids = cur.map((r) => r.id).join(',');
  const have = await get(cfg,
    'job_post_edits?select=job_id,field&job_id=in.(' + ids + ')&limit=1000');
  const seen = {}; have.forEach((e) => { seen[e.job_id + '|' + e.field] = 1; });
  const add = [];
  for (const row of cur) {
    const fields = row.edited_fields || [];
    if (!fields.length) continue;
    const sheet = bySheet[row.id];
    if (!sheet) continue;                       // 이번에 안 읽은 줄
    for (const f of fields) {
      if (seen[row.id + '|' + f]) continue;
      const before = sheet[f] == null ? null : String(sheet[f]);
      const after = row[f] == null ? null : String(row[f]);
      if (before === after) continue;           // 실제로 다르지 않으면 기록할 게 없습니다
      add.push({ job_id: row.id, field: f, old_value: before, new_value: after });
    }
  }
  if (add.length) await sb(cfg, 'job_post_edits', 'POST', add);
  return add.length;
}

/* 시트 한 장을 통째로 읽습니다 (공고 말고 작은 시트들) */
async function readWhole(cfg, sheet) {
  const first = await page(cfg, 0, PAGE, sheet);
  let rows = first.rows;
  while (rows.length < first.total) {
    const nx = await page(cfg, rows.length, PAGE, sheet);
    if (!nx.rows.length) break;
    rows = rows.concat(nx.rows);
  }
  const idx = {}; first.head.forEach((h, i) => { idx[String(h).trim()] = i; });
  return { total: first.total, rows,
           get: (r, name) => (idx[name] === undefined ? '' : r[idx[name]]) };
}

/* 공고 말고 같이 나르는 세 장 — 어느 시트인지는 copy_jobs.js 가 압니다.

   **비우지 않고 열쇠로 맞춰 담습니다.** 이 다리는 30분마다 도는데
   비웠다가 중간에 죽으면 표가 빈 채로 남습니다. */
async function syncExtras(cfg, dry) {
  const 결과 = [];
  for (const o of EXTRA_SHEETS) {
    let S;
    try { S = await readWhole(cfg, o.sheet); }
    catch (e) {
      /* 시트가 아직 없을 수 있습니다 (사이트상태는 수집기가 처음 돌 때 생깁니다) */
      결과.push({ sheet: o.sheet, table: o.table, n: 0, note: '못 읽음 · ' + e.message.slice(0, 60) });
      continue;
    }
    const seen = new Set();
    const rows = S.rows.map((r) => o.map(S.get, r)).filter((x) => {
      const k = x[o.key];
      if (!k || seen.has(k)) return false;
      seen.add(k); return true;
    });
    if (!dry && rows.length) await upsert(cfg, o.table, rows, o.key);
    결과.push({ sheet: o.sheet, table: o.table, n: rows.length, 시트줄: S.total });
  }
  return 결과;
}

/* 쓰레기통에 든 공고를 job_posts 에서 치웁니다 (2026-09-26).

   ── 왜 필요한가 ──────────────────────────────────────────
   이 다리는 **담기만 하고 지우지 않습니다.** 그래서 수집기가 쓰레기통으로
   내린 공고가 표에 그대로 남습니다. 2026-09-26 에 시트는 642건인데 표는
   719건이었고, 차이 77건이 정확히 쓰레기통 건수였습니다.

   ── 왜 이 방식이 안전한가 ────────────────────────────────
   「시트에 없는 줄을 전부 지우기」 가 아닙니다. 시트를 반만 읽은 판에
   그렇게 하면 멀쩡한 공고가 날아갑니다.
   **쓰레기통 시트에 이름이 적힌 것만** 지웁니다. 관리자가 「잘못 버림」
   (되돌림 Y) 을 누른 줄은 건드리지 않습니다. */
async function dropTrashed(cfg, dry) {
  let S;
  try { S = await readWhole(cfg, '쓰레기통'); } catch (e) { return 0; }
  const uniq = [...new Set(
    S.rows
      .filter((r) => !/^Y$/i.test(String(S.get(r, '되돌림') || '').trim()))
      .map((r) => String(S.get(r, '공고ID') || '').trim())
      .filter(Boolean),
  )];
  if (!uniq.length) return 0;
  if (dry) return uniq.length;

  const before = await count(cfg, 'job_posts');
  for (let i = 0; i < uniq.length; i += 100) {
    const 조각 = uniq.slice(i, i + 100).map(encodeURIComponent).join(',');
    await sb(cfg, 'job_posts?id=in.(' + 조각 + ')', 'DELETE');
  }
  return before - await count(cfg, 'job_posts');
}

(async function main() {
  const t0 = Date.now();
  const cfg = env();
  const full = process.argv.includes('--full');
  const dry = process.argv.includes('--dry');
  let mode = full ? 'full' : 'tail';

  try {
    const st = await loadState(cfg);

    /* ① 먼저 줄 수만 물어봅니다 (한 줄짜리 요청).
       옛 쪽은 평일 7~19시에만 도니, 늘어난 게 없으면 여기서 끝냅니다. */
    const head = await page(cfg, 0, 1);
    const total = head.total;
    if (!full && st.sheet_total === total) {
      console.log('시트 ' + total + '줄 — 지난번과 같습니다. 끝냅니다.');
      if (!dry) await log(cfg, { mode: 'skip', sheet_total: total, read_rows: 0,
                                 upserted: 0, took_ms: Date.now() - t0, ok: true,
                                 note: '늘어난 줄 없음' });
      return;
    }

    /* ② 읽을 범위.
       줄 번호를 기억하지 않습니다 — cleanJobs 가 앞줄을 지우면 번호가 밀립니다.
       늘어난 만큼에 여유를 더해 「끝쪽」을 읽고, id 로 맞춰 담습니다. */
    const grew = Math.max(total - (st.sheet_total || 0), 0);
    const want = full ? total : Math.min(total, Math.max(TAIL, grew + 100));
    const from = Math.max(total - want, 0);
    const S = await readRange(cfg, from, want);

    const all = S.rows.map((r) => toJobPost(S.get, r)).filter((p) => p.id);
    /* 시트는 같은 공고ID 가 두 번 있어도 받아줍니다. 뒤엣것을 남깁니다. */
    const byId = {}; all.forEach((p) => { byId[p.id] = p; });
    const posts = Object.keys(byId).map((k) => byId[k]);

    console.log('시트 ' + total + '줄 · ' + from + '번째부터 ' + S.rows.length + '줄 읽음 · '
                + posts.length + '건 (' + mode + ')');

    if (dry) {
      console.log('--dry 라 담지 않았습니다.');
      const ex = await syncExtras(cfg, true);
      ex.forEach((x) => console.log('  ' + x.sheet.padEnd(8) + ' → ' + x.table.padEnd(12)
        + (x.note ? x.note : x.n + '건 (시트 ' + x.시트줄 + '줄)')));
      console.log('  쓰레기통에 들어 치울 공고 ' + (await dropTrashed(cfg, true)) + '건');
      console.log('맨 끝 3건:');
      posts.slice(-3).forEach((p) => console.log('  ' + p.id + ' | ' + p.org_name
        + ' | ' + String(p.title).slice(0, 40) + ' | ' + (p.job_group || '(빈칸)')));
      return;
    }

    /* ③ 옛 「관리자가 고침」 표시를 한 번만 옮깁니다 */
    const bySheet = {}; posts.forEach((p) => { bySheet[p.id] = p; });
    const kept = await keepOldEdits(cfg, bySheet);
    if (kept) console.log('관리자가 고친 칸 ' + kept + '개를 job_post_edits 로 옮겼습니다.');

    /* ④ 담기.
       job_posts 는 이제 「옛 쪽이 말한 것」만 담는 자리라 통째로 덮어써도 됩니다.
       관리자가 고친 값은 job_post_edits 에, 사람이 내린 것은 job_hides 에 있습니다. */
    const before = await count(cfg, 'job_posts');
    await upsert(cfg, 'job_posts', posts.map((p) => {
      const q = Object.assign({}, p); delete q.edited_fields; return q;
    }), 'id');
    const after = await count(cfg, 'job_posts');

    await saveState(cfg, { sheet_total: total, last_run: new Date().toISOString(),
                           last_mode: mode });
    await log(cfg, { mode, sheet_total: total, read_rows: S.rows.length,
                     upserted: posts.length, edits_kept: kept,
                     took_ms: Date.now() - t0, ok: true,
                     note: '새로 늘어난 줄 ' + (after - before) + '건' });

    /* ⑤ 공고 말고 세 장도 같이. 그리고 쓰레기통에 든 것은 표에서 치웁니다 */
    const extras = await syncExtras(cfg, false);
    extras.forEach((x) => console.log('  ' + x.sheet.padEnd(8) + ' → ' + x.table.padEnd(12)
      + (x.note ? x.note : x.n + '건 (시트 ' + x.시트줄 + '줄)')));
    const 치움 = await dropTrashed(cfg, false);
    const 끝 = await count(cfg, 'job_posts');
    if (치움) console.log('  쓰레기통에 든 공고 ' + 치움 + '건을 표에서 치웠습니다');

    console.log('담았습니다 · 표 ' + before + ' → ' + 끝 + '건 (새로 ' + (after - before)
      + ' · 치움 ' + 치움 + ')');
    console.log((Date.now() - t0) + 'ms');
  } catch (e) {
    console.error('실패: ' + e.message);
    /* 어디까지 봤는지를 안 고칩니다 — 다음 차례가 같은 자리를 다시 읽습니다 */
    try { await log(cfg, { mode, read_rows: 0, upserted: 0,
                           took_ms: Date.now() - t0, ok: false,
                           note: String(e.message).slice(0, 500) }); } catch (_) {}
    process.exit(1);
  }
})();
