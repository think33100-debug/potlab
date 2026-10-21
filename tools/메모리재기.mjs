/* 바퀴가 도는 동안 **누가 메모리를 쓰나**를 30초마다 찍습니다 (2026-10-21 세중님 1번)
 *
 *   node tools/메모리재기.mjs --몇개 16            빈손진단을 돌리며 함께 잽니다
 *   node tools/메모리재기.mjs --몇개 16 --틈 15    15초마다
 *   node tools/메모리재기.mjs --붙어서만 300       아무것도 안 돌리고 300초만 구경
 *
 * 찍는 것 — `free -m` 의 쓴것/쓸수있는것 · **프로세스별 rss**를 갈래로 묶어서
 *            ① kordoc 워커(parse-worker)  ② 돌리는 본체  ③ 다른 크론(node tools/…)
 *            ④ 그밖(큰 것만)
 *
 * ★ **아무것도 고치지 않습니다.** DB·파일을 안 쓰고 읽기만 합니다
 *   (빈손진단도 DB 에 안 씁니다). 잰 것은 log/메모리재기_<날짜>.json 에 적습니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execSync } from 'node:child_process';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const 값 = (이름, 기본) => {
  const i = argv.indexOf(이름);
  return i > -1 && argv[i + 1] != null ? argv[i + 1] : 기본;
};
const 몇개 = Number(값('--몇개', 16));
const 틈초 = Number(값('--틈', 30));
const 붙어서만 = Number(값('--붙어서만', 0));

const 메모리 = () => {
  try {
    const t = execSync('free -m', { encoding: 'utf8' }).split('\n')[1].split(/\s+/);
    return { 전체: Number(t[1]), 쓴것: Number(t[2]), 쓸수있는것: Number(t[6]), 바탕캐시: Number(t[5]) };
  } catch { return null; }
};

/** ps 한 장 — [{pid, ppid, rssMB, 분, 갈래, 이름}] */
function 프로세스들() {
  let out = '';
  try { out = execSync('ps -eo pid,ppid,rss,etimes,args --no-headers', { encoding: 'utf8', maxBuffer: 4e6 }); }
  catch { return []; }
  const 들 = [];
  for (const l of out.split('\n')) {
    const m = l.match(/^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(.*)$/);
    if (!m) continue;
    const rssMB = Math.round(Number(m[3]) / 1024);
    if (rssMB < 20) continue;                      /* 20MB 아래는 안 셉니다 */
    const args = m[5];
    let 갈래 = '그밖'; let 이름 = args.split(/\s+/)[0].split('/').pop();
    if (/parse-worker/.test(args)) { 갈래 = 'kordoc 워커'; 이름 = 'parse-worker'; }
    else if (/빈손진단|메모리재기/.test(args)) { 갈래 = '재는 본체'; 이름 = /메모리재기/.test(args) ? '메모리재기' : '빈손진단'; }
    else if (/node/.test(args) && /tools\//.test(args)) {
      갈래 = '다른 크론';
      이름 = (args.match(/tools\/([^\s]+)/) || [])[1] || 'node';
    }
    들.push({ pid: Number(m[1]), ppid: Number(m[2]), rssMB, 분: Math.round(Number(m[4]) / 6) / 10, 갈래, 이름, args: args.slice(0, 70) });
  }
  return 들;
}

const 잰것 = [];
let 아이 = null;
if (!붙어서만) {
  const 로그 = fs.openSync('/tmp/빈손진단_재기.log', 'w');
  const 덧 = argv.includes('--매건비우기') ? ['--매건비우기'] : [];
  아이 = spawn(process.execPath, [path.join(여기, '빈손진단.mjs'), '--몇개', String(몇개), ...덧], {
    cwd: path.join(여기, '..'), stdio: ['ignore', 로그, 로그], env: process.env,
  });
  console.log('빈손진단(' + 몇개 + '건)을 띄우고 ' + 틈초 + '초마다 잽니다 — pid ' + 아이.pid);
} else {
  console.log('아무것도 안 돌리고 ' + 붙어서만 + '초 동안 ' + 틈초 + '초마다 잽니다');
}

