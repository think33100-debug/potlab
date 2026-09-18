/* 기관 자료 9종을 Supabase 로 붓습니다.
 *
 *   node tools/load_orgs.js            전부
 *   node tools/load_orgs.js hospitals  하나만
 *   node tools/load_orgs.js --count    붓지 않고 건수만 대조
 *
 * 열쇠는 .env.local 에서 읽습니다 (저장소에 안 올라갑니다).
 *   SUPABASE_URL=https://<프로젝트>.supabase.co
 *   SUPABASE_SERVICE_KEY=<Project Settings → API Keys → service_role>
 *
 * 자료가 이 스크립트를 통과만 하고 어디에도 안 남습니다 — 파일에서 읽어 바로 보냅니다.
 * 부을 때마다 표를 비우고 다시 붓습니다 (TRUNCATE). 원본이 갱신되면 그냥 다시 돌리면 됩니다.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BATCH = 1000;

/* ── 설정 읽기 ── */
function env() {
  const f = path.join(ROOT, '.env.local');
  if (!fs.existsSync(f)) {
    console.error('.env.local 이 없습니다. 아래 두 줄을 넣어 주세요:');
    console.error('  SUPABASE_URL=https://<프로젝트>.supabase.co');
    console.error('  SUPABASE_SERVICE_KEY=<service_role 키>');
    process.exit(1);
  }
  const out = {};
  fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((l) => {
    const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (m) out[m[1]] = m[2];
  });
  if (!out.SUPABASE_URL || !out.SUPABASE_SERVICE_KEY) {
    console.error('.env.local 에 SUPABASE_URL · SUPABASE_SERVICE_KEY 가 둘 다 있어야 합니다.');
    process.exit(1);
  }
  return out;
}

/* ── CSV 읽기 (따옴표 안의 쉼표·줄바꿈까지) ── */
function parseCsv(text) {
  text = text.replace(/^﻿/, '');
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else q = false;
      } else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => String(x).trim() !== ''));
}

const s = (v) => { const t = String(v == null ? '' : v).trim(); return t === '' ? null : t; };
const n = (v) => { const t = String(v == null ? '' : v).replace(/[, ]/g, '').trim();
                   if (t === '' || !/^-?\d+(\.\d+)?$/.test(t)) return null; return Number(t); };

/* ── 원본 9종 ── */
const SOURCES = [
  {
    table: 'hospitals', file: 'hospital_data.json',
    read() {
      const j = JSON.parse(fs.readFileSync(path.join(ROOT, 'hospital_data.json'), 'utf8'));
      return j.rows.map((r) => ({
        name: s(r[0]), kind: s(r[1]), sido: s(r[2]), sgg: s(r[3]),
        ot: n(r[4]), pt: n(r[5]), sw: n(r[6]), bed: n(r[7]), doc: n(r[8]), rehab: n(r[9]),
        im: n(r[10]), nr: n(r[11]), ns: n(r[12]), os: n(r[13]), fm: n(r[14]),
        addr: s(r[15]), tel: s(r[16]), data_version: s(j.v)
      }));
    }
  },
  { table: 'public_hospitals', file: 'data/public_hospitals.csv',
    map: (r) => ({ seq: n(r[0]), name: s(r[1]), kind: s(r[2]), agency: s(r[3]), law: s(r[4]),
                   est_type: s(r[5]), er: s(r[6]), beds: n(r[7]), addr: s(r[8]),
                   homepage: s(r[9]), tel: s(r[10]), fax: s(r[11]) }) },

  { table: 'dementia_safe_centers', file: 'data/dementia_centers_256.csv',
    map: (r) => ({ name: s(r[0]), sido: s(r[1]), sgg: s(r[2]), zipcode: s(r[3]),
                   addr1: s(r[4]), addr2: s(r[5]), road_code: s(r[6]), dong_code: s(r[7]),
                   adm_code: s(r[8]), lat: n(r[9]), lng: n(r[10]), homepage: s(r[11]),
                   tel: s(r[12]), fax: s(r[13]), opened_on: s(r[14]) }) },

  { table: 'dementia_centers', file: 'data/dementia_centers_317.csv',
    map: (r) => ({ name: s(r[0]), kind: s(r[1]), road_addr: s(r[2]), jibun_addr: s(r[3]),
                   lat: n(r[4]), lng: n(r[5]), est_ym: s(r[6]), area: s(r[7]), facilities: s(r[8]),
                   doctors: n(r[9]), nurses: n(r[10]), social_workers: n(r[11]), others: s(r[12]),
                   operator: s(r[13]), operator_ceo: s(r[14]), operator_tel: s(r[15]),
                   entrust_date: s(r[16]),
                   extra: { program: s(r[17]), mgr_tel: s(r[18]), mgr_org: s(r[19]),
                            as_of: s(r[20]), provider_code: s(r[21]), provider_name: s(r[22]) } }) },

  { table: 'dev_rehab_orgs', file: 'data/dev_rehab_std.csv',
    map: (r) => ({ name: s(r[0]), sido: s(r[1]), sgg: s(r[2]), road_addr: s(r[3]),
                   jibun_addr: s(r[4]), lat: n(r[5]), lng: n(r[6]), tel: s(r[7]),
                   service: s(r[8]), ceo: s(r[9]), mgr_org: s(r[10]), mgr_tel: s(r[11]),
                   as_of: s(r[12]), provider_code: s(r[13]), provider_name: s(r[14]) }) },

  { table: 'ltc_facilities', file: 'data/ltc_facilities.csv',
    map: (r) => ({ code: s(r[0]), name: s(r[1]), sido: s(r[2]), sgg: s(r[3]), dong: s(r[4]),
                   addr: s(r[5]), kind: s(r[6]), capacity: n(r[7]), pt: n(r[8]), ot: n(r[9]),
                   care: n(r[10]), sw: n(r[11]), nurse: n(r[12]), designated_on: s(r[13]) }) },

  { table: 'mental_centers', file: 'data/mental_centers.csv',
    map: (r) => ({ facility_type: s(r[0]), facility_kind: s(r[1]), name: s(r[2]),
                   sido: s(r[3]), sgg: s(r[4]), addr: s(r[5]) }) },

  { table: 'welfare_centers', file: 'data/welfare_centers.csv',
    map: (r) => ({ sido: s(r[0]), sgg: s(r[1]), facility_type: s(r[2]), corp: s(r[3]),
                   name: s(r[4]), addr: s(r[5]), tel: s(r[6]),
                   staff_quota: n(r[7]), staff_now: n(r[8]) }) },

  { table: 'welfare_facilities', file: 'data/welfare_facilities.csv',
    map: (r) => ({ facility_type: s(r[0]), facility_kind: s(r[1]), name: s(r[2]),
                   sido: s(r[3]), sgg: s(r[4]), addr: s(r[5]) }) }
];

