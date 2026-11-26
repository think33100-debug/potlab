/* 댓글 「라포」 → DM 을 1분마다 보는 크론 줄을 켜고 끕니다 (2026-11-26 세중님 「댓글 달면 바로 가야지」)
 *
 *   node tools/reels/크론댓글.mjs            지금 줄을 보여 주기만
 *   node tools/reels/크론댓글.mjs --켜기      아래 줄을 더함 (이미 있으면 안 더함)
 *   node tools/reels/크론댓글.mjs --끄기      그 줄을 뺌 (되돌리기)
 *
 * 줄   * * * * * mkdir -p ~/lock && flock -n ~/lock/dm.lock bash -c 'cd ~/potlab && node tools/reels/댓글링크.mjs --실행 --빠르게' >> ~/potlab/log/댓글링크.log 2>&1
 *      댓글링크 --빠르게 는 평소 인스타 호출 1번(게시물 목록 · 댓글 수가 바뀐 게시물만 댓글을 읽음)
 * 지키는 선 — 바꾸기 전 크론 전체를 ~/되돌림/crontab_<때>.txt 에 · 다른 줄은 글자까지 그대로 · 바꾼 뒤 다시 읽어 확인 (지침 8-15 · 8-19) */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const 켜기 = process.argv.includes('--켜기');
const 끄기 = process.argv.includes('--끄기');
const 줄 = "* * * * * mkdir -p ~/lock && flock -n ~/lock/dm.lock bash -c 'cd ~/potlab && node tools/reels/댓글링크.mjs --실행 --빠르게' >> ~/potlab/log/댓글링크.log 2>&1";
const 우리줄 = (l) => !/^\s*#/.test(l) && /tools\/reels\/댓글링크\.mjs/.test(l);

function 읽기() {
  const r = spawnSync('crontab', ['-l'], { encoding: 'utf8' });
  if (r.status !== 0) { console.error('✗ crontab -l 실패 — ' + String(r.stderr || '').slice(0, 200)); process.exit(1); }
  return r.stdout;
}
const 글 = 읽기();
const 줄들 = 글.split('\n');
const 있는 = 줄들.filter(우리줄);
console.log(`댓글 DM 크론 줄 ${있는.length}개`);
for (const l of 있는) console.log('  ' + l);
if (!켜기 && !끄기) { console.log('\n(보기만 — 바꾸려면 --켜기 또는 --끄기)'); process.exit(0); }
if (켜기 && 있는.length) { console.log('\n바꿀 것 없음 — 이미 켜져 있습니다'); process.exit(0); }
if (끄기 && !있는.length) { console.log('\n바꿀 것 없음 — 이미 꺼져 있습니다'); process.exit(0); }

const 터 = path.join(os.homedir(), '되돌림');
fs.mkdirSync(터, { recursive: true });
const 때 = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 19).replace(/[-:]/g, '').replace('T', '_');
const 되돌림 = path.join(터, `crontab_${때}.txt`);
fs.writeFileSync(되돌림, 글);

let 새줄들;
if (켜기) { const 끝빈 = 줄들.length && 줄들[줄들.length - 1] === ''; 새줄들 = 끝빈 ? [...줄들.slice(0, -1), 줄, ''] : [...줄들, 줄, '']; }
else 새줄들 = 줄들.filter((l) => !우리줄(l));
const w = spawnSync('crontab', ['-'], { input: 새줄들.join('\n'), encoding: 'utf8' });
if (w.status !== 0) { console.error('✗ crontab 쓰기 실패 — 바뀐 것 없음 · ' + String(w.stderr || '').slice(0, 200)); process.exit(1); }

const 다시 = 읽기().split('\n');
const 남은 = 다시.filter((l) => !우리줄(l)).join('\n').trimEnd();
const 원래 = 줄들.filter((l) => !우리줄(l)).join('\n').trimEnd();
const 맞음 = 남은 === 원래 && 다시.filter(우리줄).length === (켜기 ? 1 : 0);
console.log(`\n크론 줄 수 ${줄들.filter((l) => l.trim()).length} → ${다시.filter((l) => l.trim()).length}`);
console.log(`되돌림  ${되돌림}  (되돌리기: crontab ${되돌림})`);
console.log(맞음 ? `○ ${켜기 ? '켰습니다' : '껐습니다'} — 다시 읽어 다른 줄이 그대로인 것을 확인` : '✗ 다시 읽은 크론이 기대와 다릅니다 — 되돌림 파일로 되돌리세요');
process.exit(맞음 ? 0 : 1);
