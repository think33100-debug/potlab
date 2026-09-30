/* 고용형태를 왜 못 가렸는지 하나씩 짚습니다 (2026-09-30).
 *
 *   node tools/alio-hiretype-why.mjs            우리 직군 것만
 *   node tools/alio-hiretype-why.mjs --전부      남의 직군까지
 *
 * 세중님 지시 — 「고치지 말고 확인만」. 그래서 이 도구는 **아무것도 안 바꿉니다.**
 * 어느 문에서 막혔는지만 그대로 찍습니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 고용형태말, 제목토막, 고용형태가리기 } from './alio-group.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
function env() {
  const out = {};
  for (const f of ['.env.local', '.env', 'web/.env.local'].map((x) => path.join(여기, '..', x))) {
    if (!fs.existsSync(f)) continue;
    fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((l) => {
      const m = l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*?)\s*$/); if (m && !out[m[1]]) out[m[1]] = m[2];
    });
  }
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
  return JSON.parse(t);
}

const 전부 = process.argv.includes('--전부');
const 붙 = (s) => String(s || '').replace(/\s+/g, '');
const 큰갈래로 = (s) => String(s || '').replace(/\(.*?\)/g, '').trim();

const 재료 = await rpc('alio_group_src', { p_secret: cfg.COLLECT_KEY_AL2, p_source: 'AL2' });
const 볼것 = 재료.filter((g) => {
  const 우리 = g.our_job && !g.mixed;
  if (!전부 && !우리) return false;
  return !고용형태가리기(g.group_name, g.고용형태, g.pbanc_ttl,
    g.첨부이름, g.관리자고용형태, g.첨부글).값;
});

console.log('고용형태를 못 가린 것 ' + 볼것.length + '개'
  + (전부 ? ' (남의 직군까지)' : ' (우리 직군만)') + '\n');

const 표 = [];
for (const g of 볼것) {
  const 것 = String(g.고용형태 || '').split(',').map((x) => x.trim()).filter(Boolean);
  const 이름들 = g.첨부이름 || [];
  const 글들 = g.첨부글 || [];
  const 꼴 = [...new Set(이름들.map((x) => /\.hwpx?$/i.test(x) ? 'hwp'
    : /\.pdf$/i.test(x) ? 'pdf' : '그밖에'))].join('+') || '없음';

  /* 어느 문에서 막혔나 */
  let 왜;
  const 토막 = 제목토막(g.pbanc_ttl || '');
  const 제목갈래 = [...new Set(토막.map((x) => 고용형태말.find(([, v]) => v === x.말)).filter(Boolean)
    .map(() => null))];   /* 자리만 차지 */
  const 열쇠 = [(String(g.group_name).match(/\(([^()]*)\)[^()]*$/) || [])[1],
    붙(g.group_name)].filter(Boolean).map(붙);
  const 걸린토막 = 토막.filter((x) => 열쇠.some((k) => k.length >= 2 && 붙(x.글).includes(k)));

  if (!것.length) 왜 = '알리오가 고용형태를 아예 안 줌';
  else if (!토막.length) 왜 = '공고 제목에 고용형태 말이 없음';
  else if (걸린토막.length >= 2) 왜 = '두 고용형태가 다 나와서 짝 못 지음';
  else if (토막.length >= 2 && 걸린토막.length === 0
    && [...new Set(토막.map((x) => x.말))].length >= 2) 왜 = '제목에 이 자리 이름이 안 나옴';
  else 왜 = '제목에서 읽은 갈래가 알리오 목록과 안 맞아 통째로 물림';

  if (!이름들.length) 왜 += ' · 첨부 없음';
  else if (!글들.length) 왜 += (꼴.includes('pdf') ? ' · PDF, OCR 없음' : ' · 첨부 못 읽음');
  else 왜 += ' · 첨부 읽었는데 못 가림';

  표.push({
    공고: g.sn, 기관: String(g.inst_nm).slice(0, 12),
    제목: String(g.pbanc_ttl || '').slice(0, 40),
    묶음: String(g.group_name || '').slice(0, 26),
    알리오목록: String(g.고용형태 || '(없음)'),
    첨부: 꼴, 읽음: 글들.length + '/' + 이름들.length, 왜,
  });

  /* 첨부를 읽었는데 못 가린 것은 **고용형태가 나오는 자리 300자**를 그대로 */
  if (글들.length) {
    const 말목록 = 고용형태말.map(([w]) => w);
    for (const 글 of 글들) {
      const i = 글.split('').findIndex((_, k) => 말목록.some((w) => 글.startsWith(w, k)));
      console.log('── 공고 ' + g.sn + ' · ' + g.group_name + ' — 첨부 원문 300자');
      console.log('   ' + (i < 0 ? '(첨부에 고용형태 낱말이 아예 없습니다)'
        : 글.slice(Math.max(0, i - 80), i + 220).replace(/\s+/g, ' ')));
      console.log('');
    }
  }
}
console.table(표);
