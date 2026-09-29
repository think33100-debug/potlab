/* 알리오 첨부 공고문에서 글자를 뽑습니다 (2026-09-30).
 *
 *   node tools/alio-file-text.mjs --dry --몇 3
 *   node tools/alio-file-text.mjs
 *
 * 고용형태를 공고 제목·첨부 이름으로도 못 가린 공고가 남았습니다.
 * 공고문 안에는 「○ 채용분야: 기간제 물리치료사 1명」 처럼 적혀 있습니다.
 *
 * ── 읽을 수 있는 것 ───────────────────────────────────────
 *   .hwp · .hwpx   tools/hwp 가 순수 자바스크립트로 읽습니다. 바로 됩니다
 *   .pdf           tools/ocr 이 필요합니다 — `OCR_GAS_URL` · `OCR_KEY` 가 있어야 합니다
 *                  없으면 못 읽었다고 남기고 넘어갑니다. **짐작하지 않습니다**
 *
 * 받은 파일이 정말 그 꼴인지도 봅니다 (PDF 는 앞 5글자가 `%PDF-`).
 * 게시판이 오류 화면을 200 으로 주는 일이 있어서입니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hwp글자, 한글파일인가 } from './hwp/index.mjs';
import { pdf글자, 쓸수있나 as OCR쓸수있나, 이름표 as OCR이름표 } from './ocr/index.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));

/* ⚠ 개방 API 가 주는 첨부 주소는 **죽었습니다** (2026-09-30 에 확인).
 *   opendata.alio.go.kr/recruit/downloadAtchFile?recrutAtchFileNo=…
 *     → 파일이 아니라 「청년 일자리 지원 서비스」 홈 화면 8,333바이트가 옵니다.
 *       리퍼러를 붙여도 같습니다. 2018년 것도 2026년 것도 다 그렇습니다.
 *
 *   살아 있는 주소는 잡알리오 화면(tab-3)에 있습니다 —
 *     www.alio.go.kr/download/download.json?fileNo=<recrutAtchFileNo>
 *   **번호는 API 것 그대로**입니다. 주소만 갈아 끼우면 됩니다.
 *   (확인: fileNo 3028673 → application/pdf 889KB · 2681118 → hwp 151KB) */
const 내려받기주소 = (file_no) =>
  'https://www.alio.go.kr/download/download.json?fileNo=' + file_no;
const SOURCE = 'AL2';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128';
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

const argv = process.argv.slice(2);
const dry = argv.includes('--dry');
const 몇개 = argv.includes('--몇') ? Number(argv[argv.indexOf('--몇') + 1]) || 0 : 0;
if (!cfg.COLLECT_KEY_AL2) { console.error('COLLECT_KEY_AL2 가 없습니다'); process.exit(1); }

let 할것 = await rpc('alio_post_file_text_todo', { p_secret: cfg.COLLECT_KEY_AL2, p_source: SOURCE });
if (몇개) 할것 = 할것.slice(0, 몇개);
console.log('첨부 글자 뽑기 — 할 것 ' + 할것.length + '개'
  + ' · OCR ' + (OCR쓸수있나() ? OCR이름표 : '없음 (PDF 는 건너뜁니다)') + (dry ? ' · --dry' : ''));

const 셈 = { hwp: 0, hwp못: 0, pdf: 0, pdf못: 0, 건너뜀: 0, 못받음: 0 };
const 담을것 = [];
for (const f of 할것) {
  let buf;
  try {
    const r = await fetch(내려받기주소(f.file_no), { headers: { 'User-Agent': UA } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    buf = Buffer.from(await r.arrayBuffer());
  } catch (e) {
    셈.못받음++; 담을것.push({ sn: f.sn, file_no: f.file_no, 왜: '못 받음 · ' + e.message });
    await 쉼(400); continue;
  }

  const 이름 = String(f['이름'] || '');
  const PDF인가 = buf.slice(0, 5).toString('latin1') === '%PDF-';
  if (한글파일인가(이름)) {
    const r = hwp글자(buf, 이름);
    if (r.글) { 셈.hwp++; 담을것.push({ sn: f.sn, file_no: f.file_no, 글: r.글 }); }
    else { 셈.hwp못++; 담을것.push({ sn: f.sn, file_no: f.file_no, 왜: r.왜 || '한글 파일을 못 읽었습니다' }); }
  } else if (PDF인가) {
    if (!OCR쓸수있나()) {
      셈.건너뜀++;
      담을것.push({ sn: f.sn, file_no: f.file_no,
        왜: 'PDF 인데 OCR 을 맡길 곳이 없습니다 (OCR_GAS_URL · OCR_KEY 필요)' });
    } else {
      const r = await pdf글자(buf, 이름);
      if (r.글) { 셈.pdf++; 담을것.push({ sn: f.sn, file_no: f.file_no, 글: r.글 }); }
      else { 셈.pdf못++; 담을것.push({ sn: f.sn, file_no: f.file_no, 왜: r.왜 || 'PDF 를 못 읽었습니다' }); }
    }
  } else {
    셈.건너뜀++;
    담을것.push({ sn: f.sn, file_no: f.file_no,
      왜: '읽을 줄 모르는 꼴입니다 · ' + 이름.slice(-12) + ' · 앞 4바이트 '
        + buf.slice(0, 4).toString('hex') });
  }
  await 쉼(400);
}

if (!dry && 담을것.length) {
  for (let i = 0; i < 담을것.length; i += 100) {
    await rpc('alio_post_file_text_put', { p_secret: cfg.COLLECT_KEY_AL2, p_source: SOURCE,
      p_rows: 담을것.slice(i, i + 100) });
  }
}
console.log('\n── 한글 읽음 ' + 셈.hwp + ' / 못 읽음 ' + 셈.hwp못
  + ' · PDF 읽음 ' + 셈.pdf + ' / 못 읽음 ' + 셈.pdf못
  + ' · 건너뜀 ' + 셈.건너뜀 + ' · 못 받음 ' + 셈.못받음);
if (셈.건너뜀 && !OCR쓸수있나()) {
  console.log('   ※ PDF 를 읽으려면 .env.local 에 OCR_GAS_URL · OCR_KEY 를 넣어 주세요.');
}
if (dry) console.log('   --dry 라 담지 않았습니다');
