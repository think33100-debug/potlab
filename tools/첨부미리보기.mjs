/* 첨부미리보기 — 수집기를 못 돌리는 자리에서 **이미 DB 에 있는 것**으로
 * 첨부 담기를 미리 봅니다. 읽기만 합니다 (select). 아무것도 안 씁니다.
 *
 *   node tools/첨부미리보기.mjs [--몇개 30]
 *
 * 왜 이렇게 하나 (2026-10-10)
 *   collect-nara/alio 를 여기서 돌리면 공공데이터 열쇠가
 *   **SERVICE_KEY_IS_NOT_REGISTERED_ERROR** 를 냅니다 — 열쇠가 **서버 IP 에만**
 *   등록돼 있습니다. 서버에서 돌리려면 코드를 서버에 올려야 하는데
 *   그건 오늘 밤 금지입니다 (서버 반영 금지 · 작업지침 8-10).
 *
 *   그런데 **job_body 에 공고문 글자가 329줄** 이미 있습니다 (주소·파일 이름까지).
 *   수집기가 공고문을 열어 글자는 담아 두고 **주소만 job_attachments 에
 *   안 넣은 것**입니다. 그래서 그 줄로 「담으면 어떤 모습이 되나」를 그대로
 *   보여 줄 수 있습니다.
 *
 * 내는 것 — docs/첨부_미리보기_1010.json
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 첨부모으기, 진짜형식 } from './첨부담기.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 뿌리 = path.join(여기, '..');

function env() {
  const out = {};
  for (const f of [path.join(뿌리, '.env'), path.join(뿌리, '.env.local')]) {
    if (!fs.existsSync(f)) continue;
    fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((l) => {
      const m = l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*?)\s*$/);
      if (m && !out[m[1]]) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    });
  }
  for (const k of Object.keys(process.env)) if (process.env[k]) out[k] = process.env[k];
  return out;
}
const cfg = env();
const URL_ = cfg.SUPABASE_URL || cfg.NEXT_PUBLIC_SUPABASE_URL;
const KEY = cfg.SUPABASE_SERVICE_KEY;
if (!URL_ || !KEY) { console.error('SUPABASE_URL · SUPABASE_SERVICE_KEY 가 없습니다.'); process.exit(2); }

const 몇개 = (() => { const i = process.argv.indexOf('--몇개'); return i >= 0 ? Number(process.argv[i + 1]) : 30; })();

async function 한쪽(길, 부터, 까지) {
  const r = await fetch(URL_ + '/rest/v1/' + 길, {
    headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, Range: `${부터}-${까지}` },
  });
  if (!r.ok) throw new Error(r.status + ' ' + (await r.text()).slice(0, 200));
  return r.json();
}
/* ★ PostgREST 는 한 번에 **100줄**에서 끊습니다. Range 로 1000 을 달라고 해도
   서버 상한이 이깁니다 — 처음에 「job_body 100줄」로 나와서 또 밟았습니다
   (작업지침 6절 · tools/공고칸채우기.mjs 에 같은 주석이 있습니다) */
async function 읽기(길, 한쪽수 = 100, 최대 = 20000) {
  const out = [];
  for (let 부터 = 0; 부터 < 최대; 부터 += 한쪽수) {
    const 묶음 = await 한쪽(길, 부터, 부터 + 한쪽수 - 1);
    if (!묶음.length) break;
    out.push(...묶음);
    if (묶음.length < 한쪽수) break;
  }
  return out;
}

/* 보이는 공고 중 공고문 글자가 있는 것부터 — 그게 되메우기에 바로 쓰입니다 */
const 글자줄 = await 읽기('job_body?select=job_id,kind,file_name,url,body&order=job_id.asc');
const 보이는 = await 읽기('job_posts?select=id,source,org_name,title&hidden=eq.false&hold=eq.false');
const 보이는집 = new Map(보이는.map((j) => [j.id, j]));

const 쓸것 = 글자줄.filter((b) => 보이는집.has(b.job_id));
const 나머지 = 글자줄.filter((b) => !보이는집.has(b.job_id));

console.log('\n── 이미 DB 에 있는 공고문 ─────────────────────────');
console.log('  job_body            ' + 글자줄.length + '줄 (주소 있음 ' + 글자줄.filter((b) => b.url).length + ')');
console.log('  그중 **보이는 공고** ' + 쓸것.length + '건 ← 되메우기에 바로 쓸 수 있는 것');
console.log('  숨김·마감된 공고     ' + 나머지.length + '건');
console.log('  job_attachments     0줄 ← 주소를 담는 표는 비어 있습니다');

const 모음 = 첨부모으기('미리보기', { 마른: true });
for (const b of [...쓸것, ...나머지].slice(0, 몇개)) {
  const j = 보이는집.get(b.job_id);
  모음.더하기({
    job_id: b.job_id,
    kind: b.kind === '첨부' ? '공고문' : String(b.kind || '공고문'),
    name: b.file_name || '',
    url: b.url || '',
  });
  const 끝 = 모음.줄들[모음.줄들.length - 1];
  if (끝) {
    끝.기관 = j ? j.org_name : '(지금은 안 보이는 공고)';
    끝.제목 = j ? String(j.title).slice(0, 48) : '';
    끝.출처 = j ? j.source : b.job_id.replace(/[0-9].*/, '');
    끝.읽은글자수 = (b.body || '').length;
    끝.보이나 = !!j;
  }
}

console.log('\n── 주소 형식 확인 (앞 16바이트만 받습니다) ──────────');
await 모음.형식확인(몇개);
const 꼴셈 = {};
for (const r of 모음.줄들) 꼴셈[r.형식] = (꼴셈[r.형식] ?? 0) + 1;
for (const [k, v] of Object.entries(꼴셈).sort((a, b) => b[1] - a[1])) {
  console.log('  ' + String(k).padEnd(28) + v + '건');
}

console.log('\n── 몇 건을 눈으로 ─────────────────────────────────');
for (const r of 모음.줄들.slice(0, 8)) {
  console.log(`  ${r.job_id.padEnd(12)} ${String(r.기관).slice(0, 14).padEnd(16)}`
    + ` 글자 ${String(r.읽은글자수).padStart(5)} · ${r.형식} (HTTP ${r.HTTP ?? '-'})`);
  console.log(`      이름 ${String(r.name).slice(0, 50)}`);
  console.log(`      저장이름(ASCII) ${r.저장이름}`);
}

await 모음.끝내기(cfg);

console.log('\n※ 수집기 자체(--마른)는 여기서 못 돌렸습니다 —');
console.log('  공공데이터 열쇠가 **서버 IP 에만** 등록돼 있어 로컬에서는 403 입니다');
console.log('  (SERVICE_KEY_IS_NOT_REGISTERED_ERROR). 아침에 서버에서 돌립니다.');
