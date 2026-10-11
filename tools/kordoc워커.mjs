/* kordoc **상주 워커** — 파일마다 node 를 새로 띄우지 않습니다 (2026-10-11 세중님 1순위).
 *
 *   import { 읽기, 워커끝내기, 워커셈 } from './kordoc워커.mjs';
 *   const r = await 읽기('/tmp/a.hwp');       // { success, markdown, blocks, … }
 *
 *   자기 점검:  node tools/kordoc워커.mjs <파일>...
 *
 * ── 규약 (깔린 꾸러미에서 **읽어** 확인했습니다 · 짐작 아님) ──
 *   띄우기   kordoc parse-worker        (dist/cli.js)
 *   첫 줄    { ready: true, version, protocol }        protocol = 1
 *   요청     { id, file, images?, ocr?, formulaOcr?, password? }   ← file 필수
 *            ocr 은 **문자열** "auto" 또는 "force" 입니다 (true 가 아닙니다)
 *   응답     { id, rss, result }                        rss = process.memoryUsage.rss()
 *   끝내기   { cmd: "quit" }
 *   (cli.js 의 parseOne() 과 registerWorkerCommands() 를 그대로 읽었습니다)
 *
 * ── rss 로 교체합니다 ───────────────────────────────────────
 * 서버가 **메모리 2GB** 입니다 (CPU 2개). 잰 값으로 pdf 한 건에 최대 393MB 를
 * 썼습니다. 응답마다 오는 `rss` 를 보고 기준을 넘으면 **그 자리에서 워커를
 * 바꿉니다** — 한 프로세스가 오래 살면서 메모리가 쌓이는 것을 막습니다.
 *
 * ── 못 넘기는 것 ────────────────────────────────────────────
 * `ParseOptions.classifyTables`(표 의미 분류)는 **워커가 안 넘깁니다.**
 * parseOne 이 images·ocr·formulaOcr·password 넷만 추려 넘깁니다 (4.19.1).
 * 그래서 표 고르기는 분류 없이 **표 생김새**로 합니다 (공고문읽기.mjs).
 *
 * `formulaOcr` 는 **쓰지 않습니다** (AGPL · 세중님 지시).
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 꾸러미 = path.join(여기, 'kordoc');
const CLI = path.join(꾸러미, 'node_modules', 'kordoc', 'dist', 'cli.js');

/* 기준 — 환경변수로 올릴 수 있습니다 */
const RSS한계 = Number(process.env.KORDOC_RSS_MB) || 700;      /* MB */
const 몇건마다 = Number(process.env.KORDOC_RECYCLE) || 200;    /* 건 */
const 한건제한초 = Number(process.env.KORDOC_TIMEOUT) || 180;

export function kordoc있나() { return fs.existsSync(CLI); }

const 셈 = {
  띄운횟수: 0, 보낸것: 0, 받은것: 0, 탈: 0, 교체: 0, 교체까닭: {},
  최대rssMB: 0, 초합: 0, 판: null, 규약: null,
};
export function 워커셈() { return { ...셈, 교체까닭: { ...셈.교체까닭 } }; }

let 아이 = null;          /* 지금 도는 워커 */
let 다음번호 = 1;
let 기다리는것 = new Map();   /* id → {맺, 깨, 때 } */
let 남은줄 = '';
let 이번건수 = 0;

function 죽이기(까닭) {
  if (!아이) return;
  셈.교체++;
  셈.교체까닭[까닭] = (셈.교체까닭[까닭] ?? 0) + 1;
  const 옛 = 아이;
  아이 = null;
  try { 옛.stdin.write(JSON.stringify({ cmd: 'quit' }) + '\n'); } catch { /* 이미 죽었습니다 */ }
  setTimeout(() => { try { 옛.kill('SIGKILL'); } catch { /* 넘어갑니다 */ } }, 2000).unref?.();
  /* 기다리던 것들은 깨웁니다 — 안 깨우면 부르는 쪽이 영영 멈춥니다 */
  for (const [, v] of 기다리는것) v.깨(new Error('워커가 바뀌었습니다 — ' + 까닭));
  기다리는것 = new Map();
  남은줄 = '';
  이번건수 = 0;
}

function 띄우기() {
  if (아이) return 아이;
  if (!kordoc있나()) throw new Error('kordoc 이 안 깔렸습니다 — cd tools/kordoc && npm ci');
  셈.띄운횟수++;
  아이 = spawn(process.execPath, [CLI, 'parse-worker'], {
    cwd: 꾸러미, stdio: ['pipe', 'pipe', 'pipe'],
  });
  아이.stdout.setEncoding('utf8');
  아이.stdout.on('data', (조각) => {
    남은줄 += 조각;
    let i;
    while ((i = 남은줄.indexOf('\n')) >= 0) {
      const 줄 = 남은줄.slice(0, i).trim();
      남은줄 = 남은줄.slice(i + 1);
      if (!줄) continue;
      let o;
      try { o = JSON.parse(줄); } catch { continue; }
      if (o.ready) { 셈.판 = o.version; 셈.규약 = o.protocol; continue; }
      if (o.id == null) continue;
      const 기다림 = 기다리는것.get(o.id);
      if (!기다림) continue;
      기다리는것.delete(o.id);
      clearTimeout(기다림.시계);
      셈.받은것++;
      const mb = Math.round((o.rss || 0) / 1e6);
      if (mb > 셈.최대rssMB) 셈.최대rssMB = mb;
      기다림.맺({ result: o.result, rssMB: mb, 초: (Date.now() - 기다림.때) / 1000 });
      /* ★ 응답의 rss 로 교체를 판단합니다 */
      if (mb > RSS한계) 죽이기('rss ' + mb + 'MB > ' + RSS한계 + 'MB');
      else if (++이번건수 >= 몇건마다) 죽이기(몇건마다 + '건 돌았습니다');
    }
  });
  /* stderr 는 kordoc 이 진행 글을 뿜는 자리입니다 — 삼킵니다 */
  아이.stderr.resume();
  아이.on('exit', () => {
    if (!아이) return;            /* 우리가 바꾼 것 */
    아이 = null;
    for (const [, v] of 기다리는것) v.깨(new Error('워커가 죽었습니다'));
    기다리는것 = new Map();
  });
  return 아이;
}

