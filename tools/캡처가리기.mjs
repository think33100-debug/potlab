/* 캡처가리기 — 이미 찍은 캡처에서 **실제 회원 개인정보**를 검게 덮습니다.
 *
 *   node tools/캡처가리기.mjs            가립니다 (원본은 먼저 저장소 밖으로 옮깁니다)
 *   node tools/캡처가리기.mjs --미리보기   덮을 자리만 잘라서 보여줍니다 (안 고칩니다)
 *
 * 가릴 자리는 tools/가릴자리.json 의 「그림」 에 있습니다 — [x, y, 너비, 높이] (원본 픽셀).
 *
 * 원본은 **저장소 밖**(바탕화면/캡처원본_1010/)으로 옮깁니다. 저장소에 남으면
 * 가린 뜻이 없어집니다. 옮기는 것은 이 파일이 하지 않습니다 — 셸에서 합니다
 * (무엇이 어디로 갔는지 세중님이 보셔야 하니까).
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 뿌리 = path.join(여기, '..');
const sharp = createRequire(path.join(뿌리, 'web', 'package.json'))('sharp');
const 그림방 = path.join(뿌리, 'docs', 'screens');
const 미리보기 = process.argv.includes('--미리보기');
const 미리방 = path.join(그림방, '_가릴자리미리보기');

const 목록 = JSON.parse(fs.readFileSync(path.join(여기, '가릴자리.json'), 'utf8')).그림;

if (미리보기) fs.mkdirSync(미리방, { recursive: true });
let 한것 = 0; const 탈 = [];

for (const [이름, 칸들] of Object.entries(목록)) {
  const 길 = path.join(그림방, 이름 + '.png');
  if (!fs.existsSync(길)) { 탈.push(이름 + ' — 그림이 없습니다'); continue; }
  const { width: w, height: h } = await sharp(길, { limitInputPixels: false }).metadata();

  if (미리보기) {
    /* 덮을 자리를 **넉넉히 둘러** 잘라 봅니다 — 맞게 집었는지 눈으로 보려고 */
    for (let i = 0; i < 칸들.length; i++) {
      const [x, y, cw, ch] = 칸들[i];
      const top = Math.max(0, y - 60);
      const height = Math.min(ch + 120, h - top);
      await sharp(길, { limitInputPixels: false })
        .extract({ left: 0, top, width: w, height })
        .png().toFile(path.join(미리방, `${이름}__${i}.png`));
    }
    console.log(`  · ${이름} (${w}x${h}) — ${칸들.length}칸`);
    continue;
  }

  const 띠 = [];
  for (const [x, y, cw, ch] of 칸들) {
    const left = Math.max(0, Math.round(x));
    const top = Math.max(0, Math.round(y));
    const width = Math.min(Math.round(cw), w - left);
    const height = Math.min(Math.round(ch), h - top);
    if (width <= 0 || height <= 0) { 탈.push(`${이름} — 그림 밖 [${[x, y, cw, ch]}]`); continue; }
    띠.push({
      input: { create: { width, height, channels: 4, background: { r: 17, g: 17, b: 17, alpha: 1 } } },
      left, top,
    });
  }
  if (!띠.length) continue;
  const 임시 = 길 + '.tmp';
  await sharp(길, { limitInputPixels: false }).composite(띠).png().toFile(임시);
  fs.rmSync(길); fs.renameSync(임시, 길);
  console.log(`  ○ ${이름} — ${띠.length}칸 덮었습니다`);
  한것++;
}

console.log(미리보기
  ? `\n미리보기 ${Object.keys(목록).length}개 → ${path.relative(뿌리, 미리방)}`
  : `\n가린 그림 ${한것}장`);
if (탈.length) { console.log('\n걸린 것:'); for (const t of 탈) console.log('  ✗ ' + t); }
