/* ═══════════════════════════════════════════════════════════════
 *  GJ2 보류함 — 근거 없이 보류된 공고의 첨부를 **실제로 읽어** 판정합니다
 *  2026-10-02. 세중님 지시 — 「제목에 직군이 없으면 첨부까지」가 우리 원칙입니다.
 * ═══════════════════════════════════════════════════════════════
 *
 *  왜 생겼나
 *    collect-nara.mjs 줄 330 이 「의료 냄새가 없으면 첨부를 안 연다」고 넘긴 공고가,
 *    직군이 빈 채로 sortJob 2단계(「제목에 직종이 없는 뭉뚱그린 공고 —
 *    첨부를 읽어야 합니다」)를 받아 보류함으로 갔습니다. 코드 두 군데가 어긋났습니다.
 *    게다가 그 까닭이 evidence 에 안 적혀 관리자 화면에 「근거 없음」으로 떴습니다.
 *    2026-09-30 11:32:31 한 번의 실행에서 39건이 그렇게 들어왔습니다.
 *
 *  무엇을 하나
 *    그 공고들의 첨부를 열어 읽고,
 *      물리·작업치료가 있으면   → 회원 화면 (직군을 적고 보류 해제)
 *      없으면                  → 쓰레기통 (까닭을 남깁니다 · 지우지 않습니다)
 *      못 읽으면                → 보류함에 그대로 (까닭만 적습니다)
 *
 *  쓰는 법
 *    node tools/GJ2보류읽기.mjs --dry      읽어만 보고 안 고칩니다 (먼저 이것)
 *    node tools/GJ2보류읽기.mjs            판정대로 고칩니다
 *    node tools/GJ2보류읽기.mjs --n 5      5건만
 *
 *  **지우지 않습니다.** 쓰레기통으로 옮기는 것은 되돌릴 수 있습니다.
 * ═══════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { matchJob } from './gas-rules.mjs';
import { 첨부직군 } from './첨부직군.mjs';
import { pdf글자, 쓸수있나 as OCR쓸수있나 } from './ocr/index.mjs';
import { hwp글자 } from './hwp/index.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(여기, '..');
const 읽기 = (f) => {
  const o = {};
  if (!fs.existsSync(f)) return o;
  for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) o[m[1]] = m[2].trim().replace(/^(['"])([\s\S]*)\1$/, '$2').trim();
  }
  return o;
};
const cfg = {
  ...읽기(path.join(ROOT, '.env.local')),
  ...읽기(path.join(ROOT, 'web', '.env.local')),
  ...읽기(path.join(ROOT, '.env.server')),
  ...읽기(path.join(ROOT, '.env')),
  ...process.env,
};
cfg.SUPABASE_URL = cfg.SUPABASE_URL || cfg.NEXT_PUBLIC_SUPABASE_URL;
cfg.SUPABASE_ANON_KEY = cfg.SUPABASE_ANON_KEY || cfg.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const SOURCE = 'GJ2';
const BASE = 'https://apis.data.go.kr/1760000/PblJobService';
const 열쇠 = cfg.COLLECT_KEY_GJ2 || cfg.COLLECT_KEY_HS3 || '';

const argv = process.argv.slice(2);
const dry = argv.includes("--dry");   // --dry 는 판정 파일도 안 냅니다
const 몇건 = argv.includes('--n') ? Number(argv[argv.indexOf('--n') + 1]) || 0 : 0;

const t0 = Date.now();
console.log('GJ2 보류 첨부 읽기 · ' + new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
  + (dry ? ' · **--dry · 고치지 않습니다**' : ''));
console.log('  공공데이터 열쇠  ' + (cfg.ALIO_DETAIL_KEY ? '있음' : '**없음**'));
console.log('  collect_put     ' + (열쇠 ? '있음' : '**없음**'));
console.log('  OCR             ' + (OCR쓸수있나() ? '쓸 수 있음' : '**못 씀**'));
if (!cfg.ALIO_DETAIL_KEY || !cfg.SUPABASE_URL) { console.error('\n열쇠가 모자랍니다'); process.exit(1); }
if (!dry && !열쇠) { console.error('\nCOLLECT_KEY 가 없습니다 (고치려면 필요합니다)'); process.exit(1); }

async function rpc(이름, body) {
  const r = await fetch(cfg.SUPABASE_URL + '/rest/v1/rpc/' + encodeURIComponent(이름), {
    method: 'POST',
    headers: { apikey: cfg.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + cfg.SUPABASE_ANON_KEY,
               'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const 글 = await r.text();
  if (!r.ok) throw new Error('HTTP ' + r.status + ' · 응답 원문 — ' + 글.slice(0, 500));
  return 글 ? JSON.parse(글) : null;
}

/* ① 볼 것 — 근거 없이 보류된 GJ2 공고.
   화면과 같은 창구를 쓰지 않고 관리자 함수로 읽습니다 (anon 은 job_posts 를 통째로
   못 읽습니다 — 일부러 그렇게 두었습니다). 그래서 service 열쇠로 읽습니다. */
