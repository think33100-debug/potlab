/* 기관 삭제 요청 처리 — 제외 목록 기록 · 기존 게시물 삭제 · 보낸/대기 게시물 취소 (2026-11-17)

   node tools/reels/게시중단.mjs --기관 rapo777_0001 --사유 "기관 홍보팀 메일 요청"            마른 실행 (무엇을 할지만)
   node tools/reels/게시중단.mjs --기관 rapo777_0001 --사유 "…" --요청때 2026-11-17T10:00+09:00 --실행

   하는 일 (CLAUDE_README 6절)
   ① 묶음(institutions.json)에서 그 기관을 **정확히 하나** 찾습니다 (institution_ref 또는 key 그대로)
   ② 묶음 밖 ~/rapo777_게시금지.json 의 blocked_institutions 에 (새 묶음으로 바꿔도 남게 · ykiho 도 적음) 기관 참조번호 · key · 사유 · 요청 시각 · 기존 게시물ID 를 더합니다
      바꾸기 전 원본은 ~/되돌림/do_not_publish_<때>.json (지침 8-19)
   ③ 이미 올린 게시물 — IG 열쇠가 있으면 DELETE /{media_id} 를 부르고 응답 원문을 남깁니다.
      ★ 이 API 는 메타 블로그(2025-12)로만 확인했고 명세 원문은 못 열었습니다. 실패하면 「손으로 지울 것」으로 넘깁니다
   ④ 메일로 보낸 것(휴대폰 올림 대기) — 기록을 「취소」로 바꾸고, 메일로 「올리지 마세요 · 이미 올렸으면 지우세요」를 알립니다
      (휴대폰에서 올린 게시물은 게시물 ID 를 우리가 모릅니다 — 사람이 지웁니다)
   ⑤ 발행 대기(log/릴스_대기.json) 에 있던 그 기관 공고 — 「제외」로 바꿉니다
   그 뒤로 run.mjs 는 매 발행 직전에 이 파일을 다시 읽어 그 기관을 **어떤 이미지로도** 내지 않습니다 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 묶음폴더, 묶음읽기, 금지읽기, 우리금지파일, 우리금지읽기 } from './rapo777.mjs';
import { 게시물지우기 } from './ig.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(여기, '..', '..');
function env() {
  const out = {};
  for (const f of ['.env.local', '.env'].map((x) => path.join(ROOT, x))) {
    if (!fs.existsSync(f)) continue;
    for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
      const m = l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*?)\s*$/);
      if (m && !out[m[1]]) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  }
  for (const k of Object.keys(process.env)) if (process.env[k]) out[k] = process.env[k];
  return out;
}
const 인수 = (이름, 기본 = null) => { const i = process.argv.indexOf('--' + 이름); return i > 0 ? process.argv[i + 1] : 기본; };
const cfg = env();
const 실행 = process.argv.includes('--실행');
const 무엇 = 인수('기관'); const 사유 = 인수('사유');
if (!무엇 || !사유) { console.error('--기관 <institution_ref|key> --사유 "<까닭>" 가 필요합니다'); process.exit(2); }
const 요청때 = 인수('요청때', new Date().toISOString());

const 묶음 = 묶음읽기(묶음폴더(cfg));
const 걸림 = 묶음.기관들.filter((x) => x.institution_ref === 무엇 || x.key === 무엇);
if (걸림.length !== 1) {
  console.error(`기관을 하나로 못 정했습니다 — ${걸림.length}곳 (${걸림.map((x) => x.institution_ref + ' ' + x.name + ' ' + (x.address || '')).join(' / ')}). institution_ref 로 다시 주세요`);
  process.exit(1);
}
const 기 = 걸림[0];

const 기록파일 = path.join(ROOT, 'log', '릴스_올림.json');
const 대기파일 = path.join(ROOT, 'log', '릴스_대기.json');
const 발행기록파일 = path.join(ROOT, 'log', '릴스_발행기록.jsonl');
const 기록 = fs.existsSync(기록파일) ? JSON.parse(fs.readFileSync(기록파일, 'utf8')) : {};
const 대기 = fs.existsSync(대기파일) ? JSON.parse(fs.readFileSync(대기파일, 'utf8')) : {};

const 그기관 = Object.entries(기록).filter(([k, v]) => !k.startsWith('__') && v?.이미지?.기관ref === 기.institution_ref);
const 올린것 = 그기관.filter(([, v]) => v.게시물ID || v.카드게시물ID);   /* 릴스·카드뉴스 둘 다 */
const 보낸것 = 그기관.filter(([, v]) => !v.게시물ID && v.메일보낸때 && !/취소|삭제/.test(v.상태 || ''));
const 대기것 = Object.entries(대기).filter(([, v]) => v.기관ref === 기.institution_ref);
const 게시물ID = [...new Set(올린것.flatMap(([, v]) => [v.게시물ID, v.카드게시물ID]).filter(Boolean))];

