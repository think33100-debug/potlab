/* kordoc 이 서버에서 **얼마나 무거운가**를 잽니다 (2026-10-11).
 *
 *   node tools/kordoc부담재기.mjs <파일> [<파일>...]
 *
 * 붙이기 전에 재 봅니다 — Lightsail 이 작아서, 한 건에 몇 초·몇 MB 인지
 * 모르면 크론이 무너집니다.
 *
 * 맨손 tools/hwp 와 **나란히** 잽니다. 갈아끼울 값이 있는지 보려고요.
 *
 * **아무것도 담지 않습니다.**
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const KORDOC = path.join(여기, 'kordoc', 'node_modules', 'kordoc', 'dist', 'cli.js');
if (!fs.existsSync(KORDOC)) { console.error('kordoc 이 안 깔렸습니다 — ' + KORDOC); process.exit(1); }

const require_ = createRequire(import.meta.url);
let 맨손 = null;
try { 맨손 = await import('./hwp/index.mjs'); } catch { /* 없으면 맨손 비교를 건너뜁니다 */ }

const 파일들 = process.argv.slice(2).filter((x) => fs.existsSync(x));
if (!파일들.length) { console.error('잴 파일을 주십시오'); process.exit(1); }

console.log('기계 — CPU ' + os.cpus().length + '개 · 메모리 '
  + Math.round(os.totalmem() / 1e9 * 10) / 10 + 'GB · 남은 메모리 '
  + Math.round(os.freemem() / 1e9 * 10) / 10 + 'GB · node ' + process.version);
console.log('');

function 돌리기(파일, 낼곳) {
  return new Promise((맺) => {
    const t0 = Date.now();
    const 아이 = execFile(process.execPath, [KORDOC, 파일, '-o', 낼곳],
      { maxBuffer: 64e6, timeout: 300000, cwd: path.join(여기, 'kordoc') },
      (탈) => {
        맺({ 초: (Date.now() - t0) / 1000, 탈: 탈 ? String(탈.message).slice(0, 120) : null, 최대rssMB });
      });
    /* 자식의 메모리를 들여다봅니다 — /proc 가 있는 리눅스에서만 */
    let 최대rssMB = 0;
    const 보기 = setInterval(() => {
      try {
        const s = fs.readFileSync('/proc/' + 아이.pid + '/statm', 'utf8').split(' ');
        const mb = (Number(s[1]) * 4096) / 1e6;        /* resident 쪽 (4KB 쪽 단위) */
        if (mb > 최대rssMB) 최대rssMB = Math.round(mb);
      } catch { /* 끝났거나 리눅스가 아닙니다 */ }
    }, 120);
    아이.on('exit', () => clearInterval(보기));
  });
}

const 줄들 = [];
for (const f of 파일들) {
  const 바이트 = fs.statSync(f).size;
  const 낼곳 = path.join(os.tmpdir(), 'kd_' + path.basename(f) + '.md');
  const r = await 돌리기(f, 낼곳);
  const 글자 = fs.existsSync(낼곳) ? fs.readFileSync(낼곳, 'utf8').length : 0;
  const 표수 = fs.existsSync(낼곳) ? (fs.readFileSync(낼곳, 'utf8').match(/<table>/g) || []).length : 0;

  /* 맨손과 견주기 (hwp 만) */
  let 맨손글자 = null; let 맨손초 = null;
  if (맨손 && /\.hwpx?$/i.test(f)) {
    const t1 = Date.now();
    try {
      const r2 = 맨손.hwp글자(fs.readFileSync(f), path.basename(f));
      맨손글자 = String(r2.글 || '').length;
    } catch { 맨손글자 = -1; }
    맨손초 = (Date.now() - t1) / 1000;
  }

  줄들.push({ 이름: path.basename(f).slice(0, 34), 꼴: path.extname(f).slice(1).toLowerCase(),
    KB: Math.round(바이트 / 1024), 초: Math.round(r.초 * 100) / 100, rssMB: r.최대rssMB || null,
    글자, 표수, 맨손글자, 맨손초: 맨손초 == null ? null : Math.round(맨손초 * 100) / 100, 탈: r.탈 });
}

console.log('── kordoc 부담 ──────────────────────────────────────────');
console.log('  파일                                 꼴    KB     초   메모리MB   글자  표   맨손글자  맨손초');
for (const x of 줄들) {
  console.log('  ' + x.이름.padEnd(36) + String(x.꼴).padEnd(5)
    + String(x.KB).padStart(5) + String(x.초).padStart(7)
    + String(x.rssMB ?? '-').padStart(9)
    + String(x.글자).padStart(8) + String(x.표수).padStart(4)
    + String(x.맨손글자 ?? '-').padStart(10) + String(x.맨손초 ?? '-').padStart(8)
    + (x.탈 ? '   ✗ ' + x.탈 : ''));
}

const 쓸것 = 줄들.filter((x) => !x.탈);
if (쓸것.length) {
  const 합초 = 쓸것.reduce((a, x) => a + x.초, 0);
  const 평균 = 합초 / 쓸것.length;
  const 최대메모리 = Math.max(...쓸것.map((x) => x.rssMB || 0));
  console.log('\n── 어림 ─────────────────────────────────────────────');
  console.log('  한 건 평균 ' + Math.round(평균 * 100) / 100 + '초 · 가장 느린 것 '
    + Math.max(...쓸것.map((x) => x.초)) + '초 · 메모리 최대 ' + 최대메모리 + 'MB');
  for (const 하루 of [30, 100, 300]) {
    console.log('  하루 ' + String(하루).padStart(3) + '건이면  '
      + Math.round(평균 * 하루 / 60 * 10) / 10 + '분');
  }
  console.log('  ※ 한 번에 하나씩 돕니다 (수집기가 차례로 부릅니다) — 메모리는 겹치지 않습니다');
}
console.log('\n아무것도 담지 않았습니다.');
