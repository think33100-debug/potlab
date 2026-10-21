/* 능력시험 — **받아 둔 첨부를 다시 읽어** 형식별 점수를 냅니다 (그물을 안 두드립니다)
 *
 *   node tools/능력시험/형식다시읽기.mjs
 *   node tools/능력시험/형식다시읽기.mjs --꼴 jpg
 *   node tools/능력시험/형식다시읽기.mjs --자기점검
 *
 * 보는 곳 — `원문/<id>/첨부/*` (표본 50건) + `원문형식/<꼴>/*` (더 모은 것).
 * 읽기 규칙을 고칠 때마다 **그물 없이** 전후를 견주는 자리입니다.
 *
 * 「읽힘」 기준 (세중님) — 글자 수만이 아니라 **직군 · 모집인원 · 접수기간**이
 * 뽑히는지를 함께 셉니다. 그림은 OCR 오타를 감안해 이 셋이 나오면 ○ 입니다.
 *
 * ★ DB 를 두드리지 않습니다. 아무것도 안 바꿉니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 첨부읽기, 진짜형식, 칸뽑기, 본문직군, 그림최소바이트, 그림OCR인가, 워커끝내기 } from '../공고문읽기.mjs';
import { 묶음갈래 } from '../묶음파일.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const 값 = (이름, 기본) => {
  const i = argv.indexOf(이름);
  return i > -1 && argv[i + 1] != null ? argv[i + 1] : 기본;
};
const 고른꼴 = 값('--꼴', null);
/* ★ 2026-10-21 — **쪼개 돌립니다.** 339개를 한 번에 돌리면 2GB 서버에서
 *   커널이 node 를 OOM 으로 죽입니다 (10/21 10:02·10:03 에 322/339 에서 죽었습니다).
 *   node 를 새로 띄우면 더미가 깨끗해집니다. `--이어서` 면 옛 셈에 더합니다. */
const 건너뛰기 = Number(값('--건너뛰기', 0));
const 몇개 = Number(값('--몇개', 0));
const 이어서 = argv.includes('--이어서');
/* ★ 2026-10-21 — `--글적기` 면 읽은 글을 `<파일>.새.txt` 로 남깁니다.
 *   옛 `<파일>.txt`(원문받기가 **고치기 전** 읽기로 적은 것)를 **안 덮습니다** —
 *   시험의 「다시뽑음」이 그 둘을 전/후로 견줍니다. */
const 글적기 = argv.includes('--글적기');

/** 한 파일의 **능력표 갈래** — 형식별표.mjs 와 같은 생각, 받은 바이트로 */
export function 갈래(buf, 이름) {
  const 꼴 = 진짜형식(buf);
  if (꼴 === 'zip계열') {
    const 속 = 묶음갈래(buf);
    return 속 === 'hwpx' ? 'HWPX' : 속 === 'docx' ? 'DOCX' : 속 === 'xlsx' ? 'XLSX'
      : 속 === 'pptx' ? 'PPTX' : 'ZIP';
  }
  if (꼴 === 'jpg' || 꼴 === 'png' || 꼴 === 'webp') {
    return buf.length < 그림최소바이트 ? '그림(꾸밈 — 안 읽습니다)' : '그림(공고)';
  }
  if (꼴 === 'hwp') return 'HWP';
  if (꼴 === 'pdf') return 'PDF';
  if (꼴 === 'HTML') return 'HTML 이 옴 (못 받은 것)';
  return 꼴;
}