async function 보류읽기() {
  const 열 = cfg.SUPABASE_SERVICE_KEY;
  if (!열) throw new Error('SUPABASE_SERVICE_KEY 가 없습니다 — 이 도구는 집 컴퓨터에서만 돕니다');
  const 모은것 = [];
  for (let off = 0; ; off += 100) {
    const u = cfg.SUPABASE_URL + '/rest/v1/job_posts'
      + '?select=id,org_name,title,url,evidence'
      + '&source=eq.' + SOURCE + '&hold=is.true&hidden=is.false'
      + '&order=id&limit=100&offset=' + off;
    const r = await fetch(u, { headers: { apikey: 열, Authorization: 'Bearer ' + 열 } });
    const j = await r.json();
    if (!Array.isArray(j)) throw new Error('job_posts 읽기 실패 — ' + JSON.stringify(j).slice(0, 300));
    if (!j.length) break;
    모은것.push(...j);
    if (j.length < 100) break;
  }
  return 모은것;
}

/* ② 첨부 — collect-nara.mjs 와 **같은 규칙**으로 고릅니다.
   규칙이 두 벌로 갈라지면 또 짐작으로 고치게 됩니다 */
const 점수 = (nm) => (/직무기술|제출서류|서식|응시원서|양식|명세서/.test(nm) ? 0
  : /공고|모집|채용/.test(nm) ? 2 : 1);
const 온전히 = (fp) => {
  let p = String(fp || '').trim();
  if (!p) return '';
  if (!p.startsWith('http')) p = 'https://www.gojobs.go.kr/' + p.replace(/^\//, '');
  const q = p.indexOf('?');
  if (q < 0) return p;
  return p.slice(0, q) + '?' + p.slice(q + 1).split('&').map((kv) => {
    const e = kv.indexOf('=');
    if (e < 0) return kv;
    const k = kv.slice(0, e), v = kv.slice(e + 1);
    return k + '=' + (/%[0-9A-Fa-f]{2}/.test(v) ? v : encodeURIComponent(v));
  }).join('&');
};
const 풀기 = (s) => String(s == null ? '' : s)
  .replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&amp;/g, '&').trim();

async function 첨부받기(idx) {
  const r = await fetch(BASE + '/getItemFile?serviceKey=' + cfg.ALIO_DETAIL_KEY + '&idx=' + idx,
    { headers: { accept: 'application/xml' } });
  const t = await r.text();
  let pdf = '', hwp = '', 좋은것 = -1, 좋은한글 = -1;
  const 이름들 = [];
  for (const m of t.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const nm = 풀기((m[1].match(/<filename>([\s\S]*?)<\/filename>/) || [])[1]);
    const fp = 풀기((m[1].match(/<filepath>([\s\S]*?)<\/filepath>/) || [])[1]);
    if (!nm) continue;
    이름들.push(nm);
    const sc = 점수(nm);
    if (/\.hwpx?$/i.test(nm) && sc > 좋은한글) { 좋은한글 = sc; hwp = 온전히(fp); }
    if (/\.pdf$/i.test(nm) && sc > 좋은것) { 좋은것 = sc; pdf = 온전히(fp); }
  }
  /* ★ collect-nara.mjs 줄 335 는 점수와 상관없이 PDF 를 먼저 집습니다.
     공고문이 한글이고 서식이 PDF 면 서식을 읽게 됩니다. 여기서는 **점수가 높은 쪽**을
     고릅니다 (2026-10-02 · 네 건을 봤을 때는 안 터졌지만 터질 수 있는 자리입니다) */
  const 고른것 = (좋은한글 > 좋은것) ? hwp : (pdf || hwp);
  return { 고른것, 이름들, 원문길이: t.length };
}

