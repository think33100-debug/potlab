/* 심평원 **홈페이지 칸** 확인 — 응답 원문과 항목 이름을 찍습니다 (쓰기 없음)
 * (2026-10-24 세중님 3번 ⓐ — 「신청한 상세기능 전부 두드려 원문」)
 *
 *   node tools/심평원_홈페이지칸확인.mjs
 *
 * ── 묻는 것 ─────────────────────────────────────────────────
 *   ① 병원정보서비스(getHospBasisList) 응답에 **홈페이지 칸**이 있나 — 이름이 무엇인가
 *   ② 의료기관별상세정보(MadmDtlInfoService2.8)의 다른 기능에도 있나
 *   ③ 우리 DB(hira_org.hosp_url)가 **빈 곳**은 — 심평원에 원래 없나, 우리 사본이 낡았나
 *
 * ★ 열쇠는 찍지 않습니다 (주소에 붙으므로 주소도 안 찍습니다 · 지침 8-11).
 * ★ 쓰기 없음 — 읽어서 찍기만 합니다.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.join(import.meta.dirname, '..');
const env = (f) => {
  const o = {};
  if (!fs.existsSync(f)) return o;
  for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) o[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return o;
};
const cfg = { ...env(path.join(ROOT, '.env')), ...env(path.join(ROOT, '.env.local')),
  ...env(path.join(ROOT, 'web', '.env.local')) };
const KEY = cfg.HIRA_KEY_ENC || cfg.HIRA_KEY;
if (!KEY) { console.error('✗ HIRA_KEY_ENC 가 없습니다'); process.exit(1); }
const ORG = 'https://apis.data.go.kr/B551182/hospInfoServicev2/getHospBasisList';
const DTL = 'https://apis.data.go.kr/B551182/MadmDtlInfoService2.8';

async function 두드려(이름, url, 앞 = 700) {
  console.log('\n■ ' + 이름);
  let t = '';
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'potjob/1.0' }, signal: AbortSignal.timeout(20000) });
    t = await r.text();
    console.log('  HTTP ' + r.status);
  } catch (e) { console.log('  못 불렀습니다 — ' + e.message); return null; }
  let j = null;
  try { j = JSON.parse(t); } catch {
    console.log('  (JSON 이 아닙니다) 원문 앞 ' + 앞 + '자 —\n' + t.slice(0, 앞));
    return null;
  }
  const hd = j?.response?.header ?? {};
  console.log('  resultCode ' + hd.resultCode + ' · ' + hd.resultMsg
    + ' · totalCount ' + (j?.response?.body?.totalCount ?? '(없음)'));
  const it = j?.response?.body?.items?.item;
  const rows = it == null || it === '' ? [] : (Array.isArray(it) ? it : [it]);
  if (!rows.length) { console.log('  줄 0'); return rows; }
  console.log('  항목 이름 — ' + Object.keys(rows[0]).join(' · '));
  const 홈칸 = Object.keys(rows[0]).filter((k) => /url|homepage|hmpg|홈/i.test(k));
  console.log('  ★ 홈페이지 꼴 칸 — ' + (홈칸.length ? 홈칸.join(' · ') : '**없습니다**'));
  console.log('  첫 줄 원문 — ' + JSON.stringify(rows[0]).slice(0, 앞));
  return rows;
}

/* ── ① 병원정보서비스 ── */
const 한줄 = await 두드려('① getHospBasisList (1건)',
  `${ORG}?serviceKey=${KEY}&numOfRows=1&pageNo=1&_type=json`);
const ykiho = 한줄?.[0]?.ykiho;

/* ── ② 의료기관별상세정보의 기능들 ── */
if (ykiho) {
  for (const op of ['getEqpInfo2.8', 'getEtcHstInfo2.8', 'getSpcSbjtSdrInfo2.8', 'getDgsbjtInfo2.8']) {
    await 두드려('② MadmDtlInfoService2.8/' + op,
      `${DTL}/${op}?serviceKey=${KEY}&ykiho=${encodeURIComponent(ykiho)}&numOfRows=5&pageNo=1&_type=json`, 300);
    await new Promise((r) => setTimeout(r, 500));
  }
}

/* ── ③ 우리 사본이 빈 곳 — 심평원에 **지금** 물어 봅니다 ── */
if (!cfg.SUPABASE_DB_URL) {
  console.log('\n(③ 은 서버에서만 — SUPABASE_DB_URL 이 없습니다)');
  process.exit(0);
}
const u = new URL(cfg.SUPABASE_DB_URL);
const pgenv = { ...process.env,
  PGHOST: u.hostname, PGPORT: u.port || '5432',
  PGUSER: decodeURIComponent(u.username), PGPASSWORD: decodeURIComponent(u.password),
  PGDATABASE: decodeURIComponent(u.pathname.replace(/^\//, '')) || 'postgres',
  PGSSLMODE: u.searchParams.get('sslmode') || 'require' };
function psql(sql) {
  const 임시 = path.join(os.tmpdir(), '심평원홈_' + process.pid + '.sql');
  fs.writeFileSync(임시, sql, 'utf8');
  const r = spawnSync('psql', ['-X', '-A', '-t', '-q', '-F', '\t', '-v', 'ON_ERROR_STOP=1', '-f', 임시],
    { encoding: 'utf8', maxBuffer: 1 << 26, env: pgenv });
  fs.unlinkSync(임시);
  if (r.status) { console.error('✗ psql\n' + (r.stderr || '').slice(0, 600)); process.exit(1); }
  return (r.stdout || '').trimEnd();
}
const 빈곳 = psql(`
  with s as (select g."기관", hira_name_key(g."기관") as k
               from "일층병원_구멍"() g where g."상태" = '사각지대')
  select o.yadm_nm, o.ykiho, coalesce(o.fetched_at::text,'')
    from s join hira_org o on o.name_key = s.k
   where coalesce(o.hosp_url,'') = ''
   order by o.yadm_nm limit 8;`).split('\n').filter(Boolean).map((l) => l.split('\t'));
console.log('\n── ③ 우리 사본에 홈페이지가 **빈** 사각지대 기관 ' + 빈곳.length + '곳을 심평원에 다시 묻습니다 ──');
for (const [이름, , 받은날] of 빈곳) {
  const r = await 두드려('③ ' + 이름 + ' (우리 사본 받은날 ' + (받은날 || '없음') + ')',
    `${ORG}?serviceKey=${KEY}&yadmNm=${encodeURIComponent(이름)}&numOfRows=3&pageNo=1&_type=json`, 300);
  if (r && r.length) {
    for (const x of r) {
      console.log('     · ' + (x.yadmNm || '') + ' / ' + (x.sidoCdNm || '') + ' ' + (x.sgguCdNm || '')
        + ' → hospUrl 「' + (x.hospUrl ?? '(칸 없음)') + '」');
    }
  }
  await new Promise((z) => setTimeout(z, 500));
}