function 자기점검() {
  const 잼 = [];
  const 보 = (무엇, 참) => 잼.push([무엇, !!참]);
  보('PDF 갈래', 갈래(Buffer.from('%PDF-1.7 x'), 'a.pdf') === 'PDF');
  보('HWP 갈래', 갈래(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0, 0]), 'a.hwp') === 'HWP');
  보('작은 그림은 꾸밈', 갈래(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(100)]), 'a.jpg')
    === '그림(꾸밈 — 안 읽습니다)');
  보('큰 그림은 공고', 갈래(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(그림최소바이트)]), 'a.jpg')
    === '그림(공고)');
  보('HTML 은 못 받은 것', 갈래(Buffer.from('<!DOCTYPE html>'), 'a.pdf') === 'HTML 이 옴 (못 받은 것)');
  const 탈 = 잼.filter((y) => !y[1]);
  for (const y of 잼) if (!y[1]) console.log('  ✗ ' + y[0]);
  console.log((탈.length ? '✗ 자기점검 ' + 탈.length + '가지 탈'
    : '○ 형식다시읽기 자기점검 통과 — ' + 잼.length + '가지') + ' (파일·그물을 안 읽었습니다)');
  return !탈.length;
}
if (!자기점검()) process.exit(1);
if (argv.includes('--자기점검')) process.exit(0);

/* ── 볼 파일 모으기 ─────────────────────────────────────── */
const 볼것 = [];
const 원문 = path.join(여기, '원문');
if (fs.existsSync(원문)) {
  for (const d of fs.readdirSync(원문)) {
    const 첨 = path.join(원문, d, '첨부');
    if (!fs.existsSync(첨)) continue;
    for (const f of fs.readdirSync(첨)) {
      if (f.endsWith('.txt')) continue;
      볼것.push({ 곳: '표본', 공고: d, 파일: f, p: path.join(첨, f) });
    }
  }
}
const 더 = path.join(여기, '원문형식');
if (fs.existsSync(더)) {
  for (const d of fs.readdirSync(더)) {
    const 방 = path.join(더, d);
    if (!fs.statSync(방).isDirectory()) continue;
    for (const f of fs.readdirSync(방)) 볼것.push({ 곳: '더모음', 공고: f.split('_')[0], 파일: f, p: path.join(방, f) });
  }
}
볼것.sort((a, b) => (a.곳 + a.파일).localeCompare(b.곳 + b.파일));   /* 쪼개 돌릴 때 차례가 같게 */
const 전체수 = 볼것.length;
const 볼것조각 = 몇개 ? 볼것.slice(건너뛰기, 건너뛰기 + 몇개) : 볼것.slice(건너뛰기);
console.log('\n받아 둔 첨부 ' + 전체수 + '개 가운데 ' + 볼것조각.length + '개를 다시 읽습니다'
  + (고른꼴 ? ' (꼴 ' + 고른꼴 + '만)' : '')
  + (건너뛰기 || 몇개 ? ' [' + 건너뛰기 + '~' + (건너뛰기 + 볼것조각.length - 1) + ']' : ''));

