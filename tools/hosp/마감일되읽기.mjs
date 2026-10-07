/* 이미 담긴 공고의 **마감일만** 되읽습니다 (2026-10-07 세중님 지시).
 *
 *   node tools/hosp/마감일되읽기.mjs --dry            고치지 않고 셈만
 *   node tools/hosp/마감일되읽기.mjs                  정말로 채웁니다
 *   node tools/hosp/마감일되읽기.mjs --몫 50          앞 50건만
 *   node tools/hosp/마감일되읽기.mjs --출처 ND2       한 출처만 (기본 HS3·ND2)
 *
 * ── 왜 따로 있나 ─────────────────────────────────────────────
 * 수집기는 **게시판에 지금 붙어 있는 글**만 봅니다. 이미 담겨 있는데 마감일이 빈
 * 공고 288건은 수집기가 다시 안 읽습니다. 그래서 저장된 주소로 한 번 되읽습니다.
 *
 * ── 안 건드리는 것 ───────────────────────────────────────────
 *   · 마감일이 **이미 있는** 공고 (DB 쪽 창구가 거릅니다)
 *   · 관리자가 묶은 공고 (admin_locked)
 *   · 제목·직군·갈래 등 다른 칸 전부 — 날짜와 근거만 만집니다
 *
 * ── 규칙은 한 벌 ─────────────────────────────────────────────
 *   접수기간 뽑기   tools/hosp/hs_dates.js  (수집기 둘도 같은 것을 씁니다)
 *   받는 길        tools/certs/index.mjs   (중간 인증서 · 옛 암호 · 인코딩)
 *   쓰기           DB 의 마감일되읽기()      ← 날짜만 쓰는 창구
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { 글받기 } from '../certs/index.mjs';

const require = createRequire(import.meta.url);
const { hsDetailDates, hsText, hs접수문장 } = require('./hs_dates.js');

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const dry = argv.includes('--dry');
const 값 = (이름, 기본) => { const i = argv.indexOf(이름); return i > -1 && argv[i + 1] != null ? argv[i + 1] : 기본; };
const 몫 = Number(값('--몫', 400));
const 동시 = Number(값('--동시', 6));
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
  + '(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

/* .env — 값은 찍지 않습니다 */
const cfg = {};
for (const f of ['.env', '.env.local']) {
  const p = path.join(여기, '..', '..', f);
  if (!fs.existsSync(p)) continue;
  for (const 줄 of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = 줄.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) cfg[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}
const 오늘점 = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }).replace(/-/g, '.');

/* 읽은 날짜가 쓸만한가 — 수집기 둘과 같은 기준입니다.
   여기서는 올린 날을 모릅니다(창구가 안 내줍니다) → 「오늘 − 400일」 이 바닥입니다.
   서산중앙병원이 낸 2021.08.12 같은 옛 글 날짜는 여기서 걸립니다 */
function 날더하기(점날, 날수) {
  const [y, m, d] = String(점날).split('.').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 날수)).toISOString().slice(0, 10).replace(/-/g, '.');
}
function 쓸만한가(d) {
  if (!d || !d.to) return '';
  const 점 = (s) => String(s || '').replace(/-/g, '.');
  const to = 점(d.to), from = 점(d.from);
  if (!/^20\d{2}\.\d{2}\.\d{2}$/.test(to)) return '';
  if (from && from > to) return '';
  if (to < 날더하기(오늘점, -400)) return '';
  if (to > 날더하기(오늘점, 400)) return '';
  return to;
}