const t0 = Date.now();
let 끝났나 = false;
if (아이) 아이.on('exit', (c) => { 끝났나 = true; console.log('\n빈손진단이 끝났습니다 (끝값 ' + c + ')'); });

console.log('\n   때   쓴것   쓸수  워커(수)   본체  다른크론  그밖   겹친 크론');
while (!끝났나 && (붙어서만 ? (Date.now() - t0) / 1000 < 붙어서만 : true)) {
  const m = 메모리();
  const ps = 프로세스들();
  const 합 = (g) => ps.filter((x) => x.갈래 === g).reduce((a, b) => a + b.rssMB, 0);
  const 크론들 = [...new Set(ps.filter((x) => x.갈래 === '다른 크론').map((x) => x.이름))];
  const 워커수 = ps.filter((x) => x.갈래 === 'kordoc 워커').length;
  const 한줄 = {
    초: Math.round((Date.now() - t0) / 1000),
    때: new Date(Date.now() + 9 * 3600e3).toISOString().slice(11, 19),
    쓴것: m && m.쓴것, 쓸수있는것: m && m.쓸수있는것,
    워커: 합('kordoc 워커'), 워커수, 본체: 합('재는 본체'), 다른크론: 합('다른 크론'), 그밖: 합('그밖'),
    크론들, 큰것: ps.sort((a, b) => b.rssMB - a.rssMB).slice(0, 3)
      .map((x) => x.이름 + ' ' + x.rssMB + 'MB'),
  };
  잰것.push(한줄);
  console.log('  ' + 한줄.때 + String(한줄.쓴것).padStart(6) + String(한줄.쓸수있는것).padStart(6)
    + String(한줄.워커).padStart(6) + ('(' + 한줄.워커수 + ')').padStart(4) + String(한줄.본체).padStart(7) + String(한줄.다른크론).padStart(8)
    + String(한줄.그밖).padStart(7) + '   ' + 크론들.join(' · ').slice(0, 44));
  await new Promise((r) => setTimeout(r, 틈초 * 1000));
}

/* ── 요약 ── */
const 최고 = 잰것.reduce((a, b) => (b.쓴것 > (a?.쓴것 ?? -1) ? b : a), null);
console.log('\n── 요약 ──');
console.log('  잰 횟수 ' + 잰것.length + ' · 쓴것 최저 ' + Math.min(...잰것.map((x) => x.쓴것))
  + 'MB · 최고 ' + Math.max(...잰것.map((x) => x.쓴것)) + 'MB');
if (최고) {
  console.log('  최고일 때(' + 최고.때 + ') — 워커 ' + 최고.워커 + 'MB · 본체 ' + 최고.본체
    + 'MB · 다른 크론 ' + 최고.다른크론 + 'MB · 그밖 ' + 최고.그밖 + 'MB');
  console.log('    큰 것 셋 — ' + 최고.큰것.join(' · '));
}
const 크론본적 = [...new Set(잰것.flatMap((x) => x.크론들))];
console.log('  바퀴 도는 동안 함께 돈 크론 — ' + (크론본적.length ? 크론본적.join(' · ') : '없음'));
console.log('  ★ 동시 워커 최대 ' + Math.max(...잰것.map((x) => x.워커수 || 0)) + '개');
console.log('  워커 rss 최고 ' + Math.max(...잰것.map((x) => x.워커)) + 'MB · 본체 최고 '
  + Math.max(...잰것.map((x) => x.본체)) + 'MB · 다른 크론 최고 '
  + Math.max(...잰것.map((x) => x.다른크론)) + 'MB');

const 낼곳 = path.join(여기, '..', 'log', '메모리재기_'
  + new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10) + '.json');
fs.writeFileSync(낼곳, JSON.stringify({ 잰때: new Date().toISOString(), 틈초, 잰것 }, null, 1) + '\n', 'utf8');
console.log('\n  ' + 낼곳 + ' 에 적었습니다. 아무것도 고치지 않았습니다.');
