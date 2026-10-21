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
/* ★ 2026-10-21 — 700 → 480MB 로 내렸습니다.
 *
 * 서버가 2GB 입니다. 700MB 를 넘길 때까지 기다리면 **커널이 먼저 node 를
 * 죽입니다** — 10/21 06:23~06:31 에 다섯 번 OOM 으로 죽었습니다
 * (`task_memcg=/system.slice/cron.service` · 06:10 첨부읽기 크론).
 * 그러면 기다리던 요청이 「워커가 죽었습니다」로 **조용히 버려집니다** —
 * 그 바퀴에 읽음 114 · 빈손 15(그중 12건이 이 까닭)였습니다.
 * 그림 한 장이 rss 를 414→579MB 까지 밀어 올립니다(실측). 480 에서 끊으면
 * 그림 두세 장마다 워커를 바꾸고, 바꾸는 값은 0.3초쯤입니다 — 죽는 것보다 쌉니다. */
const RSS한계 = Number(process.env.KORDOC_RSS_MB) || 480;      /* MB */
const 몇건마다 = Number(process.env.KORDOC_RECYCLE) || 200;    /* 건 */
const 한건제한초 = Number(process.env.KORDOC_TIMEOUT) || 180;
/* ★ 2026-10-21 ⓐ (세중님 승인) — **시스템이 쓰는 메모리**로도 교체를 판단합니다.
 *
 * 왜 — 10/21 밤에 재 보니 1.3GB 를 쓰는 것은 **kordoc 워커 여럿이 동시에 살아
 *   있는 것**이었습니다. 한 장면에서 셋이 함께였습니다 —
 *     20:25:22  쓴것 1,861MB  ·  parse-worker 530MB + 508MB + 329MB
 *   본체는 128MB, 다른 크론은 많아야 90MB 였습니다. 겹침이 뿌리입니다.
 *   까닭은 「죽이기()」 가 **아이를 null 로 두고 2초 뒤에 SIGKILL** 하기 때문입니다 —
 *   그 사이에 새 워커가 떠서 둘이 함께 OCR 모형을 들고 있습니다.
 *
 * 그래서 ① 쓴 메모리가 문턱을 넘으면 ② **지금 건을 끝낸 뒤** ③ 옛 워커가
 * **사라진 것을 보고** 새로 띄웁니다.
 *
 * ★ 「파일마다 새로 띄우기」와 다릅니다 — 그것은 10/20 에 **더 나빠져서
 *   되돌렸습니다**(그림 51%→30% · 죽음 8→14). 그림마다 OCR 모형을 새로 불러
 *   봉우리가 높아지기 때문입니다. 이것은 **문턱을 넘을 때만** 바꿉니다. */
const 시스템문턱MB = Number(process.env.KORDOC_SYS_MB) || 1100;   /* 쓴 메모리 */
const 거두기제한초 = Number(process.env.KORDOC_REAP_SEC) || 10;    /* quit 뒤 기다리는 초 */
const 거두기더초 = Number(process.env.KORDOC_REAP_KILL_SEC) || 5;  /* SIGKILL 뒤 더 기다리는 초 */
/* KORDOC_REAP=0 이면 **옛 길**입니다 (거두지 않고 떼기만) — 전후를 같은 자리에서
   견주려고 둔 깃발입니다. 기본은 거두기(1) 입니다 */
const 거둘까 = process.env.KORDOC_REAP !== '0';

/** 시스템이 지금 쓰는 메모리(MB) — /proc/meminfo 의 MemTotal − MemAvailable */
export function 쓴메모리MB() {
  try {
    const t = fs.readFileSync('/proc/meminfo', 'utf8');
    const 집 = (이름) => Number((t.match(new RegExp('^' + 이름 + ':\\s+(\\d+) kB', 'm')) || [])[1] || 0);
    const 전체 = 집('MemTotal'); const 쓸수 = 집('MemAvailable');
    if (!전체 || !쓸수) return null;
    return Math.round((전체 - 쓸수) / 1024);
  } catch { return null; }   /* 리눅스가 아니면 null — 그러면 이 규칙은 쉽니다 */
}

export function kordoc있나() { return fs.existsSync(CLI); }

const 셈 = {
  띄운횟수: 0, 보낸것: 0, 받은것: 0, 탈: 0, 교체: 0, 교체까닭: {}, 다시보냄: 0,
  최대rssMB: 0, 초합: 0, 판: null, 규약: null,
};
export function 워커셈() { return { ...셈, 교체까닭: { ...셈.교체까닭 } }; }

