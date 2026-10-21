/* 「빈손」(받았는데 글이 안 나온) 첨부를 **진단만** 합니다 (2026-10-21 세중님 3번)
 *
 *   node tools/빈손진단.mjs            읽기탈에 「워커」가 적힌 줄 전부
 *   node tools/빈손진단.mjs --몇개 5
 *
 * 건마다 냅니다 — 파일 크기 · 진짜 형식 · 쪽수(PDF 만) · 워커 rss 최고값 ·
 *                 죽은 지점 · 걸린 초 · 글자 수
 *
 * ★ **아무것도 고치지 않습니다.** DB 에 안 씁니다(`parsed_at` 도 안 건드립니다).
 *   파일을 받아 다시 읽어 보기만 합니다 (같은 사이트는 3.5초 띄웁니다).
 * ★ 재는 동안만 **파일마다 워커를 새로 띄웁니다** — 한 건의 봉우리를 따로
 *   보려는 것입니다. 운영에서는 이렇게 하면 **더 나빠집니다**(2026-10-21 에
 *   51%→30% 로 떨어져 되돌렸습니다 — 그림마다 OCR 모형을 새로 불러 봉우리가
 *   높아집니다). 이 파일은 **재는 자리**일 뿐입니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { 고친주소 } from './첨부주소고치기.mjs';
import { 첨부읽기, 진짜형식, 워커끝내기 } from './공고문읽기.mjs';
import { 워커셈 } from './kordoc워커.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const 값 = (이름, 기본) => {
  const i = argv.indexOf(이름);
  return i > -1 && argv[i + 1] != null ? argv[i + 1] : 기본;
};
const 몇개 = Number(값('--몇개', 99));
const 매건비우기 = argv.includes('--매건비우기');

/* .env 는 node 로 읽습니다 (지침 8-12) */
const cfg = {};
for (const 이름 of ['../.env', '../.env.local']) {
  const f = path.join(여기, 이름);
  if (!fs.existsSync(f)) continue;
  for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z_0-9]+)=(.*)$/);
    if (m) cfg[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}
const H = { apikey: cfg.SUPABASE_SERVICE_KEY, Authorization: 'Bearer ' + cfg.SUPABASE_SERVICE_KEY };

/* ── 「워커」로 탈난 첨부 줄 ── */
const u = cfg.SUPABASE_URL + '/rest/v1/job_attachments'
  + '?select=job_id,name,url,parsed_at,' + encodeURIComponent('읽기탈')
  + '&' + encodeURIComponent('읽기탈') + '=like.*' + encodeURIComponent('워커') + '*'
  + '&order=parsed_at.desc&limit=100';
const r0 = await fetch(u, { headers: H });
if (!r0.ok) { console.error('✗ HTTP ' + r0.status + ' · ' + (await r0.text()).slice(0, 200)); process.exit(1); }
const 줄들 = (await r0.json()).slice(0, 몇개);
console.log('「워커」로 탈난 첨부 ' + 줄들.length + '줄을 진단합니다 (DB 에 아무것도 안 씁니다)\n');

const 메모리 = () => {
  try {
    const t = execSync('free -m', { encoding: 'utf8' }).split('\n')[1].split(/\s+/);
    return { 쓴것: Number(t[2]), 쓸수있는것: Number(t[6]) };
  } catch { return null; }
};
const 쪽수세기 = (buf, 꼴) => {
  if (꼴 !== 'pdf') return null;
  const s = buf.toString('latin1');
  const n = (s.match(/\/Type\s*\/Page[^s]/g) || []).length;
  return n || null;
};
const 틈ms = 3500;
const 자고 = (ms) => new Promise((x) => setTimeout(x, ms));
const 끝때 = new Map();
const 표 = [];

