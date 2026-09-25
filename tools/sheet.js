/* 시트를 그대로 찍어 봅니다 — node tools/sheet.js <시트이름> [찾을말]
 *
 *   node tools/sheet.js 사이트점검
 *   node tools/sheet.js 사이트점검 녹색병원
 *
 * 구글 서버가 **실제로 무엇을 받았는지** 보려고 만들었습니다.
 * 여기(집 컴퓨터)에서 두드리면 열리는데 구글에서는 안 열리는 곳이 많아,
 * 로컬에서 재현하면 엉뚱한 답을 얻습니다.
 *
 * 내보낼 수 있는 시트만 됩니다 (gas/wage.js 의 EXPORT_OK).
 * .env.local 의 APPS_SCRIPT_URL · EXPORT_KEY 를 씁니다.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const cfg = {};
fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/).forEach((l) => {
  const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/); if (m) cfg[m[1]] = m[2];
});

let seq = 0;
async function page(sheet, from, count) {
  const cb = '__potlab_cb_' + (++seq) + '_' + Date.now();
  const u = cfg.APPS_SCRIPT_URL + '?callback=' + cb + '&action=exportRows'
          + '&args=' + encodeURIComponent(JSON.stringify([cfg.EXPORT_KEY, sheet, from, count]))
          + '&t=' + Date.now();
  const txt = await (await fetch(u)).text();
  const m = txt.match(/^__potlab_cb_\d+_\d+\((.*)\);\s*$/s);
  if (!m) throw new Error('JSONP 가 아닙니다: ' + txt.slice(0, 400));
  const j = JSON.parse(m[1]);
  if (!j.ok) throw new Error(j.error);
  return j.data;
}

(async () => {
  const [sheet, 찾을말] = process.argv.slice(2);
  if (!sheet) { console.log('시트 이름을 주세요'); process.exit(1); }
  const first = await page(sheet, 0, 300);
  let rows = first.rows;
  while (rows.length < first.total) {
    const nx = await page(sheet, rows.length, 300);
    if (!nx.rows.length) break;
    rows = rows.concat(nx.rows);
  }
  console.log('시트 「' + sheet + '」 · ' + first.total + '줄');
  console.log('머리글 — ' + first.head.join(' | '));
  console.log('');
  const 볼것 = 찾을말 ? rows.filter((r) => r.join(' ').includes(찾을말)) : rows;
  if (찾을말) console.log('「' + 찾을말 + '」 이 든 줄 ' + 볼것.length + '개\n');
  볼것.forEach((r, i) => {
    console.log('━━ ' + (i + 1));
    first.head.forEach((h, k) => {
      const v = String(r[k] == null ? '' : r[k]);
      if (v !== '') console.log('   ' + String(h).padEnd(12) + v);
    });
  });
})().catch((e) => { console.error('실패: ' + e.message); process.exit(1); });