async function 파일글자(주소) {
  const r = await fetch(주소, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const buf = Buffer.from(await r.arrayBuffer());
  const 머리 = buf.subarray(0, 4).toString('latin1');
  if (머리 === 'PK\u0003\u0004' || /\.hwpx?$/i.test(주소)) {
    const g = await hwp글자(buf, '공고문.hwpx');
    return { 글: (g && (g.글 || g.text)) || '', 꼴: 'hwp', 바이트: buf.length };
  }
  if (머리 === '%PDF') {
    if (!OCR쓸수있나()) return { 글: '', 꼴: 'pdf', 왜: 'OCR 을 맡길 곳이 없습니다', 바이트: buf.length };
    const g = await pdf글자(buf, '공고문.pdf', {});
    return { 글: (g && g.글) || '', 꼴: 'pdf', 왜: g && g.왜, 바이트: buf.length };
  }
  return { 글: '', 꼴: '모름', 왜: '앞 4바이트 ' + JSON.stringify(머리), 바이트: buf.length };
}

/* ── 본체 ─────────────────────────────────────────────────── */
/* 서버에는 SUPABASE_SERVICE_KEY 가 없고(일부러) 집 컴퓨터에는 OCR 열쇠가 없습니다.
   그래서 **아이디를 밖에서 넘겨받는 길**을 둡니다 — DB 는 안 읽고 그 아이디만 봅니다.
     node tools/GJ2보류읽기.mjs --아이디 GJ303300,GJ303431,…
   아이디를 안 주면 집 컴퓨터에서 job_posts 를 직접 읽습니다 */
const 준아이디 = argv.includes('--아이디')
  ? String(argv[argv.indexOf('--아이디') + 1] || '').split(',').map((s) => s.trim()).filter(Boolean)
  : [];
let 할것;
if (준아이디.length) {
  console.log('\n① 아이디를 받았습니다 — ' + 준아이디.length + '건 (DB 는 안 읽습니다)');
  할것 = 준아이디.map((id) => ({ id, org_name: '', title: '', url: '', evidence: {} }));
} else {
  const 다 = await 보류읽기();
  console.log('\n① GJ2 보류함 ' + 다.length + '건');
  const 근거없음 = 다.filter((x) => !(x.evidence && x.evidence.보류사유));
  console.log('  그중 **근거가 없는 것** ' + 근거없음.length + '건  ← 이번에 볼 것');
  할것 = 근거없음;
}
할것 = 몇건 ? 할것.slice(0, 몇건) : 할것;
if (!할것.length) { console.log('\n볼 것이 없습니다.'); process.exit(0); }

const 셈 = { 첨부없음: 0, 못읽음: 0, 우리것: 0, 남의것: 0, 가산점: 0 };
const 회원갈것 = [], 쓰레기갈것 = [], 보류남을것 = [];

for (const x of 할것) {
  const idx = String(x.id).replace(/^GJ/, '');
  let 줄 = '  ' + x.id + '  ' + String(x.org_name).slice(0, 22).padEnd(22) + ' ';
  try {
    const f = await 첨부받기(idx);
    if (!f.고른것) {
      셈.첨부없음++;
      보류남을것.push({ ...x, 왜: '첨부가 없어 더 볼 것이 없습니다 (첨부 목록 ' + f.이름들.length + '개)' });
      console.log(줄 + '첨부 없음');
      continue;
    }
    const a = await 파일글자(f.고른것);
    if (!a.글) {
      셈.못읽음++;
      보류남을것.push({ ...x, 왜: '첨부를 못 읽었습니다 · ' + a.꼴 + ' · ' + (a.왜 || '글자 0자') });
      console.log(줄 + '못 읽음 (' + a.꼴 + ' · ' + a.바이트 + '바이트 · ' + (a.왜 || '0자') + ')');
      continue;
    }
    /* 어느 부분에 있느냐를 봅니다 — 가산점 목록에만 있으면 우리 자리가 아닙니다.
       규칙은 tools/첨부직군.mjs 한 곳에 있습니다 (collect-nara 와 같은 것) */
    const g = 첨부직군(a.글);
    if (g.직군) {
      셈.우리것++;
      회원갈것.push({ ...x, 직군: g.직군, 걸린줄: g.줄 });
      console.log(줄 + '★ 우리 것 — ' + g.직군 + ' (' + a.꼴 + ' ' + a.글.length + '자) · 「'
        + String(g.줄 || '').replace(/\s+/g, ' ').slice(0, 60) + '」');
    } else if (g.어디 === '가산점') {
      셈.가산점++;
      쓰레기갈것.push({ ...x, 왜: '첨부의 가산점·자격증 목록에만 「' + (g.후보 || '') + '」 가 있었습니다 · ' + g.까닭 });
      console.log(줄 + '가산점뿐 (' + a.꼴 + ' ' + a.글.length + '자)');
    } else if (g.어디 === '모름') {
      보류남을것.push({ ...x, 왜: '첨부에 「' + (g.후보 || '') + '」 가 있는데 모집 부분인지 가산점인지 못 가렸습니다' });
      console.log(줄 + '못 가림 — 보류 유지 (' + a.꼴 + ' ' + a.글.length + '자)');
    } else {
      셈.남의것++;
      const 있나 = /물리치료|작업치료/.test(a.글);
      쓰레기갈것.push({ ...x, 왜: '첨부 공고문을 끝까지 읽었지만 물리·작업치료사가 없었습니다 ('
        + a.꼴 + ' ' + a.글.length + '자' + (있나 ? ' · 글자는 있으나 모집 부분이 아님' : '') + ')' });
      console.log(줄 + '우리 것 아님 (' + a.꼴 + ' ' + a.글.length + '자)');
    }
  } catch (e) {
    셈.못읽음++;
    보류남을것.push({ ...x, 왜: '첨부를 못 받았습니다 · ' + String(e.message).slice(0, 120) });
    console.log(줄 + '★ 막힘 — ' + String(e.message).slice(0, 80));
  }
  await new Promise((f2) => setTimeout(f2, 250));
}

console.log('\n② 판정 —');
console.log('  ★ 회원 화면으로   ' + 회원갈것.length + '건');
console.log('  쓰레기통으로      ' + 쓰레기갈것.length + '건 (우리 것 아님 ' + 셈.남의것
  + ' · 가산점뿐 ' + 셈.가산점 + ')');
console.log('  보류함에 그대로   ' + 보류남을것.length + '건 (첨부 없음 ' + 셈.첨부없음
  + ' · 못 읽음 ' + 셈.못읽음 + ' · 못 가림 ' + (보류남을것.length - 셈.첨부없음 - 셈.못읽음) + ')');

if (회원갈것.length) {
  console.log('\n  회원 화면으로 갈 것 —');
  for (const x of 회원갈것) {
    console.log('    ' + x.직군.padEnd(6) + ' ' + x.org_name + ' · ' + String(x.title).slice(0, 50));
  }
}

/* ③ 판정만 파일로 남깁니다 — **이 도구는 DB 를 고치지 않습니다.**
   공고를 살리는 창구는 admin_decide() 뿐이고 그건 is_admin() 을 요구합니다
   (로그인한 관리자만 · 서비스 열쇠로는 안 됩니다 · 2026-10-02 확인).
   그래서 판정을 파일로 내고, 고치는 일은 눈으로 볼 수 있는 SQL 로 따로 합니다.
   「관리자가 확인 후 올림」 원칙에도 이게 맞습니다 */
const 낼것 = {
  만든때: new Date().toISOString(),
  본것: 할것.length,
  회원갈것: 회원갈것.map((x) => ({ id: x.id, 기관: x.org_name, 제목: x.title, 직군: x.직군, 걸린줄: x.걸린줄 })),
  쓰레기갈것: 쓰레기갈것.map((x) => ({ id: x.id, 기관: x.org_name, 제목: x.title, url: x.url, 왜: x.왜 })),
  보류남을것: 보류남을것.map((x) => ({ id: x.id, 기관: x.org_name, 제목: x.title, 왜: x.왜 })),
};
const 낼파일 = path.join(ROOT, 'GJ2보류판정.json');
fs.writeFileSync(낼파일, JSON.stringify(낼것, null, 1));
console.log('\n판정을 ' + 낼파일 + ' 에 적었습니다 (DB 는 안 고쳤습니다)');
console.log(Math.round((Date.now() - t0) / 1000) + '초');
