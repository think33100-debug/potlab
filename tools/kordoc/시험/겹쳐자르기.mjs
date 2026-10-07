/* 그림을 **겹치게** 자릅니다 (2026-10-07 세중님 지시).
   겹침 없이 자르면 경계에 걸린 표 줄이 양쪽에서 반쪽씩 보여 빠질 수 있습니다. */
import fs from 'node:fs';
import sharp from 'sharp';
const 원본 = process.argv[2];
const 이름앞 = process.argv[3] || 'x';
const 겹침 = Number(process.argv[4] || 200);
const 최대 = 1568;                       // Standard 등급의 긴 변 한도
const m = await sharp(원본).metadata();
const 걸음 = 최대 - 겹침;                 // 1368px 씩 내려가며 1568px 씩 집습니다
console.log('원본 ' + m.width + 'x' + m.height + ' · ' + fs.statSync(원본).size + '바이트 · 겹침 ' + 겹침 + 'px');
let i = 0, 합 = 0;
for (let top = 0; top < m.height; top += 걸음) {
  const h = Math.min(최대, m.height - top);
  if (h < 60) break;
  i++;
  const 파일 = '받은첨부/' + 이름앞 + '_' + i + '.jpg';
  await sharp(원본).extract({ left: 0, top, width: m.width, height: h }).jpeg({ quality: 92 }).toFile(파일);
  const 토큰 = Math.ceil(m.width / 28) * Math.ceil(h / 28);
  합 += 토큰;
  console.log('  토막' + i + '  ' + top + '~' + (top + h - 1) + 'px (' + m.width + 'x' + h + ') · '
    + fs.statSync(파일).size + '바이트 · 시각토큰 ' + 토큰);
  if (top + h >= m.height) break;
}
console.log('토막 ' + i + '개 · 시각토큰 합 ' + 합);
