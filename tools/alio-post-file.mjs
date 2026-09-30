/* 알리오 공고의 첨부 **이름**을 받아 옵니다 (2026-09-30).
 *
 *   node tools/alio-post-file.mjs --dry --몇 5
 *   node tools/alio-post-file.mjs --모름            고용형태를 못 가린 공고만
 *   node tools/alio-post-file.mjs                   첨부를 아직 안 받은 공고 전부
 *
 * ── 왜 이름만 받나 ────────────────────────────────────────
 * 고용형태를 공고 제목으로 못 가린 것이 남았는데, **첨부 파일 이름**이
 * 제목과 같은 꼴로 적혀 있습니다.
 *
 *   「[태백병원]220113 공무직(방사선사) 및 기간제(물리치료사) 채용 공고.hwp」
 *   「계약직 보건직(물리치료사) 체험형 청년인턴(언어치료사) 공개채용 공고문.pdf」
 *
 * 파일을 내려받을 까닭이 없습니다. `.hwp` 는 어차피 못 읽습니다.
 * 이름으로 못 가리는 것이 남으면 그때 PDF(atchFileType A)를 열면 됩니다.
 */
import fs from 'node:fs';
import { 공공부르기 } from './공공데이터부르기.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
  out.ALIO_DETAIL_KEY = out.ALIO_DETAIL_KEY
    || (fs.readFileSync(path.join(여기, '..', 'gas', 'wage.js'), 'utf8')
        .match(/const JOB3_API = \{[\s\S]*?KEY:\s*'([^']+)'/) || [])[1] || '';
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
async function sql(q) {                    // 읽기만 — PostgREST 로 골라 옵니다
  const k = cfg.SUPABASE_ANON_KEY;
  const r = await fetch(cfg.SUPABASE_URL + '/rest/v1/rpc/' + q.fn, {
    method: 'POST',
    headers: { apikey: k, Authorization: 'Bearer ' + k, 'Content-Type': 'application/json' },
    body: JSON.stringify(q.body),
  });
  if (!r.ok) throw new Error(r.status + ' ' + (await r.text()).slice(0, 200));
  return r.json();
}

const argv = process.argv.slice(2);
const dry = argv.includes('--dry');
const 모름만 = argv.includes('--모름');
const 뽑 = (n, d) => (argv.includes(n) ? Number(argv[argv.indexOf(n) + 1]) || d : d);
const 몇개 = 뽑('--몇', 0);

if (!cfg.COLLECT_KEY_AL2) { console.error('COLLECT_KEY_AL2 가 없습니다'); process.exit(1); }

let 할것 = await sql({ fn: 'alio_post_file_todo',
  body: { p_secret: cfg.COLLECT_KEY_AL2, p_source: SOURCE, p_모름만: 모름만 } });
if (몇개) 할것 = 할것.slice(0, 몇개);
console.log('첨부 이름 받기 — 할 것 ' + 할것.length + '건'
  + (모름만 ? ' (고용형태 못 가린 공고만)' : '') + (dry ? ' · --dry' : ''));

const 셈 = { 읽음: 0, 첨부: 0, 공고문: 0, 없음: 0, 못받음: 0 };
const 담을것 = [];
for (const c of 할것) {
  const sn = c.sn ?? c;
  let m;
  try {
    const r = await 공공부르기('https://apis.data.go.kr/1051000/recruitment/detail?serviceKey='
      + cfg.ALIO_DETAIL_KEY + '&resultType=json&sn=' + sn);
    if (r.code !== 200) throw new Error(r.왜 || ('HTTP ' + r.code));
    const j = JSON.parse(r.글);
    m = Array.isArray(j.result) ? j.result[0] : j.result;
  } catch (e) { 셈.못받음++; console.log('  sn ' + sn + ' 못 받음 · ' + e.message); await 쉼(300); continue; }
  셈.읽음++;
  const 것 = m?.files || [];
  if (!것.length) 셈.없음++;
  for (const f of 것) {
    셈.첨부++;
    if (f.atchFileType === 'A') 셈.공고문++;
    담을것.push({ sn, file_no: f.recrutAtchFileNo, sort_no: f.sortNo,
      파일이름: f.atchFileNm, 파일갈래: f.atchFileType, url: f.url });
  }
  await 쉼(200);
}

if (!dry) {
  for (let i = 0; i < 담을것.length; i += 300) {
    await rpc('alio_post_file_put', { p_secret: cfg.COLLECT_KEY_AL2, p_source: SOURCE,
      p_rows: 담을것.slice(i, i + 300) });
  }
}
console.log('\n── 공고 ' + 셈.읽음 + '건 · 첨부 ' + 셈.첨부 + '개 (공고문 A ' + 셈.공고문 + ')'
  + ' · 첨부 없는 공고 ' + 셈.없음 + ' · 못 받음 ' + 셈.못받음);
if (dry) console.log('   --dry 라 담지 않았습니다');