/** 한 파일 읽기. 돌려주는 것은 kordoc 의 ParseResult */
export async function 읽기(파일, 옵션 = {}) {
  const 쓸것 = 띄우기();
  const id = 다음번호++;
  const 요청 = {
    id, file: 파일,
    /* ★ images:false — 그림 바이트를 안 실어 빠릅니다 (세중님 지시) */
    images: 옵션.images === true ? undefined : false,
    ...(옵션.ocr ? { ocr: 옵션.ocr } : {}),          /* "auto" 또는 "force" */
    ...(옵션.password ? { password: 옵션.password } : {}),
    /* formulaOcr 는 **안 씁니다** (AGPL) */
  };
  셈.보낸것++;
  const t0 = Date.now();
  return await new Promise((맺, 깨) => {
    const 시계 = setTimeout(() => {
      기다리는것.delete(id);
      셈.탈++;
      죽이기('한 건이 ' + 한건제한초 + '초를 넘었습니다');
      깨(new Error('kordoc 이 ' + 한건제한초 + '초 안에 안 끝났습니다'));
    }, 한건제한초 * 1000);
    기다리는것.set(id, { 맺: (x) => { 셈.초합 = Math.round((셈.초합 + x.초) * 100) / 100; 맺(x); },
      깨: (e) => { 셈.탈++; 깨(e); }, 때: t0, 시계 });
    try { 쓸것.stdin.write(JSON.stringify(요청) + '\n'); }
    catch (e) { clearTimeout(시계); 기다리는것.delete(id); 셈.탈++; 깨(e); }
  });
}

export function 워커끝내기() { 죽이기('끝내기'); }

/* ── 자기 점검 ───────────────────────────────────────────────
   파일을 주면 그 파일들을, 안 주면 규약만 확인합니다 */
if (process.argv[1] && process.argv[1].endsWith('kordoc워커.mjs')) {
  const 파일들 = process.argv.slice(2).filter((x) => fs.existsSync(x));
  if (!kordoc있나()) { console.error('✗ kordoc 이 안 깔렸습니다'); process.exit(1); }

  if (!파일들.length) {
    /* 규약만 — 빈 요청을 보내 「file 필수」 가 오는지 봅니다 */
    띄우기();
    await new Promise((r) => setTimeout(r, 1500));
    const 어겼나 = [];
    if (셈.규약 !== 1) 어겼나.push('규약이 1 이 아닙니다 (' + 셈.규약 + ')');
    if (!셈.판) 어겼나.push('판을 못 받았습니다');
    워커끝내기();
    if (어겼나.length) { console.error('✗ ' + 어겼나.join(' · ')); process.exit(1); }
    console.log('○ 워커가 섭니다 — kordoc ' + 셈.판 + ' · 규약 ' + 셈.규약);
    console.log('   기준 — rss ' + RSS한계 + 'MB 넘으면 교체 · ' + 몇건마다 + '건마다 교체 · 한 건 ' + 한건제한초 + '초');
    process.exit(0);
  }

  for (const f of 파일들) {
    try {
      const r = await 읽기(f);
      const x = r.result || {};
      const 표수 = (x.blocks || []).filter((b) => b.type === 'table').length;
      console.log('  ' + path.basename(f).slice(0, 36).padEnd(38)
        + (x.success ? '○' : '✗ ' + (x.code || ''))
        + ' · ' + String(x.fileType || '?').padEnd(6)
        + ' · ' + String(r.초).padStart(6) + '초'
        + ' · rss ' + String(r.rssMB).padStart(4) + 'MB'
        + ' · 글자 ' + String((x.markdown || '').length).padStart(6)
        + ' · 블록 ' + String((x.blocks || []).length).padStart(4)
        + ' · 표 ' + 표수
        + (x.pageQuality ? ' · OCR 필요 쪽 ' + x.pageQuality.filter((q) => q.needsOcr).length : ''));
    } catch (e) { console.log('  ' + path.basename(f) + '  ✗ ' + e.message); }
  }
  const s = 워커셈();
  console.log('\n  띄운 횟수 ' + s.띄운횟수 + ' · 보냄 ' + s.보낸것 + ' · 받음 ' + s.받은것
    + ' · 탈 ' + s.탈 + ' · 교체 ' + s.교체 + ' · 최대 rss ' + s.최대rssMB + 'MB'
    + ' · 걸린 시간 합 ' + s.초합 + '초');
  if (Object.keys(s.교체까닭).length) console.log('  교체 까닭 — ' + JSON.stringify(s.교체까닭));
  워커끝내기();
}
