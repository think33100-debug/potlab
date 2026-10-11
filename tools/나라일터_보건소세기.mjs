/* 나라일터 목록 **원문**에서 보건소·치료사 낱말을 셉니다 (2026-10-11).
 *
 *   node tools/나라일터_보건소세기.mjs [며칠]
 *
 * ── 왜 ───────────────────────────────────────────────────────
 * 나라일터는 최근 30일 공고가 **2,368건**인데 수집기가 들여다보는 것은
 * 「볼 것 386건」(제목에 직군 1 · 재활·보건 냄새 67)뿐입니다. 나머지는
 * **기록도 없이** 버려집니다. 그래서 DB 로는 보건소 공고가 있었는지
 * 알 수 없습니다 — 목록 원문을 직접 세는 수밖에 없습니다.
 *
 * 그리고 기관 이름이 **시군구 본청**으로 옵니다 (「충청남도 아산시」).
 * 보건소 공고가 「○○보건소」라는 이름으로 오지 않아서, 기관 이름으로는
 * 못 가립니다. **제목을 봐야 합니다.**
 *
 * **아무것도 담지 않습니다.**
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'https://apis.data.go.kr/1760000/PblJobService';
const 며칠 = Number(process.argv[2]) || 30;

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

const 날 = (더할날) => {
  const d = new Date(Date.now() + 더할날 * 86400000);
  return d.toISOString().slice(0, 10).replace(/-/g, '');
};
const 한칸 = (글, 이름) => {
  const m = 글.match(new RegExp('<' + 이름 + '>([\\s\\S]*?)</' + 이름 + '>'));
  return m ? m[1].trim() : '';
};
const 아이템들 = (글) => [...글.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1]);

const 낱말 = {
  '물리치료사·작업치료사': /물리\s*치료사|작업\s*치료사/,
  '치료사(앞말 없음)': /치료사/,
  '재활': /재활/,
  '보건소·보건의료원·보건지소': /보건소|보건의료원|보건지소/,
  '치매안심': /치매안심|치매\s*센터/,
  '방문건강·지역사회중심재활': /방문\s*건강|지역사회중심재활|통합건강증진/,
  '기간제·시간선택제': /기간제|시간선택제|무기계약/,
};
const 셈 = {}; for (const k of Object.keys(낱말)) 셈[k] = 0;
const 견본 = {}; for (const k of Object.keys(낱말)) 견본[k] = [];

let 전체 = null; let 읽은줄 = 0;
for (let 쪽 = 1; 쪽 <= 40; 쪽++) {
  const u = BASE + '/getList?serviceKey=' + cfg.ALIO_DETAIL_KEY
    + '&pageNo=' + 쪽 + '&numOfRows=100&Sort_order=2'
    + '&Begin_de=' + 날(-며칠) + '&End_de=' + 날(1);
  const r = await fetch(u, { headers: { accept: 'application/xml' } });
  if (!r.ok) { console.error('  ' + 쪽 + '쪽 HTTP ' + r.status); break; }
  const t = await r.text();
  if (전체 === null) {
    전체 = Number((t.match(/<totalCount>(\d+)<\/totalCount>/) || [])[1] || 0);
    console.log('나라일터 최근 ' + 며칠 + '일 공고 ' + 전체 + '건\n');
  }
  const 줄 = 아이템들(t);
  if (!줄.length) break;
  읽은줄 += 줄.length;
  for (const x of 줄) {
    const 제목 = 한칸(x, 'title');
    const 기관 = 한칸(x, 'insttname');
    const 둘 = 제목 + ' ' + 기관;
    for (const [k, re] of Object.entries(낱말)) {
      if (re.test(둘)) {
        셈[k]++;
        if (견본[k].length < 6) 견본[k].push({ 기관, 제목: 제목.slice(0, 72), idx: 한칸(x, 'idx') });
      }
    }
  }
  if (읽은줄 >= 전체) break;
}

console.log('읽은 줄 ' + 읽은줄 + ' / ' + 전체 + '\n');
console.log('── 제목+기관 이름에 그 낱말이 있는 공고 ──');
for (const k of Object.keys(낱말)) {
  console.log('  ' + String(셈[k]).padStart(5) + '건  ' + k);
}

console.log('\n── 견본 ─────────────────────────────────────────');
for (const k of ['물리치료사·작업치료사', '치료사(앞말 없음)', '보건소·보건의료원·보건지소', '방문건강·지역사회중심재활']) {
  console.log('\n■ ' + k + '  (' + 셈[k] + '건)');
  for (const s of 견본[k]) console.log('   [' + s.기관 + ']  ' + s.제목 + '   (idx ' + s.idx + ')');
}
console.log('\n아무것도 담지 않았습니다.');
