/* 나라일터(GJ2) 공고의 **직군 근거를 원문에서 찾습니다** — 읽기만 합니다
 *
 *   node tools/나라일터_직군근거.mjs GJ306074 GJ305988 …
 *   node tools/나라일터_직군근거.mjs --근거없는것      직군새는것 이 「근거 없음」이라 한 GJ2 전부
 *   node tools/나라일터_직군근거.mjs --자기점검
 *
 * ── 왜 (2026-10-20 세중님) ────────────────────────────────────
 * `tools/직군새는것.mjs` 가 회원 화면 GJ2 **5건**을 「담아 둔 본문 어디에도
 * 우리 직군 말이 없는데 직군이 붙었다」로 냈습니다. 그런데 그 도구는
 * **job_body 만** 봅니다 — 나라일터는 자격이 **첨부 공고문**에 있는 일이
 * 흔하고, `getItemPosition` 의 직급 줄에만 적히는 일도 있습니다.
 * 그래서 **세 자리를 순서대로** 봅니다 —
 *   ① /getItem 의 contents (상세 본문)
 *   ② /getItemPosition 의 직급 줄
 *   ③ /getItemFile 의 첨부 (공고문부터)
 *
 * ★ 아무것도 바꾸지 않습니다. 고치는 것은 보고 뒤입니다.
 */
import fs from 'node:fs';
import { 공공부르기 } from './공공데이터부르기.mjs';
import { 첨부읽기, 진짜형식, 이전다음글떼기, 워커끝내기 } from './공고문읽기.mjs';
import { 점수 } from './hosp/hs_files.js';

const BASE = 'https://apis.data.go.kr/1760000/PblJobService';
const argv = process.argv.slice(2);
const 자기점검만 = argv.includes('--자기점검');
const 근거없는것 = argv.includes('--근거없는것');

/** 우리 직군 말 — `직군의심()` 과 같은 잣대 (「치료사·치료직·치료 선생」) */
export const 우리말 = /(물리|작업|도수)\s*치료\s*(사|직|선생|실|팀|과)?/;
export const 우리말센것 = /(물리|작업|도수)\s*치료\s*(사|직|선생)/;

/** 글에서 우리 직군 말이 든 줄만 — 앞뒤 안 가져옵니다 (지침 15절) */
export function 근거줄(글, 센것 = true) {
  const 잣대 = 센것 ? 우리말센것 : 우리말;
  return [...new Set(String(글 || '').split(/\r?\n/).map((l) => l.trim())
    .filter((l) => l && 잣대.test(l)))];
}

