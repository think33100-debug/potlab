/* 그림줄이기 — 캡처 PNG 를 **이름은 그대로 둔 채** 가볍게 다시 냅니다.
 *
 *   node tools/그림줄이기.mjs <폴더>
 *
 * 왜 있나 (2026-10-10)
 *   인계 묶음이 93MB 였습니다. 캡처는 거의 **단색 바탕에 글자**라
 *   팔레트 PNG 로 다시 내면 크게 줄어듭니다. **확장자가 그대로**라
 *   index.html·목록.json 의 링크를 하나도 안 고쳐도 됩니다.
 *
 * ★ 저장소 그림에는 쓰지 마십시오. **묶음 복사본에만** 씁니다 —
 *   원본은 저장소에 그대로 두어야 나중에 다시 쓸 수 있습니다.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 뿌리 = path.join(여기, '..');
const sharp = createRequire(path.join(뿌리, 'web', 'package.json'))('sharp');

const 방 = process.argv[2];
if (!방 || !fs.existsSync(방)) { console.error('쓰기: node tools/그림줄이기.mjs <폴더>'); process.exit(1); }

const 파일들 = fs.readdirSync(방).filter((f) => f.endsWith('.png'));
let 전 = 0, 후 = 0, 센것 = 0, 그냥둠 = 0;

for (const f of 파일들) {
  const 길 = path.join(방, f);
  const 크기전 = fs.statSync(길).size;
  전 += 크기전;
  try {
    const 새것 = await sharp(길, { limitInputPixels: false })
      /* 팔레트(256색) — 캡처는 단색 바탕에 글자라 눈으로는 차이가 없습니다 */
      .png({ palette: true, quality: 90, effort: 7 })
      .toBuffer();
    if (새것.length < 크기전 * 0.95) {
      fs.writeFileSync(길, 새것); 후 += 새것.length; 센것++;
    } else { 후 += 크기전; 그냥둠++; }   /* 안 줄면 원본을 둡니다 */
  } catch (e) {
    후 += 크기전; 그냥둠++;
    console.error('  ✗ ' + f + ' — ' + String(e.message).slice(0, 60));
  }
}

const mb = (b) => (b / 1024 / 1024).toFixed(1);
console.log(`  그림 ${파일들.length}장 · 줄인 것 ${센것} · 그냥 둔 것 ${그냥둠}`);
console.log(`  ${mb(전)}MB → ${mb(후)}MB (${Math.round((1 - 후 / 전) * 100)}% 줄었습니다)`);