console.log(`기관 ${기.institution_ref} · ${기.name} · ${기.address || '주소 없음'}`);
console.log(`  올린 게시물 ${게시물ID.length} (${게시물ID.join(', ') || '없음'}) · 메일로 보낸 것 ${보낸것.length} · 발행 대기 ${대기것.length}`);
금지읽기(묶음.폴더);   /* 묶음 안 목록이 있나만 봅니다 — 쓰는 것은 묶음 밖 목록 하나 */
const 금지 = 우리금지읽기();
const 이미 = 금지.blocked_institutions.some((b) => b.institution_ref === 기.institution_ref && b.key === 기.key);
console.log(`  제외 목록 — ${이미 ? '이미 있음 (게시물ID 만 보탭니다)' : '새로 더함'}`);
if (!실행) { console.log('\n마른 실행 — 아무것도 바꾸지 않았습니다. --실행 을 붙이면 합니다'); process.exit(0); }

/* ② 제외 목록 — 원본을 먼저 ~/되돌림 에 */
const 되돌림터 = path.join(os.homedir(), '되돌림');
fs.mkdirSync(되돌림터, { recursive: true });
const 때 = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 16).replace(/[-:T]/g, '').replace(/^(\d{8})/, '$1_');
const 되돌림파일 = path.join(되돌림터, `do_not_publish_${때}.json`);
if (fs.existsSync(우리금지파일())) fs.copyFileSync(우리금지파일(), 되돌림파일); else fs.writeFileSync(되돌림파일, '{"blocked_institutions":[]}\n');
if (이미) {
  const b = 금지.blocked_institutions.find((x) => x.institution_ref === 기.institution_ref && x.key === 기.key);
  b.related_post_ids = [...new Set([...(b.related_post_ids || []), ...게시물ID])];
} else {
  /* ykiho 도 적습니다 — 새 묶음에서 institution_ref 번호가 바뀌어도 막히게 */
  금지.blocked_institutions.push({ institution_ref: 기.institution_ref, key: 기.key, ykiho: 기.ykiho || null, name: 기.name, reason: 사유, requested_at: 요청때, related_post_ids: 게시물ID });
}
금지.updated_at = new Date().toISOString().slice(0, 10);
fs.writeFileSync(우리금지파일(), JSON.stringify(금지, null, 2));
const 다시 = 우리금지읽기().blocked_institutions.filter((x) => x.institution_ref === 기.institution_ref && x.key === 기.key).length;
if (다시 !== 1) { console.error(`✗ 제외 목록에 ${다시}줄 — 1줄이어야 합니다. 되돌림: ${되돌림파일}`); process.exit(1); }
console.log(`  ○ 제외 목록 기록 ${우리금지파일()} · 되돌림 ${되돌림파일}`);

const 줄적기 = (줄) => fs.appendFileSync(발행기록파일, JSON.stringify({ 때: new Date().toISOString(), 기관ref: 기.institution_ref, 기관: 기.name, ...줄 }) + '\n');
fs.mkdirSync(path.dirname(발행기록파일), { recursive: true });
줄적기({ 결과: '게시중단 요청', 사유, 요청때 });

