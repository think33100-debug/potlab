/* kordoc 워커를 띄운 프로세스가 **스스로 끝나나** 봅니다
 * (2026-10-12 · 수집기가 안 죽던 일의 되풀이 막기).
 *
 *   node tools/kordoc워커_끝나나시험.mjs <파일.hwp|pdf>
 *
 * ── 왜 이 시험이 필요한가 ────────────────────────────────────
 * 2026-10-12 01:50 클린아이가 일을 다 끝내고도 **5시간 19분** 살아 있었습니다.
 * 잠금을 쥔 채라 그 뒤 클린아이 실행 **13번이 전부 건너뛰었습니다.**
 *
 * `kordoc워커.mjs` 의 자기 점검은 끝에서 `워커끝내기()` 를 **직접 부르고**
 * `process.exit(0)` 까지 합니다. 그래서 **통과해도 증거가 안 됩니다** —
 * 수집기(GJ2·ND2·CE2)는 그 함수를 부르지 않습니다.
 *
 * 이 시험은 **수집기와 똑같이** 합니다 —
 *   · `읽기()` 만 부르고
 *   · `워커끝내기()` 를 **안 부르고**
 *   · `process.exit()` 도 **안 하고**
 *   그냥 파일 끝에서 떨어집니다.
 * 그래도 프로세스가 끝나야 맞습니다. 안 끝나면 시험이 시간 제한에 걸립니다
 * (지침 12절 — 시험은 실제와 같은 조건에서).
 *
 * 돌리는 쪽(`--감시`)이 자식을 띄워 **정말 끝났는지**와
 * **고아 워커가 남았는지**를 셉니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 인수 = process.argv.slice(2);

/* ── 안쪽: 수집기 흉내 ─────────────────────────────────────── */
if (!인수.includes('--감시')) {
  const 파일 = 인수.find((a) => !a.startsWith('--'));
  const { 읽기, kordoc있나, 워커셈 } = await import('./kordoc워커.mjs');
  if (!kordoc있나()) { console.error('kordoc 이 안 깔렸습니다'); process.exit(1); }
  if (!파일 || !fs.existsSync(파일)) { console.error('읽을 파일을 주십시오'); process.exit(1); }
  /* ⚠ `읽기()` 에는 **온 경로(절대 경로)** 를 줘야 합니다. 워커는 `cwd` 가
     kordoc 꾸러미 폴더라, 상대 경로를 주면 엉뚱한 자리를 보고 `success:false` 가
     옵니다. 처음에 상대 경로로 시험해서 「kordoc 이 못 읽는다」고 잘못 봤습니다 */
  const r = await 읽기(path.resolve(파일));
  const 셈 = 워커셈();
  console.log('읽음 — 성공 ' + !!(r.result && r.result.success)
    + ' · ' + (r.result?.markdown || '').length + '자 · rss ' + r.rssMB + 'MB · ' + r.초 + '초');
  console.log('워커 — 띄운횟수 ' + 셈.띄운횟수 + ' · 받은것 ' + 셈.받은것 + ' · 판 ' + 셈.판);
  console.log('이제 **아무것도 더 하지 않고** 끝까지 떨어집니다 (워커끝내기 안 부름)');
  /* 여기서 끝. process.exit() 를 **일부러 안 씁니다** */
}

/* ── 바깥: 감시 ────────────────────────────────────────────── */
else {
  const 파일 = 인수.find((a) => !a.startsWith('--'));
  const 제한초 = 60;
  console.log('수집기 흉내를 내는 자식을 띄웁니다 — 제한 ' + 제한초 + '초');
  const t0 = Date.now();
  const 아이 = spawn(process.execPath, [path.join(여기, 'kordoc워커_끝나나시험.mjs'), 파일],
    { stdio: ['ignore', 'pipe', 'pipe'] });
  let 글 = '';
  /* 자식의 글은 **원문 그대로** 찍습니다 — 안 찍으면 왜 죽었는지 모릅니다 (지침 2절) */
  아이.stdout.on('data', (c) => { 글 += c; process.stdout.write('   │ ' + c); });
  아이.stderr.on('data', (c) => { 글 += c; process.stdout.write('   ✗ ' + c); });

  const 끝 = await new Promise((맺) => {
    const 시계 = setTimeout(() => 맺({ 끝났나: false }), 제한초 * 1000);
    아이.on('exit', (code, sig) => { clearTimeout(시계); 맺({ 끝났나: true, code, sig }); });
  });
  const 초 = Math.round((Date.now() - t0) / 100) / 10;

  /* 고아 워커가 남았나 — **pid 로** 셉니다 (지침 8-2: 이름으로 찾으면 제 명령줄이 걸립니다) */
  let 고아 = '못 셌습니다';
  try {
    const out = execFileSync('/bin/sh', ['-c',
      "ps -eo pid,ppid,cmd | grep '[p]arse-worker' | wc -l"], { encoding: 'utf8' });
    고아 = out.trim();
  } catch { /* 윈도에서는 셀 수 없습니다 */ }

  console.log('');
  if (!끝.끝났나) {
    console.log('✗ **안 끝났습니다** — ' + 제한초 + '초가 지나도 살아 있습니다. 죽입니다');
    try { 아이.kill('SIGKILL'); } catch { /* 넘어갑니다 */ }
    console.log('   이것이 01:50 클린아이가 5시간 19분 서 있던 꼴입니다');
    process.exit(1);
  }
  console.log('○ 끝났습니다 — ' + 초 + '초 · exit code ' + 끝.code + (끝.sig ? ' · 신호 ' + 끝.sig : ''));
  console.log('   남은 parse-worker ' + 고아 + '개  (0 이어야 맞습니다)');
  if (끝.code !== 0) { console.log('✗ exit code 가 0 이 아닙니다'); process.exit(1); }
  if (고아 !== '못 셌습니다' && Number(고아) !== 0) { console.log('✗ **고아 워커가 남았습니다**'); process.exit(1); }
  console.log('');
  console.log('통과 — 워커끝내기() 를 안 불러도 프로세스가 끝나고 고아도 없습니다');
}
