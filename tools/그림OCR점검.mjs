/* 그림 공고를 읽을 준비가 됐나 — **한 자리에서** 묻습니다
 *
 *   node tools/그림OCR점검.mjs            사람이 보는 꼴로
 *   node tools/그림OCR점검.mjs --한줄      요약 메일에 넣을 한 줄
 *
 * ── 왜 그물이 필요한가 (2026-10-20) ─────────────────────────────
 * kordoc 은 PNG·JPG·WebP 를 OCR 로 읽습니다. 그런데 그러려면 **sharp** 가
 * 있어야 하고, sharp 는 **바탕 꾸러미(@img/sharp-linux-x64 · libvips)** 가
 * 따로 필요합니다. 그 바탕이 **optional** 이라서 —
 *
 *   `tools/kordoc/.npmrc` 에 `omit=optional` 이 있습니다
 *   (kordoc 의 onnxruntime-node 287MB 를 안 받으려고 켜 둔 것입니다)
 *   → 그래서 **`npm ci` 만 돌리면 그림이 또 0% 가 됩니다.**
 *
 * 깔 때 한 줄을 더 돌려야 합니다 (README 에도 적었습니다) —
 *   cd ~/potlab/tools/kordoc && ONNXRUNTIME_NODE_INSTALL=skip \
 *     npm install --include=optional --os=linux --cpu=x64 --no-audit --no-fund
 *
 * 사람이 그걸 잊을 수 있으니 **날마다 묻습니다.** 아침 요약 메일에 한 줄로 뜹니다.
 * (지침 — 「사람이 지키는 규칙이 먼저이고, 그물이 뒤를 받칩니다」)
 *
 * ★ 그물을 두드리지 않습니다. 파일만 봅니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 꾸러미 = path.join(여기, 'kordoc');

/** { 됨, 왜, sharp판, 바탕 } — 그림을 읽을 수 있나 */
export function 그림OCR준비됐나() {
  const CLI = path.join(꾸러미, 'node_modules', 'kordoc', 'dist', 'cli.js');
  if (!fs.existsSync(CLI)) {
    return { 됨: false, 왜: 'kordoc 이 안 깔렸습니다 (cd tools/kordoc && npm ci)' };
  }
  let sharp판 = null;
  try {
    const req = createRequire(path.join(꾸러미, 'package.json'));
    sharp판 = req('sharp').versions.sharp;
  } catch (e) {
    const m = String((e && e.message) || e);
    /* 두 가지를 가릅니다 — **아예 없는 것**과 **바탕이 없는 것** */
    const 바탕없음 = /runtime|Could not load the "sharp" module|platform/i.test(m);
    return { 됨: false, 바탕없음,
      왜: 바탕없음
        ? 'sharp 의 바탕 꾸러미가 없습니다 (@img/sharp-linux-x64) — .npmrc 의 omit=optional 때문입니다'
        : 'sharp 가 없습니다 — ' + m.slice(0, 100) };
  }
  /* 바탕 꾸러미가 실제로 있는지도 눈으로 봅니다 */
  const img = path.join(꾸러미, 'node_modules', '@img');
  const 바탕 = fs.existsSync(img) ? fs.readdirSync(img).filter((n) => /^sharp-/.test(n)) : [];
  if (!바탕.some((n) => /linux-x64|win32|darwin/.test(n))) {
    return { 됨: false, 바탕없음: true, sharp판,
      왜: 'sharp 는 있는데 바탕 꾸러미(@img/sharp-*)가 없습니다' };
  }
  return { 됨: true, sharp판, 바탕 };
}

/** 요약 메일에 넣을 한 줄 — 됐으면 짧게, 안 됐으면 **고치는 명령까지** */
export function 한줄() {
  const r = 그림OCR준비됐나();
  if (r.됨) return '그림 OCR      준비됨 (sharp ' + r.sharp판 + ' · 바탕 ' + r.바탕.length + '개)';
  return '██ 그림 OCR 이 안 됩니다 — ' + r.왜 + '\n'
    + '   고치는 법: cd ~/potlab/tools/kordoc && ONNXRUNTIME_NODE_INSTALL=skip \\\n'
    + '              npm install --include=optional --os=linux --cpu=x64 --no-audit --no-fund';
}

if (process.argv[1] && process.argv[1].endsWith('그림OCR점검.mjs')) {
  if (process.argv.includes('--한줄')) { console.log(한줄()); process.exit(0); }
  const r = 그림OCR준비됐나();
  console.log(r.됨 ? '○ 그림 OCR 준비됐습니다' : '✗ 그림 OCR 이 안 됩니다');
  console.log('  sharp   ' + (r.sharp판 || '없음'));
  console.log('  바탕    ' + ((r.바탕 || []).join(' · ') || '없음'));
  if (r.왜) console.log('  왜      ' + r.왜);
  if (!r.됨) {
    console.log('\n  고치는 법 —');
    console.log('    cd ~/potlab/tools/kordoc && ONNXRUNTIME_NODE_INSTALL=skip \\');
    console.log('      npm install --include=optional --os=linux --cpu=x64 --no-audit --no-fund');
  }
  process.exit(r.됨 ? 0 : 1);
}