/* ③ 올린 게시물 삭제 */
const 손으로 = [];
for (const id of 게시물ID) {
  const r = await 게시물지우기(cfg, id);
  if (r.ok) {
    줄적기({ 결과: '삭제', 게시물ID: id, 응답: r.응답 });
    for (const [k] of 올린것) {
      if (기록[k].게시물ID === id) 기록[k] = { ...기록[k], 상태: '삭제됨', 삭제때: new Date().toISOString() };
      if (기록[k].카드게시물ID === id) 기록[k] = { ...기록[k], 카드상태: '삭제됨', 카드삭제때: new Date().toISOString() };
    }
  }
  else { 손으로.push(`${id} (${r.응답.slice(0, 80)})`); 줄적기({ 결과: '삭제 실패', 게시물ID: id, 응답: r.응답 }); }
}
/* 손으로 지울 것도 기록에 표시 — 「올림」으로 남겨 두지 않습니다 */
for (const [k] of 올린것) {
  if (기록[k].게시물ID && 기록[k].상태 !== '삭제됨') 기록[k] = { ...기록[k], 상태: '삭제 필요 — 손으로 (게시 중단 요청)' };
  if (기록[k].카드게시물ID && 기록[k].카드상태 !== '삭제됨') 기록[k] = { ...기록[k], 카드상태: '삭제 필요 — 손으로 (게시 중단 요청)' };
}
/* 아직 안 올린 카드뉴스도 취소 */
for (const [k, v] of 그기관) if ((v.카드 || []).length && !v.카드게시물ID) 기록[k] = { ...기록[k], 카드상태: '취소 — 게시 중단 요청' };
/* ④ 메일로 보낸 것 — 취소 */
for (const [k, v] of 보낸것) { 기록[k] = { ...v, 상태: '취소 — 게시 중단 요청', 취소때: new Date().toISOString() }; 줄적기({ 결과: '취소', 공고: [k] }); }
/* ⑤ 발행 대기 — 제외 */
for (const [k, v] of 대기것) { 대기[k] = { ...v, 제외: true, 까닭: `게시 중단 요청 (${사유})` }; 줄적기({ 결과: '제외', 공고: [k] }); }
if (Object.keys(기록).length) fs.writeFileSync(기록파일, JSON.stringify(기록, null, 2));
if (대기것.length) fs.writeFileSync(대기파일, JSON.stringify(대기, null, 2));

console.log(`  ○ 삭제 ${게시물ID.length - 손으로.length} · 손으로 지울 것 ${손으로.length} · 취소 ${보낸것.length} · 대기 제외 ${대기것.length}`);
const 알림 = [
  `${기.name} (${기.institution_ref}) — 게시 중단 요청을 처리했습니다.`, `사유: ${사유} · 요청 시각: ${요청때}`, '',
  `제외 목록에 기록했습니다. 이 기관은 다른 로고·사진으로도 다시 올리지 않습니다.`,
  ...(손으로.length ? ['', '★ 인스타에서 손으로 지워 주세요:', ...손으로.map((x) => '  · ' + x)] : []),
  ...(보낸것.length ? ['', '★ 메일로 받은 아래 릴스는 올리지 마세요. 이미 올렸다면 인스타에서 지워 주세요:',
    ...보낸것.map(([k, v]) => `  · 공고 ${k} · ${v.직군 || ''} · ${v.메일보낸때}${v.드라이브 ? ' · ' + v.드라이브 : ''}`)] : []),
].join('\n');
console.log('\n' + 알림);
if (cfg.RESEND_KEY && cfg.NOTIFY_EMAIL) {
  const r = await fetch('https://api.resend.com/emails', { method: 'POST',
    headers: { Authorization: 'Bearer ' + cfg.RESEND_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: cfg.MAIL_FROM || 'potjob <onboarding@resend.dev>', to: [cfg.NOTIFY_EMAIL],
      subject: `[RAPO 릴스] 게시 중단 — ${기.name}`, text: 알림 }) });
  console.log(`메일 → ${r.status}`);
}
