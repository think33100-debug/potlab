/* 견본 자료 → reel.json 들 (2026-11-16)
   node tools/reels/make-sample.mjs <samples.json> <나갈폴더> [오늘 YYYY-MM-DD]
   samples.json 은 공고 줄 배열이고 줄마다 「기관」 칸에 기관 표 한 줄이 들어 있습니다 */
import fs from 'node:fs';
import path from 'node:path';
import { 릴스자료 } from './reel-data.mjs';

const [, , 입력, 폴더 = '.', 오늘] = process.argv;
const 줄들 = JSON.parse(fs.readFileSync(입력, 'utf8'));
fs.mkdirSync(폴더, { recursive: true });
for (const 줄 of 줄들) {
  const r = 릴스자료(줄, 줄.기관, { ...(오늘 ? { 오늘 } : {}), 사이트: 'rapojob.co.kr' });
  if (r.건너뜀) { console.log('건너뜀', 줄.id, r.건너뜀); continue; }
  const f = path.join(폴더, `${줄.id}.json`);
  fs.writeFileSync(f, JSON.stringify(r, null, 2));
  console.log('자료', f, '·', r.기관, r.직군, r.마감.큰글);
}