for (const x of 줄들) {
  const g = 고친주소(x.url, '');
  if (g.버릴것) {
    표.push({ job: x.job_id, 이름: x.name, 왜: '주소 버림 — ' + g.왜 });
    continue;
  }
  const host = (() => { try { return new URL(g.url).host; } catch { return ''; } })();
  const 지난 = Date.now() - (끝때.get(host) || 0);
  if (지난 < 틈ms) await 자고(틈ms - 지난);
  끝때.set(host, Date.now());

  let buf = null; let 받기탈 = '';
  try {
    const r = await fetch(g.url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0.0.0',
        ...(g.받는법 && g.받는법.Referer ? { Referer: g.받는법.Referer } : {}) },
      signal: AbortSignal.timeout(40000),
    });
    if (!r.ok) 받기탈 = 'HTTP ' + r.status;
    else buf = Buffer.from(await r.arrayBuffer());
  } catch (e) { 받기탈 = String(e && e.message || e).slice(0, 40); }
  if (!buf) { 표.push({ job: x.job_id, 이름: x.name, 왜: '못 받음 — ' + 받기탈 }); continue; }

  const 꼴 = 진짜형식(buf);
  const 쪽 = 쪽수세기(buf, 꼴);
  const 전메모리 = 메모리();
  /* 재는 자리에서만 — 워커를 끝내 두면 다음 읽기가 새로 띄웁니다 (워커비우기는 되돌릴 때 함께 지웠습니다) */
  /* --매건비우기 를 주면 파일마다 워커를 끝냅니다 — **전후를 견줄 때는 끄고** 돌립니다
     (끄면 운영과 같은 길: 문턱을 넘을 때만 바뀝니다) */
  if (매건비우기) 워커끝내기();
  const t0 = Date.now();
  let 읽 = null; let 읽기탈 = '';
  try { 읽 = await 첨부읽기(buf, x.name || 'a'); }
  catch (e) { 읽기탈 = String(e && e.message || e).slice(0, 60); }
  const 초 = Math.round((Date.now() - t0) / 100) / 10;
  const 후메모리 = 메모리();
  const 셈 = 워커셈();
  const 한줄 = {
    job: x.job_id, 이름: String(x.name || '').slice(0, 42),
    바이트: buf.length, 꼴, 쪽, 초,
    rssMB: (읽 && 읽.rssMB) || 셈.최대rssMB || null,
    글자: 읽 ? String(읽.md || '').length : 0,
    죽은지점: 읽기탈 || (읽 && 읽.왜) || '',
    옛탈: String(x['읽기탈'] || '').slice(0, 44),
    메모리: 전메모리 && 후메모리 ? (전메모리.쓴것 + '→' + 후메모리.쓴것 + 'MB') : '',
  };
  표.push(한줄);
  console.log('  ' + String(한줄.job).padEnd(13) + String(한줄.바이트).padStart(9) + '바이트 '
    + String(꼴).padEnd(7) + (쪽 ? 쪽 + '쪽 ' : '      ')
    + 'rss ' + String(한줄.rssMB || '?').padStart(4) + 'MB '
    + String(초).padStart(6) + '초  글자 ' + String(한줄.글자).padStart(6)
    + '  ' + (한줄.죽은지점 || '○'));
}

/* ── 표 ── */
console.log('\n══ 빈손 진단 표 ══');
console.log('공고          크기(바이트)  형식    쪽   rss최고  초     글자    죽은 지점');
for (const t of 표) {
  if (t.왜) { console.log('  ' + String(t.job).padEnd(13) + ' — ' + t.왜); continue; }
  console.log('  ' + String(t.job).padEnd(13) + String(t.바이트).padStart(10)
    + '  ' + String(t.꼴).padEnd(7) + String(t.쪽 || '-').padStart(4)
    + String(t.rssMB || '?').padStart(8) + 'MB' + String(t.초).padStart(7)
    + String(t.글자).padStart(8) + '  ' + (t.죽은지점 || '○ 이번엔 읽혔습니다'));
}

/* ── 판단 근거 ── */
const 잰것 = 표.filter((t) => !t.왜);
const 읽힌것 = 잰것.filter((t) => t.글자 > 200);
const 큰것 = 잰것.filter((t) => t.바이트 >= 2 * 1024 * 1024);
const 평균 = (들) => (들.length ? Math.round(들.reduce((a, b) => a + b, 0) / 들.length) : 0);
console.log('\n── 판단 근거 ──');
console.log('  잰 것 ' + 잰것.length + '건 · 이번에 읽힌 것 ' + 읽힌것.length + '건 · 2MB 이상 ' + 큰것.length + '건');
console.log('  크기 평균 — 읽힌 것 ' + 평균(읽힌것.map((t) => t.바이트)) + '바이트 · '
  + '못 읽은 것 ' + 평균(잰것.filter((t) => t.글자 <= 200).map((t) => t.바이트)) + '바이트');
console.log('  rss 최고 — 읽힌 것 ' + Math.max(0, ...읽힌것.map((t) => t.rssMB || 0)) + 'MB · '
  + '못 읽은 것 ' + Math.max(0, ...잰것.filter((t) => t.글자 <= 200).map((t) => t.rssMB || 0)) + 'MB');
console.log('  ★ 「파일마다 새 워커」로 재서 이번에 읽힌 것이 많으면, 문제는 **그 파일**이 아니라');
console.log('    **한 바퀴에 쌓인 더미**입니다 — 그러면 「큰 파일만 새벽에 하나씩」이 듣습니다.');
console.log('    반대로 새 워커로도 같은 파일이 또 죽으면 그 파일 자체가 2GB 를 넘깁니다.');
fs.writeFileSync(path.join(여기, '..', 'log', '빈손진단_' +
  new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10) + '.json'),
  JSON.stringify({ 잰때: new Date().toISOString(), 표 }, null, 1) + '\n', 'utf8');
console.log('\n  log/빈손진단_<날짜>.json 에 적었습니다. DB 에 아무것도 안 썼습니다.');
await 워커끝내기?.();
