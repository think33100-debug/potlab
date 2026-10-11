/* 알리오 첨부를 **쿠키로 받아** 진짜 파일인지 봅니다 (2026-10-11 · 2건만).
 *
 *   node tools/알리오첨부_쿠키시험.mjs [공고번호 공고번호 …]
 *
 * ── 왜 ───────────────────────────────────────────────────────
 * 10-11 에 첨부 주소 28건을 **쿠키 없이** 두드려 전부 HTML 이 왔습니다
 * (`302 → /new`). 그걸 「첨부가 틀렸다」로 읽었는데, `collect-alio.mjs` 의
 * 포털쿠키() 주석에 이미 적혀 있었습니다 —
 *   「첨부를 받으려면 포털 세션 쿠키가 있어야 합니다. 없으면 파일 대신
 *    포털 첫 화면(8,333자 HTML)이 옵니다 — 확인했습니다」
 * **주소가 틀린 게 아니라 제 형식 확인이 쿠키를 안 썼습니다.**
 *
 * **아무것도 담지 않습니다.** 받아 보고 앞 글자만 찍습니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0.0.0';
const 상세URL = 'https://apis.data.go.kr/1051000/recruitment/detail';

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
  return out;
}
const cfg = env();
if (!cfg.ALIO_DETAIL_KEY) { console.error('ALIO_DETAIL_KEY 가 없습니다'); process.exit(1); }

const 담기 = (jar) => Object.entries(jar).map(([k, v]) => k + '=' + v).join('; ');

/* collect-alio.mjs 의 포털쿠키() 와 같은 걸음입니다 */
async function 포털쿠키() {
  const jar = {};
  let u = 'https://opendata.alio.go.kr/new/';
  for (let hop = 0; hop < 4 && u; hop++) {
    const r = await fetch(u, { redirect: 'manual', headers: { 'User-Agent': UA, Cookie: 담기(jar) } });
    (r.headers.getSetCookie?.() || []).forEach((x) => {
      const kv = String(x).split(';')[0], i = kv.indexOf('=');
      if (i > 0) jar[kv.slice(0, i).trim()] = kv.slice(i + 1).trim();
    });
    const loc = r.headers.get('location');
    u = (r.status >= 300 && r.status < 400 && loc)
      ? (/^https?:/.test(loc) ? loc : 'https://opendata.alio.go.kr' + loc) : '';
    console.log('   홈 hop' + hop + ' HTTP ' + r.status + (loc ? ' → ' + loc : '') + ' · 쿠키 ' + Object.keys(jar).length + '개');
  }
  return 담기(jar);
}

function 진짜형식(바이트) {
  let i = 0;
  if (바이트[0] === 0xef && 바이트[1] === 0xbb && 바이트[2] === 0xbf) i = 3;
  while (i < 바이트.length && [0x20, 0x09, 0x0a, 0x0d].includes(바이트[i])) i++;
  const b = 바이트.slice(i);
  const 같나 = (...xs) => xs.every((x, j) => b[j] === x);
  if (같나(0x25, 0x50, 0x44, 0x46, 0x2d)) return 'pdf';
  if (같나(0xd0, 0xcf, 0x11, 0xe0)) return 'hwp (옛 OLE)';
  if (같나(0x50, 0x4b, 0x03, 0x04)) return 'zip계열 (hwpx·docx)';
  if (같나(0x3c, 0x21) || 같나(0x3c, 0x68) || 같나(0x3c, 0x48)) return 'HTML';
  return '모름';
}

const 번호들 = process.argv.slice(2).filter((x) => /^\d+$/.test(x));
if (!번호들.length) { console.error('공고번호를 주십시오 — 예) node tools/알리오첨부_쿠키시험.mjs 305856 305730'); process.exit(1); }

console.log('① 포털 홈으로 세션 쿠키 받기');
const 쿠키 = await 포털쿠키();
console.log('   쿠키 ' + (쿠키 ? '받았습니다 (' + 쿠키.split(';').length + '개)' : '**없습니다**'));

for (const sn of 번호들) {
  console.log('\n② 공고 ' + sn + ' 의 상세에서 첨부 목록');
  const r = await fetch(상세URL + '?serviceKey=' + cfg.ALIO_DETAIL_KEY + '&sn=' + sn,
    { headers: { 'User-Agent': UA, accept: 'application/json' } });
  const j = await r.json();
  const box = Array.isArray(j.result) ? j.result[0] : j.result;
  const files = (box?.files || []).filter((f) => String(f.atchFileType) === 'A');
  console.log('   atchFileType=A 인 것 ' + files.length + '개');

  for (const f of files) {
    console.log('\n③ 받아 보기 — ' + String(f.atchFileNm || '').slice(0, 60));
    for (const [이름, 머리] of [['쿠키 없이', { 'User-Agent': UA }],
      ['쿠키 있게', { 'User-Agent': UA, Cookie: 쿠키, Referer: 'https://opendata.alio.go.kr/new/' }]]) {
      try {
        const g = await fetch(String(f.url), { headers: 머리 });
        const buf = Buffer.from(await g.arrayBuffer());
        const 앞5 = buf.subarray(0, 5).toString('latin1').replace(/[^\x20-\x7e]/g, '.');
        console.log('   ' + 이름.padEnd(10) + ' HTTP ' + g.status
          + ' · ' + String(buf.length).padStart(8) + '바이트'
          + ' · 앞5 「' + 앞5 + '」'
          + ' · 형식 ' + 진짜형식(buf)
          + ' · content-type ' + (g.headers.get('content-type') || '-'));
      } catch (e) { console.log('   ' + 이름.padEnd(10) + ' 못 받음 — ' + String(e.message).slice(0, 80)); }
    }
  }
}
console.log('\n아무것도 담지 않았습니다.');
