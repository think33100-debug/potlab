/* tools/ 와 gas/wage.js 를 한 번에 검사합니다 (2026-09-28).
 *
 *   node tools/lint.mjs          둘 다
 *   node tools/lint.mjs --tools  tools/ 만
 *   node tools/lint.mjs --gas    gas/wage.js 만
 *
 * 「돌다가 죽는 것」만 봅니다 — `node --check` 가 못 잡는 종류입니다.
 * 2026-09-28 에 다리가 `치움 is not defined` 로 하루 네 번 죽었습니다.
 * 이름을 바꾸면서 두 곳을 빼먹은 것인데, 문법 오류가 아니라 실행 오류라
 * 그 줄이 돌아야 터집니다.
 *
 * eslint 는 web/node_modules 의 것을 빌려 씁니다 (새로 깔지 않습니다).
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 뿌리 = path.join(여기, '..');
/* 뿌리에 깔려 있으면 그것, 없으면 web 것을 빌립니다 (집 컴퓨터는 web 쪽에 있습니다) */
const 후보 = [path.join(뿌리, 'node_modules', 'eslint', 'bin', 'eslint.js'),
              path.join(뿌리, 'web', 'node_modules', 'eslint', 'bin', 'eslint.js')];
const eslint = 후보.find((x) => fs.existsSync(x)) || 후보[1];

if (!fs.existsSync(eslint)) {
  console.log('※ 검사 건너뜀 — ' + eslint + ' 가 없습니다');
  console.log('  web 폴더에서 npm install 을 한 번 하면 켜집니다');
  process.exit(0);
}

const argv = process.argv.slice(2);
const 할것 = [];
if (!argv.includes('--gas')) 할것.push({ 이름: 'tools/', cwd: 여기, cfg: 'eslint.tools.mjs', 볼것: ['.'] });
if (!argv.includes('--tools') && fs.existsSync(path.join(뿌리, 'gas', 'wage.js'))) {
  할것.push({ 이름: 'gas/wage.js', cwd: path.join(뿌리, 'gas'), cfg: 'eslint.gas.mjs', 볼것: ['wage.js'] });
}

let 나쁨 = 0;
for (const x of 할것) {
  const r = spawnSync(process.execPath, [eslint, '-c', x.cfg, ...x.볼것],
    { cwd: x.cwd, encoding: 'utf8' });
  const 글 = (r.stdout || '') + (r.stderr || '');
  if (r.status === 0) {
    console.log('○ ' + x.이름 + ' — 돌다가 죽을 곳 없습니다');
  } else {
    나쁨++;
    console.log('✗ ' + x.이름 + ' — 돌다가 죽을 곳이 있습니다');
    console.log(글.trim().split('\n').map((l) => '   ' + l).join('\n'));
  }
}
if (나쁨) {
  console.log('\n위 줄들은 `node --check` 로는 안 잡히는 종류입니다.');
  console.log('실제로 그 줄이 돌 때 터집니다 — 「공고가 0건인 날」 에는 멀쩡해 보입니다.');
}
process.exit(나쁨 ? 1 : 0);