let 아이 = null;          /* 지금 도는 워커 */
let 다음번호 = 1;
let 기다리는것 = new Map();   /* id → {맺, 깨, 때 } */
let 남은줄 = '';
let 이번건수 = 0;
let 끝맺음걸었나 = false;
let exit걸었나 = false;      /* process exit 리스너를 한 번만 걸게 (2026-10-21 — 리스너가 쌓였습니다) */
let 거두는중 = null;          /* 옛 워커를 거두는 약속 — 새로 띄우기 전에 기다립니다 */
let 바퀴중단 = '';            /* 못 거뒀으면 까닭이 들어가고, 그 뒤 읽기는 바로 탈납니다 */
export function 바퀴중단인가() { return 바퀴중단; }

/** 살아 있나 — kill(0) 으로 봅니다 (신호를 안 보냅니다) */
function 살아있나(옛) {
  if (!옛 || 옛.exitCode !== null || 옛.signalCode) return false;
  try { process.kill(옛.pid, 0); return true; } catch { return false; }
}

/** 옛 워커를 **거둡니다** — quit → 10초 → SIGKILL → 5초 → 그래도 남으면 바퀴 중단.
 *  무한 대기는 하지 않습니다 (세중님 지시) */
async function 거두기(옛, 까닭) {
  /* ★ **unref 하지 않습니다** — 거두는 동안 돌림판을 붙잡아야 합니다.
     unref 로 두었더니 node 가 스스로 끝났습니다(끝값 13 · unsettled top-level await).
     길어도 15초이고, 끝나면 시계가 사라집니다 */
  const 자고 = (ms) => new Promise((r) => setTimeout(r, ms));
  const t0 = Date.now();
  try {
    if (옛.stdin && !옛.stdin.destroyed && 옛.exitCode === null && !옛.killed) {
      옛.stdin.once('error', () => { /* EPIPE — 이미 죽었습니다 */ });
      옛.stdin.write(JSON.stringify({ cmd: 'quit' }) + '\n');
    }
  } catch { /* 이미 죽었습니다 */ }
  try { if (옛.stdin && !옛.stdin.destroyed) 옛.stdin.end(); } catch { /* 이미 닫혔습니다 */ }
  try { 옛.kill('SIGTERM'); } catch { /* 이미 죽었습니다 */ }
  while (살아있나(옛) && (Date.now() - t0) / 1000 < 거두기제한초) await 자고(250);
  if (살아있나(옛)) {
    셈.강제종료 = (셈.강제종료 ?? 0) + 1;
    try { 옛.kill('SIGKILL'); } catch { /* 넘어갑니다 */ }
    const t1 = Date.now();
    while (살아있나(옛) && (Date.now() - t1) / 1000 < 거두기더초) await 자고(250);
  }
  const 걸린 = Math.round((Date.now() - t0) / 100) / 10;
  if (살아있나(옛)) {
    바퀴중단 = '워커(pid ' + 옛.pid + ')를 ' + 걸린 + '초 동안 못 거뒀습니다 — ' + 까닭;
    셈.못거둠 = (셈.못거둠 ?? 0) + 1;
    console.error('✗ ' + 바퀴중단 + ' → 이 바퀴를 멈춥니다');
  } else {
    셈.거둠 = (셈.거둠 ?? 0) + 1;
    셈.거두기초합 = Math.round(((셈.거두기초합 ?? 0) + 걸린) * 10) / 10;
  }
  거두는중 = null;
}

