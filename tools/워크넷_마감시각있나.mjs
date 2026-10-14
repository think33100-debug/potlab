/* 워크넷 상세 API 에 **마감 시각** 항목이 있나 — 원문으로 확인합니다
 * (2026-10-14 · 읽기만 · DB 를 안 건드립니다).
 *
 *   node tools/워크넷_마감시각있나.mjs [공고번호]
 *
 * ── 왜 ───────────────────────────────────────────────────────
 * 일곱 칸 가운데 마감시각이 1.4% 로 가장 낮습니다. 회원 화면에서 가장 많은
 * 출처가 워크넷인데(회원 화면 42건) 마감일 337건 중 시각이 **1건**뿐입니다.
 * 제가 「API 가 시각을 안 준다」 고 적었는데 **확인한 적이 없습니다** —
 * 세중님이 다시 확인하라고 하셨습니다 (지침 10절 · 4절).
 *
 * 찍는 것
 *   · 상세 응답 **원문 1,200자** (지침 2절)
 *   · 항목 이름 **전부** (XML 태그 이름 목록)
 *   · 그중 날짜·시각처럼 보이는 항목과 그 값
 *   · 「시각으로 보이는 값(HH:MM)」 이 어디에 있나
 *
 * 열쇠는 찍지 않습니다 — 주소의 authKey 를 가립니다 (지침 8-11).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
function env() {
  const out = {};
  for (const f of ['.env', '.env.local']) {
    const p = path.join(여기, '..', f);
    if (!fs.existsSync(p)) continue;
    for (const l of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*?)\s*$/);
      if (m && !out[m[1]]) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  }
  for (const k of Object.keys(process.env)) if (process.env[k]) out[k] = process.env[k];
  return out;
}
const cfg = env();
if (!cfg.WORK_KEY) { console.error('WORK_KEY 가 없습니다 — 서버에서 돌리십시오'); process.exit(1); }

const URL_ = 'https://www.work24.go.kr/cm/openApi/call/wk/callOpenApiSvcInfo210L01.do';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0.0.0';
const 주소 = (o) => URL_ + '?' + Object.entries({ authKey: cfg.WORK_KEY, returnType: 'XML', ...o })
  .map(([k, v]) => k + '=' + encodeURIComponent(String(v))).join('&');
const 가린주소 = (u) => u.replace(/authKey=[^&]*/, 'authKey=‹가림›');

async function 받기(u) {
  const r = await fetch(u, { headers: { 'User-Agent': UA } });
  return { code: r.status, text: await r.text() };
}

/* ── ① 목록을 한 번 받아 공고번호와 infoSvc 를 얻습니다 ── */
const 번호준것 = process.argv.slice(2).find((x) => !x.startsWith('--'));
let 번호 = 번호준것; let svc = null;

if (!번호) {
  const u = 주소({ callTp: 'L', startPage: 1, display: 5, occupation: '0243' });
  console.log('목록 — ' + 가린주소(u));
  const g = await 받기(u);
  console.log('HTTP ' + g.code + ' · ' + g.text.length + '자');
  번호 = (g.text.match(/<wantedAuthNo>([^<]+)<\/wantedAuthNo>/) || [])[1];
  svc = (g.text.match(/<infoSvc>([^<]+)<\/infoSvc>/) || [])[1];
  console.log('고른 공고번호 ' + 번호 + ' · infoSvc ' + svc);
  console.log('');
}

/* ── ② 상세 ── */
const u2 = 주소({ callTp: 'D', wantedAuthNo: 번호, ...(svc ? { infoSvc: svc } : {}) });
console.log('상세 — ' + 가린주소(u2));
const d = await 받기(u2);
console.log('HTTP ' + d.code + ' · ' + d.text.length + '자');
console.log('');
console.log('── 응답 원문 앞 1,200자 ──');
console.log(d.text.slice(0, 1200));
console.log('');

const 이름 = [...new Set([...d.text.matchAll(/<([A-Za-z][A-Za-z0-9_]*)>/g)].map((m) => m[1]))];
console.log('── 항목 이름 ' + 이름.length + '개 (전부) ──');
console.log(이름.join(' · '));
console.log('');

console.log('── 이름에 날짜·시각·기간이 든 항목과 값 ──');
let 하나라도 = false;
for (const n of 이름) {
  if (!/(dt|date|day|time|hour|기간|일자|시각|마감|end|close|rcept|regDt)/i.test(n)) continue;
  const v = (d.text.match(new RegExp('<' + n + '>([\\s\\S]*?)</' + n + '>')) || [])[1];
  if (v === undefined) continue;
  하나라도 = true;
  console.log('   ' + n.padEnd(22) + String(v).replace(/\s+/g, ' ').slice(0, 70));
}
if (!하나라도) console.log('   (없습니다)');
console.log('');

console.log('── 「HH:MM」 꼴이 응답 어디에 있나 ──');
const 시각들 = [...d.text.matchAll(/([0-2]?\d:[0-5]\d)/g)];
if (!시각들.length) {
  console.log('   **없습니다** — 이 응답에 시각으로 보이는 값이 한 개도 없습니다');
} else {
  for (const m of 시각들.slice(0, 10)) {
    const 앞 = d.text.slice(Math.max(0, m.index - 70), m.index).replace(/\s+/g, ' ');
    console.log('   ' + m[1] + '   ← …' + 앞.slice(-64));
  }
}