async function rpc(fn, body) {
  const k = cfg.SUPABASE_ANON_KEY;
  const r = await fetch(cfg.SUPABASE_URL + '/rest/v1/rpc/' + fn, {
    method: 'POST',
    headers: { apikey: k, Authorization: 'Bearer ' + k, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(fn + ' HTTP ' + r.status + ' · ' + t.slice(0, 250));
  try { return JSON.parse(t); } catch { return t; }
}

/* 어느 출처를 되읽나 — 열쇠 이름과 짝지어 둡니다.
   `collect_peek` 은 「그 출처로 담긴 줄」 을 내주고, 창구는 새출처·옛출처만 고칩니다 */
const 묶음 = [
  { 열쇠: 'COLLECT_KEY_HS3', source: 'HS3', 볼것: ['HS3', 'HS'] },
  { 열쇠: 'COLLECT_KEY_ND2', source: 'ND2', 볼것: ['ND2', 'ND'] },
];
const 고른출처 = 값('--출처', '');

const t0 = Date.now();
console.log('마감일 되읽기 · ' + new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
  + (dry ? ' · **--dry**' : '') + ' · 몫 ' + 몫 + ' · 동시 ' + 동시);
if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) { console.error('SUPABASE_URL · SUPABASE_ANON_KEY 가 없습니다'); process.exit(1); }

let 전체본것 = 0, 전체읽음 = 0, 전체채움 = 0, 전체거름 = 0, 전체못받음 = 0;

for (const m of 묶음) {
  if (고른출처 && 고른출처 !== m.source) continue;
  const 열쇠값 = cfg[m.열쇠];
  if (!열쇠값) { console.log('\n' + m.source + ' — ' + m.열쇠 + ' 가 없어 건너뜁니다'); continue; }

  /* ① 마감일이 빈 줄을 모읍니다 */
  let 빈것 = [];
  for (const of of m.볼것) {
    const 줄 = await rpc('collect_peek', { p_secret: 열쇠값, p_source: m.source, p_of: of });
    const n = (줄 || []).filter((r) => !r.apply_to && r.url);
    console.log('\n' + m.source + ' ← ' + of + ' : 담긴 줄 ' + (줄 || []).length
      + ' · 마감일 빈 것 ' + n.length);
    빈것 = 빈것.concat(n);
  }
  빈것 = 빈것.slice(0, 몫);
  전체본것 += 빈것.length;
  if (!빈것.length) continue;

  /* ② 저장된 주소로 상세를 받아 접수기간을 읽습니다 */
  const 채울것 = [];
  const 거른것 = [];
  let 못받음 = 0;
  for (let i = 0; i < 빈것.length; i += 동시) {
    await Promise.all(빈것.slice(i, i + 동시).map(async (r) => {
      let g;
      try { g = await 글받기(r.url, { headers: { 'User-Agent': UA, 'Accept-Language': 'ko' } }); }
      catch (e) { 못받음++; return; }
      if (g.왜 || g.code !== 200) { 못받음++; return; }
      const 글 = hsText(g.html);
      const d = hsDetailDates(글);
      const 문장 = hs접수문장(글);
      const to = 쓸만한가(d);
      if (to) {
        채울것.push({ id: r.id, apply_from: String(d.from || '').replace(/\./g, '-') || null,
          apply_to: to.replace(/\./g, '-'),
          날짜출처: d.rank === 1 ? '본문 · 공고기간 (되읽기)' : '본문 · 접수기간 (되읽기)',
          접수문장: 문장 || null });
      } else {
        /* 날짜는 못 읽었어도 **접수문장은 담습니다** — DB 의 마감표시() 가
           「채용시까지」 같은 말을 보고 진짜 수시인지 가립니다 */
        if (문장) 채울것.push({ id: r.id, apply_to: null, 접수문장: 문장 });
        if (d.to) 거른것.push({ r, d });
      }
    }));
    process.stdout.write('\r  받는 중 ' + Math.min(i + 동시, 빈것.length) + '/' + 빈것.length + '   ');
  }
  console.log('');
  전체못받음 += 못받음;
  전체읽음 += 채울것.filter((x) => x.apply_to).length;
  전체거름 += 거른것.length;

  console.log('  읽은 마감일 ' + 채울것.filter((x) => x.apply_to).length + '건'
    + ' · 접수문장만 ' + 채울것.filter((x) => !x.apply_to).length + '건'
    + ' · 못 받음 ' + 못받음 + '건'
    + (거른것.length ? ' · 읽었지만 거른 것 ' + 거른것.length + '건' : ''));
  거른것.slice(0, 6).forEach(({ r, d }) => console.log('    거름 '
    + String(r.org_name || '').slice(0, 16).padEnd(18) + JSON.stringify(d)));
  채울것.filter((x) => x.apply_to).slice(0, 12).forEach((x) => {
    const r = 빈것.find((q) => q.id === x.id) || {};
    console.log('    ★ ' + String(r.org_name || '').slice(0, 18).padEnd(20)
      + String(x.apply_from || '-').padEnd(12) + x.apply_to + '  ' + String(r.title || '').slice(0, 36));
  });

  /* ③ 채웁니다 */
  if (dry) { console.log('  --dry 라 안 고쳤습니다'); continue; }
  for (let i = 0; i < 채울것.length; i += 100) {
    const res = await rpc('마감일되읽기', { p_secret: 열쇠값, p_source: m.source, p_rows: 채울것.slice(i, i + 100) });
    전체채움 += res['채움'] || 0;
  }
}

console.log('\n── 본 것 ' + 전체본것 + '건 · 마감일을 읽은 것 ' + 전체읽음
  + ' · 실제로 채운 줄 ' + 전체채움 + ' · 못 받음 ' + 전체못받음
  + (전체거름 ? ' · 거름 ' + 전체거름 : '')
  + ' · ' + Math.round((Date.now() - t0) / 1000) + '초');