function 죽이기(까닭) {
  if (!아이) return;
  셈.교체++;
  셈.교체까닭[까닭] = (셈.교체까닭[까닭] ?? 0) + 1;
  const 옛 = 아이;
  아이 = null;
  /* 곱게 끝내기 — quit 을 보내고 **stdin 을 닫습니다.** 닫지 않으면 워커가
     다음 줄을 기다리며 그대로 서 있습니다. 2초 뒤에도 살아 있으면 죽입니다 */
  /* ★ 2026-10-21 — **EPIPE 는 비동기로 터집니다.** 이미 죽은 워커의 stdin 에
     쓰면 `try/catch` 가 못 잡고 소켓의 'error' 사건으로 올라와 **프로세스가
     죽습니다.** 10/21 09:3x 측정이 그렇게 끝났습니다 —
       Error: write EPIPE … at 죽이기 (kordoc워커.mjs:76) … errno: -32
     그래서 쓰기 전에 **살아 있나 보고**, 소켓에 error 받이를 걸어 둡니다. */
  try {
    if (옛.stdin && !옛.stdin.destroyed && 옛.exitCode === null && !옛.killed) {
      옛.stdin.once('error', () => { /* EPIPE — 이미 죽었습니다 */ });
      옛.stdin.write(JSON.stringify({ cmd: 'quit' }) + '\n');
    }
  } catch { /* 이미 죽었습니다 */ }
  try { if (옛.stdin && !옛.stdin.destroyed) 옛.stdin.end(); } catch { /* 이미 닫혔습니다 */ }
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
  /* ★ 2026-10-21 — 관 셋에 **error 받이**를 겁니다. 워커가 먼저 죽으면
     EPIPE·ECONNRESET 이 **비동기 'error' 사건**으로 올라오고, 받이가 없으면
     우리 프로세스가 통째로 죽습니다 (지침 2절 — 조용히 죽지 않게 까닭을 적습니다) */
  for (const [이름, 관] of [['stdin', 아이.stdin], ['stdout', 아이.stdout], ['stderr', 아이.stderr]]) {
    관?.on('error', (e) => {
      셈.관탈 = (셈.관탈 ?? 0) + 1;
      셈.관탈까닭 = 이름 + ' ' + String((e && e.code) || (e && e.message) || e).slice(0, 40);
    });
  }
  아이.on('error', (e) => {
    셈.관탈 = (셈.관탈 ?? 0) + 1;
    셈.관탈까닭 = '아이 ' + String((e && e.code) || (e && e.message) || e).slice(0, 40);
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
      /* ★ 응답의 rss 와 **시스템 쓴 메모리**로 교체를 판단합니다 —
         지금 건은 위에서 이미 맺었습니다(끝낸 뒤에 바꿉니다) */
      const 쓴것 = 쓴메모리MB();
      const 바꿀까닭 = (mb > RSS한계) ? ('rss ' + mb + 'MB > ' + RSS한계 + 'MB')
        : (쓴것 != null && 쓴것 > 시스템문턱MB)
          ? ('시스템 쓴 메모리 ' + 쓴것 + 'MB > ' + 시스템문턱MB + 'MB')
          : (++이번건수 >= 몇건마다) ? (몇건마다 + '건 돌았습니다') : '';
      if (바꿀까닭) 거두며교체(바꿀까닭);
    }
  });
  /* stderr 는 kordoc 이 진행 글을 뿜는 자리입니다 — 삼킵니다 */
  아이.stderr.resume();

  /* ★ 2026-10-12 — **워커가 부모를 붙잡아 수집기가 안 죽었습니다.**
   *
   * 01:50 클린아이가 일을 다 끝내고(로그에 「씀 14건」·「한도 기록」까지 찍고)
   * **5시간 19분을 `ep_poll` 로 살아 있었습니다.** 잠금(`~/lock/cleaneye.lock`)을
   * 쥔 채라 그 뒤 클린아이 실행 **13번이 전부 건너뛰었습니다.**
   *
   * 까닭은 두 가지가 겹친 것입니다 —
   *   ① `워커끝내기()` 가 있는데 **부르는 수집기가 하나도 없습니다**
   *      (GJ2·ND2·CE2 셋 다 `첨부읽기·칸뽑기·kordoc있나` 만 import 합니다)
   *      → 지침 6절: 「코드가 있어도 아무도 import 하지 않으면 없는 기능입니다」
   *   ② 자식과 이어진 파이프(stdin·stdout·stderr)가 **부모의 돌림판을 붙잡습니다.**
   *      그래서 할 일이 없어도 node 가 안 끝납니다
   *
   * 고치는 자리를 **여기 한 곳**으로 둡니다. 수집기 셋을 각각 고치면
   * 새로 붙는 수집기가 또 같은 데 빠집니다 (지침 6절 — 기준은 한 자리).
   *   · `unref()` — 할 일이 없으면 node 가 그냥 끝납니다. 기다리는 동안은
   *     `한건제한초` 시계가 돌림판을 붙잡고 있어서 응답을 놓치지 않습니다
   *   · `process.once('exit')` — 끝날 때 자식을 반드시 죽입니다.
   *     안 하면 unref 때문에 **고아 워커**가 남습니다 */
  아이.unref?.();
  아이.stdin.unref?.();
  아이.stdout.unref?.();
  아이.stderr.unref?.();
  /* 할 일이 없어지는 순간 **곱게** 끝냅니다 (quit + stdin 닫기).
     `beforeExit` 은 돌림판이 비면 불리고 여기서 또 일을 걸 수 있습니다.
     수집기마다 `워커끝내기()` 를 적지 않아도 되게 여기에 둡니다 */
  if (!끝맺음걸었나) {
    끝맺음걸었나 = true;
    process.once('beforeExit', () => { if (아이) 죽이기('프로세스가 끝납니다'); });
  }
  /* ★ 2026-10-21 — 전에는 워커를 띄울 때마다 `process.once('exit', …)` 를 **새로**
     걸고 그 아이가 죽을 때 떼었습니다. 아이가 자주 바뀌면 리스너가 쌓여
     `MaxListenersExceededWarning: 11 exit listeners added to [process]` 가 났습니다
     (06:10 첨부읽기 크론 로그에 찍혔습니다). **한 번만 걸고 지금 아이를 봅니다.** */
  if (!exit걸었나) {
    exit걸었나 = true;
    process.on('exit', () => { try { 아이?.kill('SIGKILL'); } catch { /* 이미 죽었습니다 */ } });
  }

  아이.on('exit', () => {
    if (!아이) return;            /* 우리가 바꾼 것 */
    아이 = null;
    for (const [, v] of 기다리는것) v.깨(new Error('워커가 죽었습니다'));
    기다리는것 = new Map();
  });
  return 아이;
}

