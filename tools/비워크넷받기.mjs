/* 비워크넷받기 — 워크넷 아닌 공고 70건의 공고문을 **다시 읽습니다**.
 *
 *   node tools/비워크넷받기.mjs [--몇개 70]
 *
 * **DB 를 안 바꿉니다.** 받아서 읽고 파일로만 냅니다.
 *
 * ── 어디서 글을 얻나 ────────────────────────────────────────
 *   ① job_body.body            수집기가 이미 읽어 둔 공고문 글자 (29건)
 *   ② 공고 화면(url)을 직접     HS·HS3 처럼 병원 누리집 공고
 *   ③ 나라일터 getItemFile      GJ2 — 첨부(pdf·hwp) 주소를 API 가 줍니다
 *   ④ 알리오 상세 API           AL2·AL — 구조화된 칸이 옵니다
 *
 * ★ 받은 파일이 **진짜 그 형식인지** 앞 글자로 확인합니다 (작업지침 5절).
 * ★ 주소의 &amp; 는 풉니다 — 안 풀면 HTML 오류 화면이 옵니다.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { 다섯칸뽑기, 낱말훑기 } from './칸뽑기규칙.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 뿌리 = path.join(여기, '..');

function env() {
  const out = {};
  for (const f of [path.join(뿌리, '.env'), path.join(뿌리, '.env.local')]) {
    if (!fs.existsSync(f)) continue;
    fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((l) => {
      const m = l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*?)\s*$/);
      /* ★ 값이 따옴표에 싸여 있을 수 있습니다 (서버 .env 가 그렇습니다).
         안 벗기면 열쇠가 한 글자 길어져 「등록되지 않은 서비스키」가 납니다 */
      if (m && !out[m[1]]) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    });
  }
  for (const k of Object.keys(process.env)) if (process.env[k]) out[k] = process.env[k];
  return out;
}
const cfg = env();
const URL_ = cfg.SUPABASE_URL || cfg.NEXT_PUBLIC_SUPABASE_URL;
const KEY = cfg.SUPABASE_SERVICE_KEY;
const 공공열쇠 = (cfg.ALIO_DETAIL_KEY || '').replace(/^['"]|['"]$/g, '');
const 인수 = (이름, 기본) => {
  const i = process.argv.indexOf('--' + 이름);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : 기본;
};
const 몇개 = Number(인수('몇개', 100));
const 받은터 = path.join(뿌리, 'tmp', '받은공고문');
fs.mkdirSync(받은터, { recursive: true });

/* ── 쓸 것 ──────────────────────────────────────────────── */
const 전 = JSON.parse(fs.readFileSync(path.join(뿌리, 'tmp', '점검전.json'), 'utf8'));
const 비WN = 전.전.결과.filter((r) => r.source !== 'WN' && r.source !== 'WN2').slice(0, 몇개);

/* job_body 글자 */
async function 한쪽(길, 부터, 까지) {
  const r = await fetch(URL_ + '/rest/v1/' + 길,
    { headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, Range: `${부터}-${까지}` } });
  if (!r.ok) throw new Error(r.status + ' ' + (await r.text()).slice(0, 160));
  return r.json();
}
async function 읽기(길) {
  const out = [];
  for (let b = 0; b < 20000; b += 100) {
    const x = await 한쪽(길, b, b + 99);
    if (!x.length) break; out.push(...x);
    if (x.length < 100) break;
  }
  return out;
}
const 글자집 = new Map((await 읽기('job_body?select=job_id,file_name,url,body')).map((b) => [b.job_id, b]));

/* ── 도구 ───────────────────────────────────────────────── */
const 풀기 = (s) => String(s || '').replace(/&amp;/g, '&').replace(/&#38;/g, '&');
const 태그걷기 = (html) => String(html)
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|tr|li|h\d)>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();

function 진짜형식(b) {
  const 같나 = (...xs) => xs.every((x, i) => b[i] === x);
  if (같나(0x25, 0x50, 0x44, 0x46, 0x2d)) return 'pdf';
  if (같나(0xd0, 0xcf, 0x11, 0xe0)) return 'hwp';
  if (같나(0x50, 0x4b, 0x03, 0x04)) return 'zip계열(hwpx·docx)';
  if (같나(0xff, 0xd8, 0xff)) return 'jpg';
  if (같나(0x89, 0x50, 0x4e, 0x47)) return 'png';
  let i = 0; while (i < b.length && b[i] <= 0x20) i++;
  if (b[i] === 0x3c) return 'HTML';
  return '모름';
}

/* kordoc — 글자와 표를 뽑습니다 */
const kordocCli = path.join(뿌리, 'tools', 'kordoc', 'node_modules', 'kordoc', 'dist', 'cli.js');
const kordoc있나 = fs.existsSync(kordocCli);
async function kordoc읽기(파일) {
  if (!kordoc있나) return { 글: '', 왜: 'kordoc 이 안 깔려 있습니다' };
  const { execFileSync } = await import('node:child_process');
  try {
    const out = execFileSync(process.execPath, [kordocCli, 파일], {
      maxBuffer: 64 * 1024 * 1024, timeout: 120000, stdio: ['ignore', 'pipe', 'pipe'],
    }).toString();
    return { 글: out };
  } catch (e) {
    return { 글: '', 왜: String(e.stderr || e.message).slice(0, 160) };
  }
}

/* ── 공고마다 ───────────────────────────────────────────── */
const 결과 = [];
let 받은파일 = 0;
let 브라우저 = null;
for (const r of 비WN) {
  const 한건 = { id: r.id, source: r.source, org_name: r.org_name, title: r.title,
    job_group: r.job_group, 글출처: null, 글자수: 0, 파일: null, 형식: null, 탈: null };
  let 글 = '';

  /* ① 이미 읽어 둔 글자 */
  const b = 글자집.get(r.id);
  if (b && (b.body || '').length > 200) {
    글 = b.body; 한건.글출처 = 'job_body(수집기가 읽어 둔 것)';
    한건.파일 = b.file_name || null;
  }

  /* ③ 나라일터 — 첨부 주소를 API 가 줍니다 */
  if (!글 && r.source === 'GJ2' && 공공열쇠) {
    const idx = String(r.id).replace(/^GJ/, '');
    try {
      /* ★ 나라일터는 **1760000/PblJobService** 입니다. 처음에 알리오 주소
         (1051000/recruitment)를 써서 HTTP 400 이 났습니다 — 수집기에서
         베껴 왔어야 했습니다 (tools/collect-nara.mjs:57 · 작업지침 3절) */
      const u = `https://apis.data.go.kr/1760000/PblJobService/getItemFile`
        + `?serviceKey=${공공열쇠}&idx=${idx}`;
      const res = await fetch(u, { headers: { accept: 'application/xml' } });
      한건.탈 = 'getItemFile HTTP ' + res.status;
      const t = await res.text();
      const 씻기 = (x) => String(x).replace(/<!\[CDATA\[|\]\]>/g, '').trim();
      const 서식 = /직무기술|제출서류|서식|응시원서|양식|명세서/;
      const 고름 = [...t.matchAll(/<filename>([\s\S]*?)<\/filename>[\s\S]*?<filepath>([\s\S]*?)<\/filepath>/g)]
        .map((m) => ({ 이름: 씻기(m[1]), 길: 씻기(m[2]) }))
        .filter((x) => /\.(pdf|hwpx?|docx?)$/i.test(x.이름))
        /* 공고문처럼 보이는 것을 먼저 — 지원서·서식은 뒤로 (수집기와 같은 기준) */
        .sort((a, b) => (서식.test(a.이름) ? 1 : 0) - (서식.test(b.이름) ? 1 : 0));
      if (고름[0]) 한건.파일이름 = 고름[0].이름;
      const fp = 고름[0]?.길;
      if (fp) {
        const 주소 = 풀기(fp.startsWith('http') ? fp : 'https://www.gojobs.go.kr/' + fp.replace(/^\//, ''));
        const f = await fetch(주소);
        const buf = Buffer.from(await f.arrayBuffer());
        한건.형식 = 진짜형식(buf);
        const 파일 = path.join(받은터, r.id + (한건.형식 === 'pdf' ? '.pdf' : 한건.형식 === 'hwp' ? '.hwp' : '.bin'));
        fs.writeFileSync(파일, buf); 받은파일++;
        한건.파일 = path.basename(파일);
        if (['pdf', 'hwp', 'zip계열(hwpx·docx)'].includes(한건.형식)) {
          const k = await kordoc읽기(파일);
          if (k.글) { 글 = k.글; 한건.글출처 = 'kordoc(' + 한건.형식 + ')'; }
          else 한건.탈 = 'kordoc — ' + (k.왜 ?? '글자 없음');
        } else 한건.탈 = '받았는데 형식이 ' + 한건.형식;
      }
    } catch (e) { 한건.탈 = String(e.message).slice(0, 140); }
  }

  /* ② 공고 화면을 직접 */
  if (!글 && r.url) {
    try {
      const res = await fetch(풀기(r.url), {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        redirect: 'follow',
      });
      const buf = Buffer.from(await res.arrayBuffer());
      한건.형식 = 진짜형식(buf);
      if (한건.형식 === 'HTML') {
        글 = 태그걷기(buf.toString('utf8'));
        한건.글출처 = '공고 화면(url) HTTP ' + res.status;
      } else 한건.탈 = '공고 주소가 ' + 한건.형식 + ' 입니다 (HTTP ' + res.status + ')';
    } catch (e) { 한건.탈 = '공고 화면을 못 받음 — ' + String(e.message).slice(0, 120); }
  }

  /* ②-2 ★ 병원 누리집은 **자바스크립트로 그립니다.** 그냥 받으면 글이 아니라
     CSS 와 스크립트만 옵니다 (2026-10-10 에 대자인병원에서 24,956자를 받았는데
     「낱말 있음」 본보기가 전부 `.bymqIm{position:absolute…}` 였습니다).
     그래서 **브라우저로 그려서** innerText 를 읽습니다 */
  /* 「받아 둔 글자」가 아닌 모든 공고 화면은 **그려서** 읽습니다.
     처음엔 CSS 가 보일 때만 그렸는데, 그 가림이 3건밖에 안 잡혔습니다 —
     받아 온 HTML 이 멀쩡해 보여도 알맹이가 스크립트 안에 있는 자리가 많습니다 */
  if (r.url) {
    try {
      const { chromium } = await import('playwright');
      브라우저 ||= await chromium.launch();
      const p = await 브라우저.newPage({ locale: 'ko-KR' });
      await p.goto(풀기(r.url), { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
      await p.waitForTimeout(800);
      const t = await p.evaluate(() => document.body.innerText);
      await p.close();
      /* ★ 저장해 둔 글과 그린 글 중 **칸이 더 많이 뽑히는 쪽**을 씁니다.
         job_body 에 담긴 것이 거친 HTML 글자라 그린 쪽이 나은 때가 많습니다 */
      if (t && t.length > 200) {
        const 셈 = (x) => Object.values(다섯칸뽑기(x, r.job_group)).filter(Boolean).length;
        if (!글 || 셈(t) > 셈(글)) { 글 = t; 한건.글출처 = '공고 화면(브라우저로 그려서)'; 한건.탈 = null; }
      }
    } catch (e) { 한건.탈 = (한건.탈 ?? '') + ' · 브라우저 — ' + String(e.message).slice(0, 100); }
  }

  한건.글자수 = 글.length;
  한건.값 = 글.length > 200 ? 다섯칸뽑기(글, r.job_group) : {
    모집인원: null, 접수마감: null, 근무지: null, 지원자격: null, 예상연봉: null };
  한건.낱말 = 글.length > 200 ? 낱말훑기(글) : null;
  결과.push(한건);
  if (결과.length % 10 === 0) console.log('  … ' + 결과.length + '/' + 비WN.length);
}

if (브라우저) await 브라우저.close();

const 낼곳 = path.join(뿌리, 'tmp', '비워크넷후.json');
fs.writeFileSync(낼곳, JSON.stringify({ 잰때: new Date().toISOString(), 받은파일, 결과 }, null, 1) + '\n');

console.log('\n── 워크넷 아닌 ' + 결과.length + '건 ──');
const 셈 = { 모집인원: 0, 접수마감: 0, 근무지: 0, 지원자격: 0, 예상연봉: 0 };
for (const r of 결과) for (const k of Object.keys(셈)) if (r.값[k]) 셈[k]++;
for (const [k, v] of Object.entries(셈)) {
  console.log('  ' + k.padEnd(8) + String(v).padStart(3) + '/' + 결과.length
    + ' (' + Math.round(v / 결과.length * 100) + '%)');
}
console.log('  글을 얻은 공고 ' + 결과.filter((r) => r.글자수 > 200).length + '건 · 받은 파일 ' + 받은파일 + '개');
console.log('\n→ ' + path.relative(뿌리, 낼곳));