function rowsOf(src) {
  if (src.read) return src.read();
  const raw = parseCsv(fs.readFileSync(path.join(ROOT, src.file), 'utf8'));
  return raw.slice(1).map(src.map).filter((o) => o.name);   // 이름 없는 줄은 버립니다
}

/* ── 보내기 ── */
async function send(cfg, table, method, body) {
  const res = await fetch(cfg.SUPABASE_URL + '/rest/v1/' + table, {
    method,
    headers: {
      apikey: cfg.SUPABASE_SERVICE_KEY,
      Authorization: 'Bearer ' + cfg.SUPABASE_SERVICE_KEY,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) throw new Error(res.status + ' ' + (await res.text()).slice(0, 300));
}

async function countOf(cfg, table) {
  const res = await fetch(cfg.SUPABASE_URL + '/rest/v1/' + table + '?select=id&limit=1', {
    headers: { apikey: cfg.SUPABASE_SERVICE_KEY,
               Authorization: 'Bearer ' + cfg.SUPABASE_SERVICE_KEY,
               Prefer: 'count=exact', Range: '0-0' }
  });
  return Number((res.headers.get('content-range') || '/0').split('/')[1]) || 0;
}

(async function main() {
  const cfg = env();
  const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const countOnly = process.argv.includes('--count');
  const list = only.length ? SOURCES.filter((x) => only.includes(x.table)) : SOURCES;
  if (!list.length) { console.error('그런 표가 없습니다: ' + only.join(' ')); process.exit(1); }

  let bad = 0;
  console.log('표'.padEnd(23) + '원본'.padEnd(10) + 'DB'.padEnd(10) + '결과');
  console.log('─'.repeat(56));
  for (const src of list) {
    const rows = rowsOf(src);
    if (!countOnly) {
      await send(cfg, src.table + '?id=gt.0', 'DELETE', undefined);   // 비우고 다시
      /* 조건(id>0)이 꼭 있어야 합니다 — safeupdate 가 조건 없는 DELETE 를 막습니다 */
      for (let i = 0; i < rows.length; i += BATCH) {
        await send(cfg, src.table, 'POST', rows.slice(i, i + BATCH));
      }
    }
    const got = await countOf(cfg, src.table);
    const ok = got === rows.length;
    if (!ok) bad++;
    console.log(src.table.padEnd(23)
      + String(rows.length).padEnd(10) + String(got).padEnd(10)
      + (ok ? '맞음' : '✗ ' + (got - rows.length) + ' 차이'));
  }
  console.log('─'.repeat(56));
  console.log(bad ? '어긋난 표 ' + bad + '개' : '전부 맞습니다.');
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error('실패: ' + e.message); process.exit(1); });