/** 지금 아이를 떼고 **거두기**를 걸어 둡니다. 다음 읽기가 그 약속을 기다립니다 */
function 거두며교체(까닭) {
  if (!아이 || 거두는중) return;
  if (!거둘까) { 죽이기(까닭); return; }      /* 옛 길 — 견주기용 깃발 */
  셈.교체++;
  셈.교체까닭[까닭] = (셈.교체까닭[까닭] ?? 0) + 1;
  const 옛 = 아이;
  아이 = null;
  남은줄 = '';
  이번건수 = 0;
  /* 기다리던 것들은 깨웁니다 — 다시보냄 그물이 한 번 더 보냅니다 */
  for (const [, v] of 기다리는것) v.깨(new Error('워커가 바뀌었습니다 — ' + 까닭));
  기다리는것 = new Map();
  거두는중 = 거두기(옛, 까닭);
}

/* ★ 2026-10-20 — **워커가 교체될 때 기다리던 요청을 버리지 않습니다.**
 *
 * 워커는 rss 700MB 를 넘거나 200건마다 교체됩니다. 그때 `기다리는것` 에
 * 남아 있던 요청은 「워커가 바뀌었습니다」·「워커가 죽었습니다」로 **버려졌습니다.**
 * 능력시험에서 그것이 **읽기 실패로 세어졌습니다** —
 *   PDF 11번 · 그림 6번 (그림 읽기가 95% → 63% 로 보였습니다)
 * 꼴 탓이 아니라 **우리 쪽 살림** 탓입니다. 그래서 그 두 까닭일 때만
 * **한 번 다시** 보냅니다 (새 워커가 떠 있습니다). 다른 탈은 그대로 올립니다.
 */
const 워커바뀜 = /워커가 (바뀌었습니다|죽었습니다)/;
export const 다시보냄 = { 수: 0 };

/** 한 파일 읽기. 돌려주는 것은 kordoc 의 ParseResult */
export async function 읽기(파일, 옵션 = {}) {
  /* ★ 2026-10-21 ⓐ — **거두는 동안 기다립니다.** 안 기다리면 옛 워커가
     살아 있는 채 새 워커가 떠서 둘이 겹칩니다 (그것이 1.3GB 의 뿌리였습니다).
     못 거뒀으면 이 바퀴는 멈춥니다 — 무한 대기는 하지 않습니다 */
  if (거두는중) await 거두는중;
  if (바퀴중단) throw new Error(바퀴중단);
  try {
    return await 한번읽기(파일, 옵션);
  } catch (e) {
    if (!워커바뀜.test(String((e && e.message) || e))) throw e;
    다시보냄.수++;
    셈.다시보냄 = 다시보냄.수;
    if (거두는중) await 거두는중;          /* 다시 보낼 때도 거둔 뒤에 */
    if (바퀴중단) throw new Error(바퀴중단);
    return await 한번읽기(파일, 옵션);
  }
}

async function 한번읽기(파일, 옵션 = {}) {
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