/* `--이어서` 면 옛 셈에 더합니다 — 쪼개 돌린 조각을 한 표로 모읍니다 */
const 모음 = new Map();
const 하나하나 = [];
const 낸곳 = path.join(여기, '형식다시읽기.json');
if (이어서 && fs.existsSync(낸곳)) {
  try {
    const 옛 = JSON.parse(fs.readFileSync(낸곳, 'utf8'));
    for (const t of (옛.형식 || [])) {
      모음.set(t.형식, { n: t.n || 0, 받음: t.받음 || 0, 읽음: t.읽음 || 0, 직군: t.직군 || 0,
        인원: t.인원 || 0, 마감: t.마감 || 0, 초합: (t.평균초 || 0) * (t.n || 0), 표: t.표 || 0,
        탈: new Map(t.탈 || []) });
    }
    하나하나.push(...(옛.하나하나 || []));
    console.log('  (옛 셈에 더합니다 — 형식 ' + 모음.size + '갈래 · 하나하나 ' + 하나하나.length + '줄)');
  } catch { console.log('  (옛 셈을 못 읽었습니다 — 처음부터 셉니다)'); }
}
for (const x of 볼것조각) {
  let buf;
  try { buf = fs.readFileSync(x.p); } catch { continue; }
  const g = 갈래(buf, x.파일);
  if (고른꼴 && !g.toLowerCase().includes(고른꼴.toLowerCase())) continue;
  const t = 모음.get(g) || { n: 0, 받음: 0, 읽음: 0, 직군: 0, 인원: 0, 마감: 0, 초합: 0, 표: 0, 탈: new Map() };
  t.n++;
  const 받음 = !['HTML 이 옴 (못 받은 것)', '모름'].includes(g);
  if (받음) t.받음++;
  let r = { md: '', 글: '', 초: 0 };
  if (받음 && g !== '그림(꾸밈 — 안 읽습니다)') {
    r = await 첨부읽기(buf, x.파일);
  } else if (g === '그림(꾸밈 — 안 읽습니다)') {
    r = { md: '', 글: '', 초: 0, 왜: '꾸밈 그림이라 안 읽습니다' };
  }
  const md = String(r.md || '');
  if (글적기 && md) { try { fs.writeFileSync(x.p + '.새.txt', md, 'utf8'); } catch (e) { console.error('  ✗ 글 적기 — ' + e.message); } }
  if (md.length > 50) t.읽음++;
  if ((md.match(/\n\s*\|/g) || []).length) t.표++;
  t.초합 += r.초 || 0;
  if (r.왜) t.탈.set(String(r.왜).slice(0, 60), (t.탈.get(String(r.왜).slice(0, 60)) || 0) + 1);
  let 칸 = null;
  if (md) {
    칸 = 칸뽑기(md, r.글 || '');
    if (본문직군(r.글 || md)) t.직군++;
    if ((칸.모집인원 && Object.keys(칸.모집인원).length) || 칸.모집인원글) t.인원++;
    if (칸.접수마감) t.마감++;
  }
  모음.set(g, t);
  하나하나.push({ 곳: x.곳, 공고: x.공고, 파일: x.파일.slice(0, 44), 갈래: g, 바이트: buf.length,
    글자: md.length, 초: r.초 ?? null, OCR: !!r.OCR썼나, 그림OCR: 그림OCR인가(r) || undefined,
    직군: md ? 본문직군(r.글 || md) : '', 인원: 칸 ? ((칸.모집인원 && Object.keys(칸.모집인원).length ? 칸.모집인원 : 칸.모집인원글) || null) : null,
    마감: 칸 ? (칸.접수마감 || null) : null, 왜: r.왜 || '' });
  process.stderr.write('\r  ' + 하나하나.length + '/' + 볼것.length + '    ');
}
process.stderr.write('\n');

const 퍼 = (a, b) => (b ? Math.round((100 * a) / b) + '%' : '—');
console.log('\n── 형식별 (받아 둔 것을 다시 읽음) ──');
console.log('  형식                        건수  받기   읽기   표   직군  인원  마감  평균초');
for (const [g, t] of [...모음].sort((a, b) => b[1].n - a[1].n)) {
  console.log('  ' + g.padEnd(28) + String(t.n).padStart(4)
    + 퍼(t.받음, t.n).padStart(7) + 퍼(t.읽음, t.n).padStart(7)
    + String(t.표).padStart(5) + String(t.직군).padStart(6)
    + String(t.인원).padStart(6) + String(t.마감).padStart(6)
    + (t.n ? (t.초합 / t.n).toFixed(1) : '0').padStart(8));
  const 첫 = [...t.탈].sort((a, b) => b[1] - a[1])[0];
  if (첫) console.log('      대표 실패 — ' + 첫[0] + ' (' + 첫[1] + '번)');
}

fs.writeFileSync(낸곳,
  JSON.stringify({ 만든때: new Date().toISOString(),
    형식: [...모음].map(([g, t]) => ({ 형식: g, ...t, 탈: [...t.탈] })), 하나하나 }, null, 1) + '\n', 'utf8');
console.log('\n' + path.join(여기, '형식다시읽기.json') + ' 에 적었습니다. DB 를 두드리지 않았습니다.');
await 워커끝내기?.();
