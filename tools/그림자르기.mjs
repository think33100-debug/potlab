/* 그림자르기 — 아주 긴 캡처를 토막 내어 **눈으로 볼 수 있게** 만듭니다.
 *                그리고 개인정보가 보이는 자리를 **검은 띠로 가립니다.**
 *
 *   node tools/그림자르기.mjs <그림> [--높이 2400] [--몇장 12] [--나갈곳 <폴더>]
 *   node tools/그림자르기.mjs <그림> --가리기 "x,y,w,h" [--가리기 …] --덮어쓰기
 *
 * 왜 있나 — fullPage 캡처가 7만 픽셀을 넘는 화면이 있습니다(쓰레기통 72,001px).
 * 통째로 열면 가로 36픽셀로 줄어들어 **아무것도 안 보입니다.** 개인정보가
 * 섞였는지 보려면 토막을 내야 합니다 (2026-10-10).
 *
 * 왜 sharp 인가 — 처음엔 playwright 로 띄워 찍으려 했는데, 7만 픽셀짜리
 * 그림은 브라우저가 **한 장도 못 내놓고 5분을 넘겼습니다.** sharp 는 PNG 를
 * 바로 잘라서 몇 초입니다. (web/node_modules 에 이미 깔려 있습니다 — Next 가 씁니다)
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 뿌리 = path.join(여기, '..');
const require_ = createRequire(path.join(뿌리, 'web', 'package.json'));
const sharp = require_('sharp');

function 인수(이름, 기본) {
  const i = process.argv.indexOf('--' + 이름);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : 기본;
}
function 인수여러개(이름) {
  const out = [];
  process.argv.forEach((a, i) => { if (a === '--' + 이름 && process.argv[i + 1]) out.push(process.argv[i + 1]); });
  return out;
}

const 그림길 = process.argv[2];
if (!그림길 || !fs.existsSync(그림길)) {
  console.error('쓰기: node tools/그림자르기.mjs <그림.png> [--높이 2400] [--몇장 12]');
  console.error('      node tools/그림자르기.mjs <그림.png> --가리기 "x,y,w,h" --덮어쓰기');
  process.exit(1);
}
const 토막높이 = Number(인수('높이', 2400));
const 몇장 = Number(인수('몇장', 12));
const 덮어쓸까 = process.argv.includes('--덮어쓰기');
const 가릴것 = 인수여러개('가리기').map((s) => s.split(',').map(Number));
const 나갈곳 = path.resolve(인수('나갈곳', path.join(뿌리, 'docs', 'screens', '_토막')));

const 원본 = sharp(그림길, { limitInputPixels: false });
const { width: w, height: h } = await 원본.metadata();

if (가릴것.length) {
  /* 검은 띠를 얹습니다. 그림 밖으로 나가면 잘라 맞춥니다 */
  const 띠 = [];
  for (const [x, y, bw, bh] of 가릴것) {
    const left = Math.max(0, Math.round(x));
    const top = Math.max(0, Math.round(y));
    const width = Math.min(Math.round(bw), w - left);
    const height = Math.min(Math.round(bh), h - top);
    if (width <= 0 || height <= 0) { console.error('  · 그림 밖이라 건너뜁니다 — ' + [x, y, bw, bh]); continue; }
    띠.push({
      input: { create: { width, height, channels: 4, background: { r: 17, g: 17, b: 17, alpha: 1 } } },
      left, top,
    });
  }
  const 낼곳 = 덮어쓸까 ? 그림길 + '.tmp' : path.join(나갈곳, path.basename(그림길));
  if (!덮어쓸까) fs.mkdirSync(나갈곳, { recursive: true });
  await sharp(그림길, { limitInputPixels: false }).composite(띠).png().toFile(낼곳);
  if (덮어쓸까) { fs.rmSync(그림길); fs.renameSync(낼곳, 그림길); }
  console.log(`○ ${path.basename(그림길)} — ${w}x${h} · 가린 자리 ${띠.length}곳`
    + (덮어쓸까 ? ' (그 자리에 덮어썼습니다)' : ' → ' + path.relative(뿌리, 낼곳)));
} else {
  fs.mkdirSync(나갈곳, { recursive: true });
  const 이름 = path.basename(그림길, '.png');
  const 모두 = Math.ceil(h / 토막높이);
  const 낼것 = Math.min(모두, 몇장);
  /* 몇장보다 토막이 많으면 **고르게 떠서** 봅니다 — 앞쪽만 보면 뒤를 놓칩니다 */
  const 걸음 = 모두 <= 몇장 ? 1 : 모두 / 몇장;
  for (let i = 0; i < 낼것; i++) {
    const top = Math.min(Math.floor(i * 걸음) * 토막높이, h - 1);
    const height = Math.min(토막높이, h - top);
    await sharp(그림길, { limitInputPixels: false })
      .extract({ left: 0, top, width: w, height })
      .png()
      .toFile(path.join(나갈곳, `${이름}__${String(i).padStart(2, '0')}_y${top}.png`));
  }
  console.log(`○ ${이름} — ${w}x${h} · 토막 ${모두}개 중 ${낼것}장 → `
    + path.relative(뿌리, 나갈곳));
}