/** XML 에서 태그 하나의 값들 */
export function 태그값(xml, 이름) {
  const 꼴 = new RegExp('<' + 이름 + '>([\\s\\S]*?)</' + 이름 + '>', 'g');
  return [...String(xml || '').matchAll(꼴)].map((m) => m[1]
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"').replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d))));
}

/* ── 자기점검 ─────────────────────────────────────────── */
function 자기점검() {
  const 잼 = [];
  const 보 = (무엇, 참) => 잼.push([무엇, !!참]);
  보('치료사 줄만 집는다',
    근거줄('○ 응시자격 : 작업치료사 면허 소지자\n○ 근무지 : 보건소').length === 1);
  보('「물리치료실」은 센 잣대에 안 걸린다', 근거줄('물리치료실 배치').length === 0);
  보('「물리치료실」은 느슨한 잣대에 걸린다', 근거줄('물리치료실 배치', false).length === 1);
  보('같은 줄을 두 번 안 센다',
    근거줄('작업치료사 면허\n작업치료사 면허').length === 1);
  보('CDATA 를 푼다', 태그값('<contents><![CDATA[작업치료사 1명]]></contents>', 'contents')[0] === '작업치료사 1명');
  보('엔티티를 푼다', 태그값('<a>1 &amp; 2</a>', 'a')[0] === '1 & 2');
  보('없는 태그는 빈 목록', 태그값('<a>1</a>', 'b').length === 0);
  보('여러 줄 태그를 다 집는다', 태그값('<p>가</p><p>나</p>', 'p').length === 2);
  const 탈 = 잼.filter((y) => !y[1]);
  for (const y of 잼) if (!y[1]) console.log('  ✗ ' + y[0]);
  console.log((탈.length ? '✗ 자기점검 ' + 탈.length + '가지 탈'
    : '○ 나라일터_직군근거 자기점검 통과 — ' + 잼.length + '가지') + ' (API·DB 를 두드리지 않았습니다)');
  return !탈.length;
}
if (!자기점검()) process.exit(1);
if (자기점검만) process.exit(0);

/* ── 열쇠 ──────────────────────────────────────────────── */
const cfg = {};
for (const f of ['.env', '.env.local']) {
  if (!fs.existsSync(f)) continue;
  for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) cfg[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const U = cfg.SUPABASE_URL;
const K = cfg.SUPABASE_SERVICE_KEY;
const 공공열쇠 = cfg.ALIO_DETAIL_KEY;
if (!U || !K || !공공열쇠) { console.error('✗ SUPABASE_URL · SUPABASE_SERVICE_KEY · ALIO_DETAIL_KEY 가 있어야 합니다'); process.exit(1); }
const H = { apikey: K, Authorization: 'Bearer ' + K };

let 아이디들 = argv.filter((a) => /^GJ\d+$/.test(a));
if (근거없는것 && !아이디들.length) {
  /* 직군새는것 과 같은 길 — 회원 화면 · 직군 붙음 · GJ2 */
  const r = await fetch(U + '/rest/v1/job_posts?select=id&source=eq.GJ2'
    + '&job_group=not.is.null&job_group=neq.&order=db_insert_at.desc&limit=100', { headers: H });
  const j = await r.json();
  const p = await fetch(U + '/rest/v1/job_posts_pub?select=id&limit=400', { headers: H });
  const 보임 = new Set((await p.json()).map((x) => x.id));
  아이디들 = j.filter((x) => 보임.has(x.id)).map((x) => x.id);
}
if (!아이디들.length) { console.error('✗ 아이디를 적으십시오 (GJ306074 …)'); process.exit(1); }

const r0 = await fetch(U + '/rest/v1/job_posts?select='
  + encodeURIComponent('id,source,org_name,title,job_group,url,hold,hidden,evidence')
  + '&id=in.(' + 아이디들.join(',') + ')', { headers: H });
const 공고 = await r0.json();
console.log('\n나라일터 공고 ' + 공고.length + '건의 직군 근거를 원문에서 찾습니다\n');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0.0.0';
const 결과 = [];

for (const x of 공고) {
  const idx = String(x.id).replace(/^GJ/, '');     /* GJ306101 꼴 — /^GJ2?/ 로 떼면 숫자 2 를 같이 뗍니다 */
  console.log('════════ ' + x.id + ' · ' + String(x.org_name || '').slice(0, 20));
  console.log('  제목  ' + String(x.title || '').slice(0, 72));
  console.log('  지금  직군 ' + x.job_group + ' · 보류 ' + x.hold + ' · 숨김 ' + x.hidden);

  const 찾음 = { 상세: [], 직급: [], 첨부: [] };

  /* ① 상세 contents */
  try {
    const r = await 공공부르기(BASE + '/getItem?serviceKey=' + 공공열쇠 + '&idx=' + idx,
      { headers: { accept: 'application/xml' } });
    const 글 = 태그값(r.글, 'contents').join('\n');
    const 글2 = 이전다음글떼기(글);
    console.log('  ① 상세 contents ' + 글2.length + '자');
    찾음.상세 = 근거줄(글2);
    for (const l of 찾음.상세.slice(0, 4)) console.log('     ▸ ' + l.slice(0, 150));
    if (!찾음.상세.length) {
      const 느슨 = 근거줄(글2, false);
      if (느슨.length) for (const l of 느슨.slice(0, 3)) console.log('     (느슨) ' + l.slice(0, 150));
      else console.log('     (우리 직군 말이 없습니다)');
    }
  } catch (e) { console.log('  ① 상세 ✗ ' + String(e.message).slice(0, 70)); }

  /* ② getItemPosition 직급 줄 */
  try {
    const r = await 공공부르기(BASE + '/getItemPosition?serviceKey=' + 공공열쇠 + '&idx=' + idx,
      { headers: { accept: 'application/xml' } });
    const 줄 = [...String(r.글 || '').matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1]);
    console.log('  ② 직급 줄 ' + 줄.length + '개');
    for (const s of 줄) {
      const 이름 = (태그값(s, 'position')[0] || 태그값(s, 'posname')[0]
        || 태그값(s, 'name')[0] || s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
      const cnt = 태그값(s, 'cnt')[0] || 태그값(s, 'count')[0] || '';
      console.log('     · ' + 이름.slice(0, 90) + (cnt ? '  cnt ' + cnt : ''));
      if (우리말센것.test(이름)) 찾음.직급.push(이름);
    }
  } catch (e) { console.log('  ② 직급 ✗ ' + String(e.message).slice(0, 70)); }

  /* ③ 첨부 — 공고문부터 */
  try {
    const r = await 공공부르기(BASE + '/getItemFile?serviceKey=' + 공공열쇠 + '&idx=' + idx,
      { headers: { accept: 'application/xml' } });
    const 줄 = [...String(r.글 || '').matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1]);
    const 파일 = 줄.map((s) => ({
      이름: (태그값(s, 'filename')[0] || '').trim(),
      길: (태그값(s, 'filepath')[0] || '').trim(),
    })).filter((f) => f.길);
    /* 공고문으로 보이는 것을 먼저 (collect-nara 와 같은 점수) */
    /* ★ 2026-10-22 — 첨부 고르는 순서는 **hs_files 의 점수() 한 자리**입니다 (지침 6절) */
    파일.sort((a, b) => 점수(b.이름) - 점수(a.이름));
    console.log('  ③ 첨부 ' + 파일.length + '개');
    for (const f of 파일.slice(0, 3)) {
      let 주소 = f.길;
      if (!/^https?:/.test(주소)) 주소 = 'https://www.gojobs.go.kr' + (주소.startsWith('/') ? '' : '/') + 주소;
      try {
        const a = await fetch(주소, { headers: { 'User-Agent': UA, Referer: x.url || 'https://www.gojobs.go.kr/' },
          redirect: 'follow', signal: AbortSignal.timeout(30000) });
        const buf = Buffer.from(await a.arrayBuffer());
        const 꼴 = 진짜형식(buf);
        console.log('     ' + f.이름.slice(0, 44) + ' — ' + a.status + ' · ' + buf.length + '바이트 · ' + 꼴);
        if (!['pdf', 'hwp', 'zip계열'].includes(꼴)) continue;
        const 읽 = await 첨부읽기(buf, f.이름);
        const md = String((읽 && 읽.md) || '');
        console.log('        글자 ' + md.length + (읽 && 읽.왜 ? ' · 탈 ' + String(읽.왜).slice(0, 50) : ''));
        const ls = 근거줄(md);
        for (const l of ls.slice(0, 4)) console.log('        ▸ ' + l.slice(0, 150));
        찾음.첨부.push(...ls);
      } catch (e) { console.log('     ' + f.이름.slice(0, 40) + ' ✗ ' + String(e.message).slice(0, 50)); }
      await new Promise((z) => setTimeout(z, 600));
    }
  } catch (e) { console.log('  ③ 첨부 ✗ ' + String(e.message).slice(0, 70)); }

  const 어디 = [찾음.상세.length && '상세', 찾음.직급.length && '직급줄', 찾음.첨부.length && '첨부']
    .filter(Boolean);
  const 판정 = 어디.length ? 'ⓐ 원문에 있음 (' + 어디.join('·') + ')' : 'ⓑ 원문 어디에도 없음';
  console.log('  ★ ' + 판정 + '\n');
  결과.push({ id: x.id, 기관: x.org_name, 제목: x.title, 직군: x.job_group, 판정,
    근거: (찾음.상세[0] || 찾음.직급[0] || 찾음.첨부[0] || '').slice(0, 150), 어디 });
}

console.log('── 다섯 줄로 ──');
for (const r of 결과) {
  console.log('  ' + r.id.padEnd(10) + String(r.기관 || '').slice(0, 14).padEnd(15)
    + r.판정.padEnd(26) + (r.근거 ? '「' + r.근거.slice(0, 70) + '」' : ''));
}
console.log('\n※ 아무것도 바꾸지 않았습니다.');
await 워커끝내기?.();
